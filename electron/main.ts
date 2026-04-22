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
  autoUpdater.autoInstallOnAppQuit = process.platform !== "darwin";
  autoUpdater.forceDevUpdateConfig = !app.isPackaged;

  // GH_TOKEN is read from the environment at runtime (set at build time
  // by electron-builder via GH_TOKEN env var). Do NOT hardcode a token here.
  const token = process.env.GH_TOKEN?.trim();
  if (token) {
    autoUpdater.requestHeaders = { Authorization: `token ${token}` };
  }

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
  if (process.platform === "darwin") {
    sendUpdaterStatus({
      status: "error",
      message: "Automatic install is disabled on macOS for unsigned builds. Use manual download.",
    });
    return false;
  }
  autoUpdater.quitAndInstall();
  return true;
});

ipcMain.handle("updater:openManualDownload", async () => {
  const downloadedFile =
    updateState.status === "downloaded" ? updateState.downloadedFile : null;

  if (downloadedFile && fs.existsSync(downloadedFile)) {
    shell.showItemInFolder(downloadedFile);
    return true;
  }

  await shell.openExternal("https://github.com/lauriejim/MIR/releases/latest");
  return true;
});

ipcMain.on("app:quit", () => app.quit());
