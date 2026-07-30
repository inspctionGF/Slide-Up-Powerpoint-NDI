# 06 — Guide de reconstruction

Ce guide explique comment **refaire une application du même type** à partir du scaffold dans `/scaffold`, en s’appuyant sur l’analyse du repo PPT-NDI.

## Phase 0 — Clarifier le produit

Décidez :

1. **Modes** : SlideShow live, Classic batch, ou les deux ?
2. **Transparence** obligatoire (lower thirds) ?
3. **Plateforme** : Windows only au départ (recommandé) ?
4. **Dépendance Office** : oui (qualité) / non (renderer interne) ?

MVP recommandé : **Classic + export COM + NDI**, puis SlideShow live.

## Phase 1 — Socle Electron + Vite

Dans `scaffold/` (stack : Electron 43, Vite 7, electron-vite 5) :

```bash
cd scaffold
npm install
npm run dev
```

Objectifs :

- [x] Main / preload / renderer via **electron-vite**
- [x] Preload + `contextIsolation`
- [x] Une fenêtre shell FR
- [ ] Config JSON locale
- [ ] Dialog natif pour ouvrir un `.pptx` (à la place de `prompt`)

## Phase 2 — Bridge PowerPoint

Implémenter `src/powerpoint/` :

1. Écrire un script JScript minimal qui exporte 1 slide en PNG.
2. `spawn('cscript.exe', ['//NOLOGO', '//E:jscript', script, ...])`.
3. Attendre la fin / parser stdout.
4. Étendre à `exportAll` + métadonnées transitions.
5. Ajouter mode transparent (`Shapes.Range.Export`).

Tests manuels :

- PPTX avec fond uni
- Lower third transparent
- Slide masquée
- Fichier sur OneDrive / chemin avec espaces

## Phase 3 — Sender NDI

1. Installer NDI SDK.
2. Compiler le stub `native/PPTNDI` (ou helper exe).
3. Exposer `init/send/destroy` via N-API.
4. Depuis l’UI : bouton « Envoyer slide courante ».
5. Vérifier dans **NDI Studio Monitor**.

## Phase 4 — UX Classic

- Ouvrir fichier
- Galerie miniatures
- Prev / next + hotkeys
- Preview damier (transparence)
- Always on top
- Option moniteur local

Textes UI : **français**, icônes liées au sens (ouvrir, éditer, réglages).

## Phase 5 — Mode SlideShow (optionnel)

- Poller `CurrentShowPosition`
- Trigger export sur changement
- Mirror black/white/end
- Transitions soft (crossfade images) si besoin

## Phase 6 — Packaging

- electron-builder (plus simple qu’electron-packager + scripts custom)
- Bundler la runtime NDI
- Installateur (Inno Setup / NSIS)
- Code signing si distribution large

## Mapping repo actuel → scaffold

| Ancien | Nouveau (cible) |
|--------|-----------------|
| `backend/backend.js` | `src/main/index.ts` |
| `frontend/js/cscript.js` | `src/powerpoint/scripts/*` + `bridge.ts` |
| `frontend/js/client-*.js` | `src/renderer/modes/*` |
| `PPTNDI.cpp` + ffi-napi | `native/` + N-API ou helper process |
| `scripts/build.js` monolithique | `electron-builder` + `cmake-js` / MSBuild ciblé |

## Estimation d’effort (ordre de grandeur)

| Bloc | Effort relatif |
|------|----------------|
| Electron shell + UI Classic basique | M |
| Bridge COM export PNG | M |
| Transparence fiable | M–L |
| NDI native + packaging DLL | L |
| SlideShow live robuste | L |
| Renderer interne sans Office | XL (souvent abandonné) |

## Critères de “done” MVP

- [ ] Ouvrir un PPTX et voir toutes les miniatures
- [ ] Envoyer la slide sélectionnée en NDI (visible dans Studio Monitor)
- [ ] Option sans fond = alpha correct sur lower third
- [ ] Quitter nettoie temp + destroy NDI
- [ ] Textes FR, pas de crash si PPT absent (message clair)

## Références internes

- Architecture : [01-ARCHITECTURE.md](./01-ARCHITECTURE.md)
- Flux : [02-FLUX-DONNEES.md](./02-FLUX-DONNEES.md)
- COM : [03-COM-POWERPOINT.md](./03-COM-POWERPOINT.md)
- NDI : [04-NDI-NATIF.md](./04-NDI-NATIF.md)
- IPC : [05-ELECTRON-IPC.md](./05-ELECTRON-IPC.md)
- Code stub : [`../scaffold/`](../scaffold/)
