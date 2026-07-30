import { BrowserWindow, ipcMain } from 'electron'
import { pushRecentFile } from '../config'
import { cleanupTemp, exportAllSlides } from '../powerpoint/bridge'
import {
  setWatchPaused,
  startWatch,
  stopWatch
} from '../powerpoint/file-watcher'
import type { ExportOptions, ExportProgress, SlideBundle } from '../powerpoint/types'

export function registerPowerpointIpc(): void {
  ipcMain.handle(
    'ppt:exportAll',
    async (event, filePath: string, options: ExportOptions): Promise<SlideBundle> => {
      const win = BrowserWindow.fromWebContents(event.sender)

      const onProgress = (progress: ExportProgress): void => {
        win?.webContents.send('ppt:progress', progress)
      }

      setWatchPaused(true)
      try {
        const bundle = await exportAllSlides(filePath, options, onProgress)
        pushRecentFile(bundle.filePath)
        return bundle
      } finally {
        setWatchPaused(false)
      }
    }
  )

  ipcMain.handle('ppt:cleanup', () => {
    cleanupTemp()
  })

  ipcMain.handle('ppt:watch', (event, filePath: string): { ok: boolean; error?: string } => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return startWatch(typeof filePath === 'string' ? filePath : '', win)
  })

  ipcMain.handle('ppt:unwatch', (): { ok: boolean } => {
    stopWatch()
    return { ok: true }
  })
}
