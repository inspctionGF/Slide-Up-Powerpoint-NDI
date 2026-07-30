import { BrowserWindow, ipcMain } from 'electron'
import { loadConfig, saveConfig, type AppConfig } from '../config'
import { registerHotkeys } from '../hotkeys'
import { createTray } from '../tray'

export function windowBackgroundForTheme(theme: AppConfig['uiTheme'] | undefined): string {
  return theme === 'light' ? '#e8edf2' : '#0c0f12'
}

export function applyWindowTheme(theme: AppConfig['uiTheme'] | undefined): void {
  const color = windowBackgroundForTheme(theme)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.setBackgroundColor(color)
    }
  }
}

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', (): AppConfig => loadConfig())

  ipcMain.handle('config:set', (_event, partial: Partial<AppConfig>): AppConfig => {
    const next = saveConfig(partial ?? {})

    if (partial?.hotkeys) {
      registerHotkeys(next.hotkeys)
    }

    if (partial?.minimizeToTrayOnStartup === true) {
      createTray()
    }

    if (partial?.uiTheme) {
      applyWindowTheme(next.uiTheme)
    }

    return next
  })
}
