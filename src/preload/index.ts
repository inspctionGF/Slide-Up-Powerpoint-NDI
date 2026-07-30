import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),

  getDisplayResolutions: (): Promise<DisplayResolution[]> =>
    ipcRenderer.invoke('app:getDisplayResolutions'),

  openPresentation: (): Promise<string | null> => ipcRenderer.invoke('app:openPresentation'),

  getRecentFiles: (): Promise<RecentFile[]> => ipcRenderer.invoke('app:getRecentFiles'),

  clearRecentFiles: (): Promise<RecentFile[]> => ipcRenderer.invoke('app:clearRecentFiles'),

  removeRecentFile: (filePath: string): Promise<RecentFile[]> =>
    ipcRenderer.invoke('app:removeRecentFile', filePath),

  openPath: (filePath: string): Promise<OpenPathResult> =>
    ipcRenderer.invoke('app:openPath', filePath),

  setAlwaysOnTop: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('app:setAlwaysOnTop', enabled),

  isAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('app:isAlwaysOnTop'),

  windowMinimize: (): Promise<void> => ipcRenderer.invoke('app:windowMinimize'),
  windowMaximizeToggle: (): Promise<boolean> => ipcRenderer.invoke('app:windowMaximizeToggle'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('app:windowClose'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('app:windowIsMaximized'),
  onWindowMaximized: (callback: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean): void => {
      callback(maximized)
    }
    ipcRenderer.on('window:maximized-changed', listener)
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },

  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
  setConfig: (partial: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke('config:set', partial),

  registerHotkeys: (hotkeys?: HotkeyConfig): Promise<HotkeyStatus> =>
    ipcRenderer.invoke('app:registerHotkeys', hotkeys),
  getHotkeyStatus: (): Promise<HotkeyStatus> => ipcRenderer.invoke('app:getHotkeyStatus'),
  onHotkey: (callback: (action: HotkeyAction) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, action: HotkeyAction): void => {
      callback(action)
    }
    ipcRenderer.on('hotkey:triggered', listener)
    return () => {
      ipcRenderer.removeListener('hotkey:triggered', listener)
    }
  },

  exportAllSlides: (filePath: string, options: ExportOptions): Promise<SlideBundle> =>
    ipcRenderer.invoke('ppt:exportAll', filePath, options),

  cleanupExport: (): Promise<void> => ipcRenderer.invoke('ppt:cleanup'),

  watchPresentation: (filePath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('ppt:watch', filePath),

  unwatchPresentation: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('ppt:unwatch'),

  onPresentationChanged: (callback: (event: PresentationChangedEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: PresentationChangedEvent): void => {
      callback(payload)
    }
    ipcRenderer.on('ppt:file-changed', listener)
    return () => {
      ipcRenderer.removeListener('ppt:file-changed', listener)
    }
  },

  onExportProgress: (callback: (progress: ExportProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, progress: ExportProgress): void => {
      callback(progress)
    }
    ipcRenderer.on('ppt:progress', listener)
    return () => {
      ipcRenderer.removeListener('ppt:progress', listener)
    }
  },

  ndiGetStatus: (): Promise<NdiStatus> => ipcRenderer.invoke('ndi:getStatus'),
  ndiInit: (sourceName?: string): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:init', sourceName),
  ndiSend: (pngPath: string, once?: boolean): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:send', pngPath, once),
  ndiSendSolid: (mode: SolidOutputMode): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:sendSolid', mode),
  ndiSendTransition: (request: NdiTransitionRequest): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:sendTransition', request),
  ndiSetFrozen: (frozen: boolean): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:setFrozen', frozen),
  ndiDestroy: (): Promise<NdiStatus> => ipcRenderer.invoke('ndi:destroy'),
  ndiSetSourceName: (name: string): Promise<NdiStatus> =>
    ipcRenderer.invoke('ndi:setSourceName', name),

  slideshowStart: (options?: {
    transparent?: boolean
  }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('slideshow:start', options),
  slideshowStop: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('slideshow:stop'),
  slideshowCommand: (cmd: SlideshowCommand): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('slideshow:command', cmd),
  slideshowSetTransparent: (transparent: boolean): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('slideshow:setTransparent', transparent),
  onSlideshowStatus: (callback: (event: SlideshowStatusEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, status: SlideshowStatusEvent): void => {
      callback(status)
    }
    ipcRenderer.on('ppt:slideshow-status', listener)
    return () => {
      ipcRenderer.removeListener('ppt:slideshow-status', listener)
    }
  }
}

export type SlideUpApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback sans isolation
  window.electron = electronAPI
  // @ts-expect-error fallback sans isolation
  window.api = api
}
