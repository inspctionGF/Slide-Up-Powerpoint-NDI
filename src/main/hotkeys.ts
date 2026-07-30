import { BrowserWindow, globalShortcut, type Event, type Input } from 'electron'
import type { HotkeyAction, HotkeyConfig } from '../shared/types'
import { DEFAULT_HOTKEYS, loadConfig } from './config'

export type HotkeyStatus = {
  ok: boolean
  error: string | null
  registered: Partial<Record<HotkeyAction, string>>
}

let lastStatus: HotkeyStatus = {
  ok: true,
  error: null,
  registered: {}
}

/** Actions pilotables au clavier / télécommande */
const ACTIONS: HotkeyAction[] = ['prev', 'next', 'black', 'white', 'transparent', 'freeze']

/**
 * Touches typiques des pointeurs / télécommandes sans fil
 * (Logitech R400/R800, Kensington, etc.), en plus des raccourcis configurés.
 * Inclut variantes HID clavier + touches média / navigateur.
 */
export const PRESENTER_KEY_ALIASES: Record<HotkeyAction, string[]> = {
  prev: ['PageUp', 'MediaPreviousTrack', 'BrowserBack'],
  next: ['PageDown', 'MediaNextTrack', 'BrowserForward'],
  black: ['Period'],
  white: [],
  transparent: [],
  freeze: []
}

/** Accélérateurs actifs → action (config + aliases pointeur) */
let acceleratorMap = new Map<string, HotkeyAction>()

const attachedWindows = new WeakSet<BrowserWindow>()

/** Évite le double feu globalShortcut + before-input-event */
let lastBroadcastAt = 0
let lastBroadcastAction: HotkeyAction | null = null
const BROADCAST_DEBOUNCE_MS = 80

function broadcast(action: HotkeyAction): void {
  const now = Date.now()
  if (action === lastBroadcastAction && now - lastBroadcastAt < BROADCAST_DEBOUNCE_MS) {
    return
  }
  lastBroadcastAt = now
  lastBroadcastAction = action

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('hotkey:triggered', action)
    }
  }
}

function normalizeAccelerator(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/\bArrowLeft\b/gi, 'Left')
    .replace(/\bArrowRight\b/gi, 'Right')
    .replace(/\bArrowUp\b/gi, 'Up')
    .replace(/\bArrowDown\b/gi, 'Down')
    .replace(/\bEnter\b/gi, 'Return')
    .replace(/\bEsc\b/gi, 'Escape')
    .replace(/\bMediaTrackPrevious\b/gi, 'MediaPreviousTrack')
    .replace(/\bMediaTrackNext\b/gi, 'MediaNextTrack')
}

/** Parse une valeur config : "PageUp,Left" ou "CommandOrControl+Shift+B" */
export function parseAccelerators(raw: string): string[] {
  if (!raw.trim()) return []
  const parts: string[] = []
  let buf = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === ',') {
      const n = normalizeAccelerator(buf)
      if (n) parts.push(n)
      buf = ''
    } else {
      buf += ch
    }
  }
  const last = normalizeAccelerator(buf)
  if (last) parts.push(last)
  return parts
}

function collectAccelerators(config: HotkeyConfig): Map<string, HotkeyAction> {
  const map = new Map<string, HotkeyAction>()

  for (const action of ACTIONS) {
    const fromConfig = parseAccelerators(config[action] || DEFAULT_HOTKEYS[action])
    const fromPresenter = PRESENTER_KEY_ALIASES[action] ?? []
    for (const accel of [...fromPresenter, ...fromConfig]) {
      const key = normalizeAccelerator(accel)
      if (!key) continue
      map.set(key, action)
    }
  }

  return map
}

const CODE_TO_ACCEL: Record<string, string> = {
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Space: 'Space',
  Enter: 'Return',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Period: 'Period',
  Comma: 'Comma',
  MediaTrackPrevious: 'MediaPreviousTrack',
  MediaTrackNext: 'MediaNextTrack',
  BrowserBack: 'BrowserBack',
  BrowserForward: 'BrowserForward'
}

function inputToAccelerator(input: Input): string | null {
  if (input.type !== 'keyDown') return null
  if (input.isAutoRepeat) return null

  const parts: string[] = []
  if (input.control || input.meta) parts.push('CommandOrControl')
  if (input.alt) parts.push('Alt')
  if (input.shift) parts.push('Shift')

  const key = input.key
  const code = input.code

  let mapped: string | null = null

  if (key) {
    switch (key) {
      case 'ArrowLeft':
        mapped = 'Left'
        break
      case 'ArrowRight':
        mapped = 'Right'
        break
      case 'ArrowUp':
        mapped = 'Up'
        break
      case 'ArrowDown':
        mapped = 'Down'
        break
      case ' ':
      case 'Spacebar':
        mapped = 'Space'
        break
      case 'Enter':
        mapped = 'Return'
        break
      case 'Escape':
        mapped = 'Escape'
        break
      case 'Backspace':
        mapped = 'Backspace'
        break
      case 'PageUp':
        mapped = 'PageUp'
        break
      case 'PageDown':
        mapped = 'PageDown'
        break
      case '.':
        mapped = 'Period'
        break
      case ',':
        mapped = 'Comma'
        break
      case '+':
        mapped = 'Plus'
        break
      case '-':
        mapped = 'Minus'
        break
      case 'MediaTrackPrevious':
      case 'MediaPreviousTrack':
        mapped = 'MediaPreviousTrack'
        break
      case 'MediaTrackNext':
      case 'MediaNextTrack':
        mapped = 'MediaNextTrack'
        break
      case 'BrowserBack':
        mapped = 'BrowserBack'
        break
      case 'BrowserForward':
        mapped = 'BrowserForward'
        break
      case 'Unidentified':
      case 'Dead':
        mapped = null
        break
      default:
        if (key.length === 1) mapped = key.toUpperCase()
        else if (/^F\d{1,2}$/i.test(key)) mapped = key.toUpperCase()
        else if (key.length <= 24) mapped = key
        break
    }
  }

  // Repli : code physique HID (pointeurs qui envoient key=Unidentified)
  if (!mapped && code) {
    mapped = CODE_TO_ACCEL[code] ?? null
    if (!mapped && /^Key[A-Z]$/.test(code)) {
      mapped = code.slice(3)
    }
  }

  if (!mapped) return null
  if (['Control', 'Shift', 'Alt', 'Meta', 'Command'].includes(mapped)) return null

  parts.push(mapped)
  return normalizeAccelerator(parts.join('+'))
}

/** Touches qui scrollent la page — à absorber quand mappées */
const PREVENT_DEFAULT_ACCELS = new Set([
  'PageUp',
  'PageDown',
  'MediaPreviousTrack',
  'MediaNextTrack',
  'BrowserBack',
  'BrowserForward'
])

function onBeforeInput(event: Event, input: Input): void {
  const accel = inputToAccelerator(input)
  if (!accel) return
  const action = acceleratorMap.get(accel)
  if (!action) return

  if (PREVENT_DEFAULT_ACCELS.has(accel) || accel.includes('+')) {
    event.preventDefault()
  }
  broadcast(action)
}

/**
 * Capture locale (fenêtre au premier plan) — complément à globalShortcut
 * pour les HID USB / Bluetooth.
 */
export function attachPresenterInput(win: BrowserWindow): void {
  if (attachedWindows.has(win) || win.isDestroyed()) return
  attachedWindows.add(win)
  win.webContents.on('before-input-event', onBeforeInput)
}

export function getHotkeyStatus(): HotkeyStatus {
  return { ...lastStatus, registered: { ...lastStatus.registered } }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
  acceleratorMap = new Map()
  lastStatus = { ok: true, error: null, registered: {} }
}

function tryRegisterGlobal(accelerator: string, action: HotkeyAction): boolean {
  try {
    return globalShortcut.register(accelerator, () => broadcast(action))
  } catch {
    return false
  }
}

export function registerHotkeys(hotkeys?: HotkeyConfig): HotkeyStatus {
  unregisterHotkeys()
  const config = hotkeys ?? loadConfig().hotkeys ?? DEFAULT_HOTKEYS
  const map = collectAccelerators(config)
  acceleratorMap = map

  const registered: Partial<Record<HotkeyAction, string>> = {}
  const hardFailures: string[] = []
  const seenAccel = new Set<string>()

  for (const action of ACTIONS) {
    const configured = parseAccelerators(config[action] || DEFAULT_HOTKEYS[action])
    const aliases = PRESENTER_KEY_ALIASES[action] ?? []
    // Aliases pointeur en premier : PageUp/PageDown doivent être globaux
    // même si PowerPoint a le focus.
    const all = [...aliases, ...configured]
    const globalOk: string[] = []

    for (const raw of all) {
      const accelerator = normalizeAccelerator(raw)
      if (!accelerator || seenAccel.has(accelerator)) continue
      seenAccel.add(accelerator)
      const ok = tryRegisterGlobal(accelerator, action)
      if (ok) {
        globalOk.push(accelerator)
      } else {
        const isPresenterAlias = aliases.some((a) => normalizeAccelerator(a) === accelerator)
        const isConfigured = configured.some((c) => normalizeAccelerator(c) === accelerator)
        // PageUp/Down critiques pour les pointeurs : signaler l’échec
        if (isPresenterAlias || (isConfigured && (accelerator === 'PageUp' || accelerator === 'PageDown'))) {
          hardFailures.push(`${action} (${accelerator})`)
        }
      }
    }

    registered[action] = configured.join(', ') || globalOk.join(', ') || aliases.join(', ')
  }

  lastStatus = {
    ok: hardFailures.length === 0,
    error:
      hardFailures.length > 0
        ? `Impossible d’enregistrer : ${hardFailures.join(', ')} (une autre app détient peut‑être ces touches)`
        : null,
    registered
  }

  for (const win of BrowserWindow.getAllWindows()) {
    attachPresenterInput(win)
  }

  return getHotkeyStatus()
}
