import { watch, watchFile, unwatchFile, existsSync, statSync, type FSWatcher } from 'fs'
import type { BrowserWindow } from 'electron'

const DEBOUNCE_MS = 800
const WATCHFILE_INTERVAL_MS = 1000

let watchedPath: string | null = null
let fsWatcher: FSWatcher | null = null
let useWatchFile = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let baselineMtimeMs = 0
let paused = false
let targetWin: BrowserWindow | null = null
let ready = false

function clearDebounce(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function emitChanged(): void {
  if (!watchedPath || !targetWin || targetWin.isDestroyed()) return
  if (paused || !ready) return
  if (!existsSync(watchedPath)) {
    targetWin.webContents.send('ppt:file-changed', { path: watchedPath })
    return
  }
  try {
    const mtimeMs = statSync(watchedPath).mtimeMs
    if (mtimeMs <= baselineMtimeMs) return
    baselineMtimeMs = mtimeMs
    targetWin.webContents.send('ppt:file-changed', { path: watchedPath })
  } catch {
    targetWin.webContents.send('ppt:file-changed', { path: watchedPath })
  }
}

function scheduleEmit(): void {
  if (paused || !ready) return
  clearDebounce()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    emitChanged()
  }, DEBOUNCE_MS)
}

function detachWatchers(): void {
  clearDebounce()
  if (fsWatcher) {
    try {
      fsWatcher.close()
    } catch {
      /* ignore */
    }
    fsWatcher = null
  }
  if (useWatchFile && watchedPath) {
    try {
      unwatchFile(watchedPath)
    } catch {
      /* ignore */
    }
  }
  useWatchFile = false
}

export function setWatchPaused(value: boolean): void {
  paused = value
  if (value) {
    clearDebounce()
  } else if (watchedPath && existsSync(watchedPath)) {
    try {
      baselineMtimeMs = statSync(watchedPath).mtimeMs
    } catch {
      /* ignore */
    }
  }
}

export function stopWatch(): void {
  detachWatchers()
  watchedPath = null
  targetWin = null
  ready = false
  paused = false
  baselineMtimeMs = 0
}

export function startWatch(filePath: string, win: BrowserWindow | null): { ok: boolean; error?: string } {
  const path = filePath.trim()
  if (!path) {
    return { ok: false, error: 'Chemin de fichier manquant.' }
  }
  if (!existsSync(path)) {
    return { ok: false, error: 'Le fichier est introuvable.' }
  }

  stopWatch()
  watchedPath = path
  targetWin = win
  paused = false
  ready = false

  try {
    baselineMtimeMs = statSync(path).mtimeMs
  } catch {
    return { ok: false, error: 'Impossible de lire le fichier.' }
  }

  try {
    fsWatcher = watch(path, { persistent: true }, () => {
      scheduleEmit()
    })
    fsWatcher.on('error', () => {
      // Fallback si fs.watch échoue en cours de route (rename/lock Windows).
      if (!watchedPath || useWatchFile) return
      try {
        fsWatcher?.close()
      } catch {
        /* ignore */
      }
      fsWatcher = null
      useWatchFile = true
      watchFile(watchedPath, { interval: WATCHFILE_INTERVAL_MS }, (curr, prev) => {
        if (curr.mtimeMs !== prev.mtimeMs) scheduleEmit()
      })
    })
  } catch {
    useWatchFile = true
    watchFile(path, { interval: WATCHFILE_INTERVAL_MS }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs) scheduleEmit()
    })
  }

  // Ignore les ticks immédiats juste après le démarrage.
  setTimeout(() => {
    if (watchedPath === path) {
      try {
        if (existsSync(path)) baselineMtimeMs = statSync(path).mtimeMs
      } catch {
        /* ignore */
      }
      ready = true
    }
  }, DEBOUNCE_MS)

  return { ok: true }
}

export function getWatchedPath(): string | null {
  return watchedPath
}
