const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge between the React UI and Electron's file system.
contextBridge.exposeInMainWorld('api', {
  saveResume: (data) => ipcRenderer.invoke('save-resume', data),
  loadResume: () => ipcRenderer.invoke('load-resume'),
  exportPDF: (defaultName) => ipcRenderer.invoke('export-pdf', defaultName),
  exportDocx: (base64, defaultName) => ipcRenderer.invoke('export-docx', { base64, defaultName }),
  exportText: (text, defaultName) => ipcRenderer.invoke('export-text', { text, defaultName }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // Push the app-level appearance setting so Electron's native chrome
  // (menus, dialogs, scrollbars) follows the in-app theme.
  setTheme: (setting) => ipcRenderer.invoke('set-theme', setting),
  // File menu items live in the native menu bar (main process) but the
  // actual dialog/save logic runs in the renderer, so the menu just pings it.
  onMenuOpen: (cb) => ipcRenderer.on('menu-open-resume', cb),
  onMenuSaveAs: (cb) => ipcRenderer.on('menu-save-resume', cb),
});
