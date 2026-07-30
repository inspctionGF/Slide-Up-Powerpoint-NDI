import { app, nativeImage } from 'electron'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { SlideTransitionType } from '../../shared/types'

function transitionDir(): string {
  const dir = join(app.getPath('userData'), 'transition-frames')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function clearTransitionFrames(): void {
  const dir = transitionDir()
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
  mkdirSync(dir, { recursive: true })
}

function sampleBgra(
  buf: Buffer,
  width: number,
  height: number,
  x: number,
  y: number
): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0, 0]
  const i = (y * width + x) * 4
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function frameCountFor(durationMs: number): number {
  const ms = Math.min(1200, Math.max(120, durationMs))
  return Math.min(18, Math.max(4, Math.round(ms / 40)))
}

/**
 * Génère des PNG intermédiaires entre deux images pour l’envoi NDI.
 * Retourne les chemins (sans le frame final = toPath).
 */
export function generateTransitionFrames(
  fromPath: string,
  toPath: string,
  type: SlideTransitionType,
  durationMs: number
): string[] {
  if (type === 'cut') return []

  const fromImg = nativeImage.createFromPath(fromPath)
  const toImg = nativeImage.createFromPath(toPath)
  if (fromImg.isEmpty() || toImg.isEmpty()) return []

  const size = toImg.getSize()
  const width = size.width
  const height = size.height
  if (width < 2 || height < 2) return []

  const fromSized = fromImg.getSize().width === width && fromImg.getSize().height === height
    ? fromImg
    : fromImg.resize({ width, height, quality: 'better' })
  const fromBuf = fromSized.toBitmap()
  const toBuf = toImg.toBitmap()
  if (fromBuf.length !== toBuf.length) return []

  const steps = frameCountFor(durationMs)
  const dir = transitionDir()
  clearTransitionFrames()
  const paths: string[] = []

  for (let step = 1; step < steps; step++) {
    const t = step / steps
    const out = Buffer.alloc(toBuf.length)

    if (type === 'fade') {
      for (let i = 0; i < out.length; i++) {
        out[i] = lerp(fromBuf[i], toBuf[i], t)
      }
    } else if (type === 'slide-left') {
      const offset = Math.round(width * t)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcX = x + offset
          const i = (y * width + x) * 4
          if (srcX < width) {
            const s = sampleBgra(fromBuf, width, height, srcX, y)
            out[i] = s[0]
            out[i + 1] = s[1]
            out[i + 2] = s[2]
            out[i + 3] = s[3]
          } else {
            const s = sampleBgra(toBuf, width, height, srcX - width, y)
            out[i] = s[0]
            out[i + 1] = s[1]
            out[i + 2] = s[2]
            out[i + 3] = s[3]
          }
        }
      }
    } else {
      // zoom : fondu + léger scale de la destination
      const scale = 0.88 + 0.12 * t
      const inv = 1 / scale
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cx = (x - width / 2) * inv + width / 2
          const cy = (y - height / 2) * inv + height / 2
          const sx = Math.round(cx)
          const sy = Math.round(cy)
          const toPx = sampleBgra(toBuf, width, height, sx, sy)
          const fromPx = sampleBgra(fromBuf, width, height, x, y)
          const i = (y * width + x) * 4
          out[i] = lerp(fromPx[0], toPx[0], t)
          out[i + 1] = lerp(fromPx[1], toPx[1], t)
          out[i + 2] = lerp(fromPx[2], toPx[2], t)
          out[i + 3] = lerp(fromPx[3], toPx[3], t)
        }
      }
    }

    const frame = nativeImage.createFromBitmap(out, { width, height })
    const path = join(dir, `frame-${String(step).padStart(3, '0')}.png`)
    writeFileSync(path, frame.toPNG())
    paths.push(path)
  }

  return paths
}
