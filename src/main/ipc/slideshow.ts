import { BrowserWindow, ipcMain } from 'electron'
import { loadConfig } from '../config'
import {
  slideshowSession,
  type SlideshowCommand
} from '../powerpoint/slideshow-session'

let boundWebContentsId: number | null = null

export function registerSlideshowIpc(): void {
  ipcMain.handle(
    'slideshow:start',
    async (
      event,
      options?: { transparent?: boolean }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const config = loadConfig()
        const win = BrowserWindow.fromWebContents(event.sender)
        boundWebContentsId = event.sender.id

        await slideshowSession.stop()

        slideshowSession.onEvent((status) => {
          if (!win || win.isDestroyed()) return
          if (boundWebContentsId !== event.sender.id) return
          win.webContents.send('ppt:slideshow-status', status)
        })

        await slideshowSession.start({
          transparent: options?.transparent ?? config.transparentByDefault,
          width: config.exportWidth,
          height: config.exportHeight
        })
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Impossible de démarrer le SlideShow.'
        }
      }
    }
  )

  ipcMain.handle('slideshow:stop', async () => {
    boundWebContentsId = null
    await slideshowSession.stop()
    return { ok: true }
  })

  ipcMain.handle('slideshow:command', async (_event, cmd: SlideshowCommand) => {
    slideshowSession.command(cmd)
    return { ok: true }
  })

  ipcMain.handle('slideshow:setTransparent', async (_event, transparent: boolean) => {
    const config = loadConfig()
    await slideshowSession.setTransparent(
      transparent,
      config.exportWidth,
      config.exportHeight
    )
    return { ok: true }
  })
}
