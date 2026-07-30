import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAppIpc } from './ipc/app'
import { registerPowerpointIpc } from './ipc/powerpoint'
import { registerNdiIpc, shutdownNdi } from './ipc/ndi'
import { registerConfigIpc } from './ipc/config'
import { registerSlideshowIpc } from './ipc/slideshow'
import { cleanupTemp } from './powerpoint/bridge'
import { stopWatch } from './powerpoint/file-watcher'
import { slideshowSession } from './powerpoint/slideshow-session'
import { handleSlideupProtocol, registerSlideupScheme } from './protocol'
import { attachPresenterInput, registerHotkeys, unregisterHotkeys } from './hotkeys'
import { resolveAppIconPath } from './app-icon'
import {
  applyStartupVisibility,
  attachTrayWindowBehavior,
  createTray,
  destroyTray,
  isAppQuitting,
  markAppQuitting,
  showMainWindow
} from './tray'
import { loadConfig } from './config'
import { windowBackgroundForTheme } from './ipc/config'

/** Une seule instance — évite trays / raccourcis en conflit */
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  registerSlideupScheme()

  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.slideup.app')
    handleSlideupProtocol()

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
      attachPresenterInput(window)
    })

    registerAppIpc()
    registerConfigIpc()
    registerPowerpointIpc()
    registerNdiIpc()
    registerSlideshowIpc()

    registerHotkeys(loadConfig().hotkeys)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        showMainWindow()
      }
    })
  })

  let shuttingDown = false

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    unregisterHotkeys()
    destroyTray()
    stopWatch()
    try {
      await slideshowSession.stop()
    } catch {
      // ignore
    }
    try {
      await shutdownNdi()
    } catch {
      // ignore
    }
    cleanupTemp()
  }

  app.on('before-quit', () => {
    markAppQuitting()
    unregisterHotkeys()
    destroyTray()
  })

  app.on('will-quit', () => {
    unregisterHotkeys()
    destroyTray()
  })

  app.on('window-all-closed', () => {
    // Masquée dans le tray → des fenêtres existent encore, on ne quitte pas.
    if (!isAppQuitting() && BrowserWindow.getAllWindows().length > 0) return
    void shutdown().finally(() => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  })
}

function createWindow(): BrowserWindow {
  const icon = resolveAppIconPath()
  const cfg = loadConfig()
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Slide-up',
    backgroundColor: windowBackgroundForTheme(cfg.uiTheme),
    frame: false,
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  createTray()
  attachTrayWindowBehavior(mainWindow)
  attachPresenterInput(mainWindow)

  mainWindow.on('ready-to-show', () => {
    applyStartupVisibility(mainWindow)
  })

  const emitMaximized = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized-changed', mainWindow.isMaximized())
    }
  }
  mainWindow.on('maximize', emitMaximized)
  mainWindow.on('unmaximize', emitMaximized)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
