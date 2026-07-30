# 01 — Architecture

## 1. Vue d’ensemble

PPT-NDI est une application **desktop Electron** qui :

1. Contrôle / lit Microsoft PowerPoint via **COM** (VBScript / JScript).
2. Exporte les diapos en **PNG** (avec ou sans fond).
3. Diffuse ces images sur le réseau via **NDI** grâce à une bibliothèque native (`PPTNDI.dll`).

Elle n’implémente **pas** un moteur PowerPoint complet : le rendu “exact” vient d’Office.

```
┌─────────────────────────────────────────────────────────────┐
│  Electron Main (backend/backend.js)                         │
│  - Fenêtres, tray, IPC, raccourcis, FFI loader              │
└───────────────┬─────────────────────────────┬───────────────┘
                │ IPC                         │ ffi-napi
┌───────────────▼───────────────┐   ┌─────────▼──────────────┐
│  Renderer (frontend/*.html)   │   │  PPTNDI.dll / .dylib   │
│  - Mode, SlideShow, Classic   │   │  + Processing.NDI.*.dll│
│  - Config, Monitor, Renderer  │   └─────────┬──────────────┘
└───────────────┬───────────────┘             │ NDI network
                │ spawn cscript.exe           ▼
┌───────────────▼───────────────┐   ┌────────────────────────┐
│  Scripts COM (cscript.js)     │   │  Receivers (OBS, vMix…) │
│  PowerPoint.Application       │   └────────────────────────┘
│  .Export → PNG                │
└───────────────────────────────┘
```

## 2. Arborescence du repo actuel

```
ppt-ndi/
├── package.json              # Electron app, main = backend/backend.js
├── backend/
│   ├── backend.js            # Processus principal Electron
│   ├── img/                  # Icônes app / tray
│   └── src/
│       ├── PPTNDI.sln        # Solution Visual Studio
│       └── PPTNDI/
│           └── PPTNDI.cpp    # Wrapper NDI (init / destroy / send)
├── frontend/
│   ├── client-mode.html      # Choix SlideShow vs Classic
│   ├── client-slideshow.html # Mode plugin diaporama live
│   ├── client-classic.html   # Mode UI dédiée + galerie
│   ├── client-config.html    # Préférences
│   ├── monitor.html          # Sortie plein écran locale
│   ├── renderer.html         # Fallback rendu sans PowerPoint
│   ├── css/                  # Styles par écran
│   ├── js/
│   │   ├── cscript.js        # ★ Scripts COM embarqués
│   │   ├── client-*.js       # Logique UI par mode
│   │   ├── renderer.js       # Parse PPTX (pptx-compose)
│   │   ├── monitor.js
│   │   └── i18n.js
│   ├── i18n/*.json           # EN / KO (actuel)
│   └── img/
├── scripts/
│   ├── build.js              # SDK NDI + compile + electron-packager
│   ├── test.js               # Lance l’exe packagé dans tmp/
│   └── instScript.iss        # Installateur Inno Setup
└── resources/                # Assets marketing / sample.pptx
```

## 3. Couches et responsabilités

| Couche | Fichiers clés | Rôle |
|--------|---------------|------|
| Shell Electron | `backend/backend.js` | Cycle de vie, fenêtres, tray, IPC, chargement FFI |
| UI | `frontend/client-*.html/js` | Modes, preview, config, hotkeys UI |
| Bridge Office | `frontend/js/cscript.js` | Templates VBS/JS exécutés par `cscript.exe` |
| Rendu fallback | `frontend/js/renderer.js` | PPTX → HTML → PNG (expérimental) |
| Natif NDI | `backend/src/PPTNDI/PPTNDI.cpp` | Décoder PNG, envoyer frame NDI |
| Build | `scripts/build.js` | Télécharger SDK, MSBuild, packager |

## 4. Deux modes produit

### Mode SlideShow

- PowerPoint reste l’outil de présentation.
- L’utilisateur démarre le **diaporama** dans PowerPoint.
- PPT-NDI poll la position courante et exporte **la slide active** en PNG.
- Idéal pour les utilisateurs habitués à PowerPoint.

### Mode Classic

- L’utilisateur ouvre un `.pptx` depuis PPT-NDI.
- Toutes les slides sont exportées d’un coup (`Slide1.png`…).
- UI de navigation / transitions / moniteur dédié.
- Plus de contrôle, transitions gérées côté app.

## 5. Décisions techniques importantes

| Décision | Pourquoi |
|----------|----------|
| COM + Export PNG | Rendu pixel-perfect = PowerPoint lui-même |
| `Shapes.Range().Export(..., 1)` | Transparence (ppRelativeToOriginalSize) sans fond |
| FFI vers DLL native | NDI SDK est C/C++, pas JS |
| Electron + `nodeIntegration: true` | Ancien pattern (à **ne pas** reproduire tel quel) |
| Scripts écrits dans un temp dir | `cscript` lit des fichiers `.vbs` / JScript |

## 6. Ce qu’il faut moderniser en rebuild

1. **electron-vite + Vite 7** (déjà dans `scaffold/`).
2. **Preload + `contextIsolation: true`** (sécurité).
3. Remplacer `ffi-napi` (fragile / Node ABI) par **N-API / node-addon-api** ou un **processus helper** natif.
4. Remplacer jQuery UI ad-hoc par Vite vanilla / React / Vue si souhaité.
5. Isoler le bridge PowerPoint dans un module TypeScript testable.
6. Gérer clairement les chemins temp, lifecycle des process `cscript`, et cleanup.
7. i18n FR par défaut (selon vos règles produit).
