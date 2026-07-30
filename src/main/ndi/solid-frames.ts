import { app, nativeImage, screen } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { SolidOutputMode } from '../../shared/types'
import { loadConfig } from '../config'

function solidDir(): string {
  const dir = join(app.getPath('userData'), 'solid-frames')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function primaryDisplaySize(): { width: number; height: number } {
  try {
    const display = screen.getPrimaryDisplay()
    const scale = display.scaleFactor || 1
    return {
      width: Math.round(display.size.width * scale),
      height: Math.round(display.size.height * scale)
    }
  } catch {
    return { width: 1920, height: 1080 }
  }
}

function resolveSize(): { width: number; height: number } {
  const config = loadConfig()
  const fallback = primaryDisplaySize()
  const width = config.exportWidth > 0 ? config.exportWidth : fallback.width
  const height = config.exportHeight > 0 ? config.exportHeight : fallback.height
  return { width, height }
}

function fillBitmap(
  width: number,
  height: number,
  rgba: [number, number, number, number]
): Buffer {
  const buf = Buffer.alloc(width * height * 4)
  const [r, g, b, a] = rgba
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = b
    buf[i + 1] = g
    buf[i + 2] = r
    buf[i + 3] = a
  }
  return buf
}

function colorFor(mode: SolidOutputMode): [number, number, number, number] {
  switch (mode) {
    case 'black':
      return [0, 0, 0, 255]
    case 'white':
      return [255, 255, 255, 255]
    case 'transparent':
      return [0, 0, 0, 0]
  }
}

/** Crée (ou régénère) un PNG plein écran pour l’envoi NDI. */
export function ensureSolidFrame(mode: SolidOutputMode): string {
  const { width, height } = resolveSize()
  const path = join(solidDir(), `${mode}-${width}x${height}.png`)
  const bitmap = fillBitmap(width, height, colorFor(mode))
  const image = nativeImage.createFromBitmap(bitmap, { width, height })
  writeFileSync(path, image.toPNG())
  return path
}
