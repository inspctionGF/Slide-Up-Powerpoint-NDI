import { useEffect, useState } from 'react'
import {
  IconWinClose,
  IconWinMaximize,
  IconWinMinimize,
  IconWinRestore
} from './Icons'
import './TitleBar.css'

type TitleBarProps = {
  subtitle?: string
}

function TitleBar({ subtitle }: TitleBarProps): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.windowIsMaximized().then(setMaximized)
    return window.api.onWindowMaximized(setMaximized)
  }, [])

  return (
    <header className="titlebar" onDoubleClick={() => void window.api.windowMaximizeToggle()}>
      <div className="titlebar__drag">
        <span className="titlebar__mark" aria-hidden="true" />
        <div className="titlebar__identity">
          <span className="titlebar__brand">Slide-up</span>
          {subtitle ? <span className="titlebar__sub">{subtitle}</span> : null}
        </div>
      </div>

      <div className="titlebar__controls" role="group" aria-label="Contrôles de fenêtre">
        <button
          type="button"
          className="titlebar__btn"
          data-tip="Réduire"
          aria-label="Réduire"
          onClick={() => void window.api.windowMinimize()}
        >
          <IconWinMinimize />
        </button>
        <button
          type="button"
          className="titlebar__btn"
          data-tip={maximized ? 'Restaurer' : 'Agrandir'}
          aria-label={maximized ? 'Restaurer' : 'Agrandir'}
          onClick={() => void window.api.windowMaximizeToggle()}
        >
          {maximized ? <IconWinRestore /> : <IconWinMaximize />}
        </button>
        <button
          type="button"
          className="titlebar__btn titlebar__btn--close"
          data-tip="Fermer"
          aria-label="Fermer"
          onClick={() => void window.api.windowClose()}
        >
          <IconWinClose />
        </button>
      </div>
    </header>
  )
}

export default TitleBar
