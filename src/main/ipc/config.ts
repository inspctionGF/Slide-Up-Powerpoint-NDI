import { ipcMain } from 'electron'
import { loadConfig, saveConfig, type AppConfig } from '../config'
import { registerHotkeys } from '../hotkeys'
import { createTray } from '../tray'

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

    return next
  })
}
