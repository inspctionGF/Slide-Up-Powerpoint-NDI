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
  if (newWidth > 0 && newHeight > 0) {
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
 * Export Classic — formes groupées sans fond (alpha PNG).
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
var slideW = ap.PageSetup.SlideWidth;
var slideH = ap.PageSetup.SlideHeight;

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

  var tb = null;
  try {
    tb = slide.Shapes.AddTextbox(1, 0, 0, slideW, slideH);
    tb.Fill.Visible = 0;
    tb.Line.Visible = 0;
    tb.TextFrame.TextRange.Text = "";
  } catch (eTb) {}

  try {
    var shpGroup = slide.Shapes.Range();
    if (newWidth > 0 && newHeight > 0) {
      shpGroup.Export(outPath, 2, newWidth, newHeight, 1);
    } else {
      shpGroup.Export(outPath, 2, slideW, slideH, 1);
    }
  } catch (eExp) {
    if (newWidth > 0 && newHeight > 0) {
      slide.Export(outPath, "PNG", newWidth, newHeight);
    } else {
      slide.Export(outPath, "PNG");
    }
  }

  if (tb !== null) {
    try { tb.Delete(); } catch (eDel) {}
  }
}

ap.Saved = wasSaved;
writeLines(tmpDir + "\\\\hidden.dat", hidden);
writeLines(tmpDir + "\\\\slideEffect.dat", effects);
writeLines(tmpDir + "\\\\advance.dat", advances);

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
