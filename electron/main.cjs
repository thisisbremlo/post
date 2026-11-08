const {
  app,
  BaseWindow,
  Menu,
  WebContentsView,
  clipboard,
  ipcMain,
  session,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const {
  ElectronBlocker,
  adsLists,
  adsAndTrackingLists,
  fullLists,
} = require("@ghostery/adblocker-electron");
const loadTrackerDB = require("@ghostery/trackerdb").default;
const isDev = !app.isPackaged;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
const PARTITION = "persist:scaffold";
const ADBLOCK_TTL = 7 * 24 * 60 * 60 * 1000;
const ADBLOCK_TIMEOUT = 45_000;

/** Internal pages are drawn by the chrome; a native view would paint over them. */
const isInternalUrl = (url) => typeof url === "string" && url.startsWith("scaffold://");

/** @type {BaseWindow | null} */
let win = null;
/** @type {WebContentsView | null} */
let chromeView = null;
/** @type {Map<string, { view: WebContentsView, url: string }>} */
const pageViews = new Map();
/** @type {WebContentsView | null} */
let referenceView = null;
let referenceUrl = null;
/** @type {object | null} */
let lastLayout = null;
let overlayOpen = false;
/** Page preferences the chrome keeps in its settings. */
const pagePrefs = { zoom: 100, doNotTrack: false };

/* -------------------------------------------------------------- page views */

function notify(payload) {
  chromeView?.webContents.send("scaffold:view-event", payload);
}

function applyPageZoom(contents) {
  if (!contents || contents.isDestroyed()) return;
  contents.setZoomFactor(pagePrefs.zoom / 100);
}

function bindView(view, tabId) {
  const contents = view.webContents;
  applyPageZoom(contents);

  contents.setWindowOpenHandler(({ url }) => {
    // A link that wants a new window becomes a tab instead; nothing escapes.
    if (/^https?:/i.test(url)) notify({ kind: "open", url });
    else if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("did-start-loading", () => notify({ kind: "loading", tabId, loading: true }));
  contents.on("did-stop-loading", () => notify({ kind: "loading", tabId, loading: false }));
  contents.on("page-title-updated", (_event, title) => notify({ kind: "title", tabId, title }));
  // The page's own icon, so a tab is recognised before its title is read.
  contents.on("page-favicon-updated", (_event, favicons) => {
    const icon = favicons.find((item) => /^(https?:|data:image\/)/i.test(item)) ?? null;
    notify({ kind: "favicon", tabId, url: icon });
  });

  contents.on("did-navigate", (_event, url) => {
    const entry = pageViews.get(tabId);
    if (entry) entry.url = url;
    notify({ kind: "url", tabId, url });
  });

  contents.on("did-navigate-in-page", (_event, url) => {
    const entry = pageViews.get(tabId);
    if (entry) entry.url = url;
    notify({ kind: "url", tabId, url });
  });

  /*
   * A native view paints above the chrome, so a page's right click has to be a
   * native menu. Everything it can keep goes back to the chrome, which owns the
   * shelf; the selection and the media never enter this process's UI.
   */
  contents.on("context-menu", (_event, params) => {
    if (!win) return;
    const pageUrl = contents.getURL();
    const pageTitle = contents.getTitle() || pageUrl;
    const template = [];

    if (params.selectionText && params.selectionText.trim()) {
      template.push({
        label: "Keep the selection on the shelf",
        click: () =>
          notify({
            kind: "context-keep",
            tabId,
            url: pageUrl,
            title: pageTitle,
            note: params.selectionText.trim(),
          }),
      });
    }

    if (params.srcURL && ["image", "video", "audio"].includes(params.mediaType)) {
      let name = params.mediaType;
      try {
        name =
          decodeURIComponent(
            new URL(params.srcURL).pathname.split("/").filter(Boolean).pop() || params.mediaType,
          );
      } catch {
        /* a data: URL has no name worth having */
      }
      template.push({
        label: `Keep this ${params.mediaType} on the shelf`,
        click: () =>
          notify({
            kind: "context-keep",
            tabId,
            url: params.srcURL,
            title: name,
            note: `from ${pageTitle}`,
          }),
      });
    }

    if (params.linkURL && /^https?:/i.test(params.linkURL)) {
      template.push({
        label: "Keep this link on the shelf",
        click: () =>
          notify({
            kind: "context-keep",
            tabId,
            url: params.linkURL,
            title: params.linkURL,
            note: `found on ${pageTitle}`,
          }),
      });
    }

    if (template.length > 0) template.push({ type: "separator" });

    template.push({
      label: "Keep this page on the shelf",
      click: () => {
        if (tabId === "reference") {
          notify({ kind: "context-keep", tabId, url: pageUrl, title: pageTitle, note: "" });
        } else {
          notify({ kind: "keep-request", tabId });
        }
      },
    });

    template.push({ type: "separator" });
    template.push({ label: "Copy address", click: () => clipboard.writeText(pageUrl) });
    template.push({
      label: "Hold as reference",
      click: () => notify({ kind: "hold", url: pageUrl, title: pageTitle }),
    });

    Menu.buildFromTemplate(template).popup();
  });

  // Post sends a plain Chrome user agent; sites treat Electron differently.
  contents.setUserAgent(
    contents
      .getUserAgent()
      .replace(/ Electron\/[\d.]+/, "")
      .replace(/ Post\/[\d.]+/, ""),
  );
}

/* ------------------------------------------------------------------- menu */

function sendCommand(command) {
  chromeView?.webContents.send("scaffold:command", command);
}

/** A browser's menu, not an app's: every item is a thing the chrome already does. */
function applyMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    ...(isMac ? [] : [{ role: "fileMenu" }]),
    {
      label: "File",
      submenu: [
        { label: "New Tab", accelerator: "CmdOrCtrl+T", click: () => sendCommand("new-tab") },
        { label: "Close Tab", accelerator: "CmdOrCtrl+W", click: () => sendCommand("close-tab") },
        { type: "separator" },
        { label: "Keep This Page", accelerator: "CmdOrCtrl+D", click: () => sendCommand("keep") },
        { label: "Open the Shelf", click: () => sendCommand("shelf") },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Address Bar", accelerator: "CmdOrCtrl+L", click: () => sendCommand("address") },
        { label: "Catalogue", accelerator: "CmdOrCtrl+K", click: () => sendCommand("palette") },
        { type: "separator" },
        { label: "Back", accelerator: "CmdOrCtrl+[", click: () => sendCommand("back") },
        { label: "Forward", accelerator: "CmdOrCtrl+]", click: () => sendCommand("forward") },
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => sendCommand("reload") },
        {
          label: "Hold as Reference",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => sendCommand("reference"),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
    {
      label: "Help",
      submenu: [
        { label: "Check for Updates", click: () => checkForUpdates() },
        { label: "Post on GitHub", click: () => shell.openExternal("https://github.com/thisisbremlo/post") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------------------------------------------------------- updates */

// The commit Atom feed has no rate limit and no CORS, which is why the shell
// reads it: the packaged app can look at a public repo with no token at all.
const UPDATE_ATOM = "https://github.com/thisisbremlo/post/commits/main.atom";
const UPDATE_FEED = "https://raw.githubusercontent.com/thisisbremlo/post/main/update.json";

const quiet = (promise) => promise.catch(() => null);

/**
 * What main is right now, and what the repo says about it. The chrome compares
 * that with the version and commit baked into the running build.
 */
async function checkForUpdates() {
  try {
    const [atom, feed] = await Promise.all([
      quiet(fetch(UPDATE_ATOM).then((response) => (response.ok ? response.text() : ""))),
      quiet(
        fetch(UPDATE_FEED, { cache: "no-store" }).then((response) =>
          response.ok ? response.json() : null,
        ),
      ),
    ]);

    const decode = (text) =>
      text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");

    // Every entry is a changelog line: the commit subjects, newest first.
    const entries = [...(atom ?? "").matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .slice(0, 8)
      .map((match) => {
        const block = match[1];
        return {
          sha: block.match(/Commit\/([0-9a-f]{40})/)?.[1] ?? "",
          title: decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
            .replace(/\s+/g, " ")
            .trim(),
          date: block.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "",
        };
      })
      .filter((entry) => entry.sha || entry.title);

    const sha = entries[0]?.sha ?? "";
    const version = feed?.version ?? "";
    if (!sha && !version) return;

    chromeView?.webContents.send("scaffold:update", {
      sha,
      version,
      notes: feed?.notes ?? "",
      entries,
    });
  } catch {
    /* offline, blocked or rate limited: silently nothing new */
  }
}

function attachPreload(view, tabId) {
  view.webContents.on("dom-ready", () => undefined);
  bindView(view, tabId);
}

function ensurePageView(tabId) {
  const existing = pageViews.get(tabId);
  if (existing) return existing;

  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  attachPreload(view, tabId);
  win.contentView.addChildView(view);
  const entry = { view, url: "" };
  pageViews.set(tabId, entry);
  return entry;
}

function ensureReferenceView() {
  if (referenceView) return referenceView;
  referenceView = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  bindView(referenceView, "reference");
  win.contentView.addChildView(referenceView);
  return referenceView;
}

function referenceless() {
  for (const { view } of pageViews.values()) view.setVisible(false);
  referenceView?.setVisible(false);
}

function boundsOf(rect) {
  if (!win) return { x: 0, y: 0, width: 0, height: 0 };
  const [width, height] = win.getContentSize();
  const x = Math.max(0, Math.min(Math.round(rect.x), width));
  const y = Math.max(0, Math.min(Math.round(rect.y), height));
  return {
    x,
    y,
    width: Math.max(0, Math.min(Math.round(rect.width), width - x)),
    height: Math.max(0, Math.min(Math.round(rect.height), height - y)),
  };
}

/**
 * The chrome owns the layout and sends it here; the shell reconciles views.
 * Overlays hide the views, because a native view paints above the web page.
 */
function applyLayout(layout) {
  if (!win) return;
  lastLayout = layout;
  // The blocker follows the page in front, so a paused site is the exception
  // only while it is the one being read.
  setAdblockHost(layout.activeTab?.url ?? "");
  if (overlayOpen) return;

  const active = layout.activeTab && !isInternalUrl(layout.activeTab.url) ? layout.activeTab : null;
  for (const [tabId, entry] of pageViews) {
    if (!active || tabId !== active.id) entry.view.setVisible(false);
  }

  if (active) {
    const entry = ensurePageView(active.id);
    entry.view.setVisible(true);
    entry.view.setBounds(boundsOf(active.rect));
    if (entry.url !== active.url) {
      entry.url = active.url;
      entry.view.webContents.loadURL(active.url).catch(() => undefined);
    }
  }

  const reference =
    layout.reference && !isInternalUrl(layout.reference.url) ? layout.reference : null;
  if (reference) {
    const view = ensureReferenceView();
    view.setVisible(true);
    view.setBounds(boundsOf(reference.rect));
    if (referenceUrl !== reference.url) {
      referenceUrl = reference.url;
      view.webContents.loadURL(reference.url).catch(() => undefined);
    }
  } else if (referenceView) {
    referenceView.setVisible(false);
    win.contentView.removeChildView(referenceView);
    const contents = referenceView.webContents;
    if (!contents.isDestroyed()) {
      contents.setAudioMuted(true);
      contents.stop();
      contents.close();
    }
    referenceView = null;
    referenceUrl = null;
  }
}

/**
 * A raised chrome receives the wheel, but the site underneath should still
 * scroll. Re-emit the gesture in the active page's view, in its own coordinates.
 */
function scrollActivePage(payload) {
  if (!overlayOpen || !lastLayout?.activeTab) return;
  const active = lastLayout.activeTab;
  if (isInternalUrl(active.url)) return;
  const entry = pageViews.get(active.id);
  if (!entry || entry.view.webContents.isDestroyed()) return;

  const bounds = boundsOf(active.rect);
  if (bounds.width <= 0 || bounds.height <= 0) return;

  const requestedX = Number(payload?.x);
  const requestedY = Number(payload?.y);
  const screenX = Number.isFinite(requestedX) ? requestedX : bounds.x + bounds.width / 2;
  const screenY = Number.isFinite(requestedY) ? requestedY : bounds.y + bounds.height / 2;
  const wheelDelta = (value) => {
    const delta = Number(value);
    if (!Number.isFinite(delta)) return 0;
    return Math.max(-2400, Math.min(2400, Math.round(delta)));
  };

  // WebMouseWheelEvent deltas run positive up and left: the reverse of a DOM
  // WheelEvent. The units are pixels, matching the browser's pixel deltas.
  const deltaX = -wheelDelta(payload?.deltaX);
  const deltaY = -wheelDelta(payload?.deltaY);
  if (deltaX === 0 && deltaY === 0) return;

  entry.view.webContents.sendInputEvent({
    type: "mouseWheel",
    x: Math.max(0, Math.min(bounds.width - 1, Math.round(screenX - bounds.x))),
    y: Math.max(0, Math.min(bounds.height - 1, Math.round(screenY - bounds.y))),
    deltaX,
    deltaY,
    hasPreciseScrollingDeltas: true,
    canScroll: true,
  });
}

function destroyTab(tabId) {
  const entry = pageViews.get(tabId);
  if (!entry) return;
  entry.view.setVisible(false);
  win?.contentView.removeChildView(entry.view);
  const contents = entry.view.webContents;
  if (!contents.isDestroyed()) {
    // A page closed by the tab's X must not keep a video or a call audible.
    contents.setAudioMuted(true);
    contents.stop();
    contents.close();
  }
  pageViews.delete(tabId);
}

/* --------------------------------------------------------------- adblocker */

/** The three groups the Ghostery panel exposes as separate switches. */
const ADBLOCK_TRACKING_LISTS = adsAndTrackingLists.filter((url) => !adsLists.includes(url));
const ADBLOCK_CONSENT_LISTS = fullLists.filter((url) => !adsAndTrackingLists.includes(url));

/** The six rows in the observed-activities card, in Ghostery's own colours. */
const ADBLOCK_GROUPS = [
  { key: "advertising", label: "Advertising", color: "#cb55cd" },
  { key: "site_analytics", label: "Site Analytics", color: "#87d7ef" },
  { key: "consent", label: "Consent Management", color: "#556fcd" },
  { key: "utilities", label: "Essential", color: "#fc9734" },
  { key: "customer_interaction", label: "Customer Interaction", color: "#ef671e" },
  { key: "other", label: "Other", color: "#c7c9d1" },
];

function adblockGroupOf(key) {
  if (key === "essential") return "utilities";
  if (key === "consent_management") return "consent";
  return ADBLOCK_GROUPS.some((group) => group.key === key) ? key : "other";
}

const adblockCachePath = () => path.join(app.getPath("userData"), "adblocker-v2.bin");

/** A stale cache stays usable until the new lists arrive. */
function adblockCacheAge() {
  try {
    return Date.now() - fs.statSync(adblockCachePath()).mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function readAdblockCache() {
  const file = adblockCachePath();
  try {
    const age = adblockCacheAge();
    return {
      blocker: ElectronBlocker.deserialize(fs.readFileSync(file)),
      fresh: age < ADBLOCK_TTL,
      updatedAt: Number.isFinite(age) ? Date.now() - age : null,
    };
  } catch {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* a cache that cannot be removed is fetched over next launch */
    }
    return null;
  }
}

/** @type {import("@ghostery/adblocker-electron").ElectronBlocker | null} */
let adblocker = null;
/** @type {Promise<void> | null} */
let adblockRefresh = null;
let adblockEnabled = true;
let adblockAds = true;
let adblockTracking = true;
let adblockConsent = true;
let adblockRefreshing = false;
/** @type {Set<string>} */
let adblockAllowed = new Set();
let adblockBlocking = false;
let adblockBlocked = 0;
let adblockActiveHost = "";
/** @type {Map<string, { blocked: number, observed: number, categories: Map<string, number> }>} */
const adblockStats = new Map();
/** @type {{ matchUrl: (request: object, options?: object) => Array<{ category?: { key?: string } }> } | null} */
let adblockTrackerDB = null;
/** @type {Promise<unknown> | null} */
let adblockTrackerDBLoading = null;
/** @type {string[]} */
let adblockLists = [];
/** @type {number | null} */
let adblockUpdatedAt = null;
/** @type {string | null} */
let adblockError = null;
/** @type {NodeJS.Timeout | null} */
let adblockSendTimer = null;

const adblockConfigPath = () => path.join(app.getPath("userData"), "adblock.json");

function loadAdblockConfig() {
  try {
    const stored = JSON.parse(fs.readFileSync(adblockConfigPath(), "utf8"));
    const legacy = stored?.enabled !== false;
    adblockAds = typeof stored?.ads === "boolean" ? stored.ads : legacy;
    adblockTracking = typeof stored?.tracking === "boolean" ? stored.tracking : legacy;
    adblockConsent = typeof stored?.consent === "boolean" ? stored.consent : legacy;
    adblockEnabled = adblockAds || adblockTracking || adblockConsent;
    adblockAllowed = new Set(
      Array.isArray(stored?.allow)
        ? stored.allow
            .filter((host) => typeof host === "string" && host.trim())
            .map((host) => host.trim().toLowerCase())
        : [],
    );
    adblockLists = Array.isArray(stored?.lists)
      ? stored.lists.map(normalizeListUrl).filter(Boolean).slice(0, 12)
      : [];
  } catch {
    adblockAds = true;
    adblockTracking = true;
    adblockConsent = true;
    adblockEnabled = true;
    adblockAllowed = new Set();
    adblockLists = [];
  }
}

function saveAdblockConfig() {
  try {
    fs.writeFileSync(
      adblockConfigPath(),
      JSON.stringify(
        {
          enabled: adblockEnabled,
          ads: adblockAds,
          tracking: adblockTracking,
          consent: adblockConsent,
          allow: [...adblockAllowed],
          lists: adblockLists,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.warn("adblocker: could not save preferences:", error.message);
  }
}

/** The current site's six activity rows. Unknown trackers land in Other. */
function adblockCategoriesFor(host) {
  const stats = host ? adblockStats.get(host) : null;
  return ADBLOCK_GROUPS.map((group) => ({
    ...group,
    count: stats?.categories.get(group.key) ?? 0,
  }));
}

function adblockStatsFor(host) {
  let stats = adblockStats.get(host);
  if (!stats) {
    stats = { blocked: 0, observed: 0, categories: new Map() };
    adblockStats.set(host, stats);
  }
  return stats;
}

/** Which site a blocked subresource belongs to, even when it is not in front. */
function adblockHostFor(request) {
  // A tab's own address keeps iframes and subresources on one page total.
  for (const entry of pageViews.values()) {
    if (entry.view.webContents.id === request.tabId) return hostOf(entry.url);
  }
  const source = hostOf(request.sourceUrl || "");
  if (source) return source;
  return adblockActiveHost;
}

function adblockCategoryFor(request, host) {
  if (!adblockTrackerDB) return null;
  try {
    const details = { url: request.url, type: request.type || "other" };
    if (request.sourceUrl) details.sourceUrl = request.sourceUrl;
    else if (host) details.sourceUrl = `https://${host}/`;
    const category = adblockTrackerDB.matchUrl(details, { getDomainMetadata: true })[0]?.category;
    return category
      ? { key: adblockGroupOf(category.key), matched: true }
      : { key: "other", matched: false };
  } catch {
    return null;
  }
}

/** Load Ghostery's open TrackerDB once, next to the filter engine. */
function loadAdblockTrackerDB() {
  if (adblockTrackerDB) return Promise.resolve(adblockTrackerDB);
  if (adblockTrackerDBLoading) return adblockTrackerDBLoading;
  adblockTrackerDBLoading = (async () => {
    try {
      const file = path.join(
        path.dirname(require.resolve("@ghostery/trackerdb")),
        "..",
        "trackerdb.engine",
      );
      adblockTrackerDB = await loadTrackerDB(fs.readFileSync(file));
      sendAdblock(true);
    } catch (error) {
      console.warn("adblocker: could not load tracker categories:", error.message);
    } finally {
      adblockTrackerDBLoading = null;
    }
    return adblockTrackerDB;
  })();
  return adblockTrackerDBLoading;
}

/** The hostname as people read it, without the www every site carries anyway. */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeListUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function adblockState() {
  const stats = adblockActiveHost ? adblockStats.get(adblockActiveHost) : null;
  return {
    enabled: adblockEnabled,
    ads: adblockAds,
    tracking: adblockTracking,
    consent: adblockConsent,
    blocked: adblockBlocked,
    siteBlocked: stats?.blocked ?? 0,
    categories: adblockCategoriesFor(adblockActiveHost),
    updatedAt: adblockUpdatedAt,
    allow: [...adblockAllowed].sort(),
    lists: [...adblockLists],
    activeHost: adblockActiveHost,
    paused: Boolean(adblockActiveHost) && adblockAllowed.has(adblockActiveHost),
    ready: adblocker !== null,
    refreshing: adblockRefreshing,
    error: adblockError,
  };
}

function sendAdblock(immediate = false) {
  const send = () => {
    adblockSendTimer = null;
    if (!chromeView || chromeView.webContents.isDestroyed()) return;
    chromeView.webContents.send("scaffold:adblock", adblockState());
  };
  if (immediate) {
    if (adblockSendTimer) clearTimeout(adblockSendTimer);
    send();
    return;
  }
  if (adblockSendTimer) return;
  adblockSendTimer = setTimeout(send, 250);
  adblockSendTimer.unref?.();
}

function attachAdblockEvents(blocker) {
  blocker.on("request-blocked", (request) => {
    adblockBlocked += 1;
    const host = adblockHostFor(request);
    if (host) {
      const stats = adblockStatsFor(host);
      stats.blocked += 1;
      stats.observed += 1;
      const category = adblockCategoryFor(request, host);
      const key = category?.key ?? "other";
      stats.categories.set(key, (stats.categories.get(key) || 0) + 1);
    }
    sendAdblock();
  });

  // Ghostery shows trackers it saw and allowed too, not only the ones it stopped.
  blocker.on("request-allowed", (request) => {
    const host = adblockHostFor(request);
    const category = adblockCategoryFor(request, host);
    if (!host || !category?.matched) return;
    const stats = adblockStatsFor(host);
    stats.observed += 1;
    stats.categories.set(category.key, (stats.categories.get(category.key) || 0) + 1);
    sendAdblock();
  });
}

/** One place decides whether the current host is under the blocker. */
function syncAdblock() {
  if (!adblocker) return;
  const target = session.fromPartition(PARTITION);
  const shouldBlock =
    adblockEnabled && (!adblockActiveHost || !adblockAllowed.has(adblockActiveHost));
  if (shouldBlock === adblockBlocking) return;
  try {
    if (shouldBlock) {
      adblocker.enableBlockingInSession(target);
      adblockBlocking = true;
    } else {
      adblocker.disableBlockingInSession(target);
      adblockBlocking = false;
    }
    adblockError = null;
  } catch (error) {
    adblockError = error.message;
    console.warn("adblocker: could not change state:", error.message);
  }
  sendAdblock(true);
}

function setAdblockHost(url) {
  const host = hostOf(url);
  if (host === adblockActiveHost) return;
  adblockActiveHost = host;
  syncAdblock();
  // A switch between two allowed sites changes no blocking state, but the
  // chrome still needs the new hostname for its paused label.
  sendAdblock(true);
  if (adblockEnabled && !adblocker) void refreshAdblocker();
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("list download timed out")), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function refreshAdblocker(force = false) {
  if (adblockRefresh) {
    await adblockRefresh;
    if (!force) return;
    return refreshAdblocker(true);
  }
  if (!force && adblocker && adblockCacheAge() < ADBLOCK_TTL) return;

  adblockRefresh = (async () => {
    let extraError = null;
    adblockRefreshing = true;
    sendAdblock(true);
    try {
      const baseLists = [
        ...(adblockAds ? adsLists : []),
        ...(adblockTracking ? ADBLOCK_TRACKING_LISTS : []),
        ...(adblockConsent ? ADBLOCK_CONSENT_LISTS : []),
      ];
      if (baseLists.length === 0) {
        const target = session.fromPartition(PARTITION);
        if (adblockBlocking && adblocker) {
          try {
            adblocker.disableBlockingInSession(target);
          } catch {
            /* nothing is being blocked once every group is off */
          }
        }
        adblockBlocking = false;
        adblockError = null;
        return;
      }

      let blocker = await withTimeout(ElectronBlocker.fromLists(fetch, baseLists), ADBLOCK_TIMEOUT);
      if (adblockLists.length > 0) {
        try {
          const extra = await withTimeout(
            ElectronBlocker.fromLists(fetch, adblockLists),
            ADBLOCK_TIMEOUT,
          );
          blocker = ElectronBlocker.merge([blocker, extra]);
        } catch (error) {
          // A broken personal list must never take the built-in lists down.
          extraError = `extra list: ${error.message}`;
          console.warn("adblocker: could not load an extra list:", error.message);
        }
      }
      const target = session.fromPartition(PARTITION);
      if (adblockBlocking && adblocker) {
        try {
          adblocker.disableBlockingInSession(target);
        } catch {
          /* the replacement below is what matters */
        }
      }
      adblockBlocking = false;
      adblocker = blocker;
      attachAdblockEvents(blocker);

      const file = adblockCachePath();
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, blocker.serialize());
      try {
        fs.renameSync(temporary, file);
      } catch {
        // Windows cannot always replace an existing file with rename.
        fs.copyFileSync(temporary, file);
        fs.rmSync(temporary, { force: true });
      }
      adblockUpdatedAt = Date.now();
      adblockError = extraError;
      syncAdblock();
    } catch (error) {
      adblockError = error.message;
      console.warn("adblocker: could not update the lists:", error.message);
    } finally {
      adblockRefreshing = false;
      adblockRefresh = null;
      sendAdblock(true);
    }
  })();

  return adblockRefresh;
}

function startAdblocker() {
  loadAdblockConfig();
  void loadAdblockTrackerDB();
  const cached = readAdblockCache();
  if (cached) {
    adblocker = cached.blocker;
    attachAdblockEvents(cached.blocker);
    adblockUpdatedAt = cached.updatedAt;
  }
  syncAdblock();

  if (adblockEnabled && (!cached || !cached.fresh)) void refreshAdblocker();

  // Lists are weekly; a long-running window checks again every six hours.
  setInterval(() => {
    if (adblockEnabled && adblockCacheAge() >= ADBLOCK_TTL) void refreshAdblocker();
  }, 6 * 60 * 60 * 1000).unref();
}

/* ------------------------------------------------------------------- shell */

function createWindow() {
  win = new BaseWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#f6f2ea",
    title: "Post",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
  });

  chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });
  win.contentView.addChildView(chromeView);
  // The chrome paints its own paper; transparency is only used while a menu is
  // floating, when its stage steps aside and lets the page show through.
  chromeView.setBackgroundColor("#00000000");

  const fitChrome = () => {
    if (!win || !chromeView) return;
    const [width, height] = win.getContentSize();
    chromeView.setBounds({ x: 0, y: 0, width, height });
    if (lastLayout) applyLayout(lastLayout);
  };

  fitChrome();
  win.on("resize", fitChrome);

  chromeView.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) notify({ kind: "open", url });
    return { action: "deny" };
  });

  // Only `desktop:dev` points at the harness; `desktop` loads the built chrome,
  // which is the shipping shape. Both run unpackaged, so isDev cannot decide.
  if (process.env.VITE_DEV_SERVER_URL) {
    chromeView.webContents.loadURL(DEV_URL);
  } else {
    chromeView.webContents.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.on("closed", () => {
    win = null;
    chromeView = null;
    referenceView = null;
    pageViews.clear();
  });
}

app.whenReady().then(async () => {
  // Deny by default: camera, microphone, location, notifications.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.fromPartition(PARTITION).setPermissionCheckHandler(() => false);

  // Do Not Track is a header on every page request, not a promise in the UI.
  session.fromPartition(PARTITION).webRequest.onBeforeSendHeaders((details, callback) => {
    if (pagePrefs.doNotTrack) details.requestHeaders.DNT = "1";
    callback({ requestHeaders: details.requestHeaders });
  });

  // A browser saves what you download, to the folder the OS calls Downloads.
  session.fromPartition(PARTITION).on("will-download", (_event, item) => {
    notify({ kind: "download", title: item.getFilename() });
  });

  try {
    startAdblocker();
  } catch (error) {
    console.warn("adblocker: could not start:", error.message);
  }
  applyMenu();
  createWindow();

  setTimeout(checkForUpdates, 5000);
  // Every half hour, plus once whenever the window comes back to the front.
  setInterval(checkForUpdates, 30 * 60 * 1000);

  app.on("activate", () => {
    if (!BaseWindow.getAllWindows().length) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* --------------------------------------------------------------------- ipc */

ipcMain.on("scaffold:check-updates", () => checkForUpdates());

ipcMain.on("scaffold:preferences", (_event, preferences) => {
  const zoom = Number(preferences?.zoom);
  pagePrefs.zoom = Number.isFinite(zoom) ? Math.min(200, Math.max(50, zoom)) : 100;
  pagePrefs.doNotTrack = Boolean(preferences?.doNotTrack);
  for (const entry of pageViews.values()) applyPageZoom(entry.view.webContents);
  if (referenceView) applyPageZoom(referenceView.webContents);
});

ipcMain.on("scaffold:open-downloads", () => {
  shell.openPath(app.getPath("downloads"));
});

ipcMain.on("scaffold:sync-layout", (_event, layout) => applyLayout(layout));

ipcMain.on("scaffold:scroll-page", (_event, payload) => scrollActivePage(payload));

ipcMain.on("scaffold:overlay", (_event, open) => {
  const next = Boolean(open);
  if (next === overlayOpen) return;
  overlayOpen = next;
  if (!win || !chromeView) return;

  if (overlayOpen) {
    // Raise the chrome over the page instead of hiding the page. The chrome's
    // stage turns transparent, so the site stays visible behind the menu.
    win.contentView.addChildView(chromeView);
    return;
  }

  // Adding a view again brings it to the front, above the raised chrome.
  for (const { view } of pageViews.values()) win.contentView.addChildView(view);
  if (referenceView) win.contentView.addChildView(referenceView);
  if (lastLayout) applyLayout(lastLayout);
});

ipcMain.on("scaffold:navigate", (_event, { tabId, url }) => {
  const entry = ensurePageView(tabId);
  entry.url = url;
  entry.view.webContents.loadURL(url).catch(() => undefined);
});

/*
 * What a page says about itself, read inside its own view. The chrome cannot
 * see the page's DOM, so this is the one place metadata can come from; it is a
 * read, never an injection, and a page that refuses returns null.
 */
const META_SCRIPT = `(() => {
  const clean = (value) => (value || "").trim();
  const metas = Array.from(document.querySelectorAll("meta")).map((node) => ({
    key: node.getAttribute("property") || node.getAttribute("name") || node.getAttribute("itemprop") || "",
    content: clean(node.getAttribute("content")),
  })).filter((entry) => entry.key && entry.content);
  const links = Array.from(document.querySelectorAll("link[rel]")).map((node) => ({
    rel: Array.from(node.relList || []).map((value) => value.toLowerCase()).join(" "),
    href: node.href || "",
  })).filter((entry) => entry.href);
  const find = (key) => metas.find((entry) => entry.key.toLowerCase() === key)?.content || "";
  const openGraph = {};
  const twitter = {};
  for (const entry of metas) {
    const key = entry.key.toLowerCase();
    if (key.startsWith("og:")) openGraph[key.slice(3)] = entry.content;
    else if (key.startsWith("twitter:")) twitter[key.slice(8)] = entry.content;
  }
  const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((node) => { try { return JSON.parse(node.textContent || "null"); } catch { return null; } })
    .filter(Boolean);
  return {
    title: clean(document.title),
    description: find("description"),
    canonical: links.find((entry) => entry.rel.split(" ").includes("canonical"))?.href || "",
    lang: document.documentElement.lang || "",
    themeColor: find("theme-color"),
    openGraph,
    twitter,
    jsonLd,
    metas,
    links,
  };
})()`;

ipcMain.handle("scaffold:read-page-meta", async (_event, { tabId } = {}) => {
  const entry = pageViews.get(tabId);
  if (!entry || entry.view.webContents.isDestroyed()) return null;
  try {
    return await entry.view.webContents.executeJavaScript(META_SCRIPT, true);
  } catch {
    return null;
  }
});

/*
 * Reader mode is a reading surface, not a second browser: take the article's
 * own words, leave the navigation and the furniture behind.
 */
const READER_SCRIPT = `(() => {
  const root = document.querySelector("article, main, [role='main']") || document.body;
  if (!root) return null;
  const clone = root.cloneNode(true);
  clone.querySelectorAll("script, style, noscript, nav, header, footer, aside, form, iframe, svg, button, input, select, textarea").forEach((node) => node.remove());
  const raw = clone.innerText || clone.textContent || "";
  const text = raw
    .replace(/[ \\t]+/g, " ")
    .replace(/\\n[ \\t]*\\n[ \\t]*\\n+/g, "\\n\\n")
    .trim();
  return { title: document.title || "", url: location.href, text: text.slice(0, 60000) };
})()`;

ipcMain.handle("scaffold:read-article", async (_event, { tabId } = {}) => {
  const contents =
    tabId === "reference"
      ? referenceView?.webContents
      : pageViews.get(tabId)?.view.webContents;
  if (!contents || contents.isDestroyed()) return null;
  try {
    return await contents.executeJavaScript(READER_SCRIPT, true);
  } catch {
    return null;
  }
});

ipcMain.handle("scaffold:adblock-state", () => adblockState());

ipcMain.handle("scaffold:adblock-enabled", (_event, { enabled } = {}) => {
  const on = enabled !== false;
  adblockAds = on;
  adblockTracking = on;
  adblockConsent = on;
  adblockEnabled = on;
  saveAdblockConfig();
  syncAdblock();
  if (on) void refreshAdblocker(true);
  return adblockState();
});

ipcMain.handle("scaffold:adblock-feature", (_event, { feature, enabled } = {}) => {
  if (feature !== "ads" && feature !== "tracking" && feature !== "consent") {
    return adblockState();
  }
  const on = enabled !== false;
  if (feature === "ads") adblockAds = on;
  if (feature === "tracking") adblockTracking = on;
  if (feature === "consent") adblockConsent = on;
  adblockEnabled = adblockAds || adblockTracking || adblockConsent;
  saveAdblockConfig();
  syncAdblock();
  if (adblockEnabled) void refreshAdblocker(true);
  return adblockState();
});

ipcMain.handle("scaffold:adblock-site", (_event, { host, allowed } = {}) => {
  const key = hostOf(`https://${String(host ?? "")}`);
  if (key) {
    if (allowed) adblockAllowed.add(key);
    else adblockAllowed.delete(key);
    saveAdblockConfig();
    syncAdblock();
  }
  return adblockState();
});

ipcMain.handle("scaffold:adblock-lists", async (_event, { lists } = {}) => {
  const clean = Array.isArray(lists)
    ? lists
        .map(normalizeListUrl)
        .filter(Boolean)
        .slice(0, 12)
    : [];
  adblockLists = [...new Set(clean)];
  saveAdblockConfig();
  await refreshAdblocker(true);
  return adblockState();
});

ipcMain.handle("scaffold:adblock-refresh", async () => {
  await refreshAdblocker(true);
  return adblockState();
});

ipcMain.on("scaffold:relaunch", () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.on("scaffold:close-tab", (_event, { tabId }) => destroyTab(tabId));

ipcMain.on("scaffold:view-action", (_event, { tabId, action }) => {
  const entry = pageViews.get(tabId);
  if (!entry) return;
  const contents = entry.view.webContents;
  if (action === "back" && contents.canGoBack()) contents.goBack();
  if (action === "forward" && contents.canGoForward()) contents.goForward();
  if (action === "reload") contents.reload();
});

/* --------------------------------------------------------- install an update */

/**
 * Packaging bakes the checkout that produced this app (scripts/bake-checkout.mjs),
 * which is what lets a packaged copy pull, rebuild and replace itself instead of
 * asking its owner to run three commands by hand. A clone without that file, or
 * a build that was never packaged, gets the manual route.
 */
let checkoutPath = "";
try {
  const baked = JSON.parse(fs.readFileSync(path.join(__dirname, "checkout.json"), "utf8"));
  if (typeof baked.path === "string") checkoutPath = baked.path;
} catch {
  /* not packaged from a checkout */
}

// Running the source directly: the current folder is the checkout.
if (!app.isPackaged && !checkoutPath) checkoutPath = process.cwd();

/** Why a bundle cannot replace itself, in words a person can act on. */
function bundleProblem(bundle) {
  if (bundle.includes("/AppTranslocation/")) {
    return "Post is running from a downloaded image. Move it to Applications, then update.";
  }
  if (bundle.startsWith("/Volumes/")) {
    return "Post is running from its disk image. Move it to Applications, then update.";
  }
  try {
    fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
  } catch {
    return "Post's folder is not writable. Move it to Applications, then update.";
  }
  return "";
}

const installedBundle = () => {
  if (!app.isPackaged) return "";
  const bundle = path.resolve(app.getAppPath(), "..", "..", "..");
  return bundle.endsWith(".app") && fs.existsSync(bundle) ? bundle : "";
};

const tellInstall = (state, line) =>
  chromeView?.webContents.send("scaffold:install-event", { state, line });

/** One shell step at a time, reporting the last line so the dialog can breathe. */
function runStep(command) {
  return new Promise((resolve) => {
    const child = spawn("/bin/zsh", ["-lc", command], { cwd: checkoutPath });
    let tail = "";
    const take = (chunk) => {
      const line = String(chunk).trim().split("\n").filter(Boolean).pop();
      if (!line) return;
      tail = line;
      tellInstall("building", tail);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("close", (code) => resolve({ code, tail }));
    child.on("error", (error) => resolve({ code: -1, tail: error.message }));
  });
}

const releaseAsset = () =>
  `https://github.com/thisisbremlo/post/releases/latest/download/Post-${process.arch === "arm64" ? "arm64" : "x64"}.zip`;

const runQuiet = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(-1));
  });

/**
 * Wait for this process to die, swap the bundle in its place, reopen it. The
 * old bundle is moved aside, never deleted first: if the new one cannot take its
 * place, the old one goes back, so a failed update cannot leave no app at all.
 */
function swapIn(bundle, built, cleanup) {
  if (!built || !fs.existsSync(built)) {
    tellInstall("failed", "the new build is not on disk");
    return false;
  }

  const swapper = path.join(app.getPath("temp"), `post-swap-${Date.now()}.sh`);
  const script = [
    "#!/bin/zsh",
    `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done`,
    `rm -rf "${bundle}.incoming" "${bundle}.old" "${bundle}.failed"`,
    `ditto "${built}" "${bundle}.incoming" || exit 1`,
    `mv "${bundle}" "${bundle}.old" || exit 1`,
    `if ! mv "${bundle}.incoming" "${bundle}"; then`,
    `  mv "${bundle}.old" "${bundle}"`,
    "  exit 1",
    "fi",
    // The old bundle stays until the new one actually opens, so a bad build can
    // never leave the Mac with no Post to open.
    `if open "${bundle}"; then`,
    `  rm -rf "${bundle}.old"`,
    cleanup ? `  rm -rf "${cleanup}"` : "  :",
    "else",
    `  mv "${bundle}" "${bundle}.failed"`,
    `  mv "${bundle}.old" "${bundle}"`,
    `  open "${bundle}"`,
    `  rm -rf "${bundle}.failed"`,
    "fi",
    `rm -f "${swapper}"`,
    "",
  ].join("\n");

  try {
    fs.writeFileSync(swapper, script, { mode: 0o700 });
  } catch (error) {
    tellInstall("failed", error.message);
    return false;
  }

  spawn("/bin/zsh", [swapper], { detached: true, stdio: "ignore" }).unref();
  tellInstall("ready", "reopening on the new build");
  setTimeout(() => app.exit(0), 900);
  return true;
}

/**
 * The distributed route: a signed, notarised zip from the latest GitHub release.
 * No checkout, no node, no npm — a downloaded .app already knows how to replace
 * itself. The signature is checked before anything is unpacked into place.
 */
async function fromRelease() {
  tellInstall("downloading", "fetching the signed release");
  const response = await fetch(releaseAsset(), { redirect: "follow" });
  if (!response.ok) throw new Error(`the release asked back ${response.status}`);

  const stamp = Date.now();
  const zip = path.join(app.getPath("temp"), `post-${stamp}.zip`);
  fs.writeFileSync(zip, Buffer.from(await response.arrayBuffer()));

  const dir = path.join(app.getPath("temp"), `post-${stamp}`);
  tellInstall("verifying", "checking the signature");
  if ((await runQuiet("/usr/bin/ditto", ["-x", "-k", zip, dir])) !== 0) {
    throw new Error("the release did not unzip");
  }

  const built = fs
    .readdirSync(dir)
    .map((name) => path.join(dir, name))
    .find((candidate) => candidate.endsWith(".app"));
  if (!built) throw new Error("the release held no app");
  if ((await runQuiet("/usr/bin/codesign", ["--verify", "--deep", "--strict", built])) !== 0) {
    throw new Error("the release is not signed");
  }

  fs.rmSync(zip, { force: true });
  return { built, cleanup: dir };
}

/** The development route: pull, install, rebuild from the baked checkout. */
async function fromCheckout() {
  if (!checkoutPath || !fs.existsSync(path.join(checkoutPath, "package.json"))) return null;

  // Each step says what it is doing in plain words; the raw command stays in the
  // log, which is the only place it is useful.
  const steps = [
    ["pulling", "fetching the newest code", "git pull --ff-only"],
    ["installing", "installing what the new build needs", "npm install"],
    ["building", "rebuilding Post", "npm run package:mac"],
  ];

  for (const [state, label, command] of steps) {
    tellInstall(state, label);
    const result = await runStep(command);
    if (result.code !== 0) return null;
  }

  const built = ["release/mac-arm64/Post.app", "release/mac/Post.app", "release/mac-universal/Post.app"]
    .map((candidate) => path.join(checkoutPath, candidate))
    .find((candidate) => fs.existsSync(candidate));

  return built ?? null;
}

/**
 * An unpackaged copy cannot replace a bundle, but it can update the checkout it
 * runs from and reopen itself — which is what a person testing a build means by
 * "install". Without a baked checkout there is nothing to update.
 */
async function installDev() {
  if (!checkoutPath || !fs.existsSync(path.join(checkoutPath, "package.json"))) return "manual";

  const steps = [
    ["pulling", "fetching the newest code", "git pull --ff-only"],
    ["installing", "installing what the new build needs", "npm install"],
  ];
  if (!process.env.VITE_DEV_SERVER_URL) {
    steps.push(["building", "rebuilding the chrome", "npm run build"]);
  }

  for (const [state, label, command] of steps) {
    tellInstall(state, label);
    if ((await runStep(command)).code !== 0) {
      tellInstall("failed", "the update could not finish — the log has the last step");
      return "failed";
    }
  }

  tellInstall("ready", "reopening on the new build");
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 700);
  return "started";
}

async function installUpdate() {
  const bundle = installedBundle();
  if (!bundle) return installDev();

  // A read-only or translocated bundle would quit and never come back; say so
  // before anything is downloaded.
  const problem = bundleProblem(bundle);
  if (problem) {
    tellInstall("failed", problem);
    return "failed";
  }

  try {
    const release = await fromRelease();
    if (!swapIn(bundle, release.built, release.cleanup)) return "failed";
    return "started";
  } catch (error) {
    tellInstall("failed", error.message);
  }

  const built = await fromCheckout();
  if (built && swapIn(bundle, built, "")) return "started";

  tellInstall("failed", "the update could not finish — the log has the last step");
  return "failed";
}

ipcMain.handle("scaffold:install-update", () => installUpdate());
