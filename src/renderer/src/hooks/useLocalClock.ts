import { useEffect, useState } from 'react'

export type ClockParts = {
  dateLabel: string
  timeLabel: string
  fullLabel: string
  iso: string
}

function formatClock(now: Date): ClockParts {
  const dateLabel = now.toLocaleDateString('fr-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  const timeLabel = now.toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  return {
    dateLabel,
    timeLabel,
    fullLabel: `${dateLabel} ${timeLabel}`,
    iso: now.toISOString()
  }
}

/** Horloge locale mise à jour chaque seconde (affichage FR). */
export function useLocalClock(): ClockParts {
  const [parts, setParts] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const tick = (): void => setParts(formatClock(new Date()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return parts
}
