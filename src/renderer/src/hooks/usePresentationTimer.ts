import { useCallback, useEffect, useRef, useState } from 'react'

export type PresentationTimer = {
  elapsedMs: number
  running: boolean
  formatted: string
  play: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function usePresentationTimer(): PresentationTimer {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running, setRunning] = useState(false)
  const startedAt = useRef<number | null>(null)
  const baseMs = useRef(0)
  const raf = useRef<number | null>(null)

  const tick = useCallback(() => {
    if (startedAt.current == null) return
    setElapsedMs(baseMs.current + (performance.now() - startedAt.current))
    raf.current = requestAnimationFrame(tick)
  }, [])

  const stopRaf = useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }, [])

  const play = useCallback(() => {
    if (startedAt.current != null) return
    startedAt.current = performance.now()
    setRunning(true)
    raf.current = requestAnimationFrame(tick)
  }, [tick])

  const pause = useCallback(() => {
    if (startedAt.current == null) return
    baseMs.current += performance.now() - startedAt.current
    startedAt.current = null
    setElapsedMs(baseMs.current)
    setRunning(false)
    stopRaf()
  }, [stopRaf])

  const toggle = useCallback(() => {
    if (startedAt.current == null) play()
    else pause()
  }, [pause, play])

  const reset = useCallback(() => {
    stopRaf()
    startedAt.current = null
    baseMs.current = 0
    setElapsedMs(0)
    setRunning(false)
  }, [stopRaf])

  useEffect(() => () => stopRaf(), [stopRaf])

  return {
    elapsedMs,
    running,
    formatted: formatElapsed(elapsedMs),
    play,
    pause,
    toggle,
    reset
  }
}
