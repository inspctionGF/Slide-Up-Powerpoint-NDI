# 03 — Automation PowerPoint (COM)

## 1. Principe

Windows expose PowerPoint via **COM Automation**. Les scripts utilisent :

```vb
Set objPPT = CreateObject("PowerPoint.Application")
Set ap = objPPT.ActivePresentation   ' SlideShow
' ou
Set ap = objPPT.Presentations.Open(path, WithWindow:=False, ...)
```

Sur Classic, les scripts sont en **JScript** (`cscript //E:jscript`) :

```js
var objPPT = new ActiveXObject("PowerPoint.Application");
```

Les templates vivent dans `frontend/js/cscript.js` et sont **écrits sur disque** avant `spawn('cscript.exe', ...)`.

## 2. Catalogue des scripts

### SlideShow

| Clé | Langage | Entrées | Comportement |
|-----|---------|---------|--------------|
| `vbsBg` | VBScript | `tmpDir, width, height` | Boucle : attend stdin, exporte slide courante **avec fond** via `Slide.Export(..., "PNG")` |
| `vbsNoBg` | VBScript | idem | Exporte **sans fond** via `Shapes.Range().Export(..., Format:=2, ExportMode:=1)` |
| `vbsCheckSlide` | VBScript | — | Echo `Status: {index}` toutes les 500 ms |
| `vbsDirectCmd` | VBScript | stdin cmds | `prev` / `next` / `black` / `white` / `pause` |

### Classic

| Clé | Langage | Entrées | Comportement |
|-----|---------|---------|--------------|
| `vbsBg` | JScript | `pptx, tmpDir, w, h` | Ouvre le fichier, exporte chaque slide en PNG avec fond |
| `vbsNoBg` | JScript | idem | Export shapes groupés (transparence) + cleanup shapes hors cadre |
| `vbsQuickEdit` | JScript | `pptx, slideNo` | Active la fenêtre PPT et sélectionne la slide |

## 3. Export “exact” avec fond

```vb
With ap.Slides(objSlideShow.CurrentShowPosition)
  .Export Wscript.Arguments.Item(0) & "/Slide.png", "PNG", newWidth, newHeight
End With
```

- Méthode native PowerPoint.
- Inclut le **fond de diapositive**.
- Résolution optionnelle (sinon taille slide).

## 4. Export transparent (sans fond)

Astuce utilisée dans le projet :

1. Ajouter une TextBox pleine taille (pour forcer un Range non vide).
2. `Set shpGroup = Slides(n).Shapes.Range()`.
3. Exporter le groupe :

```vb
shpGroup.Export path & "/Slide.png", 2, width, height, 1
' 2 = ppShapeFormatPNG
' 1 = ppRelativeToOriginalSize (conserve alpha)
```

4. Supprimer la TextBox temporaire.
5. Restaurer `ap.Saved` si la présentation était déjà sauvée (évite le dirty flag).

En Classic `vbsNoBg`, nettoyage supplémentaire des shapes hors zone (`deleteInvisibleTop/Left`) pour éviter des PNG vides / artefacts.

## 5. États du diaporama

`SlideShowWindow.View.State` :

| Valeur | Signification (approx.) | Echo PPT-NDI |
|--------|-------------------------|--------------|
| 1 | Running | Export (`Proc`) |
| 2 | Paused | Export aussi |
| 3 | Black screen | `PPTNDI: Black` |
| 4 | White screen | `PPTNDI: White` |
| 5 | Done | `PPTNDI: Done` |

## 6. Contrôle distant

```vb
objSlideShow.GotoSlide CurrentShowPosition ± 1
ap.SlideShowWindow.View.State = 3  ' black
```

Les hotkeys Electron (`Ctrl+Shift+…`) envoient des commandes à l’UI, qui écrit sur `stdin` de `vbsDirectCmd` ou change la slide Classic localement.

## 7. Pièges connus

1. **PowerPoint doit être installé** — sinon Classic échoue ; le renderer interne est un plan B faible.
2. **Une seule instance COM** — plusieurs scripts partagent la même app PowerPoint.
3. **Fichier verrouillé** — l’export peut renvoyer `EBUSY` ; le JS retry (`sendNDI`).
4. **Dirty flag** — toujours restaurer `Saved` après modifications temporaires.
5. **macOS** — pas de `cscript` ; le support est différent / limité dans ce repo.
6. **Sécurité** — exécuter des scripts générés nécessite un dossier temp fiable et un contenu contrôlé.

## 8. Alternative moderne recommandée

Pour un rebuild :

| Option | Avantage | Inconvénient |
|--------|----------|--------------|
| **COM via `winax` / PowerShell** | Plus simple à maintenir en Node | Toujours Windows + Office |
| **Office JS / add-in** | Intégré à PPT | Autre modèle de déploiement |
| **LibreOffice headless** | Gratuit | Rendu différent |
| **Parser PPTX pur** | Pas d’Office | Fidélité insuffisante pour broadcast pro |

**Recommandation produit** : garder COM PowerPoint pour le rendu broadcast, isoler le bridge derrière une interface :

```ts
interface PowerPointBridge {
  exportCurrentSlide(opts: ExportOptions): Promise<PngPath>;
  exportAllSlides(file: string, opts: ExportOptions): Promise<SlideBundle>;
  getShowPosition(): Promise<number | null>;
  goto(delta: number): Promise<void>;
  dispose(): Promise<void>;
}
```
