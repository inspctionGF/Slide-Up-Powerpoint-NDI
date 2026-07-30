import { useCallback, useEffect, useState } from 'react'
import ModeSelect from './modes/ModeSelect'
import ClassicMode from './modes/ClassicMode'
import SlideshowMode from './modes/SlideshowMode'
import SplashScreen from './components/SplashScreen'
import TitleBar from './components/TitleBar'
import TooltipProvider from './components/TooltipProvider'
import { applyUiTheme } from './theme'

type AppMode = 'select' | 'classic' | 'slideshow'

function App(): JSX.Element {
  const [mode, setMode] = useState<AppMode>('select')
  const [version, setVersion] = useState('…')
  const [showSplash, setShowSplash] = useState(true)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.getVersion().then(setVersion)
    void window.api.getConfig().then((cfg) => applyUiTheme(cfg.uiTheme ?? 'dark'))
  }, [])

  useEffect(() => {
    void window.api.windowIsMaximized().then(setMaximized)
    return window.api.onWindowMaximized(setMaximized)
  }, [])

  const finishSplash = useCallback(() => {
    setShowSplash(false)
  }, [])

  const subtitle = showSplash
    ? 'Démarrage'
    : mode === 'classic'
      ? 'Classic'
      : mode === 'slideshow'
        ? 'SlideShow'
        : 'Modes'

  let content: JSX.Element
  if (showSplash) {
    content = <SplashScreen version={version} onDone={finishSplash} />
  } else if (mode === 'classic') {
    content = <ClassicMode onBack={() => setMode('select')} />
  } else if (mode === 'slideshow') {
    content = <SlideshowMode onBack={() => setMode('select')} />
  } else {
    content = (
      <ModeSelect
        version={version}
        onSelectClassic={() => setMode('classic')}
        onSelectSlideshow={() => setMode('slideshow')}
      />
    )
  }

  return (
    <TooltipProvider>
      <div className={`app-shell${maximized ? '' : ' is-reduced'}`}>
        <TitleBar subtitle={subtitle} />
        <div className="app-shell__body">{content}</div>
      </div>
    </TooltipProvider>
  )
}

export default App
