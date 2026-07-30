# 05 — Electron, fenêtres et IPC

## 1. Processus principal

Fichier : `backend/backend.js` (`package.json` → `"main"`).

### Init

```js
app.disableHardwareAcceleration();
app.allowRendererProcessReuse = true;
require('@electron/remote/main').initialize();
app.on('ready', init);
```

### Fenêtres créées

| Variable | HTML | Rôle |
|----------|------|------|
| `mainWindow` | `client-mode.html` | Sélecteur de mode |
| `mainWindow2` | `client-slideshow.html` ou `client-classic.html` | Mode actif |
| `mainWindow3` | `client-config.html` | Config (souvent cachée) |
| `monitorWin` | `monitor.html` | Plein écran local |
| `rendererWin` | `renderer.html` | Worker rendu PPTX interne |

Création commune via `createWin()` :

- `frame: false`
- `nodeIntegration: true` ⚠️
- `contextIsolation: false` ⚠️
- `@electron/remote` activé ⚠️

**À ne pas recopier** dans un produit moderne : utilisez un **preload** et IPC typé.

## 2. CLI

```
ppt-ndi.exe [--slideshow] [--classic] [--load-file=chemin.pptx]
```

## 3. Canaux IPC

### `remote` (UI ↔ main)

| `data.name` | Effet |
|-------------|-------|
| `exit` | Quitte / destroy fenêtres |
| `select1` | Ouvre SlideShow |
| `select2` | Ouvre Classic |
| `showConfig` / `hideConfig` | Config |
| `onTop` / `onTopOff` | Always on top |
| `reflectConfig` | Reload config + hotkeys |
| `passConfigData` | Stocke `remoteVar.configData` |

Messages main → renderer2 : `msg: exit | focused | blurred | loadFile | gotoPrev | …`

### `require` (synchrone)

Pont dangereux mais central : charge FFI et appelle `init` / `send` / `destroy`, ou enregistre les global shortcuts.

### `monitor`

`get` displays, `assign`, `turnOn/Off`, `transparentOn/Off`, `update`, couleurs…

### `renderer`

Proxy entre Classic et la fenêtre `renderer.html` (`load` / `cancel` / notifications).

### `status`

Ex. `multipleInstance` (single instance lock).

## 4. Tray

Menu : Hide/Show, Configure, Exit. Double-clic restaure la fenêtre mode.

## 5. Hotkeys

Préfixe `Ctrl+Shift+` + touches configurables (`prev`, `next`, `transparent`, `black`, `white`).

Enregistrés dans `globalShortcut_proc()` après `passConfigData`.

## 6. Config

Écran `client-config` + JSON local (langue, hotkeys, highPerformance, etc.).

`highPerformance` active une boucle `sendLoop()` dans le main qui renvoie périodiquement la dernière image NDI.

## 7. i18n actuelle

Fichiers JSON dans `frontend/i18n/` (EN/KO principalement). Helper `i18n.js` + `getLangRsc`.

Pour votre rebuild : **français par défaut**, textes justifiés / alignés selon vos règles UI.

## 8. Pattern cible (rebuild)

```
main/
  index.ts
  windows.ts
  ipc/
    powerpoint.ts
    ndi.ts
    config.ts
preload/
  index.ts          # expose API minimale window.api.*
renderer/
  ...
```

Exemple preload :

```ts
contextBridge.exposeInMainWorld('api', {
  ndiSend: (path: string) => ipcRenderer.invoke('ndi:send', path),
  exportSlides: (file: string) => ipcRenderer.invoke('ppt:exportAll', file),
  onSlideStatus: (cb) => ipcRenderer.on('ppt:status', (_e, v) => cb(v)),
});
```
