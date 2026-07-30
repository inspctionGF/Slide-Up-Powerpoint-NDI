import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  DisplayResolution,
  GalleryPosition,
  HotkeyAction,
  SlideTransitionType
} from '@shared/types'
import { IconEdit, IconKeyboard } from './Icons'
import { FX_OPTIONS } from './ProductionBar'
import ToolSelect from './ToolSelect'
import { applyUiTheme } from '../theme'
import './SettingsPanel.css'

type SettingsPanelProps = {
  open: boolean
  onClose: () => void
  onSaved?: (config: AppConfig) => void
}

type HotkeyGroup = 'nav' | 'fill' | 'prod'

const HOTKEY_GROUPS: {
  id: HotkeyGroup
  caption: string
  fields: { action: HotkeyAction; label: string }[]
}[] = [
  {
    id: 'nav',
    caption: 'Navigation',
    fields: [
      { action: 'prev', label: 'Précédente' },
      { action: 'next', label: 'Suivante' }
    ]
  },
  {
    id: 'fill',
    caption: 'Fonds',
    fields: [
      { action: 'black', label: 'Noir' },
      { action: 'white', label: 'Blanc' },
      { action: 'transparent', label: 'Sans fond' }
    ]
  },
  {
    id: 'prod',
    caption: 'Production',
    fields: [{ action: 'freeze', label: 'Gel' }]
  }
]

const GALLERY_POSITION_OPTIONS: { value: GalleryPosition; label: string }[] = [
  { value: 'left', label: 'Gauche' },
  { value: 'bottom', label: 'Bas' }
]

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.filter((value) => value > 0))].sort((a, b) => a - b)
}

function exportSizeOptions(
  displayValues: number[],
  current: number,
  displayLabels: Map<number, string>
): { value: number; label: string }[] {
  const positives = uniqueSorted([...displayValues, current])
  const values = [0, ...positives]
  return values.map((value) => {
    if (value === 0) return { value, label: 'Natif' }
    const displayLabel = displayLabels.get(value)
    return {
      value,
      label: displayLabel ? `${displayLabel} · ${value} px` : `${value} px`
    }
  })
}

type ToggleRowProps = {
  id: string
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled
}: ToggleRowProps): JSX.Element {
  return (
    <div className={`settings__toggle-row${hint ? ' settings__toggle-row--rich' : ''}`}>
      <div className="settings__toggle-copy">
        <span className="settings__toggle-label" id={id}>
          {label}
        </span>
        {hint ? <span className="settings__toggle-hint">{hint}</span> : null}
      </div>
      <button
        type="button"
        className={`settings__toggle${checked ? ' is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="settings__toggle-thumb" aria-hidden="true" />
      </button>
    </div>
  )
}

function SettingsPanel({ open, onClose, onSaved }: SettingsPanelProps): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [displays, setDisplays] = useState<DisplayResolution[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void window.api.getConfig().then(setConfig)
    void window.api.getDisplayResolutions().then(setDisplays)
    void window.api.getHotkeyStatus().then((status) => {
      setHotkeyError(status.error ?? null)
    })
    setMessage(null)
  }, [open])

  const widthLabels = useMemo(() => {
    const map = new Map<number, string>()
    for (const display of displays) {
      if (!map.has(display.width)) {
        map.set(display.width, display.primary ? 'Écran' : display.label.split(' · ')[0])
      }
    }
    return map
  }, [displays])

  const heightLabels = useMemo(() => {
    const map = new Map<number, string>()
    for (const display of displays) {
      if (!map.has(display.height)) {
        map.set(display.height, display.primary ? 'Écran' : display.label.split(' · ')[0])
      }
    }
    return map
  }, [displays])

  const displayWidths = useMemo(
    () => uniqueSorted(displays.map((display) => display.width)),
    [displays]
  )
  const displayHeights = useMemo(
    () => uniqueSorted(displays.map((display) => display.height)),
    [displays]
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const save = async (): Promise<void> => {
    if (!config) return
    setSaving(true)
    setMessage(null)
    try {
      const { recentFiles: _recentFiles, ...settings } = config
      const next = await window.api.setConfig(settings)
      const ndi = await window.api.ndiSetSourceName(next.ndiSourceName)
      const hotkeys = await window.api.registerHotkeys(next.hotkeys)
      setConfig(next)
      applyUiTheme(next.uiTheme ?? 'dark')
      onSaved?.(next)
      setHotkeyError(hotkeys.error ?? null)
      const parts = [
        ndi.lastError
          ? `Config enregistrée. NDI : ${ndi.lastError}`
          : `Config enregistrée. Source NDI « ${ndi.sourceName} ».`
      ]
      if (hotkeys.error) {
        parts.push(`Raccourcis : ${hotkeys.error}`)
      }
      setMessage(parts.join(' '))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Échec de l’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      className={`settings${open ? ' is-open' : ''}`}
      aria-hidden={!open}
      aria-label="Réglages"
    >
      <div className="settings__panel" role="dialog" aria-modal={open} aria-labelledby="settings-title">
        <header className="settings__head">
          <h2 id="settings-title">Réglages</h2>
          <button type="button" className="settings__close" onClick={onClose}>
            Fermer
          </button>
        </header>

        <div className="settings__body">
          {!config ? (
            <p className="settings__hint">Chargement des réglages…</p>
          ) : (
            <>
              <section className="settings__ndi" aria-labelledby="settings-ndi-title">
                <h3 id="settings-ndi-title" className="settings__ndi-title">
                  NDI
                </h3>

                <label className="settings__field settings__field--ndi">
                  <span>Nom de la source</span>
                  <input
                    type="text"
                    value={config.ndiSourceName}
                    onChange={(e) => setConfig({ ...config, ndiSourceName: e.target.value })}
                  />
                </label>

                <ToolSelect
                  variant="field"
                  className="select-field--flush"
                  label="Transition FX"
                  value={config.slideTransitionType}
                  options={FX_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  ariaLabel="Type de transition"
                  onChange={(slideTransitionType: SlideTransitionType) =>
                    setConfig({
                      ...config,
                      slideTransitionType,
                      slideTransitionEffect: slideTransitionType !== 'cut'
                    })
                  }
                />

                {config.slideTransitionType !== 'cut' && (
                  <ToolSelect
                    variant="field"
                    className="select-field--flush"
                    label="Durée FX (ms)"
                    value={config.slideTransitionMs}
                    options={[250, 350, 450, 600, 800, 1000]}
                    ariaLabel="Durée de transition"
                    onChange={(slideTransitionMs) =>
                      setConfig({ ...config, slideTransitionMs })
                    }
                  />
                )}

                <ToggleRow
                  id="ndi-background"
                  label="Fond sur NDI"
                  checked={!config.transparentByDefault}
                  onChange={(checked) =>
                    setConfig({ ...config, transparentByDefault: !checked })
                  }
                />

                <ToggleRow
                  id="ndi-keepalive"
                  label="Maintenir le flux NDI"
                  checked={config.highPerformanceKeepalive}
                  onChange={(checked) =>
                    setConfig({ ...config, highPerformanceKeepalive: checked })
                  }
                />
              </section>

              <ToggleRow
                id="ui-theme"
                label="Mode clair"
                hint="Interface claire pour les environnements bien éclairés"
                checked={config.uiTheme === 'light'}
                onChange={(checked) => {
                  const uiTheme = checked ? 'light' : 'dark'
                  setConfig({ ...config, uiTheme })
                  applyUiTheme(uiTheme)
                  void window.api.setConfig({ uiTheme })
                }}
              />

              <ToggleRow
                id="app-tray"
                label="Réduire dans la barre d’état système au démarrage"
                checked={config.minimizeToTrayOnStartup}
                onChange={(checked) =>
                  setConfig({ ...config, minimizeToTrayOnStartup: checked })
                }
              />

              <ToggleRow
                id="app-first-slide"
                label="Démarrer avec la première diapositive sélectionnée"
                checked={config.selectFirstSlideOnOpen}
                onChange={(checked) =>
                  setConfig({ ...config, selectFirstSlideOnOpen: checked })
                }
              />

              <div className="settings__row settings__row--export">
                <ToolSelect
                  variant="field"
                  label="Largeur export"
                  value={config.exportWidth}
                  options={exportSizeOptions(displayWidths, config.exportWidth, widthLabels)}
                  ariaLabel="Largeur d’export"
                  onChange={(exportWidth) => setConfig({ ...config, exportWidth })}
                />
                <ToolSelect
                  variant="field"
                  label="Hauteur export"
                  value={config.exportHeight}
                  options={exportSizeOptions(displayHeights, config.exportHeight, heightLabels)}
                  ariaLabel="Hauteur d’export"
                  onChange={(exportHeight) => setConfig({ ...config, exportHeight })}
                />
              </div>

              <fieldset className="settings__fieldset settings__fieldset--hotkeys">
                <legend>Raccourcis</legend>
                <p className="settings__hotkeys-lead">
                  <IconKeyboard className="settings__hotkeys-lead-icon" />
                  <span>
                    Pointeurs sans fil supportés (PageUp / PageDown / Period). Plusieurs
                    touches : PageUp,Left · Ex. CommandOrControl+Shift+B
                  </span>
                </p>

                {HOTKEY_GROUPS.map((group) => (
                  <div key={group.id} className="settings__hotkey-block">
                    <p className="settings__gallery-caption">{group.caption}</p>
                    <div className="settings__hotkeys">
                      {group.fields.map(({ action, label }) => (
                        <label key={action} className="settings__hotkey">
                          <span className="settings__hotkey-label">{label}</span>
                          <span className="settings__hotkey-control">
                            <input
                              type="text"
                              spellCheck={false}
                              autoComplete="off"
                              value={config.hotkeys[action]}
                              aria-label={`Raccourci ${label}`}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  hotkeys: { ...config.hotkeys, [action]: e.target.value }
                                })
                              }
                            />
                            <IconEdit className="settings__hotkey-edit" />
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {hotkeyError && (
                  <p className="settings__msg settings__msg--warn">{hotkeyError}</p>
                )}
              </fieldset>

              <fieldset className="settings__fieldset settings__fieldset--gallery">
                <legend>Galerie Classic</legend>

                <ToolSelect
                  variant="field"
                  className="select-field--flush"
                  label="Position"
                  value={config.galleryPosition}
                  options={GALLERY_POSITION_OPTIONS}
                  ariaLabel="Position de la galerie"
                  onChange={(galleryPosition) => setConfig({ ...config, galleryPosition })}
                />

                <div className="settings__gallery-block">
                  <p className="settings__gallery-caption">Grille · mode bas</p>
                  <div className="settings__row settings__row--tight">
                    <ToolSelect
                      variant="field"
                      className="select-field--flush select-field--compact"
                      label="Colonnes"
                      value={config.galleryColumns}
                      options={Array.from({ length: 11 }, (_, i) => i + 2)}
                      ariaLabel="Nombre de colonnes"
                      onChange={(galleryColumns) => setConfig({ ...config, galleryColumns })}
                    />
                    <ToolSelect
                      variant="field"
                      className="select-field--flush select-field--compact"
                      label="Lignes"
                      value={config.galleryRows}
                      options={Array.from({ length: 5 }, (_, i) => i + 1)}
                      ariaLabel="Nombre de lignes visibles"
                      onChange={(galleryRows) => setConfig({ ...config, galleryRows })}
                    />
                  </div>
                </div>

                <ToggleRow
                  id="gallery-pip"
                  label="Mini-écran suivant"
                  hint="Aperçu flottant de la prochaine diapositive"
                  checked={config.nextPreviewEnabled}
                  onChange={(checked) =>
                    setConfig({ ...config, nextPreviewEnabled: checked })
                  }
                />
              </fieldset>

              {message && <p className="settings__msg">{message}</p>}
            </>
          )}
        </div>

        <div className="settings__actions">
          <button type="button" className="settings__btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="settings__btn settings__btn--primary"
            disabled={saving || !config}
            onClick={() => void save()}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </aside>
  )
}

export default SettingsPanel
