import { useEffect, useState } from 'react'
import './SplashScreen.css'

type SplashScreenProps = {
  version: string
  onDone: () => void
}

const MIN_MS = 5000
const EXIT_MS = 700

function SplashScreen({ version, onDone }: SplashScreenProps): JSX.Element {
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const started = performance.now()
    let frame = 0
    let exitTimer: ReturnType<typeof setTimeout> | null = null
    let finished = false

    const tick = (now: number): void => {
      const elapsed = now - started
      const ratio = Math.min(1, elapsed / MIN_MS)
      // Ease-out curve so the bar feels intentional, not linear.
      const eased = 1 - Math.pow(1 - ratio, 2.4)
      setProgress(Math.round(eased * 100))

      if (elapsed >= MIN_MS && !finished) {
        finished = true
        setProgress(100)
        setExiting(true)
        exitTimer = setTimeout(onDone, EXIT_MS)
        return
      }

      if (!finished) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      if (exitTimer) clearTimeout(exitTimer)
    }
  }, [onDone])

  const status =
    progress < 28
      ? 'Initialisation du moteur NDI…'
      : progress < 58
        ? 'Préparation des ponts PowerPoint…'
        : progress < 88
          ? 'Calibrage de la diffusion…'
          : 'Prêt.'

  return (
    <div
      className={`splash${exiting ? ' is-exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      aria-label="Démarrage de Slide-up"
    >
      <div className="splash__atmosphere" aria-hidden="true" />
      <div className="splash__mesh" aria-hidden="true" />
      <div className="splash__grain" aria-hidden="true" />
      <div className="splash__scan" aria-hidden="true" />

      <div className="splash__stage">
        <div className="splash__mark" aria-hidden="true">
          <span className="splash__orbit splash__orbit--a" />
          <span className="splash__orbit splash__orbit--b" />
          <span className="splash__core" />
        </div>

        <h1 className="splash__brand">Slide-up</h1>
        <p className="splash__tagline">
          Diffusion de diapositives sur le réseau, avec transparence réelle.
        </p>

        <div className="splash__meter" aria-hidden="true">
          <div className="splash__meter-track">
            <div
              className="splash__meter-fill"
              style={{ width: `${progress}%` }}
            />
            <span className="splash__meter-glow" style={{ left: `${progress}%` }} />
          </div>
          <div className="splash__meter-meta">
            <span className="splash__status">{status}</span>
            <span className="splash__pct">{String(progress).padStart(3, '0')}%</span>
          </div>
        </div>

        <footer className="splash__foot">
          <span>v{version || '…'}</span>
          <span className="splash__foot-sep" aria-hidden="true" />
          <span>Windows · démarrage</span>
        </footer>
      </div>
    </div>
  )
}

export default SplashScreen
