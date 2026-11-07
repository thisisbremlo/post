const { contextBridge, ipcRenderer } = require("electron");

/**
 * The chrome renderer gets exactly this: layout reconciliation, navigation
 * commands, and the one call that hands passwords back to Chrome's manager.
 */
contextBridge.exposeInMainWorld("scaffold", {
  platform: process.platform,

  openPasswordManager: () => ipcRenderer.invoke("scaffold:open-password-manager"),

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
