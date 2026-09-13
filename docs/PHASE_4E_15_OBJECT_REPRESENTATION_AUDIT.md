# Phase 4E-15 - Object Representation Classification Audit

## Baseline

Checkpoint expectation: `34dd65a` with tracked move visibility fixed.

Known runtime baseline before this audit:

- Experimental rule count: 46
- Golden: 46/46
- Corpus: 31 regression, 3 exploratory

This phase is audit-only. No production parser, validator, or rule semantics were
changed.

## Current Figure Detection Architecture

`documentCaptionsNormalizer` builds visual structure from `word/document.xml`
body content. Figure detection currently collects semantic `w:drawing`
descendants under `w:body` and excludes only textbox drawings.

Current figure signal:

- included: `w:drawing`
- excluded: drawings containing `wps:txbx` or `w:txbxContent`
- not required: `pic:pic`
- not required: `a:graphicData/@uri`
- not required: specific picture, chart, or diagram payload classification
- not included: `w:object` / `o:OLEObject` unless also represented through
  `w:drawing`

Caption association is document-order based. Inline drawings can associate with
nearby `Şekil <number>.` captions. Anchors remain ambiguous.

## Active Figure-Related Rules

| Rule ID | Validator | Normalized fact |
| --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.figure-object-alignment` | `ObjectAlignmentValidator` | `document.figures.items` |
| `comu.applied-sciences.food-technology.bachelor.figure-caption-placement` | `ObjectCaptionPlacementValidator` | inline `document.figures.items` + caption position |
| `comu.applied-sciences.food-technology.bachelor.figure-caption-format` | `ObjectCaptionFormatValidator` | associated figure captions |
| `comu.applied-sciences.food-technology.bachelor.figure-in-text-reference` | `ObjectInTextReferenceValidator` | associated figure captions + `document.objectReferences.items` |
| `comu.applied-sciences.food-technology.bachelor.list-of-figures` | `ConditionalRequiredSectionValidator` | `document.figures.hasFigures` |

The rule metadata uses `Şekil` and `Tablo`. It does not define separate chart,
diagram, SmartArt, grouped drawing, image, or OLE object categories.

## Object Taxonomy

| Type | Representation | Current outcome | Semantic confidence |
| --- | --- | --- | --- |
| Normal picture | `w:drawing` / `wp:inline` / `pic:pic` | figure | High |
| Chart | `w:drawing` / `a:graphicData` / `c:chart` | figure | Ambiguous |
| SmartArt / diagram | `w:drawing` / `a:graphicData` / `dgm:relIds` | figure | Ambiguous |
| Grouped DrawingML | `w:drawing` / `a:graphicData` / `wpg` | figure | Ambiguous |
| WPS textbox | `w:drawing` + `wps:txbx` or `w:txbxContent` | not figure | High |
| VML image | `w:pict` / `v:shape` / `v:imagedata` | not figure | Medium |
| OLE / embedded object | `w:object` / `v:shape` / `o:OLEObject` | not figure | Ambiguous |

## Risk Ranking

High: Chart. Common in Word documents and classified as figure through generic
`w:drawing`; it affects figure placement/alignment/reference/list rules.

High: SmartArt / diagram. Also classified through generic `w:drawing`; product
semantics are ambiguous because diagrams may be academic figures, but the parser
does not know the subtype.

Medium: Grouped DrawingML. A single logical grouped visual is classified as one
figure per outer `w:drawing`; duplicate risk depends on real package structure.

Medium: OLE / embedded object. Current detector does not see `w:object`, so
false-negative risk depends on whether product semantics should treat embedded
objects as figures.

Low: Normal picture. Existing baseline is correct.

Low: WPS textbox. Existing textbox exclusion remains correct.

## Selected Diagnostic Target

Selected target: generic `w:drawing` object classification.

Reason: it is the central implementation choice shared by chart, SmartArt,
grouped DrawingML, and normal pictures. It is also the shortest raw OOXML ->
normalized fact -> validator behavior chain.

## Fixtures

All Phase 4E-15 fixtures are exploratory synthetic OOXML:

- `chart-object-synthetic.docx`
- `smartart-object-synthetic.docx`
- `grouped-drawing-object-synthetic.docx`
- `ole-object-synthetic.docx`
- `smartart-caption-collision-synthetic.docx`

## Raw OOXML Evidence

Normal picture baseline:

- `w:drawing`: 1
- `pic:pic`: 1
- `c:chart`: 0
- `dgm:relIds`: 0
- `w:object`: 0
- `o:OLEObject`: 0

Chart fixture:

- `w:drawing`: 2
- `pic:pic`: 1
- `c:chart`: 1

SmartArt fixture:

- `w:drawing`: 2
- `pic:pic`: 1
- `dgm:relIds`: 1

Grouped drawing fixture:

- `w:drawing`: 2
- `pic:pic`: 1
- `wpg:*`: present

OLE fixture:

- `w:drawing`: 1
- `pic:pic`: 1
- `w:object`: 1
- `o:OLEObject`: 1

## Normalized Facts

Normal picture baseline:

- figure count: 1
- associated caption: `Şekil 1`
- figure rules: 46/46 overall pass

Chart:

- figure count: 2
- new chart drawing became `figure-2`
- no caption associated with `figure-2`
- runtime: 45/46, `figure-caption-placement` failed

SmartArt:

- figure count: 2
- new diagram drawing became `figure-2`
- no caption associated with `figure-2`
- runtime: 45/46, `figure-caption-placement` failed

Grouped DrawingML:

- figure count: 2
- new grouped drawing became `figure-2`
- no caption associated with `figure-2`
- runtime: 45/46, `figure-caption-placement` failed

OLE:

- figure count: 1
- the OLE object did not create an additional figure occurrence
- runtime: 46/46

SmartArt caption collision:

- figure count: 2
- SmartArt associated with `Şekil 99`
- `figure-in-text-reference` failed because there was no body reference to
  `Şekil 99`
- runtime: 45/46

## Classification

Confirmed:

- OBJECT CLASSIFICATION GAP
- ARCHITECTURAL LIMITATION
- AMBIGUOUS PRODUCT SEMANTICS

Not proven:

- FALSE POSITIVE
- FALSE NEGATIVE
- DUPLICATE OBJECT RECONSTRUCTION

Generic `w:drawing` classification and RuleResult impact are proven. A wrong
RuleResult is not proven because the active rule semantics do not define whether
charts, SmartArt, or grouped drawings should be excluded from `Şekil`.

## MCE Interaction

The current detector uses semantic traversal through `markupCompatibilityResolver`,
so `mc:AlternateContent` branch selection is shared with text and figure parsing.
No new duplicate Choice/Fallback object reconstruction was proven in this phase.

## Header/Footer Boundary

`documentCaptionsNormalizer` reads `w:body` from `document.xml`; header/footer
parts are handled separately for page numbering. Body figure detection therefore
does not merge header/footer drawings into academic figure facts in the current
architecture.

## Phase 4E-15A Recommendation

If product semantics decide that only specific subtypes should count as academic
figures, implement a central object classifier before changing validators.

Conceptual shape:

- `classifyDrawingObject(...)`
- returns `picture`, `chart`, `diagram`, `group`, `textbox`, `other`
- map subtypes to `DocumentFigureOccurrence` only through explicit rule-backed
  policy

Avoid validator hacks, rule ID conditionals, fixture markers, and scattered
chart-specific exclusions.

## Trust Boundary

This audit uses deterministic synthetic OOXML, not Microsoft Word generated
fixtures. It does not claim rendered layout fidelity, full DrawingML parsing,
full Office object taxonomy, or Word-native chart/SmartArt/OLE behavior.
