# Phase 4E-14A - Tracked Move Visibility Fix

## Proven Bug

Phase 4E-14 proved that `w:moveFrom` and `w:moveTo` were both parsed as
visible semantic content. A single logical moved value could therefore enter the
normalized document twice.

Before fix:

- `tracked-move-synthetic.docx`: `TG_MOVED_TEXT` normalized twice
- `tracked-move-semantic-collision-synthetic.docx`: `KAYNAKLAR` normalized as
  `KAYNAKLARKAYNAKLAR`
- semantic collision runtime: 42/46 passed, 4 failed

The failed rules were:

- `comu.bachelor.spacing.line-height`
- `comu.bachelor.format.alignment`
- `comu.applied-sciences.food-technology.bachelor.paragraph-indentation`
- `comu.applied-sciences.food-technology.bachelor.references`

## Revision Visibility Policy

ThesisGuard now applies a parser-level current-document visibility policy:

- `w:del` -> invisible
- `w:moveFrom` -> invisible
- `w:ins` -> visible
- `w:moveTo` -> visible
- normal `w:r` -> visible

This is not a full tracked-revision engine. It only decides which revision
content contributes to the current semantic document model.

## Selected Architecture

The visibility decision lives in `revisionVisibility.ts` as a small shared
parser helper. `documentXmlParser` calls this helper while selecting visible
runs, so downstream paragraph text, section detection, headings, abbreviations,
captions, object references, and typography rules all receive one consistent
semantic model.

The fix intentionally avoids rule-specific filters, fixture marker checks, and
section-specific hacks.

## Before / After

`tracked-move-synthetic.docx`

- Raw OOXML: one `w:moveFrom`, one `w:moveTo`
- Before normalized text: `... TG_MOVED_TEXT TG_MOVED_TEXT`
- After normalized text: `... TG_MOVED_TEXT`
- Before marker run occurrences: 2
- After marker run occurrences: 1
- After runtime: 46/46 passed

`tracked-move-semantic-collision-synthetic.docx`

- Raw OOXML: one `w:moveFrom`, one `w:moveTo`
- Before normalized text: `KAYNAKLARKAYNAKLAR`
- After normalized text: `KAYNAKLAR`
- Before section fact count for exact `KAYNAKLAR`: 0
- After section fact count for exact `KAYNAKLAR`: 1
- Before runtime: 42/46 passed, 4 failed
- After runtime: 46/46 passed, 0 failed, 0 N/A

## RuleResult Recovery

| Rule ID | Before | After | Root cause |
| --- | --- | --- | --- |
| `comu.bachelor.spacing.line-height` | FAILED | PASSED | `moveFrom` source content was treated as body paragraph content. |
| `comu.bachelor.format.alignment` | FAILED | PASSED | `moveFrom` source content was treated as body paragraph content. |
| `comu.applied-sciences.food-technology.bachelor.paragraph-indentation` | FAILED | PASSED | `moveFrom` source content was treated as body paragraph content. |
| `comu.applied-sciences.food-technology.bachelor.references` | FAILED | PASSED | Duplicated `KAYNAKLAR` text prevented exact section fact detection. |

## Corpus Promotion

The two tracked-move fixtures were promoted from exploratory to regression after
the fix:

- `tracked-move-synthetic.docx`
- `tracked-move-semantic-collision-synthetic.docx`

The corpus now contains 31 regression fixtures and 3 exploratory fixtures.

## Regression Coverage

`tests/audit/revisionVisibilityRegression.cjs` covers:

- normal run visible
- `w:del` run invisible
- `w:ins` run visible
- `w:moveFrom` run invisible
- `w:moveTo` run visible
- moveFrom inside hyperlink invisible
- moveTo inside hyperlink visible
- moveFrom nested inside hyperlink invisible
- moveTo nested inside hyperlink visible
- duplicate moved marker normalized once
- inactive moveFrom semantic heading/section marker absent
- active moveTo semantic marker present

## Trust Boundary

Supported current-document policy:

- `w:del` -> invisible
- `w:moveFrom` -> invisible
- `w:ins` -> visible
- `w:moveTo` -> visible

Not claimed:

- accept/reject history
- revision author/date semantics
- overlapping revision resolution
- move range reconstruction
- Word UI revision display modes
- comparison view
- rendered layout
- Word-native tracked-move fixture coverage

The current proof uses deterministic synthetic OOXML fixtures and the
production-equivalent runtime.
