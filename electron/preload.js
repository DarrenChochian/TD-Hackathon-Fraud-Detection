const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  setOverlayInteractivity: (interactive) => ipcRenderer.send('overlay:set-interactive', interactive),
  runResearch: (prompt) => ipcRenderer.invoke('research:run', { prompt }),
  onResearchEvent: (callback) => {
    const listener = (_, payload) => callback(payload)
    ipcRenderer.on('research:event', listener)
    return () => ipcRenderer.removeListener('research:event', listener)
  },
})
