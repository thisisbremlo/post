const { contextBridge, ipcRenderer } = require("electron");

/**
 * The chrome renderer gets exactly this: layout reconciliation, navigation
 * commands, and the update installer's progress.
 */
contextBridge.exposeInMainWorld("scaffold", {
  platform: process.platform,

  installUpdate: () => ipcRenderer.invoke("scaffold:install-update"),

  onInstallEvent: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("scaffold:install-event", listener);
    return () => ipcRenderer.removeListener("scaffold:install-event", listener);
  },

  syncLayout: (layout) => ipcRenderer.send("scaffold:sync-layout", layout),
  setOverlay: (open) => ipcRenderer.send("scaffold:overlay", Boolean(open)),
  scrollPage: (deltaX, deltaY, x, y) =>
    ipcRenderer.send("scaffold:scroll-page", { deltaX, deltaY, x, y }),
  setPreferences: (preferences) => ipcRenderer.send("scaffold:preferences", preferences),

  openDownloads: () => ipcRenderer.send("scaffold:open-downloads"),

  navigate: (tabId, url) => ipcRenderer.send("scaffold:navigate", { tabId, url }),
  /** What the page declares about itself: description, social card, JSON-LD. */
  readPageMeta: (tabId) => ipcRenderer.invoke("scaffold:read-page-meta", { tabId }),
  readArticle: (tabId) => ipcRenderer.invoke("scaffold:read-article", { tabId }),

  getAdblockState: () => ipcRenderer.invoke("scaffold:adblock-state"),
  setAdblockEnabled: (enabled) => ipcRenderer.invoke("scaffold:adblock-enabled", { enabled }),
  setAdblockFeature: (feature, enabled) =>
    ipcRenderer.invoke("scaffold:adblock-feature", { feature, enabled }),
  setAdblockSite: (host, allowed) =>
    ipcRenderer.invoke("scaffold:adblock-site", { host, allowed }),
  setAdblockLists: (lists) => ipcRenderer.invoke("scaffold:adblock-lists", { lists }),
  refreshAdblock: () => ipcRenderer.invoke("scaffold:adblock-refresh"),
  onAdblock: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on("scaffold:adblock", listener);
    return () => ipcRenderer.removeListener("scaffold:adblock", listener);
  },
  relaunch: () => ipcRenderer.send("scaffold:relaunch"),
  closeTab: (tabId) => ipcRenderer.send("scaffold:close-tab", { tabId }),
  viewAction: (tabId, action) => ipcRenderer.send("scaffold:view-action", { tabId, action }),

  onCommand: (handler) => {
    const listener = (_event, command) => handler(command);
    ipcRenderer.on("scaffold:command", listener);
    return () => ipcRenderer.removeListener("scaffold:command", listener);
  },

  checkUpdates: () => ipcRenderer.send("scaffold:check-updates"),

  onUpdate: (handler) => {
    const listener = (_event, notice) => handler(notice);
    ipcRenderer.on("scaffold:update", listener);
    return () => ipcRenderer.removeListener("scaffold:update", listener);
  },

  onViewEvent: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("scaffold:view-event", listener);
    return () => ipcRenderer.removeListener("scaffold:view-event", listener);
  },
});
