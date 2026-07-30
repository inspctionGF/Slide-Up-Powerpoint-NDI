# 04 — Couche NDI native

## 1. Rôle

`PPTNDI.cpp` encapsule le **NDI SDK** et expose 3 fonctions C pour Node via FFI :

| Fonction | Signature C | Rôle |
|----------|-------------|------|
| `init` | `int init(void)` | `NDIlib_initialize` + `NDIlib_send_create` |
| `destroy` | `int destroy(void)` | Destroy sender + `NDIlib_destroy` |
| `send` | `int send(const char *path, bool trans)` | PNG → RGBA → `NDIlib_send_send_video_v2` |

Nom NDI annoncé : **`PPTNDI`** (puis `PPTNDI (2)`… si collision, max 5 instances).

## 2. Chargement depuis Electron

Dans `backend/backend.js`, canal IPC `require` :

```js
remoteVar.lib = ffi.Library(libPath, {
  init:    ['int', []],
  destroy: ['int', []],
  send:    ['int', ['string', 'bool']],
});
```

Chemins recherchés (à côté de l’app, hors asar) :

- Windows : `PPTNDI.dll` + `Processing.NDI.Lib.x64.dll`
- macOS : `PPTNDI.dylib` (+ `libndi.dylib`)
- Linux : `libpptndi.so` (+ `libndi.so.5`)

Le renderer appelle :

```js
ipc.sendSync('require', { lib: 'ffi', func: null, args: null }); // load
ipc.sendSync('require', { lib: 'ffi', func: 'init', args: null });
ipc.sendSync('require', { lib: 'ffi', func: 'send', args: [pngPath, false] });
```

## 3. Algorithme `send`

Pseudo-code (cf. `PPTNDI.cpp`) :

```
loadFile(png_data, path)
decodePNG(image_data, xres, yres, png_data)  // picopng, RGBA
frame.FourCC = NDIlib_FourCC_type_RGBA
frame.p_data = image_data
frame.line_stride = xres * 4
repeat (trans ? 1 : 2) times:
  NDIlib_send_send_video_v2(sender, &frame)
```

## 4. Build natif (Windows)

`scripts/build.js` :

1. Télécharge **NDI SDK** (+ `innoextract` pour extraire l’installeur Windows).
2. Copie headers / libs SDK.
3. Compile `PPTNDI.sln` (MSBuild, x64 Release) → `PPTNDI.dll`.
4. `electron-packager` sur un dossier `deploy/`.
5. Copie `PPTNDI.dll` + `Processing.NDI.Lib.x64.dll` dans le bundle.

Prérequis build :

- Visual Studio Build Tools (C++)
- SDK NDI (licence NDI à respecter)
- Node + npm deps installées

## 5. Limitations actuelles

- Dépendance **ABI** : `ffi-napi` / `ref-napi` cassent souvent avec Node récent / Electron récent.
- `picopng` = décodeur minimal (pas d’optimisation perf).
- Envoi synchrone depuis le main via `sendSync` — peut bloquer l’UI sous charge.
- Pas de clock NDI explicite / pas d’audio.

## 6. Rebuild recommandé

Préférer l’une de ces options :

### A. Node Addon (N-API)

```
native/
  binding.gyp
  src/ndi_sender.cpp   // même logique
  index.ts             // wrap TypeScript
```

Avantage : plus stable que ffi-napi, typings propres.

### B. Processus helper

Petit exe `pptndi-sender.exe` qui lit des chemins PNG sur stdin et push NDI. Electron communique via stdio JSON.

Avantage : crash isolé, rebuild Electron indépendant du SDK.

### C. Lib existante

Évaluer des wrappers NDI communautaires (maintenabilité / licence).

## 7. Checklist intégration NDI

- [ ] Initialiser une seule fois par process
- [ ] Nom source configurable (`PPTNDI`, `Église-Main`, …)
- [ ] Gérer collision de noms
- [ ] Détruire proprement à la sortie
- [ ] Copier runtime NDI à côté du binaire
- [ ] Documenter installation NDI Tools pour les receivers
- [ ] Tester avec OBS / vMix / NDI Studio Monitor
