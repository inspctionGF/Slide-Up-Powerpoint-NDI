# Roadmap Slide-up

## CURRENT — fait (MVP)

- Socle Electron 43 + preload isolé + UI FR
- Mode **Classic** : ouvrir PPTX, galerie, alpha, prev/next, épingler
- Envoi **NDI** via helper `slideup-ndi.exe` (DLL bundlée dans `dist`)
- Retry EBUSY / fichier verrouillé
- Statut NDI live + nom de source éditable
- Mode **SlideShow** : suivi live du diaporama PowerPoint → NDI
- Config locale `%APPDATA%/slide-up/config.json` + panneau réglages
- Cleanup temp + destroy NDI à la fermeture
- Messages d’erreur FR (Office manquant, helper NDI absent, etc.)

### À valider manuellement (terrain)

- [ ] Classic → slides visibles dans NDI Studio Monitor
- [ ] Lower third transparent (alpha correct)
- [ ] SlideShow suit le diaporama PowerPoint
- [ ] Message clair si PowerPoint absent
- [ ] Quitter sans process orphelin (`cscript` / `slideup-ndi`)

---

## NEXT — à implémenter

### Produit / UX

- [x] Indicateurs **Actuel** / **Suivant** sur les miniatures (Classic)
- [ ] Tray système (masquer, réglages, quitter)
- [x] Hotkeys globaux configurables (`Ctrl+Shift+…`)
- [x] Pointeurs / télécommandes sans fil (PageUp/PageDown + capture HID)
- [ ] Moniteur local plein écran
- [ ] Transitions soft (crossfade d’images)
- [ ] CLI : `--slideshow`, `--classic`, `--load-file=`

### Packaging / distrib

- [ ] Installateur NSIS testé de bout en bout
- [ ] Code signing (si distribution large)
- [ ] Vérifier licence redistribution NDI Runtime

### Hors scope (volontaire)

- Renderer interne sans PowerPoint (fidélité insuffisante pour le broadcast)
