import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppConfig,
  DisplayResolution,
  ExportOptions,
  ExportProgress,
  HotkeyAction,
  HotkeyConfig,
  NdiStatus,
  OpenPathResult,
  PresentationChangedEvent,
  RecentFile,
  SlideBundle,
  SlideshowCommand,
  SlideshowStatusEvent,
  SolidOutputMode,
  NdiTransitionRequest
} from '../shared/types'

export type HotkeyStatus = {
  ok: boolean
  error: string | null
  registered: Partial<Record<HotkeyAction, string>>
}

export type SlideUpApi = {
  getVersion: () => Promise<string>
  getDisplayResolutions: () => Promise<DisplayResolution[]>
  openPresentation: () => Promise<string | null>
  getRecentFiles: () => Promise<RecentFile[]>
  clearRecentFiles: () => Promise<RecentFile[]>
  removeRecentFile: (filePath: string) => Promise<RecentFile[]>
  openPath: (filePath: string) => Promise<OpenPathResult>
  setAlwaysOnTop: (enabled: boolean) => Promise<boolean>
  isAlwaysOnTop: () => Promise<boolean>
  windowMinimize: () => Promise<void>
  windowMaximizeToggle: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximized: (callback: (maximized: boolean) => void) => () => void
  getConfig: () => Promise<AppConfig>
  setConfig: (partial: Partial<AppConfig>) => Promise<AppConfig>
  registerHotkeys: (hotkeys?: HotkeyConfig) => Promise<HotkeyStatus>
  getHotkeyStatus: () => Promise<HotkeyStatus>
  onHotkey: (callback: (action: HotkeyAction) => void) => () => void
  exportAllSlides: (filePath: string, options: ExportOptions) => Promise<SlideBundle>
  cleanupExport: () => Promise<void>
  watchPresentation: (filePath: string) => Promise<{ ok: boolean; error?: string }>
  unwatchPresentation: () => Promise<{ ok: boolean }>
  onPresentationChanged: (callback: (event: PresentationChangedEvent) => void) => () => void
  onExportProgress: (callback: (progress: ExportProgress) => void) => () => void
  ndiGetStatus: () => Promise<NdiStatus>
  ndiInit: (sourceName?: string) => Promise<NdiStatus>
  ndiSend: (pngPath: string, once?: boolean) => Promise<NdiStatus>
  ndiSendSolid: (mode: SolidOutputMode) => Promise<NdiStatus>
  ndiSendTransition: (request: NdiTransitionRequest) => Promise<NdiStatus>
  ndiSetFrozen: (frozen: boolean) => Promise<NdiStatus>
  ndiDestroy: () => Promise<NdiStatus>
  ndiSetSourceName: (name: string) => Promise<NdiStatus>
  slideshowStart: (options?: {
    transparent?: boolean
  }) => Promise<{ ok: boolean; error?: string }>
  slideshowStop: () => Promise<{ ok: boolean }>
  slideshowCommand: (cmd: SlideshowCommand) => Promise<{ ok: boolean }>
  slideshowSetTransparent: (transparent: boolean) => Promise<{ ok: boolean }>
  onSlideshowStatus: (callback: (event: SlideshowStatusEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SlideUpApi
  }
}

export {}
