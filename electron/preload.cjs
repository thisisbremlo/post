const { contextBridge, ipcRenderer } = require("electron");

/**
 * The chrome renderer gets exactly this: layout reconciliation, navigation
 * commands, and a vault that only ever answers with origin and username.
 */
contextBridge.exposeInMainWorld("scaffold", {
  platform: process.platform,

  vaultProtected: () => ipcRenderer.invoke("scaffold:vault-protected"),

  syncLayout: (layout) => ipcRenderer.send("scaffold:sync-layout", layout),
  setOverlay: (open) => ipcRenderer.send("scaffold:overlay", Boolean(open)),

  navigate: (tabId, url) => ipcRenderer.send("scaffold:navigate", { tabId, url }),
  relaunch: () => ipcRenderer.send("scaffold:relaunch"),
  closeTab: (tabId) => ipcRenderer.send("scaffold:close-tab", { tabId }),
  viewAction: (tabId, action) => ipcRenderer.send("scaffold:view-action", { tabId, action }),

  onCommand: (handler) => {
    const listener = (_event, command) => handler(command);
    ipcRenderer.on("scaffold:command", listener);
    return () => ipcRenderer.removeListener("scaffold:command", listener);
  },

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

  vault: {
    list: () => ipcRenderer.invoke("scaffold:vault-list"),
    save: (entry) => ipcRenderer.invoke("scaffold:vault-save", entry),
    remove: (id) => ipcRenderer.invoke("scaffold:vault-remove", id),
    fill: (tabId) => ipcRenderer.invoke("scaffold:vault-fill", tabId),
  },
});
