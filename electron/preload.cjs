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
  setPreferences: (preferences) => ipcRenderer.send("scaffold:preferences", preferences),

  listExtensions: () => ipcRenderer.invoke("scaffold:extensions"),
  addExtension: () => ipcRenderer.invoke("scaffold:extensions-add"),
  installFromStore: (url) => ipcRenderer.invoke("scaffold:extensions-store", { url }),
  removeExtension: (id) => ipcRenderer.invoke("scaffold:extensions-remove", { id }),
  openDownloads: () => ipcRenderer.send("scaffold:open-downloads"),

  navigate: (tabId, url) => ipcRenderer.send("scaffold:navigate", { tabId, url }),
  /** What the page declares about itself: description, social card, JSON-LD. */
  readPageMeta: (tabId) => ipcRenderer.invoke("scaffold:read-page-meta", { tabId }),
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
