/** Scripts VBScript pour le mode SlideShow live */

export const SLIDESHOW_CHECK = `
On Error Resume Next
Do While True
  Err.Clear
  Dim objPPT, ap
  Set objPPT = CreateObject("PowerPoint.Application")
  If Err.Number <> 0 Then
    Wscript.Echo "Status: OFF"
  Else
    Err.Clear
    Set ap = objPPT.ActivePresentation
    If Err.Number <> 0 Then
      Wscript.Echo "Status: OFF"
    Else
      Err.Clear
      Dim pos
      pos = ap.SlideShowWindow.View.CurrentShowPosition
      If Err.Number <> 0 Then
        Wscript.Echo "Status: OFF"
      Else
        Dim st
        st = ap.SlideShowWindow.View.State
        If st = 3 Then
          Wscript.Echo "Status: BLACK " & pos
        ElseIf st = 4 Then
          Wscript.Echo "Status: WHITE " & pos
        ElseIf st = 5 Then
          Wscript.Echo "Status: DONE " & pos
        Else
          Wscript.Echo "Status: " & pos
        End If
      End If
    End If
  End If
  Wscript.Sleep 500
Loop
`.trim()

export const SLIDESHOW_DIRECT_CMD = `
On Error Resume Next
Do While True
  Dim cmd
  cmd = Wscript.StdIn.ReadLine()
  If Len(cmd) = 0 Then
  Else
    Dim objPPT, ap, view
    Set objPPT = CreateObject("PowerPoint.Application")
    Set ap = objPPT.ActivePresentation
    Set view = ap.SlideShowWindow.View
    If cmd = "prev" Then
      view.GotoSlide view.CurrentShowPosition - 1
    ElseIf cmd = "next" Then
      view.GotoSlide view.CurrentShowPosition + 1
    ElseIf cmd = "black" Then
      view.State = 3
    ElseIf cmd = "white" Then
      view.State = 4
    ElseIf cmd = "pause" Then
      If view.State = 2 Then
        view.State = 1
      Else
        view.State = 2
      End If
    End If
  End If
Loop
`.trim()

/**
 * Args: tmpDir, width, height
 * Lit stdin (ligne vide = export). Mode avec fond.
 */
export const SLIDESHOW_EXPORT_BG = `
Dim objPPT, ap, newWidth, newHeight
On Error Resume Next
newWidth = CLng(Wscript.Arguments.Item(1))
newHeight = CLng(Wscript.Arguments.Item(2))
Do While True
  Dim cmd
  cmd = Wscript.StdIn.ReadLine()
  Err.Clear
  Set objPPT = CreateObject("PowerPoint.Application")
  If Err.Number <> 0 Then
    Wscript.Echo "PPTNDI: NoPPT"
  Else
    Err.Clear
    Set ap = objPPT.ActivePresentation
    If Err.Number <> 0 Then
      Wscript.Echo "PPTNDI: Ready"
    Else
      Err.Clear
      Dim view, pos, st
      Set view = ap.SlideShowWindow.View
      If Err.Number <> 0 Then
        Wscript.Echo "PPTNDI: Ready"
      Else
        pos = view.CurrentShowPosition
        st = view.State
        If st = 3 Then
          Wscript.Echo "PPTNDI: Black"
        ElseIf st = 4 Then
          Wscript.Echo "PPTNDI: White"
        ElseIf st = 5 Then
          Wscript.Echo "PPTNDI: Done"
        Else
          Dim isSaved
          isSaved = ap.Saved
          If newWidth > 0 And newHeight > 0 Then
            ap.Slides(pos).Export Wscript.Arguments.Item(0) & "\\Slide.png", "PNG", newWidth, newHeight
          Else
            ' Résolution native PPT — meilleure qualité
            ap.Slides(pos).Export Wscript.Arguments.Item(0) & "\\Slide.png", "PNG"
          End If
          If isSaved Then ap.Saved = True
          Wscript.Echo "PPTNDI: Sent 0 0 " & pos
        End If
      End If
    End If
  End If
Loop
`.trim()

/**
 * Args: tmpDir, width, height — export transparent (formes seules, sans fond).
 * Comme ppt-ndi : Shapes.Range.Export Format:=2, ExportMode:=1.
 * Dimensions : toujours explicites (0,0 réduit la résolution).
 */
export const SLIDESHOW_EXPORT_NOBG = `
Dim objPPT, ap, newWidth, newHeight
On Error Resume Next
newWidth = CLng(Wscript.Arguments.Item(1))
newHeight = CLng(Wscript.Arguments.Item(2))
Do While True
  Dim cmd
  cmd = Wscript.StdIn.ReadLine()
  Err.Clear
  Set objPPT = CreateObject("PowerPoint.Application")
  If Err.Number <> 0 Then
    Wscript.Echo "PPTNDI: NoPPT"
  Else
    Err.Clear
    Set ap = objPPT.ActivePresentation
    If Err.Number <> 0 Then
      Wscript.Echo "PPTNDI: Ready"
    Else
      Err.Clear
      Dim view, pos, st
      Set view = ap.SlideShowWindow.View
      If Err.Number <> 0 Then
        Wscript.Echo "PPTNDI: Ready"
      Else
        pos = view.CurrentShowPosition
        st = view.State
        If st = 3 Then
          Wscript.Echo "PPTNDI: Black"
        ElseIf st = 4 Then
          Wscript.Echo "PPTNDI: White"
        ElseIf st = 5 Then
          Wscript.Echo "PPTNDI: Done"
        Else
          Dim isSaved, slideW, slideH, tb, shpGroup, origCnt, expW, expH, reqW, reqH, scaleW, scaleH
          isSaved = ap.Saved
          slideW = ap.PageSetup.SlideWidth
          slideH = ap.PageSetup.SlideHeight
          If newWidth > 0 And newHeight > 0 Then
            expW = newWidth
            expH = newHeight
          Else
            expW = Round(slideW * 96 / 72, 0)
            expH = Round(slideH * 96 / 72, 0)
          End If
          ' Suréchantillonnage ×2 (Shape.Export sort souvent trop petit)
          reqW = expW * 2
          reqH = expH * 2
          origCnt = ap.Slides(pos).Shapes.Range().Count
          Set tb = ap.Slides(pos).Shapes.AddTextbox(1, 0, 0, slideW, slideH)
          On Error Resume Next
          tb.Fill.Visible = 0
          tb.Line.Visible = 0
          On Error Resume Next
          Set shpGroup = ap.Slides(pos).Shapes.Range()
          If shpGroup.Count = origCnt Then
            tb.Delete
            If isSaved Then ap.Saved = True
          Else
            ' Shape.Export : scale = SlideSize / ShapeSize * pixels cibles
            scaleW = Round(slideW / shpGroup.Width * reqW, 0)
            scaleH = Round(slideH / shpGroup.Height * reqH, 0)
            If scaleW < 1 Then scaleW = reqW
            If scaleH < 1 Then scaleH = reqH
            shpGroup.Export Wscript.Arguments.Item(0) & "\\Slide.png", 2, scaleW, scaleH, 1
            tb.Delete
            If isSaved Then ap.Saved = True
            Wscript.Echo "PPTNDI: Sent 0 0 " & pos
          End If
        End If
      End If
    End If
  End If
Loop
`.trim()
