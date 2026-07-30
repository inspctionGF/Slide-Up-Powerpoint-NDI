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
 * Volontairement limitées aux codes HID standards pour éviter les conflits UI
 * (Space / Enter / Backspace restent hors aliases).
 */
export const PRESENTER_KEY_ALIASES: Record<HotkeyAction, string[]> = {
  prev: ['PageUp'],
  next: ['PageDown'],
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
const BROADCAST_DEBOUNCE_MS = 60

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

function inputToAccelerator(input: Input): string | null {
  if (input.type !== 'keyDown') return null
  if (input.isAutoRepeat) return null

  const parts: string[] = []
  if (input.control || input.meta) parts.push('CommandOrControl')
  if (input.alt) parts.push('Alt')
  if (input.shift) parts.push('Shift')

  const key = input.key
  if (!key) return null

  const mapped = ((): string | null => {
    switch (key) {
      case 'ArrowLeft':
        return 'Left'
      case 'ArrowRight':
        return 'Right'
      case 'ArrowUp':
        return 'Up'
      case 'ArrowDown':
        return 'Down'
      case ' ':
      case 'Spacebar':
        return 'Space'
      case 'Enter':
        return 'Return'
      case 'Escape':
        return 'Escape'
      case 'Backspace':
        return 'Backspace'
      case 'PageUp':
        return 'PageUp'
      case 'PageDown':
        return 'PageDown'
      case '.':
        return 'Period'
      case ',':
        return 'Comma'
      case '+':
        return 'Plus'
      case '-':
        return 'Minus'
      default:
        if (key.length === 1) return key.toUpperCase()
        if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase()
        return key.length <= 16 ? key : null
    }
  })()

  if (!mapped) return null
  if (['Control', 'Shift', 'Alt', 'Meta', 'Command'].includes(mapped)) return null

  parts.push(mapped)
  return normalizeAccelerator(parts.join('+'))
}

/** Touches qui scrollent la page — à absorber quand mappées */
const PREVENT_DEFAULT_ACCELS = new Set(['PageUp', 'PageDown'])

function onBeforeInput(event: Event, input: Input): void {
  const accel = inputToAccelerator(input)
  if (!accel) return
  const action = acceleratorMap.get(accel)
  if (!action) return

  // Absorber PageUp/Down pour éviter le scroll. Laisser passer les lettres
  // et flèches afin de ne pas casser la saisie / les listes des réglages.
  if (PREVENT_DEFAULT_ACCELS.has(accel) || accel.includes('+')) {
    event.preventDefault()
  }
  broadcast(action)
}

/**
 * Capture locale (fenêtre au premier plan) — plus fiable pour les HID
 * USB / Bluetooth que globalShortcut seul.
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
    const all = [...configured, ...aliases]
    const globalOk: string[] = []

    for (const raw of all) {
      const accelerator = normalizeAccelerator(raw)
      if (!accelerator || seenAccel.has(accelerator)) continue
      seenAccel.add(accelerator)
      try {
        const ok = globalShortcut.register(accelerator, () => broadcast(action))
        if (ok) {
          globalOk.push(accelerator)
        }
        // Échec globalShortcut : toléré — before-input-event couvre le 1er plan
        // (souvent le cas pour Left/Right/B sans modificateur sous Windows).
      } catch {
        const isConfigured = configured.some(
          (c) => normalizeAccelerator(c) === accelerator
        )
        if (isConfigured && !map.has(accelerator)) {
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
        ? `Impossible d’enregistrer : ${hardFailures.join(', ')}`
        : null,
    registered
  }

  for (const win of BrowserWindow.getAllWindows()) {
    attachPresenterInput(win)
  }

  return getHotkeyStatus()
}
