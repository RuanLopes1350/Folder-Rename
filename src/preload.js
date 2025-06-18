const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  analyzeFolder: (folderPath) => ipcRenderer.invoke('folder:analyze', folderPath),
  renameFiles: (folderPath, options) => ipcRenderer.invoke('files:rename', folderPath, options),
  previewRename: (folderPath, options) => ipcRenderer.invoke('files:preview', folderPath, options)
});