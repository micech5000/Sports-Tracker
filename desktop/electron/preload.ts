import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("sportsTracker", {
  platform: process.platform,
  updateNow: () => ipcRenderer.invoke("events:update-now"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: { notificationsEnabled?: boolean; startWithWindows?: boolean }) =>
    ipcRenderer.invoke("settings:set", settings),
  onEventsUpdated: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("events-updated", listener);
    return () => ipcRenderer.removeListener("events-updated", listener);
  },
});
