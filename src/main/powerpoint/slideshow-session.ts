import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { app, nativeImage } from 'electron'
import {
  SLIDESHOW_CHECK,
  SLIDESHOW_DIRECT_CMD,
  SLIDESHOW_EXPORT_BG,
  SLIDESHOW_EXPORT_NOBG
} from './slideshow-scripts'
import { toSlideupUrl } from '../protocol'

export type SlideshowCommand = 'prev' | 'next' | 'black' | 'white' | 'pause'

export type SlideshowStatusEvent =
  | { type: 'position'; index: number }
  | { type: 'black'; index: number }
  | { type: 'white'; index: number }
  | { type: 'done'; index: number }
  | { type: 'off' }
  | { type: 'ready' }
  | { type: 'noppt' }
  | { type: 'exported'; index: number; path: string; url: string }
  | { type: 'error'; message: string }

type Listener = (event: SlideshowStatusEvent) => void

function scriptsRoot(): string {
  const root = join(app.getPath('temp'), 'slide-up', 'scripts')
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

function writeScript(name: string, content: string): string {
  const path = join(scriptsRoot(), name)
  writeFileSync(path, content, 'utf8')
  return path
}

function spawnVbs(scriptPath: string, args: string[] = []): ChildProcessWithoutNullStreams {
  return spawn('cscript.exe', ['//NOLOGO', scriptPath, ...args], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
}

export class SlideshowSession {
  private checkProc: ChildProcessWithoutNullStreams | null = null
  private exportProc: ChildProcessWithoutNullStreams | null = null
  private cmdProc: ChildProcessWithoutNullStreams | null = null
  private tempDir: string | null = null
  private transparent = true
  private exportWidth = 0
  private exportHeight = 0
  private lastIndex = -1
  private exporting = false
  private listeners = new Set<Listener>()
  private running = false

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: SlideshowStatusEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  isRunning(): boolean {
    return this.running
  }

  async start(options: {
    transparent: boolean
    width?: number
    height?: number
  }): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error('Le mode SlideShow est disponible uniquement sous Windows.')
    }

    await this.teardownProcesses()

    this.transparent = options.transparent
    this.exportWidth = options.width ?? 0
    this.exportHeight = options.height ?? 0
    this.running = true
    this.lastIndex = -1
    this.tempDir = join(app.getPath('temp'), 'slide-up', `show-${Date.now()}`)
    mkdirSync(this.tempDir, { recursive: true })

    const width = String(this.exportWidth)
    const height = String(this.exportHeight)
    const exportScript = writeScript(
      this.transparent ? 'show-export-nobg.vbs' : 'show-export-bg.vbs',
      this.transparent ? SLIDESHOW_EXPORT_NOBG : SLIDESHOW_EXPORT_BG
    )
    const checkScript = writeScript('show-check.vbs', SLIDESHOW_CHECK)
    const cmdScript = writeScript('show-cmd.vbs', SLIDESHOW_DIRECT_CMD)

    this.exportProc = spawnVbs(exportScript, [this.tempDir, width, height])
    this.attachExportStdout(this.exportProc)

    this.checkProc = spawnVbs(checkScript)
    this.attachCheckStdout(this.checkProc)

    this.cmdProc = spawnVbs(cmdScript)
    this.triggerExport()
  }

  private attachCheckStdout(proc: ChildProcessWithoutNullStreams): void {
    proc.stdout.setEncoding('utf8')
    let buf = ''
    proc.stdout.on('data', (chunk: string) => {
      buf += chunk
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() || ''
      for (const line of lines) this.handleStatusLine(line.trim())
    })
    proc.on('exit', () => {
      if (this.running) {
        this.emit({ type: 'error', message: 'Le sondeur PowerPoint s’est arrêté.' })
      }
    })
  }

  private attachExportStdout(proc: ChildProcessWithoutNullStreams): void {
    proc.stdout.setEncoding('utf8')
    let buf = ''
    proc.stdout.on('data', (chunk: string) => {
      buf += chunk
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() || ''
      for (const line of lines) this.handleExportLine(line.trim())
    })
  }

  private handleStatusLine(line: string): void {
    if (!line) return
    if (line === 'Status: OFF') {
      this.emit({ type: 'off' })
      return
    }
    const black = line.match(/^Status: BLACK (\d+)/)
    if (black) {
      this.emit({ type: 'black', index: parseInt(black[1], 10) })
      return
    }
    const white = line.match(/^Status: WHITE (\d+)/)
    if (white) {
      this.emit({ type: 'white', index: parseInt(white[1], 10) })
      return
    }
    const done = line.match(/^Status: DONE (\d+)/)
    if (done) {
      this.emit({ type: 'done', index: parseInt(done[1], 10) })
      return
    }
    const pos = line.match(/^Status: (\d+)/)
    if (pos) {
      const index = parseInt(pos[1], 10)
      this.emit({ type: 'position', index })
      if (index !== this.lastIndex && index > 0) {
        this.lastIndex = index
        this.triggerExport()
      }
    }
  }

  private handleExportLine(line: string): void {
    this.exporting = false
    if (!line) return
    if (line.includes('PPTNDI: NoPPT')) {
      this.emit({ type: 'noppt' })
      return
    }
    if (line.includes('PPTNDI: Ready')) {
      this.emit({ type: 'ready' })
      return
    }
    if (line.includes('PPTNDI: Black')) {
      this.emit({ type: 'black', index: this.lastIndex })
      return
    }
    if (line.includes('PPTNDI: White')) {
      this.emit({ type: 'white', index: this.lastIndex })
      return
    }
    if (line.includes('PPTNDI: Done')) {
      this.emit({ type: 'done', index: this.lastIndex })
      return
    }
    const sent = line.match(/PPTNDI: Sent .* (\d+)\s*$/)
    if (sent && this.tempDir) {
      const index = parseInt(sent[1], 10)
      const path = join(this.tempDir, 'Slide.png')
      if (existsSync(path)) {
        if (this.transparent && this.exportWidth > 0 && this.exportHeight > 0) {
          try {
            const img = nativeImage.createFromPath(path)
            if (!img.isEmpty()) {
              const size = img.getSize()
              // Jamais d’upscale (pixellisation) — réduire seulement si trop grand
              if (size.width > this.exportWidth || size.height > this.exportHeight) {
                writeFileSync(
                  path,
                  img
                    .resize({
                      width: this.exportWidth,
                      height: this.exportHeight,
                      quality: 'best'
                    })
                    .toPNG()
                )
              }
            }
          } catch {
            // garder le PNG brut
          }
        }
        this.emit({
          type: 'exported',
          index,
          path,
          url: `${toSlideupUrl(path)}&t=${Date.now()}`
        })
      }
    }
  }

  triggerExport(): void {
    if (!this.exportProc || this.exporting) return
    this.exporting = true
    try {
      this.exportProc.stdin.write('\n')
    } catch {
      this.exporting = false
    }
  }

  command(cmd: SlideshowCommand): void {
    if (!this.cmdProc) return
    try {
      this.cmdProc.stdin.write(`${cmd}\n`)
    } catch {
      this.emit({ type: 'error', message: 'Impossible d’envoyer la commande au diaporama.' })
    }
  }

  async setTransparent(transparent: boolean, width = 0, height = 0): Promise<void> {
    if (!this.running || !this.tempDir) return
    this.transparent = transparent
    this.exportWidth = width
    this.exportHeight = height
    if (this.exportProc) {
      try {
        this.exportProc.kill()
      } catch {
        // ignore
      }
      this.exportProc = null
    }
    const exportScript = writeScript(
      this.transparent ? 'show-export-nobg.vbs' : 'show-export-bg.vbs',
      this.transparent ? SLIDESHOW_EXPORT_NOBG : SLIDESHOW_EXPORT_BG
    )
    this.exportProc = spawnVbs(exportScript, [
      this.tempDir,
      String(width),
      String(height)
    ])
    this.attachExportStdout(this.exportProc)
    this.triggerExport()
  }

  private async teardownProcesses(): Promise<void> {
    this.running = false
    for (const proc of [this.checkProc, this.exportProc, this.cmdProc]) {
      if (!proc) continue
      try {
        proc.kill()
      } catch {
        // ignore
      }
    }
    this.checkProc = null
    this.exportProc = null
    this.cmdProc = null
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true })
      } catch {
        // ignore
      }
      this.tempDir = null
    }
  }

  async stop(): Promise<void> {
    this.listeners.clear()
    await this.teardownProcesses()
  }
}

export const slideshowSession = new SlideshowSession()
