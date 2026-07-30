import type { SlideTransitionType } from '@shared/types'
import { useLocalClock } from '../hooks/useLocalClock'
import {
  IconBlackout,
  IconCalendar,
  IconClock,
  IconFreeze,
  IconPause,
  IconPlay,
  IconReset
} from './Icons'
import './ProductionBar.css'

export const FX_OPTIONS: { value: SlideTransitionType; label: string; title: string }[] = [
  { value: 'cut', label: 'CUT', title: 'Couper (instantané)' },
  { value: 'fade', label: 'FADE', title: 'Fondu' },
  { value: 'slide-left', label: 'SLIDE', title: 'Glissement gauche' },
  { value: 'zoom', label: 'ZOOM', title: 'Zoom' }
]

type ProductionBarProps = {
  timerLabel: string
  timerRunning: boolean
  onTimerToggle: () => void
  onTimerReset: () => void
  blackoutActive: boolean
  freezeActive: boolean
  onBlackout: () => void
  onFreeze: () => void
  fx: SlideTransitionType
  onFxChange: (type: SlideTransitionType) => void
  disabled?: boolean
}

function ProductionBar({
  timerLabel,
  timerRunning,
  onTimerToggle,
  onTimerReset,
  blackoutActive,
  freezeActive,
  onBlackout,
  onFreeze,
  fx,
  onFxChange,
  disabled
}: ProductionBarProps): JSX.Element {
  const clock = useLocalClock()

  return (
    <div className="prod-bar" role="toolbar" aria-label="Contrôles de production">
      <div className="prod-bar__segment prod-bar__timer">
        <IconClock className="prod-bar__clock" />
        <span className="prod-bar__time" aria-live="polite" data-tip="Chronomètre de présentation">
          {timerLabel}
        </span>
        <button
          type="button"
          className={`prod-bar__icon-btn${timerRunning ? ' is-on' : ''}`}
          onClick={onTimerToggle}
          disabled={disabled}
          data-tip={timerRunning ? 'Pause du chrono' : 'Démarrer le chrono'}
          aria-label={timerRunning ? 'Pause du chrono' : 'Démarrer le chrono'}
        >
          {timerRunning ? <IconPause /> : <IconPlay />}
        </button>
        <button
          type="button"
          className="prod-bar__icon-btn"
          onClick={onTimerReset}
          disabled={disabled}
          data-tip="Réinitialiser le chrono"
          aria-label="Réinitialiser le chrono"
        >
          <IconReset />
        </button>
        <span className="prod-bar__sep" aria-hidden="true" />
        <IconCalendar className="prod-bar__calendar" />
        <time
          className="prod-bar__datetime"
          dateTime={clock.iso}
          aria-label={`Date et heure : ${clock.fullLabel}`}
          data-tip="Date et heure locales"
        >
          <span className="prod-bar__date">{clock.dateLabel}</span>
          <span className="prod-bar__clock-time">{clock.timeLabel}</span>
        </time>
      </div>

      <div className="prod-bar__segment prod-bar__outs" role="group" aria-label="Sortie">
        <button
          type="button"
          className={`prod-bar__chip prod-bar__chip--noir${blackoutActive ? ' is-active' : ''}`}
          onClick={onBlackout}
          disabled={disabled}
          data-tip="Noir (blackout)"
          aria-pressed={blackoutActive}
        >
          <IconBlackout />
          <span>Noir</span>
        </button>
        <button
          type="button"
          className={`prod-bar__chip prod-bar__chip--gel${freezeActive ? ' is-active' : ''}`}
          onClick={onFreeze}
          disabled={disabled}
          data-tip="Gel de la sortie NDI"
          aria-pressed={freezeActive}
        >
          <IconFreeze />
          <span>Gel</span>
        </button>
      </div>

      <div className="prod-bar__segment prod-bar__fx" role="group" aria-label="Effet de transition">
        <span className="prod-bar__fx-label">FX</span>
        <div className="prod-bar__fx-track">
          {FX_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`prod-bar__fx-btn${fx === option.value ? ' is-active' : ''}`}
              onClick={() => onFxChange(option.value)}
              disabled={disabled}
              data-tip={option.title}
              aria-pressed={fx === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProductionBar
