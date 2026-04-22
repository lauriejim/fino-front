import { contextBridge, ipcRenderer } from "electron";

// -----------------------------------------------------------------------------
// fino — preload script
//
// Exposes a safe, typed subset of Electron APIs to the renderer under
// `window.electronAPI`. Keep this surface small — anything here is a trust
// boundary. The renderer should have no direct access to node modules.
// -----------------------------------------------------------------------------

export type UpdaterStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version?: string }
  | { status: "not-available" }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version?: string; downloadedFile?: string | null }
  | { status: "error"; message: string };

const api = {
  // File system (for future imports)
  openFile: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke("dialog:openFile", options) as Promise<Electron.OpenDialogReturnValue>,
  readFile: (path: string) => ipcRenderer.invoke("fs:readFile", path) as Promise<Buffer>,

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url) as Promise<void>,

  // Updater
  updater: {
    getState: () => ipcRenderer.invoke("updater:getState") as Promise<UpdaterStatus>,
    downloadUpdate: () =>
      ipcRenderer.invoke("updater:downloadUpdate") as Promise<UpdaterStatus>,
    installUpdate: () => ipcRenderer.invoke("updater:installUpdate") as Promise<boolean>,
    openManualDownload: () =>
      ipcRenderer.invoke("updater:openManualDownload") as Promise<boolean>,
    onStatus: (handler: (status: UpdaterStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: UpdaterStatus) =>
        handler(payload);
      ipcRenderer.on("updater:status", listener);
      return () => ipcRenderer.removeListener("updater:status", listener);
    },
  },

  // App lifecycle
  quit: () => ipcRenderer.send("app:quit"),
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld("electronAPI", api);
