const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge between the React UI and Electron's file system.
contextBridge.exposeInMainWorld('api', {
  saveResume: (data) => ipcRenderer.invoke('save-resume', data),
  loadResume: () => ipcRenderer.invoke('load-resume'),
  exportPDF: () => ipcRenderer.invoke('export-pdf'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // File menu items live in the native menu bar (main process) but the
  // actual dialog/save logic runs in the renderer, so the menu just pings it.
  onMenuOpen: (cb) => ipcRenderer.on('menu-open-resume', cb),
  onMenuSaveAs: (cb) => ipcRenderer.on('menu-save-resume', cb),
});
