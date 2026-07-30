import { useCallback, useEffect, useState } from 'react'
import type {
  AppConfig,
  HotkeyAction,
  NdiStatus,
  OutputMode,
  SlideshowStatusEvent,
  SlideTransitionType
} from '@shared/types'
import {
  IconArrowLeft,
  IconBroadcast,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconPlay,
  IconSettings,
  IconTransparency
} from '../components/Icons'
import ProductionBar from '../components/ProductionBar'
import SettingsPanel from '../components/SettingsPanel'
import { usePresentationTimer } from '../hooks/usePresentationTimer'
import './SlideshowMode.css'

type SlideshowModeProps = {
  onBack: () => void
}

function SlideshowMode({ onBack }: SlideshowModeProps): JSX.Element {
  const [running, setRunning] = useState(false)
  const [transparent, setTransparent] = useState(true)
  const [statusText, setStatusText] = useState(
    'Démarrez un diaporama dans PowerPoint, puis lancez le suivi.'
  )
  const [error, setError] = useState<string | null>(null)
  const [slideIndex, setSlideIndex] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ndi, setNdi] = useState<NdiStatus | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [screenMode, setScreenMode] = useState<'live' | 'black' | 'white' | 'off'>('off')
  const [outputMode, setOutputMode] = useState<OutputMode>('live')
  const [frozen, setFrozen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const timer = usePresentationTimer()

  useEffect(() => {
    void window.api.getConfig().then((cfg) => {
      setConfig(cfg)
      setTransparent(cfg.transparentByDefault)
    })
    void window.api.ndiGetStatus().then((status) => {
      setNdi(status)
      setFrozen(Boolean(status.frozen))
    })

    const off = window.api.onSlideshowStatus((event: SlideshowStatusEvent) => {
      switch (event.type) {
        case 'position':
          setSlideIndex(event.index)
          setScreenMode('live')
          setOutputMode('live')
          setStatusText(`Diapositive ${event.index} - suivi en cours.`)
          break
        case 'black':
          setSlideIndex(event.index)
          setScreenMode('black')
          setStatusText('Écran noir du diaporama.')
          break
        case 'white':
          setSlideIndex(event.index)
          setScreenMode('white')
          setStatusText('Écran blanc du diaporama.')
          break
        case 'done':
          setScreenMode('off')
          setStatusText('Diaporama terminé.')
          break
        case 'off':
          setScreenMode('off')
          setStatusText('En attente du diaporama PowerPoint…')
          break
        case 'ready':
          setScreenMode('off')
          setStatusText('Présentation ouverte - démarrez le mode diaporama.')
          break
        case 'noppt':
          setError('Microsoft PowerPoint est introuvable.')
          setStatusText('PowerPoint requis.')
          break
        case 'error':
          setError(event.message)
          break
        case 'exported':
          setSlideIndex(event.index)
          setPreviewUrl(event.url)
          setScreenMode('live')
          setOutputMode('live')
          setError(null)
          void (async () => {
            const cfg = await window.api.getConfig()
            setConfig(cfg)
            const frozenNow = (await window.api.ndiGetStatus()).frozen
            if (frozenNow) {
              setFrozen(true)
              setStatusText(
                `Gel actif — aperçu slide ${event.index}, sortie NDI figée.`
              )
              return
            }
            const sent = await window.api.ndiSendTransition({
              path: event.path,
              type: cfg.slideTransitionType,
              durationMs: cfg.slideTransitionMs
            })
            setNdi(sent)
            setFrozen(Boolean(sent.frozen))
            if (sent.lastError) {
              setError(sent.lastError)
              setStatusText(`Slide ${event.index} exportée - échec NDI.`)
            } else {
              setStatusText(`Slide ${event.index} diffusée sur « ${sent.sourceName} ».`)
            }
          })()
          break
      }
    })

    return () => {
      off()
      void window.api.slideshowStop()
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    const cfg = await window.api.getConfig()
    setConfig(cfg)
    const ndiStatus = await window.api.ndiInit(cfg.ndiSourceName)
    setNdi(ndiStatus)
    setFrozen(Boolean(ndiStatus.frozen))
    if (ndiStatus.lastError) {
      setError(ndiStatus.lastError)
    }

    const result = await window.api.slideshowStart({ transparent })
    if (!result.ok) {
      setError(result.error || 'Impossible de démarrer le suivi.')
      setRunning(false)
      return
    }
    setRunning(true)
    setStatusText('Suivi démarré - en attente du diaporama…')
  }, [transparent])

  const stop = useCallback(async () => {
    await window.api.slideshowStop()
    setRunning(false)
    setStatusText('Suivi arrêté.')
  }, [])

  const toggleTransparent = useCallback(async () => {
    const next = !transparent
    setTransparent(next)
    if (running) {
      await window.api.slideshowSetTransparent(next)
      setOutputMode('live')
      setFrozen(false)
      await window.api.ndiSetFrozen(false)
      setStatusText(next ? 'Sans fond activé — texte et formes seuls.' : 'Fond PowerPoint inclus.')
    }
  }, [running, transparent])

  const back = useCallback(async () => {
    await window.api.slideshowStop()
    onBack()
  }, [onBack])

  const applySolidMode = useCallback(
    async (mode: 'black' | 'white') => {
      if (outputMode === mode) {
        setOutputMode('live')
        setFrozen(false)
        await window.api.ndiSetFrozen(false)
        setStatusText('Retour à la sortie live.')
        return
      }
      setFrozen(false)
      setOutputMode(mode)
      const labels = { black: 'Noir', white: 'Blanc' } as const
      void window.api.slideshowCommand(mode)
      const sent = await window.api.ndiSendSolid(mode)
      setNdi(sent)
      setFrozen(Boolean(sent.frozen))
      if (sent.lastError) {
        setError(sent.lastError)
        setStatusText(`Échec NDI - sortie ${labels[mode]}.`)
      } else {
        setError(null)
        setStatusText(`Sortie ${labels[mode]} diffusée sur « ${sent.sourceName} ».`)
      }
    },
    [outputMode]
  )

  /** T / raccourci : diapo sans fond (pas un écran vide). */
  const onTransparentPress = useCallback(async () => {
    if (outputMode !== 'live') {
      setFrozen(false)
      await window.api.ndiSetFrozen(false)
      setOutputMode('live')
      if (transparent) {
        setStatusText('Diapo sans fond diffusée.')
        return
      }
    }
    await toggleTransparent()
  }, [outputMode, toggleTransparent, transparent])

  const toggleFreeze = useCallback(async () => {
    const next = !frozen
    const sent = await window.api.ndiSetFrozen(next)
    setNdi(sent)
    setFrozen(sent.frozen)
    setStatusText(
      sent.frozen
        ? `Gel activé — sortie NDI figée sur « ${sent.sourceName} ».`
        : 'Gel levé.'
    )
  }, [frozen])

  const setFx = useCallback(async (slideTransitionType: SlideTransitionType) => {
    const next = await window.api.setConfig({
      slideTransitionType,
      slideTransitionEffect: slideTransitionType !== 'cut'
    })
    setConfig(next)
  }, [])

  useEffect(() => {
    return window.api.onHotkey((action: HotkeyAction) => {
      if (settingsOpen) return
      if (action === 'prev') void window.api.slideshowCommand('prev')
      else if (action === 'next') void window.api.slideshowCommand('next')
      else if (action === 'black' || action === 'white') {
        void applySolidMode(action)
      } else if (action === 'transparent') {
        void onTransparentPress()
      } else if (action === 'freeze') {
        void toggleFreeze()
      }
    })
  }, [applySolidMode, onTransparentPress, settingsOpen, toggleFreeze])

  const previewClass = [
    'show__preview',
    transparent ? 'show__preview--checker' : '',
    outputMode !== 'live' ? `show__preview--${outputMode}` : `show__preview--${screenMode}`
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`show${settingsOpen ? ' is-settings-open' : ''}`}>
      <div className="show__frame">
        <header className="show__bar">
          <button type="button" className="show__back" onClick={() => void back()}>
            <IconArrowLeft />
            <span>Modes</span>
          </button>
          <div className="show__brand-block">
            <span className="show__brand">Slide-up</span>
            <span className="show__tag">SlideShow</span>
          </div>
          <div className="show__actions">
            <button
              type="button"
              className={`show__btn ${transparent ? 'is-active' : ''}`}
              onClick={() => void toggleTransparent()}
              data-tip="Texte et formes sans fond PowerPoint (PNG alpha)"
            >
              <IconTransparency />
              <span>Sans fond</span>
            </button>
            <button
              type="button"
              className="show__btn"
              onClick={() => setSettingsOpen(true)}
              data-tip="Réglages"
            >
              <IconSettings />
              <span>Réglages</span>
            </button>
            {!running ? (
              <button
                type="button"
                className="show__btn show__btn--primary"
                onClick={() => void start()}
              >
                <IconPlay />
                <span>Démarrer</span>
              </button>
            ) : (
              <button type="button" className="show__btn" onClick={() => void stop()} data-tip="Arrêter">
                <IconClose />
                <span>Arrêter</span>
              </button>
            )}
          </div>
        </header>

        <main className="show__workspace">
          <div className="show__screen">
            <section className={previewClass} aria-label="Aperçu live">
              {outputMode === 'black' && <p className="show__screen-label">Sortie noire</p>}
              {outputMode === 'white' && (
                <p className="show__screen-label is-dark">Sortie blanche</p>
              )}
              {outputMode === 'live' && screenMode === 'black' && (
                <p className="show__screen-label">Écran noir</p>
              )}
              {outputMode === 'live' && screenMode === 'white' && (
                <p className="show__screen-label is-dark">Écran blanc</p>
              )}
              {outputMode === 'live' && screenMode === 'live' && previewUrl && (
                <img
                  src={previewUrl}
                  alt={slideIndex ? `Diapositive ${slideIndex}` : 'Aperçu'}
                />
              )}
              {outputMode === 'live' && screenMode === 'off' && (
                <div className="show__placeholder">
                  <p className="show__placeholder-brand">Slide-up</p>
                  <p>
                    Lancez le suivi, puis démarrez le diaporama dans PowerPoint. La
                    slide active sera exportée et envoyée en NDI automatiquement.
                  </p>
                </div>
              )}

              <div className="show__transport">
                <button
                  type="button"
                  className="show__nav"
                  disabled={!running}
                  onClick={() => void window.api.slideshowCommand('prev')}
                  aria-label="Précédent"
                >
                  <IconChevronLeft />
                </button>
                <button
                  type="button"
                  className="show__nav"
                  disabled={!running}
                  onClick={() => void window.api.slideshowCommand('next')}
                  aria-label="Suivant"
                >
                  <IconChevronRight />
                </button>
                <div className="show__bwt" role="group" aria-label="Sorties NDI">
                  <button
                    type="button"
                    className={`show__bwt-btn ${outputMode === 'black' ? 'is-active' : ''}`}
                    onClick={() => void applySolidMode('black')}
                    data-tip="Sortie noire (NDI)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className={`show__bwt-btn ${outputMode === 'white' ? 'is-active' : ''}`}
                    onClick={() => void applySolidMode('white')}
                    data-tip="Sortie blanche (NDI)"
                  >
                    W
                  </button>
                  <button
                    type="button"
                    className={`show__bwt-btn ${transparent && outputMode === 'live' ? 'is-active' : ''}`}
                    onClick={() => void onTransparentPress()}
                    data-tip="Diapo sans fond PowerPoint (texte / formes)"
                  >
                    T
                  </button>
                </div>
                <span className="show__counter">
                  {slideIndex ? `Slide ${slideIndex}` : '-'}
                  {frozen ? ' · GEL' : ''}
                </span>
                <span className={`show__ndi ${ndi?.ready && !ndi.lastError ? 'is-live' : ''}`}>
                  <IconBroadcast />
                  {ndi?.ready ? ndi.sourceName : 'NDI'}
                </span>
              </div>
            </section>
          </div>
        </main>

        <footer className="show__status">
          <div className="show__status-rack">
            <ProductionBar
              timerLabel={timer.formatted}
              timerRunning={timer.running}
              onTimerToggle={timer.toggle}
              onTimerReset={timer.reset}
              blackoutActive={outputMode === 'black'}
              freezeActive={frozen}
              onBlackout={() => void applySolidMode('black')}
              onFreeze={() => void toggleFreeze()}
              fx={config?.slideTransitionType ?? 'cut'}
              onFxChange={(type) => void setFx(type)}
              disabled={!running}
            />
            <p className="show__status-text">{error ?? statusText}</p>
          </div>
        </footer>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setConfig}
      />
    </div>
  )
}

export default SlideshowMode
