# Phase 4E-11A DrawingML Textbox Object Classification Fix

## Scope

This production fix addresses the Phase 4E-11 object classification gap:
DrawingML / WordprocessingShape textboxes were parsed correctly as visible
textbox text, but their carrier `w:drawing` was also counted as a thesis figure
object.

## Root Cause

`parseFigures` treated every `w:drawing` under `w:body` as a figure occurrence.
For DrawingML textboxes, that produced an extra figure fact on the textbox
carrier paragraph. The downstream object validators then failed:

- `comu.applied-sciences.food-technology.bachelor.figure-object-alignment`
- `comu.applied-sciences.food-technology.bachelor.figure-caption-placement`

## Fix

Figure detection now classifies drawings before creating figure facts.

Textbox drawings are excluded when the drawing subtree contains either:

- `wps:txbx`
- `w:txbxContent`

Visible text parsing is unchanged. Textbox paragraphs still remain in the
normalized document with `contentScope: "textbox"`.

## Runtime Result

For all three DrawingML textbox fixtures:

- textbox visible text is preserved
- textbox text is normalized exactly once
- textbox paragraph has `contentScope: "textbox"`
- textbox carrier does not create a figure fact
- normal golden figure remains detected
- font-size rule passes
- section-order rule passes
- figure alignment rule passes
- figure caption placement rule passes
- report is 46/46

## Trust Boundary

This fix is regression-tested for synthetic DrawingML WordprocessingShape
textboxes using:

`w:drawing -> wp:inline -> a:graphic -> a:graphicData -> wps:wsp -> wps:txbx -> w:txbxContent`

It does not claim support for all Office shapes, charts, SmartArt, diagrams,
grouped drawings, alternate-content variants, or every Word-native textbox
serialization.
