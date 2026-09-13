# Phase 4E-10A Textbox Ownership Fix

## Scope

This production fix separates visible textbox content from normal academic
document-flow paragraphs without discarding the visible text.

## Model

`Paragraph.contentScope` is now explicit:

- `document`: normal document-flow paragraph
- `textbox`: visible paragraph owned by `w:txbxContent`

## Parser Behavior

Paragraph parsing still uses descendant traversal under `w:body`, so textbox
paragraphs remain visible in the normalized document.

Run parsing now keeps only runs whose nearest owning `w:p` is the paragraph
currently being parsed. This preserves wrappers such as `w:hyperlink`,
`w:ins`, `w:fldSimple`, and complex field cached results, while preventing
inner textbox runs from leaking into the outer carrier paragraph.

Run text parsing now keeps only `w:t` nodes whose nearest owning `w:r` is the
run currently being parsed. This prevents an outer carrier run from absorbing
text owned by nested textbox runs.

## Academic Scope

Textbox-owned paragraphs are excluded from:

- academic body paragraph selection through `getBodyParagraphs`
- document-flow section detection through `parseDocumentSections`
- academic heading occurrence normalization

This keeps visible textbox text available for future textbox-aware rules while
preventing decorative shape text from being treated as thesis body structure.

## Regression Evidence

`textbox-font-size-synthetic.docx`:

- VML `w:txbxContent` count: 1
- textbox-owned paragraph count for diagnostic text: 1
- document-owned diagnostic text count: 0
- outer carrier paragraph text: empty
- font-size result: passed
- report: 46/46 passed

`textbox-semantic-collision-synthetic.docx`:

- VML `w:txbxContent` count: 1
- textbox-owned `KAYNAKLAR` count: 1
- document-owned `KAYNAKLAR` count: 1, the real thesis section
- section-order result: passed
- report: 46/46 passed

## Trust Boundary

VML `w:txbxContent` is regression-tested. DrawingML /
WordprocessingShape textbox representations are not yet fixture-verified by
this phase and should not be claimed as fully covered.
