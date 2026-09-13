# Phase 4E-11 DrawingML Textbox Audit

## Scope

This is an audit-first phase. No production source code was changed for
Phase 4E-11.

## Representation

The synthetic fixtures use DrawingML / WordprocessingShape textbox OOXML:

- `w:drawing`
- `wp:inline`
- `a:graphic`
- `a:graphicData`
- `wps:wsp`
- `wps:txbx`
- `w:txbxContent`
- nested `w:p/w:r/w:t`

The fixtures are `synthetic-ooxml`; they are not claimed to be word-native.

## Runtime Findings

The Phase 4E-10A textbox ownership model is representation-independent for
`w:txbxContent`:

- DrawingML textbox visible text is preserved.
- Textbox text is normalized exactly once under the inner textbox paragraph.
- The outer carrier paragraph does not receive nested textbox text or runs.
- The inner paragraph has `contentScope: "textbox"`.
- 11 pt textbox text does not fail the academic body font-size rule.
- Textbox `KAYNAKLAR` does not create a section-order failure.

## OOXML Evidence

Each DrawingML fixture has:

- `w:txbxContent` count: 1
- `wps:wsp` count: 1
- `wps:txbx` count: 1
- `v:textbox` count: 0

The document also keeps the original golden figure, so total `w:drawing` and
`a:graphic` counts are 2.

## Object Detection Finding

The DrawingML textbox carrier is currently counted as a figure occurrence by
the generic `w:drawing` object parser. This produces two false positives:

- `comu.applied-sciences.food-technology.bachelor.figure-object-alignment`
- `comu.applied-sciences.food-technology.bachelor.figure-caption-placement`

This is not a textbox ownership failure. It is a DrawingML object classification
gap: a WordprocessingShape textbox should not automatically be treated as a
thesis figure object requiring figure alignment/caption semantics.

## Classification

- Textbox ownership: no bug / representation coverage confirmed for synthetic
  DrawingML WordprocessingShape `w:txbxContent`.
- Academic body and structural scope: no bug for the tested fixtures.
- Object detection: false positive / representation classification gap.

## Trust Boundary

Verified:

- VML `v:textbox` with `w:txbxContent`
- Synthetic DrawingML WordprocessingShape textbox with `wps:txbx` and
  `w:txbxContent`

Not claimed:

- all Word textbox variants
- word-native DrawingML textbox output
- DrawingML shape geometry/style support

## Phase 4E-11A Notes

If a production fix is pursued, the minimum safe direction is to make figure
normalization distinguish thesis figure drawings from WordprocessingShape
textbox drawings. The parser should not discard textbox visible text, and it
should not add a broad DrawingML shape domain unless a rule needs that metadata.
