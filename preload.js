const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  dragStart: () => ipcRenderer.send('window:drag-start'),
  dragEnd: () => ipcRenderer.send('window:drag-end'),
});

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  updateAppSettings: (patch) => ipcRenderer.invoke('app:update-settings', patch),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  installUpdate: () => ipcRenderer.send('app:install-update'),
  onUpdateProgress: (callback) => ipcRenderer.on('app:update-progress', (_event, progress) => callback(progress)),
  updateInstrument: (instrument, patch) => ipcRenderer.invoke('settings:update-instrument', instrument, patch),
  pickFolder: () => ipcRenderer.invoke('settings:pick-folder'),
  getLibrary: (instrument) => ipcRenderer.invoke('library:get', instrument),
  renameFiles: (instrument, toPattern) => ipcRenderer.invoke('library:rename-files', instrument, toPattern),
  openSong: (instrument, file) => ipcRenderer.invoke('library:open-song', instrument, file),
  renameArtist: (instrument, fromName, toName) =>
    ipcRenderer.invoke('library:rename-artist', instrument, fromName, toName),
  scanLibrary: (instrument) => ipcRenderer.invoke('library:scan', instrument),
  onScanProgress: (callback) => ipcRenderer.on('library:scan-progress', (_event, progress) => callback(progress)),
});
