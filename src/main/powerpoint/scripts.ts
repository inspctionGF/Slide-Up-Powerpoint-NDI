/**
 * Export Classic — toutes les diapos avec fond (Slide.Export PNG).
 * Args: pptx, tmpDir, width, height (0 = taille native)
 */
export const EXPORT_ALL_BG = `
var pptx = WScript.Arguments.Item(0);
var tmpDir = WScript.Arguments.Item(1);
var newWidth = parseInt(WScript.Arguments.Item(2), 10);
var newHeight = parseInt(WScript.Arguments.Item(3), 10);

var fso = new ActiveXObject("Scripting.FileSystemObject");
if (!fso.FolderExists(tmpDir)) {
  fso.CreateFolder(tmpDir);
}

var objPPT;
try {
  objPPT = new ActiveXObject("PowerPoint.Application");
} catch (e) {
  WScript.Echo("PPTNDI: NoPPT");
  WScript.Quit(1);
}

objPPT.DisplayAlerts = 0;
var ap;
try {
  ap = objPPT.Presentations.Open(pptx, true, false, false);
} catch (eOpen) {
  WScript.Echo("PPTNDI: OpenFail");
  try { objPPT.Quit(); } catch (eQ) {}
  WScript.Quit(2);
}

var wasSaved = ap.Saved;
var count = ap.Slides.Count;
var hidden = [];
var effects = [];
var advances = [];
var useCustomSize = newWidth > 0 && newHeight > 0;

for (var i = 1; i <= count; i++) {
  var slide = ap.Slides.Item(i);
  if (slide.SlideShowTransition.Hidden) {
    hidden.push(i);
  }
  try {
    effects.push(i + "," + slide.SlideShowTransition.EntryEffect + "," + slide.SlideShowTransition.Duration);
  } catch (eEff) {
    effects.push(i + ",0,0");
  }
  try {
    if (slide.SlideShowTransition.AdvanceOnTime) {
      advances.push(i + "," + slide.SlideShowTransition.AdvanceTime);
    }
  } catch (eAdv) {}

  var outPath = tmpDir + "\\\\Slide" + i + ".png";
  WScript.Echo("PPTNDI: Progress " + i + " " + count);
  // 0,0 = résolution native PPT (meilleure qualité que forcer 96 dpi)
  if (useCustomSize) {
    slide.Export(outPath, "PNG", newWidth, newHeight);
  } else {
    slide.Export(outPath, "PNG");
  }
}

writeLines(tmpDir + "\\\\hidden.dat", hidden);
writeLines(tmpDir + "\\\\slideEffect.dat", effects);
writeLines(tmpDir + "\\\\advance.dat", advances);

ap.Saved = wasSaved;
ap.Close();
try { objPPT.Quit(); } catch (eQuit) {}
WScript.Echo("PPTNDI: Loaded " + count);

function writeLines(path, lines) {
  var ts = fso.CreateTextFile(path, true);
  for (var n = 0; n < lines.length; n++) {
    ts.WriteLine(lines[n]);
  }
  ts.Close();
}
`.trim()

/**
 * Export Classic — formes uniquement, sans fond PowerPoint (PNG alpha).
 * Comme ppt-ndi : Shapes.Range().Export(..., Format:=2, ExportMode:=1).
 * Args: pptx, tmpDir, width, height
 */
export const EXPORT_ALL_NOBG = `
var pptx = WScript.Arguments.Item(0);
var tmpDir = WScript.Arguments.Item(1);
var newWidth = parseInt(WScript.Arguments.Item(2), 10);
var newHeight = parseInt(WScript.Arguments.Item(3), 10);

var fso = new ActiveXObject("Scripting.FileSystemObject");
if (!fso.FolderExists(tmpDir)) {
  fso.CreateFolder(tmpDir);
}

var objPPT;
try {
  objPPT = new ActiveXObject("PowerPoint.Application");
} catch (e) {
  WScript.Echo("PPTNDI: NoPPT");
  WScript.Quit(1);
}

objPPT.DisplayAlerts = 0;
var ap;
try {
  // Lecture/écriture : nécessaire pour AddTextBox / Delete hors cadre
  ap = objPPT.Presentations.Open(pptx, false, false, false);
} catch (eOpen) {
  WScript.Echo("PPTNDI: OpenFail");
  try { objPPT.Quit(); } catch (eQ) {}
  WScript.Quit(2);
}

var wasSaved = ap.Saved;
var count = ap.Slides.Count;
var hidden = [];
var effects = [];
var advances = [];
var slideW = ap.PageSetup.SlideWidth;
var slideH = ap.PageSetup.SlideHeight;
// Pixels cibles. Shape.Export n’accepte pas des pixels bruts :
// scale = SlideSize / ShapeSize * pixelsCibles
// Suréchantillonnage ×2 : Shape.Export sort souvent plus petit que demandé ;
// on exporte plus grand, puis Electron réduit proprement (jamais d’upscale).
var expW = newWidth > 0 ? newWidth : Math.round(slideW * 96 / 72);
var expH = newHeight > 0 ? newHeight : Math.round(slideH * 96 / 72);
var reqW = expW * 2;
var reqH = expH * 2;

for (var i = 1; i <= count; i++) {
  var slide = ap.Slides.Item(i);
  if (slide.SlideShowTransition.Hidden) {
    hidden.push(i);
  }
  try {
    effects.push(i + "," + slide.SlideShowTransition.EntryEffect + "," + slide.SlideShowTransition.Duration);
  } catch (eEff) {
    effects.push(i + ",0,0");
  }
  try {
    if (slide.SlideShowTransition.AdvanceOnTime) {
      advances.push(i + "," + slide.SlideShowTransition.AdvanceTime);
    }
  } catch (eAdv) {}

  WScript.Echo("PPTNDI: Progress " + i + " " + count);
  var outPath = tmpDir + "\\\\Slide" + i + ".png";

  deleteInvisibleTop(slide, slideH);
  deleteInvisibleLeft(slide, slideW);
  deleteInvisibleTop(slide, slideH);

  var tb = slide.Shapes.AddTextBox(1, 0, 0, slideW, slideH);
  try { tb.Fill.Visible = 0; tb.Line.Visible = 0; } catch (eVis) {}
  var shpGroup = slide.Shapes.Range();
  var scaleW = Math.round(slideW / shpGroup.Width * reqW);
  var scaleH = Math.round(slideH / shpGroup.Height * reqH);
  if (scaleW < 1) scaleW = reqW;
  if (scaleH < 1) scaleH = reqH;
  shpGroup.Export(outPath, 2, scaleW, scaleH, 1);
  tb.Delete();

  if (fso.FileExists(outPath)) {
    var objFile = fso.GetFile(outPath);
    if (objFile.Size === 0) {
      for (var intShape = slide.Shapes.Count; intShape >= 1; intShape--) {
        if (slide.Shapes(intShape).Type === 7) {
          slide.Shapes(intShape).Delete();
        }
      }
      var tb2 = slide.Shapes.AddTextBox(1, 0, 0, slideW, slideH);
      try { tb2.Fill.Visible = 0; tb2.Line.Visible = 0; } catch (eVis2) {}
      var shpGroup2 = slide.Shapes.Range();
      var scaleW2 = Math.round(slideW / shpGroup2.Width * reqW);
      var scaleH2 = Math.round(slideH / shpGroup2.Height * reqH);
      if (scaleW2 < 1) scaleW2 = reqW;
      if (scaleH2 < 1) scaleH2 = reqH;
      shpGroup2.Export(outPath, 2, scaleW2, scaleH2, 1);
      tb2.Delete();
    }
  }
}

ap.Saved = wasSaved;
writeLines(tmpDir + "\\\\hidden.dat", hidden);
writeLines(tmpDir + "\\\\slideEffect.dat", effects);
writeLines(tmpDir + "\\\\advance.dat", advances);

ap.Close();
try { objPPT.Quit(); } catch (eQuit) {}
WScript.Echo("PPTNDI: Loaded " + count);

function deleteInvisibleTop(sl, sngHeight) {
  for (var intShape = sl.Shapes.Count; intShape >= 1; intShape--) {
    var topSize = sl.Shapes(intShape).Top;
    var heightSize = sl.Shapes(intShape).Height;
    if (sngHeight - topSize <= 0) {
      sl.Shapes(intShape).Delete();
    } else if (topSize < 0) {
      if (sl.Shapes(intShape).Type === 17 || topSize + heightSize <= 0) {
        sl.Shapes(intShape).Delete();
      } else if (sl.Shapes(intShape).Type === 1) {
        sl.Shapes(intShape).Top = 0;
        sl.Shapes(intShape).Height = topSize + heightSize;
      } else {
        sl.Shapes(intShape).Delete();
      }
    }
  }
}

function deleteInvisibleLeft(sl, sngWidth) {
  for (var intShape = sl.Shapes.Count; intShape >= 1; intShape--) {
    var leftSize = sl.Shapes(intShape).Left;
    var widthSize = sl.Shapes(intShape).Width;
    if (sngWidth - leftSize <= 0) {
      sl.Shapes(intShape).Delete();
    } else if (leftSize < 0) {
      if (sl.Shapes(intShape).Type === 17 || widthSize + leftSize <= 0) {
        sl.Shapes(intShape).Delete();
      } else if (sl.Shapes(intShape).Type === 1) {
        sl.Shapes(intShape).Left = 0;
        sl.Shapes(intShape).Width = leftSize + widthSize;
      } else {
        sl.Shapes(intShape).Delete();
      }
    }
  }
}

function writeLines(path, lines) {
  var ts = fso.CreateTextFile(path, true);
  for (var n = 0; n < lines.length; n++) {
    ts.WriteLine(lines[n]);
  }
  ts.Close();
}
`.trim()
