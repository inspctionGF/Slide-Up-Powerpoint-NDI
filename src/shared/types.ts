export type ExportOptions = {
  transparent: boolean
  width?: number
  height?: number
}

/** Résolution d’un écran connecté (pixels physiques) */
export type DisplayResolution = {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
}

export type SlideMeta = {
  index: number
  path: string
  url: string
  hidden: boolean
  entryEffect?: number
  duration?: number
}

export type SlideBundle = {
  tempDir: string
  slides: SlideMeta[]
  filePath: string
  transparent: boolean
}

export type ExportProgress = {
  current: number
  total: number
  message: string
}

export type NdiStatus = {
  ready: boolean
  sourceName: string
  lastError: string | null
  lastSentPath: string | null
  frozen: boolean
}

export type GalleryPosition = 'left' | 'bottom'

export type UiTheme = 'dark' | 'light'

export type SolidOutputMode = 'black' | 'white' | 'transparent'

export type OutputMode = 'live' | SolidOutputMode

/** Effet de transition entre diapositives (NDI + aperçu) */
export type SlideTransitionType = 'cut' | 'fade' | 'slide-left' | 'zoom'

export type HotkeyAction = 'prev' | 'next' | 'black' | 'white' | 'transparent' | 'freeze'

export type HotkeyConfig = Record<HotkeyAction, string>

export type NdiTransitionRequest = {
  path: string
  type?: SlideTransitionType
  durationMs?: number
}

export type RecentFile = {
  path: string
  name: string
  openedAt: number
}

export type AppConfig = {
  ndiSourceName: string
  transparentByDefault: boolean
  /**
   * @deprecated Conservé pour migration — préférer slideTransitionType
   */
  slideTransitionEffect: boolean
  /** Type de transition (CUT / FADE / SLIDE / ZOOM) */
  slideTransitionType: SlideTransitionType
  /** Durée de la transition en ms (hors CUT) */
  slideTransitionMs: number
  exportWidth: number
  exportHeight: number
  highPerformanceKeepalive: boolean
  /** Position de la galerie de miniatures */
  galleryPosition: GalleryPosition
  /** Colonnes de la grille (mode bas, ou rail gauche multi-colonnes) */
  galleryColumns: number
  /** Lignes visibles de la grille en mode bas */
  galleryRows: number
  /** Thème d’interface */
  uiTheme: UiTheme
  /** Mini-écran flottant de la diapositive suivante */
  nextPreviewEnabled: boolean
  /** Réduire dans la barre d’état système au démarrage */
  minimizeToTrayOnStartup: boolean
  /** Sélectionner et diffuser la 1re diapositive à l’ouverture */
  selectFirstSlideOnOpen: boolean
  /** Raccourcis clavier globaux */
  hotkeys: HotkeyConfig
  /** Fichiers PowerPoint ouverts récemment */
  recentFiles: RecentFile[]
}

export type PresentationChangedEvent = {
  path: string
}

export type OpenPathResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export type SlideshowCommand = 'prev' | 'next' | 'black' | 'white' | 'pause'

export type SlideshowStatusEvent =
  | { type: 'position'; index: number }
  | { type: 'black'; index: number }
  | { type: 'white'; index: number }
  | { type: 'done'; index: number }
  | { type: 'off' }
  | { type: 'ready' }
  | { type: 'noppt' }
  | { type: 'exported'; index: number; path: string; url: string }
  | { type: 'error'; message: string }
