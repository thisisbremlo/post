/*
 * Runs before the desk bundle on chrome://post.
 *
 * The desk is the same React app the extension harness loads; it speaks
 * chrome.tabs, chrome.storage and friends. Here those calls are answered by
 * PostHandler through one message, `post.call`, and tab changes are pushed back
 * as `postTabs`. Nothing about the desk's data flow changes, only the transport.
 *
 * Loaded with a classic <script> before the module bundle so `chrome.tabs`
 * exists by the time the desk's modules evaluate `hasChrome`.
 */
(() => {
  const api = (window.chrome = window.chrome || {});
  if (typeof api.send !== "function") {
    // Not a WebUI page (opened as a file, or the handler is missing): leave
    // chrome alone so the desk falls back to its demo data and says why.
    return;
  }

  const listeners = new Set();
  const pending = new Map();
  let tabs = [];
  let selfIndex = -1;
  let nextRequest = 1;

  const event = () => ({
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    hasListener: (fn) => listeners.has(fn),
  });

  function call(method, payload) {
    return new Promise((resolve) => {
      const id = nextRequest++;
      pending.set(id, resolve);
      api.send("post.call", [method, id, JSON.stringify(payload || {})]);
      window.setTimeout(() => {
        if (pending.delete(id)) resolve(null);
      }, 5000);
    });
  }

  const view = (tab) =>
    tab && {
      id: tab.id,
      index: tab.index,
      windowId: 1,
      active: Boolean(tab.active),
      url: tab.url || "",
      title: tab.title || "",
    };

  const tabAt = (id) => tabs.find((tab) => tab.id === id) || null;
  const isDesk = (url) => !url || /(^|\/)index\.html$/.test(url);

  // ---------- the two callbacks PostHandler calls into ----------

  window.postReceive = (id, json) => {
    const resolve = pending.get(id);
    if (!resolve) return;
    pending.delete(id);
    try {
      resolve(json ? JSON.parse(json) : null);
    } catch {
      resolve(null);
    }
  };

  window.postTabs = (json) => {
    try {
      const payload = JSON.parse(json);
      tabs = Array.isArray(payload.tabs) ? payload.tabs : [];
      selfIndex = typeof payload.self === "number" ? payload.self : -1;
    } catch {
      return;
    }
    // One synthetic activation record, because the desk listens for one.
    for (const fn of [...listeners]) {
      try {
        fn({ tabId: selfIndex, windowId: 1 });
      } catch {
        /* a listener that throws must not stop the others */
      }
    }
  };

  // ---------- chrome.tabs ----------

  api.tabs = {
    query: async (query) => {
      let result = tabs;
      if (query && query.active) result = result.filter((tab) => tab.active);
      return result.map(view);
    },
    get: async (id) => view(tabAt(id)),
    getCurrent: async () => view(tabAt(selfIndex)),
    create: async ({ url } = {}) => {
      if (isDesk(url)) {
        await call("new", {});
      } else {
        await call("new", {});
        await call("navigate", { index: tabs.length - 1, url });
      }
      return null;
    },
    update: async (id, props = {}) => {
      if (props.url) await call("navigate", { index: id, url: props.url });
      if (props.active) await call("activate", { index: id });
      return view(tabAt(id));
    },
    remove: async (id) => {
      await call("close", { index: id });
    },
    goBack: async (id) => {
      await call("nav", { index: id, direction: "back" });
    },
    goForward: async (id) => {
      await call("nav", { index: id, direction: "forward" });
    },
    reload: async (id) => {
      await call("nav", { index: id, direction: "reload" });
    },
    onCreated: event(),
    onRemoved: event(),
    onMoved: event(),
    onUpdated: event(),
    onActivated: event(),
  };

  // The desk asks for the current window; there is exactly one.
  api.windows = {
    getCurrent: async () => ({ id: 1, focused: true }),
    update: async () => ({ id: 1, focused: true }),
  };

  // ---------- storage: shelf, sittings, settings ----------

  api.storage = {
    local: {
      get: async (key) => {
        if (typeof key !== "string") return {};
        const reply = await call("storage.read", { key });
        if (reply && typeof reply === "object" && key in reply) {
          return { [key]: reply[key] };
        }
        return {};
      },
      set: async (values) => {
        await call("storage.write", { values });
      },
      remove: async () => {},
    },
    onChanged: event(),
  };

  // ---------- the rest is the next milestone, not a silent failure ----------
  // These return the shape each view expects (an empty list), so Bookmarks,
  // History and Extensions render their empty state instead of an error.

  api.bookmarks = {
    search: async () => [],
    getTree: async () => [],
    create: async ({ title, url }) => ({ id: "0", title: title || url, url }),
    remove: async () => {},
  };
  api.history = { search: async () => [] };
  api.management = {
    getAll: async () => [],
    setEnabled: async () => {},
    uninstall: async () => {},
  };

  api.runtime = {
    id: "post",
    getURL: () => "",
    getManifest: () => ({
      name: "Post",
      version: "0.1.0",
      chrome_url_overrides: { newtab: "post_ui.html" },
    }),
  };
})();
