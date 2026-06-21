const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs/promises');

const isDev = process.env.NODE_ENV === 'development';

let win;

// Ask before downloading/installing — these builds are unsigned, so the
// user should consent rather than have an installer silently fetched.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on('update-available', async (info) => {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Update available',
    message: `OpenResume Builder ${info.version} is available (you have ${app.getVersion()}).`,
    detail: 'Download it now?',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) autoUpdater.downloadUpdate();
});

autoUpdater.on('update-downloaded', async () => {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Update ready',
    message: 'The update has been downloaded.',
    detail: 'Restart now to install it?',
    buttons: ['Restart', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) autoUpdater.quitAndInstall();
});

autoUpdater.on('error', (err) => {
  console.error('Auto-update check failed:', err);
});

function checkForUpdates() {
  if (isDev || !app.isPackaged) return;
  autoUpdater.checkForUpdates().catch((err) => console.error('checkForUpdates failed:', err));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Save resume JSON to disk
ipcMain.handle('save-resume', async (_e, data) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Save Resume',
    defaultPath: 'resume.json',
    filters: [{ name: 'Resume JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, filePath };
});

// Load resume JSON from disk
ipcMain.handle('load-resume', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Open Resume',
    properties: ['openFile'],
    filters: [{ name: 'Resume JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths.length) return { ok: false };
  const raw = await fs.readFile(filePaths[0], 'utf-8');
  return { ok: true, data: JSON.parse(raw) };
});

// Export the rendered preview to PDF
ipcMain.handle('export-pdf', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Export PDF',
    defaultPath: 'resume.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false };
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await fs.writeFile(filePath, pdf);
  return { ok: true, filePath };
});

app.whenReady().then(() => {
  createWindow();
  checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
