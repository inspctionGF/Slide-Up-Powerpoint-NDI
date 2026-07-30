import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { loadAppIcon } from './app-icon'
import { loadConfig } from './config'

let tray: Tray | null = null
let quitting = false

export function isAppQuitting(): boolean {
  return quitting
}

export function markAppQuitting(): void {
  quitting = true
}

function trayIconFallback(): Electron.NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inMark =
        (x >= 3 && x <= 12 && y >= 3 && y <= 5) ||
        (x >= 3 && x <= 5 && y >= 3 && y <= 12) ||
        (x >= 3 && x <= 12 && y >= 10 && y <= 12)
      if (inMark) {
        buf[i] = 143
        buf[i + 1] = 25
        buf[i + 2] = 28
        buf[i + 3] = 255
      } else {
        buf[i + 3] = 0
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

function trayIcon(): Electron.NativeImage {
  const fromFile = loadAppIcon(true) ?? loadAppIcon(false)
  if (fromFile) {
    return fromFile.resize({ width: 16, height: 16 })
  }
  return trayIconFallback()
}

export function showMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function quitApp(): void {
  markAppQuitting()
  destroyTray()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.destroy()
    }
  }
  app.quit()
}

export function createTray(): Tray {
  if (tray) return tray

  tray = new Tray(trayIcon())
  tray.setToolTip('Slide-up')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Afficher',
        click: () => showMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => quitApp()
      }
    ])
  )
  tray.on('double-click', () => showMainWindow())
  return tray
}

export function destroyTray(): void {
  if (!tray) return
  try {
    tray.destroy()
  } catch {
    // déjà détruit
  }
  tray = null
}

export function attachTrayWindowBehavior(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (quitting) return
    // Fermer (X) = masquer dans le tray (une seule instance)
    if (tray) {
      event.preventDefault()
      win.hide()
    }
  })
}

export function applyStartupVisibility(win: BrowserWindow): void {
  const config = loadConfig()
  if (config.minimizeToTrayOnStartup) {
    createTray()
    return
  }
  win.show()
}

/** Chemin éventuel vers une icône packagée (non requis). */
export { packagedIconPath } from './app-icon'
