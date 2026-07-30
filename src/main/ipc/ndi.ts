import { ipcMain } from 'electron'
import { loadConfig, saveConfig, type AppConfig } from '../config'
import { ndiHelper } from '../ndi/client'
import { ensureSolidFrame } from '../ndi/solid-frames'
import { generateTransitionFrames } from '../ndi/transitions'
import type {
  NdiStatus,
  NdiTransitionRequest,
  SlideTransitionType,
  SolidOutputMode
} from '../../shared/types'

const state: NdiStatus = {
  ready: false,
  sourceName: 'Slide-up',
  lastError: null,
  lastSentPath: null,
  frozen: false
}

let keepaliveTimer: NodeJS.Timeout | null = null
let lastImagePath: string | null = null
let transitionToken = 0
let transitionBusy = false

function stopKeepalive(): void {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer)
    keepaliveTimer = null
  }
}

function startKeepaliveIfNeeded(): void {
  stopKeepalive()
  const config = loadConfig()
  if (!config.highPerformanceKeepalive || !lastImagePath || !state.ready) return
  keepaliveTimer = setInterval(() => {
    if (!lastImagePath || !state.ready) return
    void ndiHelper.send(lastImagePath, true).catch(() => {
      // ignore keepalive errors
    })
  }, 100)
}

function toStatus(): NdiStatus {
  return { ...state }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 150 * (i + 1)))
    }
  }
  throw lastError
}

function isBusyError(message: string | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('ebusy') ||
    m.includes('verrouill') ||
    m.includes('locked') ||
    m.includes('en cours') ||
    m.includes('being used') ||
    m.includes('decoder le png')
  )
}

async function sendPngWithBusyRetry(
  pngPath: string,
  once: boolean
): Promise<{ ok: boolean; error?: string }> {
  let last: { ok: boolean; error?: string } = { ok: false, error: 'Échec d’envoi NDI.' }
  for (let i = 0; i < 6; i++) {
    last = await withRetry(() => ndiHelper.send(pngPath, once), 2)
    if (last.ok) return last
    if (!isBusyError(last.error) || i === 5) return last
    await new Promise((r) => setTimeout(r, 180 * (i + 1)))
  }
  return last
}

async function ensureInit(preferredName?: string): Promise<boolean> {
  const config = loadConfig()
  const name =
    (preferredName && preferredName.trim()) || config.ndiSourceName || 'Slide-up'
  const result = await ndiHelper.init(name)
  if (!result.ok) {
    state.ready = false
    state.lastError = result.error || 'Échec d’initialisation NDI.'
    stopKeepalive()
    return false
  }
  state.ready = true
  state.sourceName = result.sourceName || name
  state.lastError = null
  startKeepaliveIfNeeded()
  return true
}

async function reinit(config: AppConfig): Promise<NdiStatus> {
  try {
    const ok = await ensureInit(config.ndiSourceName)
    if (!ok) return toStatus()
    if (lastImagePath) {
      await ndiHelper.send(lastImagePath, false)
    }
    return toStatus()
  } catch (err) {
    state.ready = false
    state.lastError = err instanceof Error ? err.message : 'Échec NDI.'
    return toStatus()
  }
}

async function sendPath(
  pngPath: string,
  once = false,
  options?: { bypassFreeze?: boolean }
): Promise<NdiStatus> {
  try {
    if (state.frozen && !options?.bypassFreeze) {
      return toStatus()
    }

    if (!state.ready) {
      const ok = await ensureInit()
      if (!ok) return toStatus()
    }

    const result = await sendPngWithBusyRetry(pngPath, Boolean(once))
    if (!result.ok) {
      state.lastError = result.error || 'Échec d’envoi NDI.'
      return toStatus()
    }

    state.lastSentPath = pngPath
    state.lastError = null
    lastImagePath = pngPath
    startKeepaliveIfNeeded()
    return toStatus()
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : 'Échec d’envoi NDI.'
    return toStatus()
  }
}

function resolveTransition(
  requested?: SlideTransitionType
): { type: SlideTransitionType; durationMs: number } {
  const config = loadConfig()
  const type = requested ?? config.slideTransitionType
  const durationMs = config.slideTransitionMs
  return { type, durationMs }
}

async function sendWithTransition(request: NdiTransitionRequest): Promise<NdiStatus> {
  const pngPath = request.path
  if (!pngPath) {
    state.lastError = 'Chemin PNG manquant.'
    return toStatus()
  }

  if (state.frozen) {
    return toStatus()
  }

  const { type, durationMs } = resolveTransition(request.type)
  const ms = request.durationMs ?? durationMs

  if (
    type === 'cut' ||
    !lastImagePath ||
    lastImagePath === pngPath ||
    transitionBusy
  ) {
    return sendPath(pngPath, false)
  }

  const token = ++transitionToken
  transitionBusy = true
  stopKeepalive()

  try {
    const frames = generateTransitionFrames(lastImagePath, pngPath, type, ms)
    for (const frame of frames) {
      if (token !== transitionToken || state.frozen) break
      await sendPngWithBusyRetry(frame, true)
      await new Promise((r) => setTimeout(r, Math.max(16, Math.floor(ms / (frames.length + 1)))))
    }
    if (token !== transitionToken) return toStatus()
    return await sendPath(pngPath, false)
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : 'Échec de transition NDI.'
    return await sendPath(pngPath, false)
  } finally {
    if (token === transitionToken) {
      transitionBusy = false
    }
  }
}

export function registerNdiIpc(): void {
  ipcMain.handle('ndi:getStatus', (): NdiStatus => toStatus())

  ipcMain.handle('ndi:init', async (_event, sourceName?: string): Promise<NdiStatus> => {
    try {
      await ensureInit(sourceName)
      return toStatus()
    } catch (err) {
      state.ready = false
      state.lastError = err instanceof Error ? err.message : 'Échec NDI.'
      stopKeepalive()
      return toStatus()
    }
  })

  ipcMain.handle('ndi:send', async (_event, pngPath: string, once = false): Promise<NdiStatus> => {
    return sendPath(pngPath, once)
  })

  ipcMain.handle(
    'ndi:sendTransition',
    async (_event, request: NdiTransitionRequest): Promise<NdiStatus> => {
      if (!request || typeof request.path !== 'string') {
        state.lastError = 'Requête de transition invalide.'
        return toStatus()
      }
      return sendWithTransition(request)
    }
  )

  ipcMain.handle('ndi:setFrozen', async (_event, frozen: boolean): Promise<NdiStatus> => {
    transitionToken += 1
    transitionBusy = false
    state.frozen = Boolean(frozen)
    stopKeepalive()
    if (state.frozen && lastImagePath && state.ready) {
      // Maintient le dernier frame même sans keepalive config
      keepaliveTimer = setInterval(() => {
        if (!lastImagePath || !state.ready || !state.frozen) return
        void ndiHelper.send(lastImagePath, true).catch(() => undefined)
      }, 100)
      void ndiHelper.send(lastImagePath, true).catch(() => undefined)
    } else {
      startKeepaliveIfNeeded()
    }
    return toStatus()
  })

  ipcMain.handle(
    'ndi:sendSolid',
    async (_event, mode: SolidOutputMode): Promise<NdiStatus> => {
      if (mode !== 'black' && mode !== 'white' && mode !== 'transparent') {
        state.lastError = 'Mode de sortie invalide.'
        return toStatus()
      }
      try {
        // Blackout / fond : annule le gel
        state.frozen = false
        transitionToken += 1
        const path = ensureSolidFrame(mode)
        return await sendPath(path, false, { bypassFreeze: true })
      } catch (err) {
        state.lastError =
          err instanceof Error ? err.message : 'Échec de génération du frame.'
        return toStatus()
      }
    }
  )

  ipcMain.handle('ndi:destroy', async (): Promise<NdiStatus> => {
    stopKeepalive()
    lastImagePath = null
    state.frozen = false
    transitionToken += 1
    transitionBusy = false
    await ndiHelper.destroy()
    state.ready = false
    state.lastSentPath = null
    state.lastError = null
    return toStatus()
  })

  ipcMain.handle('ndi:setSourceName', async (_event, name: string): Promise<NdiStatus> => {
    const config = saveConfig({ ndiSourceName: name })
    return reinit(config)
  })
}

export async function shutdownNdi(): Promise<void> {
  stopKeepalive()
  transitionToken += 1
  await ndiHelper.destroy()
  state.ready = false
  state.frozen = false
}
