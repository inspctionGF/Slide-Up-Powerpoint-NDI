import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type {
  AppConfig,
  ExportProgress,
  GalleryPosition,
  HotkeyAction,
  NdiStatus,
  OutputMode,
  RecentFile,
  SlideBundle,
  SlideMeta,
  SlideTransitionType
} from '@shared/types'
import {
  IconArrowLeft,
  IconBroadcast,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconEdit,
  IconFolder,
  IconHistory,
  IconLayoutBottom,
  IconLayoutLeft,
  IconPin,
  IconPip,
  IconRefresh,
  IconSettings,
  IconTransparency
} from '../components/Icons'
import ProductionBar from '../components/ProductionBar'
import SettingsPanel from '../components/SettingsPanel'
import ToolSelect from '../components/ToolSelect'
import { usePresentationTimer } from '../hooks/usePresentationTimer'
import './ClassicMode.css'

type ClassicModeProps = {
  onBack: () => void
}

type PipPos = { leftPct: number; topPct: number }

const PIP_WIDTH_MIN = 16
const PIP_WIDTH_MAX = 52
const PIP_WIDTH_DEFAULT = 28

function clampPipWidth(value: number): number {
  return Math.min(PIP_WIDTH_MAX, Math.max(PIP_WIDTH_MIN, value))
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()
}

function formatRelativeOpenedAt(openedAt: number): string {
  if (!openedAt) return ''
  const diff = Date.now() - openedAt
  if (diff < 60_000) return 'à l’instant'
  if (diff < 3_600_000) {
    const min = Math.max(1, Math.floor(diff / 60_000))
    return `il y a ${min} min`
  }
  if (diff < 86_400_000) {
    const hours = Math.max(1, Math.floor(diff / 3_600_000))
    return `il y a ${hours} h`
  }
  if (diff < 7 * 86_400_000) {
    const days = Math.max(1, Math.floor(diff / 86_400_000))
    return `il y a ${days} j`
  }
  return new Date(openedAt).toLocaleDateString('fr-FR')
}

async function sendWithRetry(path: string, attempts = 6): Promise<NdiStatus> {
  let last: NdiStatus | null = null
  for (let i = 0; i < attempts; i++) {
    last = await window.api.ndiSend(path)
    if (!last.lastError) return last
    const msg = last.lastError.toLowerCase()
    const busy =
      msg.includes('ebusy') ||
      msg.includes('verrouill') ||
      msg.includes('locked') ||
      msg.includes('decoder le png') ||
      msg.includes('délai')
    if (!busy && i > 1) return last
    await new Promise((r) => setTimeout(r, 160 * (i + 1)))
  }
  return last!
}

async function sendTransitionWithRetry(
  path: string,
  type: SlideTransitionType,
  durationMs: number,
  attempts = 4
): Promise<NdiStatus> {
  if (type === 'cut') return sendWithRetry(path)
  let last: NdiStatus | null = null
  for (let i = 0; i < attempts; i++) {
    last = await window.api.ndiSendTransition({ path, type, durationMs })
    if (!last.lastError) return last
    const msg = last.lastError.toLowerCase()
    const busy =
      msg.includes('ebusy') ||
      msg.includes('verrouill') ||
      msg.includes('locked') ||
      msg.includes('decoder le png')
    if (!busy && i > 0) return last
    await new Promise((r) => setTimeout(r, 200 * (i + 1)))
  }
  return last!
}

function previewFxClass(type: SlideTransitionType | undefined): string | undefined {
  if (!type || type === 'cut') return undefined
  return `classic__slide-img--fx classic__slide-img--fx-${type}`
}

function ClassicMode({ onBack }: ClassicModeProps): JSX.Element {
  const [bundle, setBundle] = useState<SlideBundle | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [transparent, setTransparent] = useState(true)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Prêt - ouvrez une présentation.')
  const [ndi, setNdi] = useState<NdiStatus | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [sourceDraft, setSourceDraft] = useState('Slide-up')
  const [sourceSaving, setSourceSaving] = useState(false)
  const [outputMode, setOutputMode] = useState<OutputMode>('live')
  const [frozen, setFrozen] = useState(false)
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const timer = usePresentationTimer()
  const [fileChanged, setFileChanged] = useState(false)
  const [pipPos, setPipPos] = useState<PipPos>({ leftPct: 68, topPct: 56 })
  const [pipWidthPct, setPipWidthPct] = useState(() => {
    const raw = Number(localStorage.getItem('slideup-pip-width'))
    return Number.isFinite(raw) ? clampPipWidth(raw) : PIP_WIDTH_DEFAULT
  })
  const [bottomSplit, setBottomSplit] = useState(() => {
    const raw = Number(localStorage.getItem('slideup-split-bottom'))
    return Number.isFinite(raw) ? Math.min(55, Math.max(14, raw)) : 28
  })
  const [leftSplit, setLeftSplit] = useState(() => {
    const raw = Number(localStorage.getItem('slideup-split-left'))
    return Number.isFinite(raw) ? Math.min(40, Math.max(12, raw)) : 16
  })
  const bodyRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const splitDrag = useRef<{
    axis: 'h' | 'v'
    pointerId: number
  } | null>(null)
  const pipDrag = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const pipResize = useRef<{
    pointerId: number
    startX: number
    startWidthPct: number
    parentWidth: number
  } | null>(null)
  const thumbsRef = useRef<HTMLUListElement>(null)
  const sourceInputRef = useRef<HTMLInputElement>(null)
  const bundleRef = useRef<SlideBundle | null>(null)
  const busyRef = useRef(false)

  const galleryPosition: GalleryPosition = config?.galleryPosition ?? 'left'
  const galleryColumns = config?.galleryColumns ?? 6
  const galleryRows = config?.galleryRows ?? 2
  const nextPreviewEnabled = config?.nextPreviewEnabled ?? true

  useEffect(() => {
    bundleRef.current = bundle
  }, [bundle])

  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    void window.api.isAlwaysOnTop().then(setAlwaysOnTop)
    void window.api.getConfig().then((cfg) => {
      setConfig(cfg)
      setTransparent(cfg.transparentByDefault)
      setSourceDraft(cfg.ndiSourceName)
      setRecentFiles(cfg.recentFiles ?? [])
    })
    void window.api.getRecentFiles().then(setRecentFiles)
    void window.api.ndiGetStatus().then((status) => {
      setNdi(status)
      setFrozen(Boolean(status.frozen))
      if (status.sourceName) setSourceDraft(status.sourceName)
    })
    const offProgress = window.api.onExportProgress(setProgress)
    const offChanged = window.api.onPresentationChanged((event) => {
      if (busyRef.current) return
      const currentPath = bundleRef.current?.filePath
      if (!currentPath || !samePath(currentPath, event.path)) return
      setFileChanged(true)
      setStatus('Fichier modifié sur le disque.')
    })
    return () => {
      offProgress()
      offChanged()
      void window.api.unwatchPresentation()
    }
  }, [])

  const patchUiConfig = useCallback(async (partial: Partial<AppConfig>) => {
    const next = await window.api.setConfig(partial)
    setConfig(next)
    setRecentFiles(next.recentFiles ?? [])
    return next
  }, [])

  const applySourceName = useCallback(async () => {
    const name = sourceDraft.trim()
    if (!name) return
    if (ndi?.sourceName === name && !ndi.lastError) return
    setSourceSaving(true)
    try {
      await window.api.setConfig({ ndiSourceName: name })
      const status = await window.api.ndiSetSourceName(name)
      setNdi(status)
      setSourceDraft(status.sourceName || name)
      if (status.lastError) {
        setError(status.lastError)
      } else {
        setError(null)
        setStatus(`Source NDI renommée « ${status.sourceName} ».`)
        if (currentIndex >= 0 && bundle?.slides[currentIndex] && outputMode === 'live') {
          const sent = await sendWithRetry(bundle.slides[currentIndex].path)
          setNdi(sent)
        }
      }
    } finally {
      setSourceSaving(false)
    }
  }, [bundle, currentIndex, ndi?.lastError, ndi?.sourceName, outputMode, sourceDraft])

  const slides = bundle?.slides ?? []
  const hasSelection = currentIndex >= 0 && currentIndex < slides.length
  const current: SlideMeta | null = hasSelection ? slides[currentIndex] : null
  const hasPreview = previewIndex >= 0 && previewIndex < slides.length
  const previewSlide: SlideMeta | null = hasPreview ? slides[previewIndex] : null
  const isLocalPreview = hasPreview && previewIndex !== currentIndex
  const displaySlide: SlideMeta | null = previewSlide ?? current
  const visibleCount = useMemo(() => slides.filter((s) => !s.hidden).length, [slides])
  const nextIndex = useMemo(() => {
    if (!hasSelection) {
      for (let i = 0; i < slides.length; i++) {
        if (!slides[i].hidden) return i
      }
      return null
    }
    for (let i = currentIndex + 1; i < slides.length; i++) {
      if (!slides[i].hidden) return i
    }
    return null
  }, [currentIndex, hasSelection, slides])
  const nextSlide = nextIndex !== null ? slides[nextIndex] : null

  useEffect(() => {
    const el = thumbsRef.current?.querySelector<HTMLElement>(
      '.classic__thumb.is-preview, .classic__thumb.is-current'
    )
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [previewIndex, currentIndex, galleryPosition])

  const refreshRecentFiles = useCallback(async () => {
    const list = await window.api.getRecentFiles()
    setRecentFiles(list)
  }, [])

  const loadFromPath = useCallback(
    async (path: string, options?: { preserveIndex?: boolean }) => {
      setError(null)
      setFileChanged(false)
      setBusy(true)
      setProgress({ current: 0, total: 0, message: 'Préparation de l’export…' })
      setStatus(`Export de ${fileName(path)}…`)

      const previousIndex = options?.preserveIndex ? currentIndex : -1

      try {
        await window.api.unwatchPresentation()
        await window.api.cleanupExport()
        const cfg = config ?? (await window.api.getConfig())
        const result = await window.api.exportAllSlides(path, {
          transparent,
          width: cfg.exportWidth || 1920,
          height: cfg.exportHeight || 1080
        })
        setBundle(result)
        setOutputMode('live')
        setStatus(
          `${result.slides.length} diapositive${result.slides.length > 1 ? 's' : ''} chargée${result.slides.length > 1 ? 's' : ''}.`
        )
        await refreshRecentFiles()

        const watchResult = await window.api.watchPresentation(result.filePath)
        if (!watchResult.ok && watchResult.error) {
          setStatus(
            `${result.slides.length} diapositive${result.slides.length > 1 ? 's' : ''} chargée${result.slides.length > 1 ? 's' : ''}. Surveillance indisponible.`
          )
        }

        const ndiStatus = await window.api.ndiInit(cfg.ndiSourceName)
        setNdi(ndiStatus)
        if (ndiStatus.lastError) {
          setError(ndiStatus.lastError)
        }

        let nextIndex = -1
        if (options?.preserveIndex && result.slides.length > 0) {
          nextIndex = Math.min(Math.max(previousIndex, 0), result.slides.length - 1)
        } else if (cfg.selectFirstSlideOnOpen && result.slides[0]) {
          nextIndex = 0
        }

        setCurrentIndex(nextIndex)
        setPreviewIndex(nextIndex >= 0 ? nextIndex : 0)
        if (nextIndex >= 0 && result.slides[nextIndex] && !ndiStatus.lastError) {
          const sent = await sendWithRetry(result.slides[nextIndex].path)
          setNdi(sent)
          if (sent.lastError) setError(sent.lastError)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Échec de l’export.'
        setError(message)
        setStatus('Export interrompu.')
        if (!options?.preserveIndex) {
          setBundle(null)
          void window.api.unwatchPresentation()
        }
      } finally {
        setBusy(false)
        setProgress(null)
      }
    },
    [config, currentIndex, refreshRecentFiles, transparent]
  )

  const openFile = useCallback(async () => {
    setError(null)
    const path = await window.api.openPresentation()
    if (!path) {
      await refreshRecentFiles()
      return
    }
    await loadFromPath(path)
  }, [loadFromPath, refreshRecentFiles])

  const openRecent = useCallback(
    async (path: string) => {
      const result = await window.api.openPath(path)
      if (!result.ok) {
        setError(result.error)
        setStatus('Ouverture impossible.')
        const next = await window.api.removeRecentFile(path)
        setRecentFiles(next)
        return
      }
      await loadFromPath(result.path)
    },
    [loadFromPath]
  )

  const reloadFile = useCallback(async () => {
    if (!bundle?.filePath || busy) return
    await loadFromPath(bundle.filePath, { preserveIndex: true })
  }, [bundle?.filePath, busy, loadFromPath])

  const removeRecent = useCallback(async (path: string) => {
    const next = await window.api.removeRecentFile(path)
    setRecentFiles(next)
  }, [])

  const clearRecent = useCallback(async () => {
    const next = await window.api.clearRecentFiles()
    setRecentFiles(next)
  }, [])

  const dismissFileChanged = useCallback(() => {
    setFileChanged(false)
    setStatus('Modification ignorée.')
  }, [])

  const previewSlideOnly = useCallback(
    (index: number) => {
      if (!bundle || index < 0 || index >= bundle.slides.length) return
      setPreviewIndex(index)
      setOutputMode('live')
      const slide = bundle.slides[index]
      setError(null)
      setStatus(
        index === currentIndex
          ? `Aperçu de la diapositive ${slide.index} (déjà en direct).`
          : `Aperçu local de la diapositive ${slide.index} — la diffusion NDI n’a pas changé.`
      )
    },
    [bundle, currentIndex]
  )

  const selectSlide = useCallback(
    async (index: number) => {
      if (!bundle || index < 0 || index >= bundle.slides.length) return
      setCurrentIndex(index)
      setPreviewIndex(index)
      const slide = bundle.slides[index]

      if (frozen) {
        setOutputMode('live')
        setError(null)
        setStatus(`Gel actif — aperçu diapositive ${slide.index}, sortie NDI figée.`)
        return
      }

      setOutputMode('live')
      const fx = config?.slideTransitionType ?? 'cut'
      const durationMs = config?.slideTransitionMs ?? 450
      const sent = await sendTransitionWithRetry(slide.path, fx, durationMs)
      setNdi(sent)
      setFrozen(Boolean(sent.frozen))
      if (sent.lastError) {
        setError(sent.lastError)
        setStatus(`Échec NDI - diapositive ${slide.index}.`)
      } else {
        setError(null)
        setStatus(`Diapositive ${slide.index} diffusée sur « ${sent.sourceName} ».`)
      }
    },
    [bundle, config?.slideTransitionMs, config?.slideTransitionType, frozen]
  )

  const applySolidMode = useCallback(
    async (mode: 'black' | 'white') => {
      if (busy) return
      if (outputMode === mode) {
        if (hasSelection) {
          setFrozen(false)
          await window.api.ndiSetFrozen(false)
          await selectSlide(currentIndex)
        } else {
          setOutputMode('live')
          setFrozen(false)
          await window.api.ndiSetFrozen(false)
        }
        return
      }
      setFrozen(false)
      setOutputMode(mode)
      const labels = { black: 'Noir', white: 'Blanc' } as const
      const sent = await window.api.ndiSendSolid(mode)
      setNdi(sent)
      setFrozen(Boolean(sent.frozen))
      if (sent.lastError) {
        setError(sent.lastError)
        setStatus(`Échec NDI - sortie ${labels[mode]}.`)
      } else {
        setError(null)
        setStatus(`Sortie ${labels[mode]} diffusée sur « ${sent.sourceName} ».`)
      }
    },
    [busy, currentIndex, hasSelection, outputMode, selectSlide]
  )

  const toggleFreeze = useCallback(async () => {
    if (busy) return
    const next = !frozen
    if (next) {
      const sent = await window.api.ndiSetFrozen(true)
      setNdi(sent)
      setFrozen(true)
      setError(null)
      setStatus(`Gel activé — sortie NDI figée sur « ${sent.sourceName} ».`)
      return
    }
    const sent = await window.api.ndiSetFrozen(false)
    setNdi(sent)
    setFrozen(false)
    const slide = hasSelection && bundle ? bundle.slides[currentIndex] : null
    if (slide && outputMode === 'live') {
      const live = await sendWithRetry(slide.path)
      setNdi(live)
      setStatus(`Gel levé — reprise live diapositive ${slide.index}.`)
    } else {
      setStatus('Gel levé.')
    }
  }, [busy, bundle, currentIndex, frozen, hasSelection, outputMode])

  const setFx = useCallback(
    async (slideTransitionType: SlideTransitionType) => {
      await patchUiConfig({
        slideTransitionType,
        slideTransitionEffect: slideTransitionType !== 'cut'
      })
    },
    [patchUiConfig]
  )

  const goPrev = useCallback(() => {
    if (!hasSelection) {
      if (slides.length > 0) void selectSlide(0)
      return
    }
    void selectSlide(currentIndex - 1)
  }, [currentIndex, hasSelection, selectSlide, slides.length])

  const goNext = useCallback(() => {
    if (!hasSelection) {
      if (slides.length > 0) void selectSlide(0)
      return
    }
    void selectSlide(currentIndex + 1)
  }, [currentIndex, hasSelection, selectSlide, slides.length])

  const toggleTransparent = useCallback(async () => {
    const next = !transparent
    setTransparent(next)
    if (!bundle) return

    setBusy(true)
    setFileChanged(false)
    setError(null)
    setStatus(next ? 'Ré-export sans fond…' : 'Ré-export avec fond…')
    try {
      const cfg = config ?? (await window.api.getConfig())
      let width = cfg.exportWidth || 0
      let height = cfg.exportHeight || 0
      // Conserver la résolution du PNG déjà chargé (évite le redimensionnement Shape.Export)
      if (!width || !height) {
        const sample = bundle.slides[currentIndex] ?? bundle.slides[0]
        if (sample) {
          const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
            const img = new Image()
            img.onload = () =>
              resolve({ width: img.naturalWidth, height: img.naturalHeight })
            img.onerror = () => resolve(null)
            img.src = sample.url
          })
          if (size && size.width > 0 && size.height > 0) {
            width = size.width
            height = size.height
          }
        }
      }
      if (!width || !height) {
        width = 1920
        height = 1080
      }
      const result = await window.api.exportAllSlides(bundle.filePath, {
        transparent: next,
        width,
        height
      })
      setBundle(result)
      setOutputMode('live')
      setFrozen(false)
      await window.api.ndiSetFrozen(false)
      const idx = Math.min(Math.max(currentIndex, 0), result.slides.length - 1)
      setCurrentIndex(idx)
      setPreviewIndex(idx)
      if (result.slides[idx]) {
        const sent = await sendWithRetry(result.slides[idx].path)
        setNdi(sent)
        if (sent.lastError) setError(sent.lastError)
      }
      setStatus(next ? 'Sans fond activé — texte et formes seuls.' : 'Fond PowerPoint inclus.')
      await window.api.watchPresentation(result.filePath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du ré-export.')
      setTransparent(!next)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [bundle, config, currentIndex, transparent])

  /** T / raccourci : diapo sans fond (pas un écran vide). */
  const onTransparentPress = useCallback(async () => {
    if (busy) return
    if (outputMode !== 'live') {
      setFrozen(false)
      await window.api.ndiSetFrozen(false)
      setOutputMode('live')
      if (transparent) {
        if (hasSelection) await selectSlide(currentIndex)
        setStatus('Diapo sans fond diffusée.')
        return
      }
    }
    await toggleTransparent()
  }, [
    busy,
    currentIndex,
    hasSelection,
    outputMode,
    selectSlide,
    toggleTransparent,
    transparent
  ])

  useEffect(() => {
    return window.api.onHotkey((action: HotkeyAction) => {
      if (busy || settingsOpen) return
      if (action === 'prev') goPrev()
      else if (action === 'next') goNext()
      else if (action === 'black' || action === 'white') {
        void applySolidMode(action)
      } else if (action === 'transparent') {
        void onTransparentPress()
      } else if (action === 'freeze') {
        void toggleFreeze()
      }
    })
  }, [applySolidMode, busy, goNext, goPrev, onTransparentPress, settingsOpen, toggleFreeze])

  const togglePin = useCallback(async () => {
    const applied = await window.api.setAlwaysOnTop(!alwaysOnTop)
    setAlwaysOnTop(applied)
  }, [alwaysOnTop])

  const onPipPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pipResize.current) return
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('.classic__pip-resize')) return
    const pipRect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    pipDrag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - pipRect.left,
      offsetY: event.clientY - pipRect.top
    }
  }, [])

  const onPipPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = pipDrag.current
    const preview = previewRef.current
    if (!drag || drag.pointerId !== event.pointerId || !preview) return

    const parent = preview.getBoundingClientRect()
    const pipW = event.currentTarget.offsetWidth
    const pipH = event.currentTarget.offsetHeight
    if (parent.width <= 0 || parent.height <= 0) return

    let left = event.clientX - drag.offsetX - parent.left
    let top = event.clientY - drag.offsetY - parent.top
    left = Math.max(0, Math.min(parent.width - pipW, left))
    top = Math.max(0, Math.min(parent.height - pipH, top))

    setPipPos({
      leftPct: (left / parent.width) * 100,
      topPct: (top / parent.height) * 100
    })
  }, [])

  const onPipPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pipDrag.current?.pointerId === event.pointerId) {
      pipDrag.current = null
    }
  }, [])

  const onPipResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const preview = previewRef.current
      if (!preview) return
      const parent = preview.getBoundingClientRect()
      event.currentTarget.setPointerCapture(event.pointerId)
      pipDrag.current = null
      pipResize.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidthPct: pipWidthPct,
        parentWidth: parent.width
      }
      document.body.style.cursor = 'nwse-resize'
      document.body.style.userSelect = 'none'
    },
    [pipWidthPct]
  )

  const onPipResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const resize = pipResize.current
      const preview = previewRef.current
      const pipEl = event.currentTarget.closest('.classic__pip') as HTMLElement | null
      if (!resize || resize.pointerId !== event.pointerId || !preview || !pipEl) return

      const parent = preview.getBoundingClientRect()
      if (parent.width <= 0) return
      const deltaPct = ((event.clientX - resize.startX) / resize.parentWidth) * 100
      const nextWidth = clampPipWidth(resize.startWidthPct + deltaPct)
      setPipWidthPct(nextWidth)

      const pipW = (nextWidth / 100) * parent.width
      const pipH = pipEl.offsetHeight
      let left = (pipPos.leftPct / 100) * parent.width
      let top = (pipPos.topPct / 100) * parent.height
      left = Math.max(0, Math.min(parent.width - pipW, left))
      top = Math.max(0, Math.min(parent.height - pipH, top))
      setPipPos({
        leftPct: (left / parent.width) * 100,
        topPct: (top / parent.height) * 100
      })
    },
    [pipPos.leftPct, pipPos.topPct]
  )

  const onPipResizePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pipResize.current?.pointerId !== event.pointerId) return
    pipResize.current = null
    setPipWidthPct((v) => {
      localStorage.setItem('slideup-pip-width', String(v))
      return v
    })
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const onSplitPointerDown = useCallback((axis: 'h' | 'v') => {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      splitDrag.current = { axis, pointerId: event.pointerId }
      document.body.style.cursor = axis === 'h' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'
    }
  }, [])

  const onSplitPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = splitDrag.current
    const body = bodyRef.current
    if (!drag || drag.pointerId !== event.pointerId || !body) return
    const rect = body.getBoundingClientRect()
    if (drag.axis === 'h') {
      const fromBottom = ((rect.bottom - event.clientY) / rect.height) * 100
      const next = Math.min(55, Math.max(14, fromBottom))
      setBottomSplit(next)
    } else {
      const fromLeft = ((event.clientX - rect.left) / rect.width) * 100
      const next = Math.min(40, Math.max(12, fromLeft))
      setLeftSplit(next)
    }
  }, [])

  const onSplitPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (splitDrag.current?.pointerId !== event.pointerId) return
    const axis = splitDrag.current.axis
    splitDrag.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (axis === 'h') {
      setBottomSplit((v) => {
        localStorage.setItem('slideup-split-bottom', String(v))
        return v
      })
    } else {
      setLeftSplit((v) => {
        localStorage.setItem('slideup-split-left', String(v))
        return v
      })
    }
  }, [])

  const renderRecentFiles = (compact = false): JSX.Element | null => {
    if (recentFiles.length === 0) return null

    return (
      <div className={`classic__recent ${compact ? 'classic__recent--compact' : ''}`}>
        <div className="classic__recent-head">
          <span className="classic__recent-title">
            <IconHistory />
            Fichiers récents
          </span>
          {!compact && (
            <button
              type="button"
              className="classic__recent-clear"
              onClick={() => void clearRecent()}
              disabled={busy}
            >
              Effacer l’historique
            </button>
          )}
        </div>
        <ul className="classic__recent-list">
          {recentFiles.map((file) => (
            <li key={file.path} className="classic__recent-item">
              <button
                type="button"
                className="classic__recent-open"
                onClick={() => void openRecent(file.path)}
                disabled={busy}
                data-tip={file.path}
              >
                <span className="classic__recent-name">{file.name}</span>
                <span className="classic__recent-path">{file.path}</span>
                <span className="classic__recent-meta">{formatRelativeOpenedAt(file.openedAt)}</span>
              </button>
              <button
                type="button"
                className="classic__recent-remove"
                onClick={() => void removeRecent(file.path)}
                disabled={busy}
                data-tip="Retirer de l’historique"
                aria-label={`Retirer ${file.name} de l’historique`}
              >
                <IconClose />
              </button>
            </li>
          ))}
        </ul>
        {compact && (
          <button
            type="button"
            className="classic__recent-clear"
            onClick={() => void clearRecent()}
            disabled={busy}
          >
            Effacer l’historique
          </button>
        )}
      </div>
    )
  }

  const renderThumbs = (): JSX.Element => {
    if (slides.length === 0) {
      return (
        <div className="classic__empty-rail">
          <p>Aucune diapositive. Ouvrez un fichier PowerPoint pour commencer.</p>
          {renderRecentFiles(true)}
        </div>
      )
    }

    return (
      <ul
        ref={thumbsRef}
        className={`classic__thumbs ${galleryPosition === 'bottom' ? 'classic__thumbs--grid' : ''}`}
        style={
          galleryPosition === 'bottom'
            ? ({ '--gallery-cols': galleryColumns } as CSSProperties)
            : undefined
        }
      >
        {slides.map((slide, index) => {
          const isCurrent = index === currentIndex
          const isNext = nextIndex !== null && index === nextIndex
          const isPreview = index === previewIndex && !isCurrent
          return (
            <li key={slide.index}>
              <button
                type="button"
                className={`classic__thumb ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''} ${isPreview ? 'is-preview' : ''} ${slide.hidden ? 'is-hidden' : ''}`}
                onClick={() => previewSlideOnly(index)}
                onDoubleClick={() => void selectSlide(index)}
                disabled={busy}
                data-tip="Cliquer pour prévisualiser · Double-cliquer pour diffuser"
              >
                <span className="classic__thumb-frame">
                  <img src={slide.url} alt="" draggable={false} />
                  {isCurrent && (
                    <span className="classic__thumb-badge classic__thumb-badge--current">
                      Actuel
                    </span>
                  )}
                  {isPreview && (
                    <span className="classic__thumb-badge classic__thumb-badge--preview">
                      Aperçu
                    </span>
                  )}
                  {isNext && !isCurrent && !isPreview && (
                    <span className="classic__thumb-badge classic__thumb-badge--next">
                      Suivant
                    </span>
                  )}
                </span>
                <span className="classic__thumb-meta">
                  {slide.index}
                  {slide.hidden ? ' · masquée' : ''}
                  {isCurrent ? ' · en cours' : ''}
                  {isNext && !isCurrent ? ' · suivante' : ''}
                  {isPreview ? ' · aperçu' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const galleryToolbar = (
    <div className="classic__layout-controls" role="toolbar" aria-label="Disposition">
      <div className="classic__seg" role="group" aria-label="Position de la galerie">
        <button
          type="button"
          className={`classic__seg-btn ${galleryPosition === 'left' ? 'is-active' : ''}`}
          onClick={() => void patchUiConfig({ galleryPosition: 'left' })}
          data-tip="Galerie à gauche"
          aria-pressed={galleryPosition === 'left'}
        >
          <IconLayoutLeft />
        </button>
        <button
          type="button"
          className={`classic__seg-btn ${galleryPosition === 'bottom' ? 'is-active' : ''}`}
          onClick={() => void patchUiConfig({ galleryPosition: 'bottom' })}
          data-tip="Galerie en bas"
          aria-pressed={galleryPosition === 'bottom'}
        >
          <IconLayoutBottom />
        </button>
      </div>

      <button
        type="button"
        className={`classic__seg-solo ${nextPreviewEnabled ? 'is-active' : ''}`}
        onClick={() => void patchUiConfig({ nextPreviewEnabled: !nextPreviewEnabled })}
        data-tip="Mini-écran de la diapositive suivante"
        aria-pressed={nextPreviewEnabled}
      >
        <IconPip />
      </button>

      {galleryPosition === 'bottom' && (
        <div className="classic__gallery-group classic__gallery-group--nums">
          <ToolSelect
            label="Colonnes"
            value={galleryColumns}
            options={Array.from({ length: 11 }, (_, i) => i + 2)}
            ariaLabel="Nombre de colonnes"
            onChange={(value) => void patchUiConfig({ galleryColumns: value })}
          />
          <ToolSelect
            label="Lignes"
            value={galleryRows}
            options={Array.from({ length: 5 }, (_, i) => i + 1)}
            ariaLabel="Nombre de lignes visibles"
            onChange={(value) => void patchUiConfig({ galleryRows: value })}
          />
        </div>
      )}
    </div>
  )

  return (
    <div className={`classic${settingsOpen ? ' is-settings-open' : ''}${busy ? ' is-busy' : ''}`}>
      <div className={`classic__frame classic__frame--gallery-${galleryPosition}`}>
      <header className="classic__bar">
        <button
          type="button"
          className="classic__icon-btn classic__icon-btn--back"
          onClick={onBack}
          data-tip="Retour"
          aria-label="Retour aux modes"
        >
          <IconArrowLeft />
          {!busy && <span>Modes</span>}
        </button>

        {!busy && (
          <>
            <div className="classic__brand-block">
              <span className="classic__brand">Slide-up</span>
              <span className="classic__mode-tag">Classic</span>
            </div>

            <div className="classic__actions">
              {galleryToolbar}

              <div className="classic__action-group">
                <button
                  type="button"
                  className="classic__btn classic__btn--primary"
                  onClick={() => void openFile()}
                  disabled={busy}
                >
                  <IconFolder />
                  <span>Ouvrir</span>
                </button>

                <button
                  type="button"
                  className={`classic__btn ${fileChanged ? 'is-warn' : ''}`}
                  onClick={() => void reloadFile()}
                  disabled={busy || !bundle}
                  data-tip="Recharger la présentation depuis le disque"
                >
                  <IconRefresh />
                  <span>Recharger</span>
                </button>

                <button
                  type="button"
                  className={`classic__btn ${transparent ? 'is-active' : ''}`}
                  onClick={() => void toggleTransparent()}
                  disabled={busy}
                  data-tip="Texte et formes sans fond PowerPoint (PNG alpha)"
                >
                  <IconTransparency />
                  <span>Sans fond</span>
                </button>

                <button
                  type="button"
                  className={`classic__btn ${alwaysOnTop ? 'is-active' : ''}`}
                  onClick={() => void togglePin()}
                  data-tip="Toujours au premier plan"
                >
                  <IconPin />
                  <span>Épingler</span>
                </button>

                <button
                  type="button"
                  className="classic__btn"
                  onClick={() => setSettingsOpen(true)}
                  data-tip="Réglages"
                >
                  <IconSettings />
                  <span>Réglages</span>
                </button>

                <button
                  type="button"
                  className={`classic__btn classic__btn--ndi ${ndi?.ready && !ndi.lastError ? 'is-live' : ''}`}
                  onClick={() => {
                    if (!hasPreview && !current) return
                    void selectSlide(hasPreview ? previewIndex : currentIndex)
                  }}
                  disabled={(!hasPreview && !current) || busy}
                  data-tip={
                    isLocalPreview
                      ? 'Diffuser la diapositive en aperçu sur NDI'
                      : 'Renvoyer la slide courante en NDI'
                  }
                >
                  <IconBroadcast />
                  <span>NDI</span>
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {fileChanged && bundle && (
        <div className="classic__banner" role="status">
          <p className="classic__banner-text">
            Fichier modifié sur le disque. Recharger pour appliquer les changements ?
          </p>
          <div className="classic__banner-actions">
            <button
              type="button"
              className="classic__btn classic__btn--primary"
              onClick={() => void reloadFile()}
              disabled={busy}
            >
              <IconRefresh />
              <span>Recharger</span>
            </button>
            <button
              type="button"
              className="classic__btn"
              onClick={dismissFileChanged}
              disabled={busy}
            >
              <span>Ignorer</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={bodyRef}
        className="classic__body"
        style={
          galleryPosition === 'bottom'
            ? ({
                '--gallery-rows': galleryRows,
                gridTemplateRows: `minmax(0, 1fr) var(--split-size) minmax(5rem, ${bottomSplit}%)`
              } as CSSProperties)
            : ({
                gridTemplateColumns: `minmax(8rem, ${leftSplit}%) var(--split-size) minmax(0, 1fr)`
              } as CSSProperties)
        }
      >
        {galleryPosition === 'left' && (
          <>
            <aside className="classic__rail classic__rail--left" aria-label="Galerie des diapositives">
              <header className="classic__rail-head">
                <h2 className="classic__rail-title">Diapositives</h2>
                {slides.length > 0 && (
                  <span className="classic__rail-count">{slides.length}</span>
                )}
              </header>
              {renderThumbs()}
            </aside>
            <div
              className="classic__splitter classic__splitter--v"
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionner la galerie"
              aria-valuenow={Math.round(leftSplit)}
              tabIndex={0}
              onPointerDown={onSplitPointerDown('v')}
              onPointerMove={onSplitPointerMove}
              onPointerUp={onSplitPointerUp}
              onPointerCancel={onSplitPointerUp}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  setLeftSplit((v) => {
                    const next = Math.max(12, v - 2)
                    localStorage.setItem('slideup-split-left', String(next))
                    return next
                  })
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  setLeftSplit((v) => {
                    const next = Math.min(40, v + 2)
                    localStorage.setItem('slideup-split-left', String(next))
                    return next
                  })
                }
              }}
            />
          </>
        )}

        <section className="classic__stage" aria-label="Aperçu">
          <div className="classic__screen">
            <div
              ref={previewRef}
              className={`classic__preview ${transparent ? 'classic__preview--checker' : ''} ${outputMode !== 'live' ? `classic__preview--${outputMode}` : ''}`}
            >
              {outputMode === 'black' && (
                <p className="classic__screen-label">Sortie noire</p>
              )}
              {outputMode === 'white' && (
                <p className="classic__screen-label classic__screen-label--dark">
                  Sortie blanche
                </p>
              )}
              {outputMode === 'live' && displaySlide ? (
                <>
                  {isLocalPreview && (
                    <span className="classic__preview-tag" aria-live="polite">
                      Aperçu local · {displaySlide.index}
                    </span>
                  )}
                  <img
                    key={`${displaySlide.path}-${previewIndex}-${config?.slideTransitionType ?? 'cut'}`}
                    src={displaySlide.url}
                    alt={`Diapositive ${displaySlide.index}`}
                    draggable={false}
                    className={previewFxClass(config?.slideTransitionType)}
                  />
                </>
              ) : null}
              {outputMode === 'live' && !displaySlide && (
                <div className="classic__placeholder">
                  <p className="classic__placeholder-brand">Slide-up</p>
                  <p>
                    Importez une présentation pour prévisualiser et diffuser chaque
                    diapositive sur le réseau NDI.
                  </p>
                  {!bundle && renderRecentFiles(false)}
                </div>
              )}

              {busy && (
                <div className="classic__overlay classic__overlay--quiet" role="presentation" aria-hidden="true" />
              )}

              {nextPreviewEnabled && nextSlide && (
                <div
                  className="classic__pip"
                  style={{
                    left: `${pipPos.leftPct}%`,
                    top: `${pipPos.topPct}%`,
                    width: `${pipWidthPct}%`
                  }}
                  onPointerDown={onPipPointerDown}
                  onPointerMove={onPipPointerMove}
                  onPointerUp={onPipPointerUp}
                  onPointerCancel={onPipPointerUp}
                  role="complementary"
                  aria-label={`Aperçu diapositive suivante ${nextSlide.index}`}
                >
                  <div className="classic__pip-frame" data-tip={`Suivante · ${nextSlide.index}`}>
                    <img src={nextSlide.url} alt="" draggable={false} />
                  </div>
                  <button
                    type="button"
                    className="classic__pip-close"
                    onClick={() => void patchUiConfig({ nextPreviewEnabled: false })}
                    data-tip="Masquer le mini-écran"
                    aria-label="Masquer le mini-écran"
                  >
                    <IconClose />
                  </button>
                  <button
                    type="button"
                    className="classic__pip-resize"
                    aria-label="Redimensionner le mini-écran"
                    data-tip="Redimensionner (ratio 16:9)"
                    onPointerDown={onPipResizePointerDown}
                    onPointerMove={onPipResizePointerMove}
                    onPointerUp={onPipResizePointerUp}
                    onPointerCancel={onPipResizePointerUp}
                  />
                </div>
              )}

              <div className="classic__transport">
                <button
                  type="button"
                  className="classic__nav"
                  onClick={goPrev}
                  disabled={!bundle || busy || (hasSelection && currentIndex <= 0)}
                  aria-label="Diapositive précédente"
                >
                  <IconChevronLeft />
                </button>
                <p className="classic__counter">
                  {current ? `${current.index} / ${slides.length}` : '- / -'}
                  {bundle ? ` · ${visibleCount} visible${visibleCount > 1 ? 's' : ''}` : ''}
                  {frozen ? ' · GEL' : ''}
                </p>
                <button
                  type="button"
                  className="classic__nav"
                  onClick={goNext}
                  disabled={
                    !bundle ||
                    busy ||
                    (hasSelection && currentIndex >= slides.length - 1)
                  }
                  aria-label="Diapositive suivante"
                >
                  <IconChevronRight />
                </button>

                <div className="classic__bwt" role="group" aria-label="Sorties NDI">
                  <button
                    type="button"
                    className={`classic__bwt-btn ${outputMode === 'black' ? 'is-active' : ''}`}
                    onClick={() => void applySolidMode('black')}
                    disabled={busy}
                    data-tip="Sortie noire (NDI)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className={`classic__bwt-btn ${outputMode === 'white' ? 'is-active' : ''}`}
                    onClick={() => void applySolidMode('white')}
                    disabled={busy}
                    data-tip="Sortie blanche (NDI)"
                  >
                    W
                  </button>
                  <button
                    type="button"
                    className={`classic__bwt-btn ${transparent && outputMode === 'live' ? 'is-active' : ''}`}
                    onClick={() => void onTransparentPress()}
                    disabled={busy}
                    data-tip="Diapo sans fond PowerPoint (texte / formes)"
                  >
                    T
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {galleryPosition === 'bottom' && (
          <>
            <div
              className="classic__splitter classic__splitter--h"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Redimensionner l’aperçu et la galerie"
              aria-valuenow={Math.round(bottomSplit)}
              tabIndex={0}
              onPointerDown={onSplitPointerDown('h')}
              onPointerMove={onSplitPointerMove}
              onPointerUp={onSplitPointerUp}
              onPointerCancel={onSplitPointerUp}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setBottomSplit((v) => {
                    const next = Math.max(14, v - 2)
                    localStorage.setItem('slideup-split-bottom', String(next))
                    return next
                  })
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setBottomSplit((v) => {
                    const next = Math.min(55, v + 2)
                    localStorage.setItem('slideup-split-bottom', String(next))
                    return next
                  })
                }
              }}
            />
            <aside
              className="classic__rail classic__rail--bottom"
              aria-label="Galerie des diapositives"
            >
              {renderThumbs()}
            </aside>
          </>
        )}
      </div>

      <footer className={`classic__status${busy ? ' classic__status--loading' : ''}`}>
        {busy ? (
          <div className="classic__load" role="status" aria-live="polite">
            <div className="classic__load-meta">
              <span className="classic__load-pulse" aria-hidden="true" />
              <p className="classic__load-msg">
                {progress?.message ?? status ?? 'Traitement en cours…'}
              </p>
              {progress && progress.total > 0 ? (
                <span className="classic__load-count">
                  {progress.current} / {progress.total}
                </span>
              ) : (
                <span className="classic__load-count classic__load-count--wait">…</span>
              )}
            </div>
            <div
              className="classic__load-track"
              aria-valuemin={0}
              aria-valuemax={progress && progress.total > 0 ? progress.total : 100}
              aria-valuenow={
                progress && progress.total > 0
                  ? progress.current
                  : undefined
              }
              aria-valuetext={
                progress && progress.total > 0
                  ? `${progress.current} sur ${progress.total}`
                  : 'En cours'
              }
              role="progressbar"
            >
              <div
                className={`classic__load-fill${
                  progress && progress.total > 0 ? '' : ' classic__load-fill--indeterminate'
                }`}
                style={
                  progress && progress.total > 0
                    ? {
                        width: `${Math.min(100, Math.max(4, (progress.current / progress.total) * 100))}%`
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ) : (
          <div className="classic__status-rack">
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
              disabled={busy}
            />

            <div className="classic__status-meta">
              <p className="classic__status-text">
                {error ? error : status}
                {bundle ? ` · ${fileName(bundle.filePath)}` : ''}
              </p>
              <div className="classic__ndi-bar">
                <span
                  className={`classic__ndi-dot ${ndi?.ready && !ndi.lastError ? 'is-live' : ''} ${ndi?.lastError ? 'is-error' : ''}`}
                  aria-hidden="true"
                />
                <label className="classic__source">
                  <span>Source</span>
                  <div className="classic__source-field">
                    <input
                      ref={sourceInputRef}
                      type="text"
                      value={sourceDraft}
                      disabled={sourceSaving || busy}
                      onChange={(e) => setSourceDraft(e.target.value)}
                      onBlur={() => void applySourceName()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        }
                      }}
                      aria-label="Nom de la source NDI"
                    />
                    <button
                      type="button"
                      className="classic__source-edit"
                      data-tip="Modifier le nom de la source"
                      aria-label="Modifier le nom de la source"
                      disabled={sourceSaving || busy}
                      onMouseDown={(e) => {
                        e.preventDefault()
                      }}
                      onClick={() => {
                        const input = sourceInputRef.current
                        if (!input || input.disabled) return
                        input.focus()
                        input.select()
                      }}
                    >
                      <IconEdit />
                    </button>
                  </div>
                </label>
                <span className={`classic__status-ndi ${ndi?.lastError ? 'is-error' : ''}`}>
                  {ndi?.ready && !ndi.lastError
                    ? 'en direct'
                    : ndi?.lastError
                      ? ndi.lastError
                      : 'inactif'}
                </span>
              </div>
            </div>
          </div>
        )}
      </footer>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(cfg) => {
          setConfig(cfg)
          setRecentFiles(cfg.recentFiles ?? [])
          setSourceDraft(cfg.ndiSourceName)
          setTransparent(cfg.transparentByDefault)
          void window.api.ndiGetStatus().then(setNdi)
        }}
      />
    </div>
  )
}

export default ClassicMode
