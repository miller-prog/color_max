const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (defaultName, filters) => ipcRenderer.invoke('dialog:saveFile', defaultName, filters),
  saveImage: (defaultName) => ipcRenderer.invoke('dialog:saveImage', defaultName),
  readFile: (filePath, encoding) => ipcRenderer.invoke('file:read', filePath, encoding),
  writeFile: (filePath, data, encoding) => ipcRenderer.invoke('file:write', filePath, data, encoding),
  writeFileBuffer: (filePath, buffer) => ipcRenderer.invoke('file:writeBuffer', filePath, buffer),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  onMenuOpenFile: (cb) => ipcRenderer.on('menu-open-file', cb),
  onMenuSaveText: (cb) => ipcRenderer.on('menu-save-text', cb),
  onMenuImportMapping: (cb) => ipcRenderer.on('menu-import-mapping', cb),
  onMenuExportMapping: (cb) => ipcRenderer.on('menu-export-mapping', cb),
  onMenuExportImage: (cb) => ipcRenderer.on('menu-export-image', cb),
  onMenuAbout: (cb) => ipcRenderer.on('menu-about', cb),
});
