import { IconLayers, IconPlay } from '../components/Icons'
import './ModeSelect.css'

type ModeSelectProps = {
  version: string
  onSelectClassic: () => void
  onSelectSlideshow: () => void
}

function ModeSelect({
  version,
  onSelectClassic,
  onSelectSlideshow
}: ModeSelectProps): JSX.Element {
  return (
    <div className="mode">
      <div className="mode__atmosphere" aria-hidden="true" />
      <div className="mode__grain" aria-hidden="true" />

      <header className="mode__hero">
        <h1 className="mode__brand">Slide-up</h1>
        <p className="mode__tagline">
          Diffusez vos diapositives sur le réseau avec transparence réelle, sans
          moniteur dédié.
        </p>
      </header>

      <div className="mode__choices" role="list">
        <button
          type="button"
          className="mode__choice mode__choice--classic"
          role="listitem"
          onClick={onSelectClassic}
        >
          <span className="mode__choice-icon" aria-hidden="true">
            <IconLayers />
          </span>
          <span className="mode__choice-body">
            <span className="mode__choice-label">Mode Classic</span>
            <span className="mode__choice-desc">
              Ouvrez un fichier, parcourez la galerie et envoyez chaque diapositive
              en NDI.
            </span>
          </span>
          <span className="mode__choice-cta">Ouvrir</span>
        </button>

        <button
          type="button"
          className="mode__choice mode__choice--live"
          role="listitem"
          onClick={onSelectSlideshow}
        >
          <span className="mode__choice-icon" aria-hidden="true">
            <IconPlay />
          </span>
          <span className="mode__choice-body">
            <span className="mode__choice-label">Mode SlideShow</span>
            <span className="mode__choice-desc">
              Suivez le diaporama PowerPoint en direct et reflétez la slide active.
            </span>
          </span>
          <span className="mode__choice-cta">Suivre</span>
        </button>
      </div>

      <footer className="mode__foot">
        <span>v{version}</span>
        <span className="mode__foot-sep" aria-hidden="true" />
        <span>Windows · Microsoft PowerPoint requis</span>
      </footer>
    </div>
  )
}

export default ModeSelect
