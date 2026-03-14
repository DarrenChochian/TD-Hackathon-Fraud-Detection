const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  setWindowMode: (mode, width, height) => ipcRenderer.invoke('set-window-mode', mode, width, height),
  runResearch: (prompt) => ipcRenderer.invoke('research:run', { prompt }),
  onResearchEvent: (callback) => {
    const listener = (_, payload) => callback(payload)
    ipcRenderer.on('research:event', listener)
    return () => ipcRenderer.removeListener('research:event', listener)
  },
})
