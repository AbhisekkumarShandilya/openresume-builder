const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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

// Manual "Check for Updates" button in Settings — unlike the silent
// on-launch checkForUpdates() above, this reports the outcome back to the
// renderer (checking/up-to-date/error), not just the update-available case.
// The existing update-available/update-downloaded listeners above still
// fire and show their native dialogs same as the on-launch check; this just
// adds renderer-visible feedback for the "you're already up to date" and
// "check failed" cases, which previously had no UI at all.
ipcMain.handle('check-for-updates', () => {
  const version = app.getVersion();
  if (isDev || !app.isPackaged) {
    return Promise.resolve({ ok: false, reason: 'dev-mode', version });
  }
  return new Promise((resolve) => {
    const cleanup = () => {
      autoUpdater.off('update-available', onAvailable);
      autoUpdater.off('update-not-available', onNotAvailable);
      autoUpdater.off('error', onError);
    };
    const onAvailable = (info) => { cleanup(); resolve({ ok: true, hasUpdate: true, version, latest: info.version }); };
    const onNotAvailable = () => { cleanup(); resolve({ ok: true, hasUpdate: false, version }); };
    const onError = (err) => { cleanup(); resolve({ ok: false, reason: 'error', message: err.message, version }); };
    autoUpdater.once('update-available', onAvailable);
    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('error', onError);
    autoUpdater.checkForUpdates().catch((err) => { cleanup(); resolve({ ok: false, reason: 'error', message: err.message, version }); });
  });
});

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

  win.webContents.session.setSpellCheckerLanguages(['en-US']);

  // Electron renders spelling-error underlines automatically once a
  // spellchecker language is set, but doesn't show any context menu out of
  // the box — without this, right-clicking a misspelled word does nothing.
  win.webContents.on('context-menu', (_event, params) => {
    const items = [];

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        items.push({ label: suggestion, click: () => win.webContents.replaceMisspelling(suggestion) });
      }
      if (params.dictionarySuggestions.length) items.push({ type: 'separator' });
      items.push({
        label: 'Add to Dictionary',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      items.push({ type: 'separator' });
    }

    if (params.isEditable) {
      items.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll },
      );
    } else if (params.selectionText) {
      items.push({ label: 'Copy', role: 'copy' });
    }

    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Open/Save As live in the File menu; the actual dialog + file I/O still
// runs in the renderer (via the same save-resume/load-resume IPC the
// toolbar used), so these just ping it to run that flow.
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu-open-resume') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu-save-resume') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  buildMenu();
  createWindow();
  checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
