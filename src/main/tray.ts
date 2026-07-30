import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { loadConfig } from './config'

let tray: Tray | null = null
let quitting = false

export function isAppQuitting(): boolean {
  return quitting
}

export function markAppQuitting(): void {
  quitting = true
}

function trayIcon(): Electron.NativeImage {
  // Icône 16x16 monochrome simple (ambre) pour Windows tray
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
        buf[i] = 58
        buf[i + 1] = 153
        buf[i + 2] = 232
        buf[i + 3] = 255
      } else {
        buf[i + 3] = 0
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

function showMainWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
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
        click: () => {
          markAppQuitting()
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => showMainWindow())
  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

export function attachTrayWindowBehavior(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (quitting) return
    // Avec tray : fermer = masquer
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
    // Ne pas montrer la fenêtre
    return
  }
  win.show()
}

/** Chemin éventuel vers une icône packagée (non requis). */
export function packagedIconPath(): string {
  return join(__dirname, '../../resources/icon.png')
}
