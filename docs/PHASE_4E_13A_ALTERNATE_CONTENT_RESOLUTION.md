# Phase 4E-13A AlternateContent Resolution

## Proven Bug

Phase 4E-13 proved that `mc:AlternateContent` branches were not resolved before
semantic parsing. `mc:Choice` and `mc:Fallback` WordprocessingML descendants could
both enter normalized paragraphs, sections, and figure facts.

Observed pre-fix effects:

- duplicate text/run reconstruction
- duplicate section facts
- duplicate figure facts
- false positive section-order result
- false positive figure caption placement result

## Selected Architecture

The fix adds a central semantic traversal helper:

`src/features/analysis/parsers/markupCompatibilityResolver.ts`

Instead of mutating or cloning the parsed DOM, parsers now ask for semantic
children or semantic descendants. When traversal reaches `mc:AlternateContent`,
the helper exposes children from only one selected branch.

This keeps raw package XML intact while preventing inactive branches from
reaching downstream parser and validator semantics.

## Supported Namespace Policy

`mc:Choice/@Requires` values are prefixes. The resolver maps each prefix through
the namespace declarations visible from the Choice element, then checks the
resolved namespace URI against an explicit supported set.

The supported set is intentionally small:

- WordprocessingML main: body text, paragraphs, runs, fields, tables
- Wordprocessing DrawingML: inline/anchor figure carriers
- DrawingML main and picture: existing figure payload traversal
- WordprocessingShape: DrawingML/WPS textbox ownership support
- VML: existing VML textbox support

This is a ThesisGuard semantic support set, not a declaration of full Office
feature support.

## Choice Selection Algorithm

For each `mc:AlternateContent` block:

1. inspect `mc:Choice` children in document order
2. parse the whitespace-separated `Requires` prefixes
3. resolve every prefix to a namespace URI from Choice context
4. select the first Choice where every required namespace URI is supported
5. if no Choice is supported, select `mc:Fallback`
6. if no supported Choice and no Fallback exist, expose no semantic children

`Requires` is all-or-nothing. A Choice with one unsupported or unresolved prefix
is unsupported.

## Nested And Malformed Behavior

Nested AlternateContent is resolved recursively by the traversal helper. The
selected branch may contain another AlternateContent block, and that inner block
is resolved using the same policy.

Malformed or unresolved `Requires` prefixes are not treated as supported. The
resolver falls back if a Fallback branch exists.

## Raw OOXML Vs Semantic DOM

The fix does not delete anything from DOCX packages. Raw OOXML may still contain
both Choice and Fallback branches, duplicate `w:t`, or duplicate `w:drawing`
representations.

The semantic model sees only the selected branch.

## Before / After Evidence

`alternate-content-text-synthetic.docx`

Before:

- `TG_ALT_CHOICE` visible
- `TG_ALT_FALLBACK` visible
- `TG_ALT_TEXT_MARKER` run occurrence: 2

After:

- `TG_ALT_CHOICE` visible
- `TG_ALT_FALLBACK` absent
- `TG_ALT_TEXT_MARKER` run occurrence: 1
- report: 46 total, 46 passed, 0 failed, 0 N/A, score 100

`alternate-content-semantic-collision-synthetic.docx`

Before:

- duplicate `KAYNAKLAR` section facts
- section-order false positive

After:

- `KAYNAKLAR` section fact count: 1
- report: 46 total, 46 passed, 0 failed, 0 N/A, score 100

`alternate-content-figure-synthetic.docx`

Before:

- raw `w:drawing` count: 2
- semantic figure facts: 2
- caption association ambiguous
- figure caption placement false positive

After:

- raw `w:drawing` count: 2
- semantic figure facts: 1
- caption association restored
- report: 46 total, 46 passed, 0 failed, 0 N/A, score 100

## Regression Impact

The three Phase 4E-13 fixtures were promoted from exploratory to regression:

- `alternate-content-text-synthetic.docx`
- `alternate-content-semantic-collision-synthetic.docx`
- `alternate-content-figure-synthetic.docx`

The corpus now contains 29 regression fixtures and 3 exploratory fixtures.

Existing regressions for track changes, VML textboxes, DrawingML/WPS textboxes,
TOC ownership, split runs, complex fields, automatic numbering, multi-section
margins, style inheritance, docDefaults/theme fonts, normal figures, and normal
tables remain covered by the corpus.

## Trust Boundary

This is not full MCE compliance. It does not implement complete Office feature
negotiation, a Word rendering engine, rendered-layout semantics, or proof for
every Word-native serialization.

The fix covers ThesisGuard's deterministic semantic parsing subset for
`mc:AlternateContent`, `mc:Choice`, `mc:Fallback`, and `mc:Choice/@Requires`.
Evidence comes from repository code, synthetic OOXML fixtures, the MCE-specific
regression script, and production-equivalent 46-rule runtime.
