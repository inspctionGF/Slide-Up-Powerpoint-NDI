# Documentation technique — PPT NDI (analyse & reconstruction)

Ce dossier documente l’architecture de **PPT-NDI** (repo actuel) et fournit un **plan de reconstruction** pour bâtir une application équivalente (ou meilleure) de zéro.

## Objectif produit

Envoyer des diapositives PowerPoint sur le réseau via **NDI** (NewTek), avec support de **transparence** (pas de chroma key), sans moniteur physique dédié.

## Documents

| Fichier | Contenu |
|---------|---------|
| [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) | Couches, arborescence, responsabilités |
| [02-FLUX-DONNEES.md](./02-FLUX-DONNEES.md) | Séquences SlideShow / Classic / NDI |
| [03-COM-POWERPOINT.md](./03-COM-POWERPOINT.md) | Automation Office, export PNG, transparence |
| [04-NDI-NATIF.md](./04-NDI-NATIF.md) | DLL native, FFI, API `init/send/destroy` |
| [05-ELECTRON-IPC.md](./05-ELECTRON-IPC.md) | Fenêtres Electron, IPC, tray, config |
| [06-GUIDE-REBUILD.md](./06-GUIDE-REBUILD.md) | Roadmap pour reconstruire l’app |
| [07-ROADMAP.md](./07-ROADMAP.md) | CURRENT / NEXT — état produit Slide-up |
| [../scaffold/](../scaffold/) | Squelette de projet cible (code stub) |

## Stack actuelle (repo historique)

```
Electron 20  →  UI HTML/jQuery  →  cscript + COM PowerPoint  →  PNG
                                                              ↓
                                              FFI → PPTNDI.dll → NDI SDK
```

## Stack cible (scaffold / rebuild)

| Technologie | Version | Rôle |
|-------------|---------|------|
| Node.js | ≥ 22.12 | Runtime |
| Electron | ^43 | Shell desktop |
| Vite | ^7 | Bundler + HMR renderer |
| electron-vite | ^5 | Build main / preload / renderer |
| TypeScript | ^5.8 | Typage |
| electron-builder | ^26 | Packaging Windows |
| @electron-toolkit/utils | ^4 | Helpers main (`is.dev`, etc.) |
| @electron-toolkit/preload | ^3 | API preload standard |

```
Electron 43 + electron-vite
  → UI Vite (FR)
  → IPC preload isolé
  → cscript + COM PowerPoint → PNG
  → N-API / helper → NDI SDK
```

## Prérequis système

- Windows 7+ (cible principale) ou macOS (partiel)
- Microsoft PowerPoint installé (rendu fidèle)
- NDI Runtime / SDK pour le build natif
- Node.js + outils C++ (MSVC) pour compiler la DLL

## Convention

Toute nouvelle UI que vous construirez à partir du scaffold doit afficher ses textes **en français**.
