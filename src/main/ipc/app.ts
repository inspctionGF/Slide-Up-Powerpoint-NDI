import { app, dialog, BrowserWindow, ipcMain, screen } from 'electron'
import { existsSync } from 'fs'
import { extname } from 'path'
import type { OpenDialogReturnValue } from 'electron'
import type {
  DisplayResolution,
  HotkeyConfig,
  OpenPathResult,
  RecentFile
} from '../../shared/types'
import {
  clearRecentFiles,
  getRecentFiles,
  pushRecentFile,
  removeRecentFile
} from '../config'
import { getHotkeyStatus, registerHotkeys, type HotkeyStatus } from '../hotkeys'

const PPT_EXTENSIONS = new Set(['.pptx', '.ppt', '.ppsx', '.pps'])

function isPresentationPath(filePath: string): boolean {
  return PPT_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function listDisplayResolutions(): DisplayResolution[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display, index) => {
    const scale = display.scaleFactor || 1
    const width = Math.round(display.size.width * scale)
    const height = Math.round(display.size.height * scale)
    const primary = display.id === primaryId
    const name =
      display.label?.trim() ||
      (primary ? 'Écran principal' : `Écran ${index + 1}`)
    return {
      id: display.id,
      label: `${name} · ${width}×${height}`,
      width,
      height,
      primary
    }
  })
}

export function registerAppIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:getDisplayResolutions', (): DisplayResolution[] =>
    listDisplayResolutions()
  )

  ipcMain.handle('app:openPresentation', async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Ouvrir une présentation',
      filters: [
        { name: 'PowerPoint', extensions: ['pptx', 'ppt', 'ppsx', 'pps'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile' as const]
    }

    const result: OpenDialogReturnValue = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const path = result.filePaths[0]
    pushRecentFile(path)
    return path
  })

  ipcMain.handle('app:getRecentFiles', (): RecentFile[] => getRecentFiles())

  ipcMain.handle('app:clearRecentFiles', (): RecentFile[] => clearRecentFiles())

  ipcMain.handle('app:removeRecentFile', (_event, filePath: string): RecentFile[] =>
    removeRecentFile(typeof filePath === 'string' ? filePath : '')
  )

  ipcMain.handle('app:openPath', (_event, filePath: string): OpenPathResult => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return { ok: false, error: 'Chemin de fichier manquant.' }
    }
    const path = filePath.trim()
    if (!existsSync(path)) {
      return { ok: false, error: 'Ce fichier est introuvable sur le disque.' }
    }
    if (!isPresentationPath(path)) {
      return {
        ok: false,
        error: 'Ce fichier n’est pas une présentation PowerPoint prise en charge.'
      }
    }
    pushRecentFile(path)
    return { ok: true, path }
  })

  ipcMain.handle('app:setAlwaysOnTop', (_event, enabled: boolean): boolean => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return false
    win.setAlwaysOnTop(Boolean(enabled))
    return win.isAlwaysOnTop()
  })

  ipcMain.handle('app:isAlwaysOnTop', (): boolean => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    return win?.isAlwaysOnTop() ?? false
  })

  ipcMain.handle('app:windowMinimize', (): void => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.minimize()
  })

  ipcMain.handle('app:windowMaximizeToggle', (): boolean => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })

  ipcMain.handle('app:windowClose', (): void => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.close()
  })

  ipcMain.handle('app:windowIsMaximized', (): boolean => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    return win?.isMaximized() ?? false
  })

  ipcMain.handle(
    'app:registerHotkeys',
    (_event, hotkeys?: HotkeyConfig): HotkeyStatus => registerHotkeys(hotkeys)
  )

  ipcMain.handle('app:getHotkeyStatus', (): HotkeyStatus => getHotkeyStatus())
}
