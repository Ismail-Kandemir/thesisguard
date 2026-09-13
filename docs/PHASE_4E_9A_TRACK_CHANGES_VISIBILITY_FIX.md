# Phase 4E-9A Track Changes Visibility Policy

## Scope

This production fix applies a minimal accepted/current document visibility policy:

- normal `w:r` content remains visible
- `w:ins` descendant runs remain visible
- `w:del` descendant runs are excluded from the normalized visible run list

The implementation does not add a full revision engine and does not preserve
revision metadata in the public domain model.

## Production Change

`parseRuns` keeps descendant traversal for wrappers such as hyperlinks, fields,
and inserted revisions, but filters out runs with a `w:del` ancestor.

This keeps existing split-run, field-result, TOC cached-result, and nested wrapper
behavior while preventing deleted revision text from entering:

- `paragraph.runs`
- `paragraph.text`
- heading and section detection
- body typography validation
- object reference normalization
- abbreviation and keyword downstream consumers

## Regression Fixtures

- `tracked-deleted-run-font-size-synthetic.docx`
  - contains a deleted 11 pt body run
  - expected: `46/46 PASS`
  - proves deleted run is excluded from typography validation

- `tracked-inserted-run-synthetic.docx`
  - contains an inserted 12 pt body run
  - expected: `46/46 PASS`
  - proves inserted current text remains visible

- `tracked-deleted-reference-synthetic.docx`
  - contains a deleted fake `Şekil 99` reference
  - expected: `46/46 PASS`
  - proves deleted text does not create visible object-reference semantics

## Runtime Evidence

`node tests/audit/trackedChangesAudit.cjs` shows:

- deleted 11 pt text exists in OOXML but is absent from normalized paragraph text
  and visible runs
- inserted text exists in OOXML and remains present in normalized paragraph text
  and visible runs
- deleted fake figure reference exists in OOXML but is absent from normalized
  object references

## Trust Boundary

Not implemented in this phase:

- moveFrom / moveTo
- overlapping revision ranges
- accept/reject commands
- revision author/date policy
- Word UI display modes such as All Markup or Original
- deleted content reporting or preservation
