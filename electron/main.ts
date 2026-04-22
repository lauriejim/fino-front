import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import fs from "node:fs";

// -----------------------------------------------------------------------------
// fino — Electron main process
//
// Differences vs. v1 (tui/):
//   - contextIsolation: true + nodeIntegration: false + preload script
//   - no secrets embedded in the main process
//   - renderer served by Vite in dev, packaged dist/ in prod
// -----------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === "development";
const VITE_DEV_URL = "http://localhost:5173";

let mainWindow: BrowserWindow | null = null;

type UpdaterStatus =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version?: string }
  | { status: "not-available" }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version?: string; downloadedFile?: string | null }
  | { status: "error"; message: string };

let updateState: UpdaterStatus = { status: "idle" };

function sendUpdaterStatus(payload: UpdaterStatus): void {
  updateState = payload;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:status", payload);
  }
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  // Install on quit on both platforms. On macOS this works for unsigned
  // builds too, as long as the app is in /Applications (the standard
  // location after the .dmg drag-and-drop). The worst-case failure mode
  // is that the user gets the "unverified developer" popup again on the
  // next launch — same one-off friction as the first install.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.forceDevUpdateConfig = !app.isPackaged;

  // fino-front is a public GitHub repo, so autoUpdater can read releases
  // and artifacts anonymously — no Authorization header needed at
  // runtime. GH_TOKEN is still used at BUILD time (in CI) by
  // electron-builder to *publish* to Releases, but that's a separate
  // concern.

  autoUpdater.on("checking-for-update", () => sendUpdaterStatus({ status: "checking" }));
  autoUpdater.on("update-available", (info) =>
    sendUpdaterStatus({ status: "available", version: info?.version })
  );
  autoUpdater.on("update-not-available", () => sendUpdaterStatus({ status: "not-available" }));
  autoUpdater.on("download-progress", (progress) =>
    sendUpdaterStatus({ status: "downloading", percent: Number(progress?.percent ?? 0) })
  );
  autoUpdater.on("update-downloaded", (info) =>
    sendUpdaterStatus({
      status: "downloaded",
      version: info?.version,
      downloadedFile: (info as unknown as { downloadedFile?: string })?.downloadedFile ?? null,
    })
  );
  autoUpdater.on("error", (err) =>
    sendUpdaterStatus({ status: "error", message: err?.message ?? "Updater error" })
  );
}

async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    sendUpdaterStatus({
      status: "error",
      message: (err as Error)?.message ?? "Failed to check for updates.",
    });
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: "#ffffff", // Primer day bg — prevents dark flash
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload uses node APIs (fs/ipcRenderer) — re-evaluate once we strip them
    },
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  if (app.isPackaged) {
    void checkForUpdates();
  }
}

app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---- IPC handlers -----------------------------------------------------------

ipcMain.handle("dialog:openFile", async (event, options: Electron.OpenDialogOptions = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true, filePaths: [] as string[] };
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    ...options,
  });
  return result;
});

ipcMain.handle("fs:readFile", async (_event, filePath: string): Promise<Buffer> => {
  return fs.promises.readFile(filePath);
});

ipcMain.handle("shell:openExternal", async (_event, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle("updater:getState", () => updateState);

ipcMain.handle("updater:downloadUpdate", async () => {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    sendUpdaterStatus({
      status: "error",
      message: (err as Error)?.message ?? "Failed to download update.",
    });
  }
  return updateState;
});

ipcMain.handle("updater:installUpdate", async () => {
  // Squirrel (the framework behind electron-updater on macOS) validates
  // that the old and new bundle have matching code signatures before
  // swapping. Without an Apple Developer ID to sign with, each ad-hoc
  // build has a *different* signature, so the validation fails every
  // time. We fall back to "open the downloaded file in Finder" on Mac
  // — the user drags the new Fino.app to /Applications manually. Windows
  // and Linux aren't affected and use the normal quitAndInstall path.
  if (process.platform === "darwin") {
    const downloadedFile =
      updateState.status === "downloaded" ? updateState.downloadedFile : null;
    if (downloadedFile && fs.existsSync(downloadedFile)) {
      shell.showItemInFolder(downloadedFile);
      return true;
    }
    await shell.openExternal("https://github.com/lauriejim/fino-front/releases/latest");
    return true;
  }

  try {
    autoUpdater.quitAndInstall();
    return true;
  } catch (err) {
    sendUpdaterStatus({
      status: "error",
      message:
        (err as Error)?.message ??
        "Could not install the update automatically. Use manual download as a fallback.",
    });
    return false;
  }
});

ipcMain.handle("updater:openManualDownload", async () => {
  const downloadedFile =
    updateState.status === "downloaded" ? updateState.downloadedFile : null;

  if (downloadedFile && fs.existsSync(downloadedFile)) {
    shell.showItemInFolder(downloadedFile);
    return true;
  }

  await shell.openExternal("https://github.com/lauriejim/fino-front/releases/latest");
  return true;
});

ipcMain.on("app:quit", () => app.quit());
