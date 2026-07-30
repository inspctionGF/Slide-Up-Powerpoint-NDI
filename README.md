# Slide-up Powerpoint NDI

Application desktop Electron pour diffuser des diapositives PowerPoint via NDI.

## Prérequis utilisateur (émetteur)

- Windows x64
- Microsoft PowerPoint

**NDI Tools n’est pas requis** pour envoyer : la runtime (`Processing.NDI.Lib.x64.dll`) est **bundlée** dans l’installateur via `npm run dist`.

Les logiciels qui **reçoivent** le flux (OBS, vMix, NDI Studio Monitor) doivent eux avoir NDI.

## Prérequis développeur

- Node.js ≥ 22.12
- Visual Studio Build Tools (C++)
- NDI Runtime installé sur la machine de build (pour copier la DLL dans le bundle)

## Installation / build

```bash
npm install
npm run build:ndi    # compile helper + copie Processing.NDI.Lib.x64.dll
npm run ensure:ndi   # vérifie que exe + DLL sont présents
npm run dev
```

Package Windows (helper + DLL inclus) :

```bash
npm run dist
```

## Scripts

| Commande | Rôle |
|----------|------|
| `npm run dev` | App Electron en développement |
| `npm run build` | Compile main / preload / renderer |
| `npm run prepare:icons` | Génère `build/icon.ico` + PNG depuis `public/logo.svg` |
| `npm run build:ndi` | Compile helper + bundle la DLL NDI dans `resources/ndi/` |
| `npm run ensure:ndi` | Échoue si le bundle NDI est incomplet |
| `npm run dist` | Icônes + installateur NSIS avec NDI inclus |

## Modes

- **Classic** — ouvrir un PPTX, galerie, envoi NDI manuel
- **SlideShow** — suivre le diaporama PowerPoint en live

## Pointeurs sans fil

Les télécommandes de présentation (Logitech, Kensington, etc.) sont supportées nativement :

| Touche HID | Action |
|------------|--------|
| Page Down | Diapositive suivante |
| Page Up | Diapositive précédente |
| `.` (Period) | Fond noir |
| Flèches ← / → | Navigation (raccourcis par défaut) |

Les raccourcis restent configurables dans les réglages (plusieurs touches séparées par des virgules).

## Architecture

```
PowerPoint (COM/cscript) → PNG → slideup-ndi.exe (+ DLL bundlée) → NDI
```

Docs techniques : [`docs/`](docs/).

## Licence

Le **code source** de Slide-up est sous licence [MIT](LICENSE).

Les composants tiers (notamment la runtime **NDI®** de Vizrt) restent sous
leurs licences respectives — voir [NOTICE](NOTICE).

> Redistribution de `Processing.NDI.Lib.x64.dll` : respecter la licence NDI / Vizrt en vigueur.
> NDI® est une marque déposée de Vizrt NDI AB.
