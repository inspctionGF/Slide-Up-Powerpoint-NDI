import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import type {
  AppConfig,
  HotkeyAction,
  HotkeyConfig,
  RecentFile,
  SlideTransitionType,
  UiTheme
} from '../shared/types'

export type { AppConfig }

export const MAX_RECENT_FILES = 12

/** Plusieurs touches possibles, séparées par des virgules (pointeurs sans fil inclus). */
export const DEFAULT_HOTKEYS: HotkeyConfig = {
  prev: 'PageUp,Left',
  next: 'PageDown,Right',
  black: 'B,Period',
  white: 'W',
  transparent: 'T',
  freeze: 'F'
}

export const DEFAULT_CONFIG: AppConfig = {
  ndiSourceName: 'Slide-up',
  transparentByDefault: true,
  slideTransitionEffect: false,
  slideTransitionType: 'cut',
  slideTransitionMs: 450,
  exportWidth: 0,
  exportHeight: 0,
  highPerformanceKeepalive: false,
  galleryPosition: 'left',
  galleryColumns: 6,
  galleryRows: 2,
  nextPreviewEnabled: true,
  uiTheme: 'dark',
  minimizeToTrayOnStartup: false,
  selectFirstSlideOnOpen: true,
  hotkeys: { ...DEFAULT_HOTKEYS },
  recentFiles: []
}

const HOTKEY_ACTIONS: HotkeyAction[] = [
  'prev',
  'next',
  'black',
  'white',
  'transparent',
  'freeze'
]

const TRANSITION_TYPES: SlideTransitionType[] = ['cut', 'fade', 'slide-left', 'zoom']

function normalizeTransitionType(raw: unknown, effectFallback: boolean): SlideTransitionType {
  if (typeof raw === 'string' && (TRANSITION_TYPES as string[]).includes(raw)) {
    return raw as SlideTransitionType
  }
  return effectFallback ? 'fade' : DEFAULT_CONFIG.slideTransitionType
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeHotkey(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeHotkeys(raw: Partial<HotkeyConfig> | undefined): HotkeyConfig {
  const source = raw ?? {}
  const next: HotkeyConfig = { ...DEFAULT_HOTKEYS }
  for (const action of HOTKEY_ACTIONS) {
    next[action] = normalizeHotkey(source[action], DEFAULT_HOTKEYS[action])
  }
  return next
}

function normalizePathKey(path: string): string {
  return path.trim().replace(/\//g, '\\').toLowerCase()
}

function normalizeRecentFiles(raw: unknown): RecentFile[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: RecentFile[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Partial<RecentFile>
    if (typeof entry.path !== 'string') continue
    const path = entry.path.trim()
    if (!path) continue
    const key = normalizePathKey(path)
    if (seen.has(key)) continue
    seen.add(key)
    const name =
      typeof entry.name === 'string' && entry.name.trim()
        ? entry.name.trim()
        : basename(path)
    const openedAt =
      typeof entry.openedAt === 'number' && Number.isFinite(entry.openedAt)
        ? entry.openedAt
        : 0
    out.push({ path, name, openedAt })
    if (out.length >= MAX_RECENT_FILES) break
  }
  return out
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function normalizeConfig(raw: Partial<AppConfig>): AppConfig {
  const galleryPosition =
    raw.galleryPosition === 'bottom' || raw.galleryPosition === 'left'
      ? raw.galleryPosition
      : DEFAULT_CONFIG.galleryPosition

  const slideTransitionEffect =
    typeof raw.slideTransitionEffect === 'boolean'
      ? raw.slideTransitionEffect
      : DEFAULT_CONFIG.slideTransitionEffect

  const slideTransitionType = normalizeTransitionType(
    raw.slideTransitionType,
    slideTransitionEffect
  )

  const uiTheme: UiTheme = raw.uiTheme === 'light' ? 'light' : 'dark'

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    ndiSourceName:
      typeof raw.ndiSourceName === 'string' && raw.ndiSourceName.trim()
        ? raw.ndiSourceName.trim()
        : DEFAULT_CONFIG.ndiSourceName,
    galleryPosition,
    galleryColumns: clampInt(raw.galleryColumns, 2, 12, DEFAULT_CONFIG.galleryColumns),
    galleryRows: clampInt(raw.galleryRows, 1, 5, DEFAULT_CONFIG.galleryRows),
    nextPreviewEnabled:
      typeof raw.nextPreviewEnabled === 'boolean'
        ? raw.nextPreviewEnabled
        : DEFAULT_CONFIG.nextPreviewEnabled,
    uiTheme,
    slideTransitionEffect: slideTransitionType !== 'cut',
    slideTransitionType,
    slideTransitionMs: clampInt(raw.slideTransitionMs, 120, 1200, DEFAULT_CONFIG.slideTransitionMs),
    transparentByDefault:
      typeof raw.transparentByDefault === 'boolean'
        ? raw.transparentByDefault
        : DEFAULT_CONFIG.transparentByDefault,
    minimizeToTrayOnStartup:
      typeof raw.minimizeToTrayOnStartup === 'boolean'
        ? raw.minimizeToTrayOnStartup
        : DEFAULT_CONFIG.minimizeToTrayOnStartup,
    selectFirstSlideOnOpen:
      typeof raw.selectFirstSlideOnOpen === 'boolean'
        ? raw.selectFirstSlideOnOpen
        : DEFAULT_CONFIG.selectFirstSlideOnOpen,
    hotkeys: normalizeHotkeys(raw.hotkeys),
    recentFiles: normalizeRecentFiles(raw.recentFiles)
  }
}

export function loadConfig(): AppConfig {
  const path = configPath()
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG, hotkeys: { ...DEFAULT_HOTKEYS } }
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppConfig>
    return normalizeConfig(raw)
  } catch {
    return { ...DEFAULT_CONFIG, hotkeys: { ...DEFAULT_HOTKEYS } }
  }
}

export function saveConfig(partial: Partial<AppConfig>): AppConfig {
  const next = normalizeConfig({ ...loadConfig(), ...partial })
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function pushRecentFile(filePath: string): RecentFile[] {
  const path = filePath.trim()
  if (!path) return loadConfig().recentFiles
  const name = basename(path)
  const key = normalizePathKey(path)
  const current = loadConfig().recentFiles.filter((f) => normalizePathKey(f.path) !== key)
  const next: RecentFile[] = [{ path, name, openedAt: Date.now() }, ...current].slice(
    0,
    MAX_RECENT_FILES
  )
  return saveConfig({ recentFiles: next }).recentFiles
}

export function removeRecentFile(filePath: string): RecentFile[] {
  const key = normalizePathKey(filePath.trim())
  const next = loadConfig().recentFiles.filter((f) => normalizePathKey(f.path) !== key)
  return saveConfig({ recentFiles: next }).recentFiles
}

export function clearRecentFiles(): RecentFile[] {
  return saveConfig({ recentFiles: [] }).recentFiles
}

export function getRecentFiles(): RecentFile[] {
  return loadConfig().recentFiles
}
