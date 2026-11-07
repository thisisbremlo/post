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
const { execFile, spawn } = require("node:child_process");
const isDev = !app.isPackaged;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
const PARTITION = "persist:scaffold";

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

/* -------------------------------------------------------------- page views */

function notify(payload) {
  chromeView?.webContents.send("scaffold:view-event", payload);
}

function bindView(view, tabId) {
  const contents = view.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    // A link that wants a new window becomes a tab instead; nothing escapes.
    if (/^https?:/i.test(url)) notify({ kind: "open", url });
    else if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("did-start-loading", () => notify({ kind: "loading", tabId, loading: true }));
  contents.on("did-stop-loading", () => notify({ kind: "loading", tabId, loading: false }));
  contents.on("page-title-updated", (_event, title) => notify({ kind: "title", tabId, title }));

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

    const entry = (atom ?? "").match(/<entry>([\s\S]*?)<\/entry>/)?.[1] ?? "";
    const sha = entry.match(/Commit\/([0-9a-f]{40})/)?.[1] ?? "";
    const version = feed?.version ?? "";
    if (!sha && !version) return;

    chromeView?.webContents.send("scaffold:update", {
      sha,
      version,
      notes: feed?.notes ?? "",
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
  if (overlayOpen) {
    referenceless();
    return;
  }

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
    referenceUrl = null;
  }
}

function destroyTab(tabId) {
  const entry = pageViews.get(tabId);
  if (!entry) return;
  entry.view.setVisible(false);
  win?.contentView.removeChildView(entry.view);
  entry.view.webContents.close();
  pageViews.delete(tabId);
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

app.whenReady().then(() => {
  // Deny by default: camera, microphone, location, notifications.
  session.fromPartition(PARTITION).setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.fromPartition(PARTITION).setPermissionCheckHandler(() => false);

  // A browser saves what you download, to the folder the OS calls Downloads.
  session.fromPartition(PARTITION).on("will-download", (_event, item) => {
    notify({ kind: "download", title: item.getFilename() });
  });

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

ipcMain.on("scaffold:sync-layout", (_event, layout) => applyLayout(layout));

ipcMain.on("scaffold:overlay", (_event, open) => {
  overlayOpen = Boolean(open);
  if (overlayOpen) referenceless();
  else if (lastLayout) applyLayout(lastLayout);
});

ipcMain.on("scaffold:navigate", (_event, { tabId, url }) => {
  const entry = ensurePageView(tabId);
  entry.url = url;
  entry.view.webContents.loadURL(url).catch(() => undefined);
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

async function installUpdate() {
  const bundle = installedBundle();
  const checkoutExists = checkoutPath && fs.existsSync(path.join(checkoutPath, "package.json"));
  if (!bundle || !checkoutExists) return "manual";

  const steps = [
    ["pulling", "git pull --ff-only"],
    ["installing", "npm install"],
    ["building", "npm run package:mac"],
  ];

  for (const [state, command] of steps) {
    tellInstall(state, command);
    const result = await runStep(command);
    if (result.code !== 0) {
      tellInstall("failed", result.tail || `${command} stopped with ${result.code}`);
      return "started";
    }
  }

  const built = ["release/mac-arm64/Post.app", "release/mac/Post.app", "release/mac-universal/Post.app"]
    .map((candidate) => path.join(checkoutPath, candidate))
    .find((candidate) => fs.existsSync(candidate));

  if (!built) {
    tellInstall("failed", "electron-builder left no Post.app to swap in");
    return "started";
  }

  // The swap waits for this process to exit; the app quits, the copy is replaced.
  const swapper = path.join(app.getPath("temp"), `post-swap-${Date.now()}.sh`);
  fs.writeFileSync(
    swapper,
    [
      "#!/bin/zsh",
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done`,
      `rm -rf "${bundle}.incoming"`,
      `ditto "${built}" "${bundle}.incoming"`,
      `rm -rf "${bundle}"`,
      `mv "${bundle}.incoming" "${bundle}"`,
      `open "${bundle}"`,
      `rm -f "${swapper}"`,
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  spawn("/bin/zsh", [swapper], { detached: true, stdio: "ignore" }).unref();

  tellInstall("ready", "reopening on the new build");
  setTimeout(() => app.exit(0), 900);
  return "started";
}

ipcMain.handle("scaffold:install-update", () => installUpdate());

/** Google Password Manager is Chrome's, so Post opens it rather than keeping a copy. */
ipcMain.handle("scaffold:open-password-manager", async () => {
  if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app",
      path.join(app.getPath("home"), "Applications/Google Chrome.app"),
    ];
    if (candidates.some((candidate) => fs.existsSync(candidate))) {
      execFile("open", ["-a", "Google Chrome", "chrome://password-manager/passwords"]);
      return "chrome";
    }
  }
  await shell.openExternal("https://passwords.google.com");
  return "web";
});
