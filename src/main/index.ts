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
import {
  applyStartupVisibility,
  attachTrayWindowBehavior,
  createTray,
  destroyTray,
  isAppQuitting,
  markAppQuitting
} from './tray'
import { loadConfig } from './config'

registerSlideupScheme()

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Slide-up',
    backgroundColor: '#0c0f12',
    frame: false,
    autoHideMenuBar: true,
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.slideup.app')
  handleSlideupProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
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
      const win = BrowserWindow.getAllWindows()[0]
      win?.show()
    }
  })
})

async function shutdown(): Promise<void> {
  unregisterHotkeys()
  destroyTray()
  stopWatch()
  await slideshowSession.stop()
  await shutdownNdi()
  cleanupTemp()
}

app.on('window-all-closed', () => {
  // Avec tray, les fenêtres masquées ne déclenchent pas all-closed.
  // Si vraiment tout est fermé et qu’on quitte :
  if (isAppQuitting() || process.platform !== 'darwin') {
    void shutdown().finally(() => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  }
})

app.on('before-quit', () => {
  markAppQuitting()
  void shutdown()
})
