const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const { registerResearchAgentIpc } = require('./research-agent/ipc')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  const display = screen.getPrimaryDisplay()
  const useDisplayBounds = process.platform === 'win32'
  const initialRect = useDisplayBounds ? display.bounds : display.workArea

  mainWindow = new BrowserWindow({
    x: initialRect.x,
    y: initialRect.y,
    width: initialRect.width,
    height: initialRect.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'floating')
  // Click-through by default; renderer will opt-in interactive regions.
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  // Re-apply display metrics after first paint for platform-specific reliability.
  mainWindow.once('ready-to-show', () => {
    const nextDisplay = screen.getPrimaryDisplay()
    const nextRect = useDisplayBounds ? nextDisplay.bounds : nextDisplay.workArea
    const { width, height, x, y } = nextRect
    if (width > 100 && height > 100) {
      mainWindow.setBounds({ x, y, width, height })
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

let currentSettingsAccelerator = 'Alt+K'
let currentMainPanelAccelerator = 'Alt+L'

// On macOS, Option+L (Alt+L) is intercepted by some IME/keyboard configurations
// before Electron can claim it. Provide a fallback chain specific to the platform.
const MACOS_FALLBACKS = {
  'Alt+L': ['Alt+Shift+L', 'Command+Shift+L'],
}

function tryRegister(accelerator, handler) {
  const ok = globalShortcut.register(accelerator, handler)
  console.log(`[hotkeys] register(${accelerator}) → ${ok ? 'OK' : 'FAILED'}`)
  return ok
}

function tryRegisterWithFallbacks(accelerator, handler, fallbacks) {
  if (tryRegister(accelerator, handler)) return { ok: true, registered: accelerator }
  for (const fb of fallbacks) {
    if (tryRegister(fb, handler)) return { ok: true, registered: fb }
  }
  console.warn(`[hotkeys] All candidates failed for desired accelerator: ${accelerator}`)
  return { ok: false, registered: null }
}

function registerAllHotkeys() {
  globalShortcut.unregisterAll()

  // Helper to bring window to front and send IPC
  const handleHotkey = (channel) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (process.platform === 'darwin') {
        app.focus({ steal: true }) // Force focus on Mac
      }
      mainWindow.show()
      mainWindow.focus()
      mainWindow.setIgnoreMouseEvents(false)
      mainWindow.webContents.send(channel)
    }
  }

  const settingsResult = tryRegisterWithFallbacks(
    currentSettingsAccelerator,
    () => handleHotkey('settings:open'), // Uses the helper now
    []
  )
  if (settingsResult.ok) currentSettingsAccelerator = settingsResult.registered

  const macFallbacks = process.platform === 'darwin'
    ? (MACOS_FALLBACKS[currentMainPanelAccelerator] ?? ['Alt+Shift+L', 'Command+Shift+L'])
    : []
    
  const mainPanelResult = tryRegisterWithFallbacks(
    currentMainPanelAccelerator,
    () => handleHotkey('main-panel:open'),
    macFallbacks
  )
  if (mainPanelResult.ok) currentMainPanelAccelerator = mainPanelResult.registered

  const notify = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('hotkey:registration-result', {
      settings: { accelerator: currentSettingsAccelerator, ok: settingsResult.ok },
      mainPanel: { accelerator: currentMainPanelAccelerator, ok: mainPanelResult.ok },
    })
  }

  if (mainWindow?.webContents?.isLoading()) {
    mainWindow.webContents.once('did-finish-load', notify)
  } else {
    setImmediate(notify)
  }

  return { settingsOk: settingsResult.ok, mainPanelOk: mainPanelResult.ok }
}

app.whenReady().then(() => {
  registerResearchAgentIpc({
    ipcMain,
    projectRoot: app.getAppPath(),
    userDataPath: app.getPath('userData'),
  })

  createWindow()
  registerAllHotkeys()
})

ipcMain.handle('settings:get-hotkey', () => ({ accelerator: currentSettingsAccelerator }))

ipcMain.handle('settings:update-hotkey', (_, { accelerator }) => {
  const prev = currentSettingsAccelerator
  currentSettingsAccelerator = accelerator
  const { settingsOk } = registerAllHotkeys()
  if (!settingsOk) {
    currentSettingsAccelerator = prev
    registerAllHotkeys()
    return { ok: false, accelerator: currentSettingsAccelerator }
  }
  return { ok: true, accelerator: currentSettingsAccelerator }
})

ipcMain.handle('main-panel:get-hotkey', () => ({ accelerator: currentMainPanelAccelerator }))

ipcMain.handle('main-panel:update-hotkey', (_, { accelerator }) => {
  const prev = currentMainPanelAccelerator
  currentMainPanelAccelerator = accelerator
  const { mainPanelOk } = registerAllHotkeys()
  if (!mainPanelOk) {
    currentMainPanelAccelerator = prev
    registerAllHotkeys()
    return { ok: false, accelerator: currentMainPanelAccelerator }
  }
  return { ok: true, accelerator: currentMainPanelAccelerator }
})

ipcMain.on('overlay:set-interactive', (_, interactive) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const enabled = Boolean(interactive)
  mainWindow.setIgnoreMouseEvents(!enabled, { forward: true })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
