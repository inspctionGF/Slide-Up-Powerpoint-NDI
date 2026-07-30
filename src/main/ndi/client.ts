import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export type NdiHelperResponse = {
  ok: boolean
  error?: string
  sourceName?: string
}

function resolveNdiDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'ndi')
  }
  const fromApp = join(app.getAppPath(), 'resources', 'ndi')
  if (existsSync(join(fromApp, 'slideup-ndi.exe'))) {
    return fromApp
  }
  return join(__dirname, '../../resources/ndi')
}

export function resolveHelperPaths(): { exe: string; cwd: string } {
  const dir = resolveNdiDir()
  return {
    exe: join(dir, 'slideup-ndi.exe'),
    cwd: dir
  }
}

export class NdiHelperClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private queue: Array<{
    resolve: (value: NdiHelperResponse) => void
    reject: (reason: Error) => void
    timer: NodeJS.Timeout
  }> = []
  private starting: Promise<void> | null = null

  isRunning(): boolean {
    return Boolean(this.child && !this.child.killed)
  }

  async ensureStarted(): Promise<void> {
    if (this.child && !this.child.killed) return
    if (this.starting) return this.starting

    this.starting = this.spawnHelper()
    try {
      await this.starting
    } finally {
      this.starting = null
    }
  }

  private async spawnHelper(): Promise<void> {
    const { exe, cwd } = resolveHelperPaths()
    if (!existsSync(exe)) {
      throw new Error(
        `Helper NDI introuvable (${exe}). Lancez « npm run build:ndi » puis réessayez.`
      )
    }
    if (!existsSync(join(cwd, 'Processing.NDI.Lib.x64.dll'))) {
      throw new Error(
        'Processing.NDI.Lib.x64.dll manquant à côté du helper. Relancez « npm run build:ndi ».'
      )
    }

    this.child = spawn(exe, [], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    this.child.on('exit', () => {
      this.failAll(new Error('Le helper NDI s’est arrêté de façon inattendue.'))
      this.child = null
    })
    this.child.on('error', (err) => {
      this.failAll(new Error(`Impossible de démarrer le helper NDI : ${err.message}`))
      this.child = null
    })

    const ping = await this.request({ cmd: 'ping' }, 3000)
    if (!ping.ok) {
      throw new Error(ping.error || 'Le helper NDI ne répond pas.')
    }
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk
    let idx = this.buffer.indexOf('\n')
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (line) this.resolveNext(line)
      idx = this.buffer.indexOf('\n')
    }
  }

  private resolveNext(line: string): void {
    const pending = this.queue.shift()
    if (!pending) return
    clearTimeout(pending.timer)
    try {
      const parsed = JSON.parse(line) as NdiHelperResponse
      pending.resolve(parsed)
    } catch {
      pending.reject(new Error(`Réponse NDI invalide : ${line}`))
    }
  }

  private failAll(error: Error): void {
    const items = this.queue.splice(0, this.queue.length)
    for (const item of items) {
      clearTimeout(item.timer)
      item.reject(error)
    }
  }

  async request(
    payload: Record<string, unknown>,
    timeoutMs = 15000
  ): Promise<NdiHelperResponse> {
    await this.ensureStarted()
    if (!this.child || !this.child.stdin.writable) {
      throw new Error('Le helper NDI n’est pas disponible.')
    }

    return new Promise<NdiHelperResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((q) => q.timer === timer)
        if (idx >= 0) this.queue.splice(idx, 1)
        reject(new Error('Délai dépassé en attendant le helper NDI.'))
      }, timeoutMs)

      this.queue.push({ resolve, reject, timer })
      this.child!.stdin.write(`${JSON.stringify(payload)}\n`)
    })
  }

  async init(name: string): Promise<NdiHelperResponse> {
    return this.request({ cmd: 'init', name }, 10000)
  }

  async send(path: string, once = false): Promise<NdiHelperResponse> {
    return this.request({ cmd: 'send', path, once }, 20000)
  }

  async destroy(): Promise<void> {
    if (!this.child) return
    try {
      await this.request({ cmd: 'destroy' }, 3000)
    } catch {
      // ignore
    }
    this.kill()
  }

  kill(): void {
    this.failAll(new Error('Helper NDI arrêté.'))
    if (this.child) {
      try {
        this.child.stdin.end()
      } catch {
        // ignore
      }
      try {
        this.child.kill()
      } catch {
        // ignore
      }
      this.child = null
    }
  }
}

export const ndiHelper = new NdiHelperClient()
