import { spawn } from 'child_process'
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { EXPORT_ALL_BG, EXPORT_ALL_NOBG } from './scripts'
import { toSlideupUrl } from '../protocol'
import type { ExportOptions, ExportProgress, SlideBundle, SlideMeta } from './types'

let activeTempDir: string | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Attend qu’un PNG soit lisible (évite EBUSY juste après l’export COM). */
async function waitForReadablePng(path: string, attempts = 8): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      if (!existsSync(path)) {
        await sleep(80 * (i + 1))
        continue
      }
      const fd = openSync(path, 'r')
      closeSync(fd)
      return true
    } catch {
      await sleep(100 * (i + 1))
    }
  }
  return existsSync(path)
}

function ensureTempRoot(): string {
  const root = join(app.getPath('temp'), 'slide-up')
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true })
  }
  return root
}

function createSessionDir(): string {
  const dir = join(ensureTempRoot(), String(Date.now()))
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeScript(content: string, name: string): string {
  const scriptPath = join(ensureTempRoot(), name)
  writeFileSync(scriptPath, content, 'utf8')
  return scriptPath
}

function parseHidden(tempDir: string): Set<number> {
  const file = join(tempDir, 'hidden.dat')
  if (!existsSync(file)) return new Set()
  return new Set(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => parseInt(l.trim(), 10))
      .filter((n) => !Number.isNaN(n))
  )
}

function parseEffects(tempDir: string): Map<number, { entryEffect: number; duration: number }> {
  const file = join(tempDir, 'slideEffect.dat')
  const map = new Map<number, { entryEffect: number; duration: number }>()
  if (!existsSync(file)) return map
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [i, e, d] = line.split(',')
    const index = parseInt(i, 10)
    if (Number.isNaN(index)) continue
    map.set(index, {
      entryEffect: parseInt(e, 10) || 0,
      duration: parseFloat(d) || 0
    })
  }
  return map
}

function runCscript(
  scriptPath: string,
  args: string[],
  onProgress?: (p: ExportProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'cscript.exe',
      ['//NOLOGO', '//E:jscript', scriptPath, ...args],
      { windowsHide: true }
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8')
      stdout += text
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/PPTNDI: Progress (\d+) (\d+)/)
        if (m && onProgress) {
          onProgress({
            current: parseInt(m[1], 10),
            total: parseInt(m[2], 10),
            message: `Export de la diapositive ${m[1]} / ${m[2]}`
          })
        }
      }
    })

    child.stderr.on('data', (buf: Buffer) => {
      stderr += buf.toString('utf8')
    })

    child.on('error', (err) => {
      reject(new Error(`Impossible de lancer cscript : ${err.message}`))
    })

    child.on('close', (code) => {
      if (stdout.includes('PPTNDI: NoPPT')) {
        reject(
          new Error(
            'Microsoft PowerPoint est introuvable. Installez Office pour exporter les diapositives.'
          )
        )
        return
      }
      if (stdout.includes('PPTNDI: OpenFail')) {
        reject(new Error('Impossible d’ouvrir la présentation PowerPoint.'))
        return
      }
      if (code !== 0 && !stdout.includes('PPTNDI: Loaded')) {
        reject(
          new Error(
            stderr.trim() ||
              `L’export PowerPoint a échoué (code ${code ?? 'inconnu'}).`
          )
        )
        return
      }
      resolve()
    })
  })
}

export async function exportAllSlides(
  filePath: string,
  options: ExportOptions,
  onProgress?: (p: ExportProgress) => void
): Promise<SlideBundle> {
  if (process.platform !== 'win32') {
    throw new Error('L’export PowerPoint via COM est disponible uniquement sous Windows.')
  }

  cleanupTemp()

  const tempDir = createSessionDir()
  activeTempDir = tempDir

  const script = options.transparent ? EXPORT_ALL_NOBG : EXPORT_ALL_BG
  const scriptPath = writeScript(script, options.transparent ? 'export-nobg.js' : 'export-bg.js')
  const width = String(options.width ?? 0)
  const height = String(options.height ?? 0)

  onProgress?.({ current: 0, total: 0, message: 'Ouverture de PowerPoint…' })

  await runCscript(scriptPath, [filePath, tempDir, width, height], onProgress)

  const hidden = parseHidden(tempDir)
  const effects = parseEffects(tempDir)
  const slides: SlideMeta[] = []

  for (let i = 1; ; i++) {
    const png = join(tempDir, `Slide${i}.png`)
    const ready = await waitForReadablePng(png, i === 1 ? 10 : 4)
    if (!ready) break
    const fx = effects.get(i)
    slides.push({
      index: i,
      path: png,
      url: toSlideupUrl(png),
      hidden: hidden.has(i),
      entryEffect: fx?.entryEffect,
      duration: fx?.duration
    })
  }

  if (slides.length === 0) {
    throw new Error('Aucune diapositive exportée. Vérifiez le fichier PowerPoint.')
  }

  return {
    tempDir,
    slides,
    filePath,
    transparent: options.transparent
  }
}

export function cleanupTemp(): void {
  if (!activeTempDir) return
  try {
    rmSync(activeTempDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
  activeTempDir = null
}
