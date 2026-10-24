const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('launcher', {
  desktop: true,
  captureShortcut: (active) => ipcRenderer.invoke('shortcut:capture', active),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  load: () => ipcRenderer.invoke('config:load'),
  save: (config) => ipcRenderer.invoke('config:save', config),
  launch: (id) => ipcRenderer.invoke('launch', id),
  browse: (kind) => ipcRenderer.invoke('browse', kind),
  describe: (paths) => ipcRenderer.invoke('describe', paths),
  scan: () => ipcRenderer.invoke('scan'),
  filePath: (file) => webUtils.getPathForFile(file),
  showDonut: () => ipcRenderer.invoke('donut:show'),
  hideDonut: () => ipcRenderer.invoke('donut:hide'),
  openSettings: () => ipcRenderer.invoke('settings:show'),
  exportConfig: () => ipcRenderer.invoke('config:export'),
  importConfig: () => ipcRenderer.invoke('config:import'),
  window: (action) => ipcRenderer.send('window', action),
  onConfig: (callback) => {
    const listener = (_, config) => callback(config);
    ipcRenderer.on('config:changed', listener);
    return () => ipcRenderer.removeListener('config:changed', listener);
  },
  onDonut: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('donut:opened', listener);
    return () => ipcRenderer.removeListener('donut:opened', listener);
  },
});
