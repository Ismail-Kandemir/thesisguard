# PHASE 4F-08 TABLE LIST-OF-TABLES CONSISTENCY SOURCE GROUNDING AND SEMANTIC FOUNDATION

## 1. Executive Summary

This phase added a source-bounded table/list semantic foundation without changing rule IDs, rule config, score weights, or existing table/figure validators.

The implementation models `Tablolar Listesi` entries separately from:

- structural `w:tbl` table occurrences
- table captions
- table numbers
- body in-text references
- section headings
- TOC/list field content

No new production consistency failure was added because repository source grounding explicitly does not require exact list-to-table coverage, orphan-entry failure, title equality, list ordering, duplicate-entry failure, leader formatting, or rendered page-number correctness.

Final decision:

OPTION B - TABLE/LIST SEMANTIC FOUNDATION COMPLETE, CONSISTENCY BOUNDED BY SOURCE

## 2. Starting Checkpoint

- Branch: `main`
- Starting HEAD: `fc246a5`
- `origin/main`: `fc246a5`
- Last commit: `fc246a5 feat: add bibliography entry semantics`
- Initial worktree: clean

## 3. Related Production Rules

Active table-related rules:

| Rule ID | Type | Current validator | Source grounding |
| --- | --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.table-object-alignment` | `OBJECT_ALIGNMENT` | `ObjectAlignmentValidator` | SOURCE_DIRECT |
| `comu.applied-sciences.food-technology.bachelor.table-caption-placement` | `OBJECT_CAPTION_PLACEMENT` | `ObjectCaptionPlacementValidator` | SOURCE_DIRECT |
| `comu.applied-sciences.food-technology.bachelor.table-caption-format` | `OBJECT_CAPTION_FORMAT` | `ObjectCaptionFormatValidator` | SOURCE_DIRECT |
| `comu.applied-sciences.food-technology.bachelor.table-in-text-reference` | `OBJECT_IN_TEXT_REFERENCE` | `ObjectInTextReferenceValidator` | SOURCE_DIRECT |
| `comu.applied-sciences.food-technology.bachelor.list-of-tables` | `CONDITIONAL_REQUIRED_SECTION` | `ConditionalRequiredSectionValidator` | SOURCE_DIRECT |

No new table rule ID was introduced.

## 4. Source Grounding

SOURCE_DIRECT:

- Real table object alignment: tables must be centered.
- Table captions must be above tables.
- Table captions must be left-aligned and single-line spaced.
- Tables must be referenced in thesis text.
- `Tablolar Listesi` is required when tables exist.

SOURCE_DERIVED:

- List entry identity can safely use visible `Tablo <number>` text as a semantic fact.
- A populated list is semantically observable, but not a separate production failure.

NOT_SOURCE_SUPPORTED:

- Every table must appear in `Tablolar Listesi`.
- Every list entry must resolve to a real table.
- Exact caption/list title equality.
- List entry ordering.
- Duplicate list entry failure.
- Dotted leader requirement.
- Rendered page-number correctness.
- New `OBJECT_LIST_CONSISTENCY` production rule.

AMBIGUOUS:

- Continuation tables.
- Multi-paragraph list entries.
- Generated list fields whose cached visible result is absent.
- Appendix/lettered table numbering.

## 5. Supported Requirements

Production-supported requirements remain:

- Structural table presence from real `w:tbl`.
- Table caption placement.
- Table caption formatting.
- Table object alignment.
- In-text table reference for reliably captioned tables.
- Conditional `Tablolar Listesi` section presence when tables exist.

Semantic-foundation support added:

- `Tablolar Listesi` section identity.
- List entry occurrence extraction.
- Table/list number association facts.
- Missing-list-entry facts.
- Orphan-list-entry facts.
- Ambiguous association facts.
- Duplicate entry preservation.
- Page-number suffix ignored for identity.

## 6. Unsupported Requirements

Not implemented as production failures:

- Table/list completeness.
- Orphan list entry failure.
- Caption/list title equality.
- List order validation.
- Rendered page number validation.
- Page leader validation.
- Table typography or table-cell typography.
- Continuation-table validation.

## 7. Previous Implementation

Before this phase:

- Structural tables were parsed as `DocumentTableOccurrence`.
- Captions were parsed as `DocumentCaption`.
- Table-caption proximity association existed.
- Body object references existed.
- `Tablolar Listesi` was checked only as a conditional required section.
- List entries were not modeled.
- Table/list associations were not observable.

## 8. Structural Table Occurrence

Real table identity remains structural:

- `w:tbl`

Plain text such as `Tablo 1` does not create a table occurrence.

Nested tables remain excluded from production academic object checks.

## 9. Table Semantic Identity

Reliable table identity is currently:

- top-level `DocumentTableOccurrence`
- associated table `DocumentCaption`
- caption kind `table`
- caption number

Tables without reliable captions remain structural tables but do not receive a list identity.

## 10. Caption Semantics

Caption semantics continue to use the existing parser:

- visible paragraph text
- label `Tablo`
- decimal number token
- paragraph/block location

Split-run captions are reconstructed at paragraph text level.

## 11. Caption Association

Table-caption association remains proximity-based over document blocks.

States remain represented through existing table facts:

- `captionId`
- `captionPosition`
- `none`
- `ambiguous`

## 12. Caption Placement

Caption placement remains production-enforced:

- table caption before table

Validation uses static document block order, not rendered page coordinates.

## 13. Caption Numbering

Caption number is preserved as metadata.

No standalone table-numbering production rule was added because source does not require sequence, uniqueness, ordering, restart behavior, or appendix numbering semantics as production failures.

## 14. Duplicate Identity Handling

Duplicate table caption numbers are preserved.

Existing in-text reference validation already treats duplicate caption numbers as unsafe for confident reference ownership. Table-list association facts mark duplicate-number situations as ambiguous.

## 15. Split-Run Behavior

Run boundaries are not caption/list-entry boundaries.

`Tab` + `lo ` + `3` + `. Title` is reconstructed as one visible paragraph text before semantic parsing.

## 16. Multi-Line Behavior

Manual line breaks inside one paragraph remain part of that paragraph's visible text.

Multi-paragraph caption or list-entry grouping is not heuristically merged in this phase.

## 17. In-Text Reference Semantics

Existing object-reference semantics remain:

- tokenized `Tablo <number>` matching
- caption text excluded
- list-section content excluded
- TOC content excluded
- section headings excluded

`Tablo 1` does not match `Tablo 10`.

## 18. Reference Exclusions

Reference scanning excludes:

- captions
- `Tablolar Listesi`
- `Şekiller Listesi`
- TOC-owned paragraphs
- rule-defined section headings
- table-cell content
- textbox-owned content
- deleted revision text through visible-text parsing

## 19. List of Tables Section

`Tablolar Listesi` section identity uses `AcademicSectionOccurrence`.

No independent section scanner was added.

## 20. Conditionality

Existing conditionality remains:

- if structural tables exist, `Tablolar Listesi` section is required

The condition is based on `document.tables.hasTables`, not raw text.

## 21. List Entry Model

Added:

- `DocumentTableList`
- `TableListEntryOccurrence`
- `TableListTableAssociation`
- `TableListEntryAssociation`

This model is optional on `NormalizedDocument` and is computed after academic sections.

## 22. List Entry Boundaries

Entries are extracted only inside the semantic `Tablolar Listesi` boundary.

Excluded:

- section heading itself
- blank paragraphs
- TOC-owned content
- textbox content
- table-cell content
- next academic section

## 23. List Entry Identity

Entry identity is:

- kind: `Tablo`
- normalized number token

Title is preserved as metadata but is not production-compared.

## 24. Page-Number Suffix Handling

Trailing cached/page-number-like suffixes are ignored for identity.

Example:

- `Tablo 2.1 Deney sonuçları ........ 14`

identity:

- number `2.1`
- title `Deney sonuçları`

Rendered page correctness remains out of scope.

## 25. Table -> List Association

Table-to-list facts are computed by matching reliable table caption number to list entry number.

States:

- `MATCHED`
- `MISSING_LIST_ENTRY`
- `AMBIGUOUS`

These facts are not production failures in this phase.

## 26. Title Consistency Decision

Caption/list title consistency is not production-enforced.

Reason:

- Source does not strongly require exact title equality.
- Generated list entries can vary in cached text representation.

## 27. Number Consistency Decision

Number consistency is modeled as semantic facts.

It is not a new production rule because source does not require complete list consistency as a scoring failure.

## 28. Body Reference Consistency Decision

Existing source-backed direction remains:

- every reliably captioned table must have a body reference

The reverse direction was not added:

- every body table reference must resolve to a real table

## 29. Table-Cell Exclusions

Table-cell paragraphs are excluded from:

- section recognition
- list entry extraction
- body reference scanning

## 30. Nested Table Behavior

Nested tables are still parsed as nested structural occurrences but excluded from academic object production checks.

This phase does not introduce a nested-table engine.

## 31. Alignment

Table alignment behavior is unchanged.

It remains based on:

- direct `w:tblPr/w:jc`
- table style alignment fallback
- `unknown` when unresolved

## 32. Caption Format

Table caption format behavior is unchanged.

It remains based on caption paragraph alignment and line spacing.

Figure caption format and Level 3 figure semantics were not changed.

## 33. Empty-List Semantics

The semantic model distinguishes:

- `LIST_SECTION_MISSING`
- `LIST_SECTION_PRESENT_EMPTY`
- `LIST_SECTION_PRESENT_WITH_ENTRIES`
- `LIST_SECTION_PRESENT_UNRESOLVED`

The existing production `list-of-tables` rule still checks section presence only, because populated-list enforcement is not source-grounded as a separate production failure.

## 34. Orphan Entries

Orphan list entries are preserved with:

- `ORPHAN_LIST_ENTRY`

They are observable semantic evidence but not production failures.

## 35. Missing Entries

Tables with reliable captions but no matching list entry are preserved with:

- `MISSING_LIST_ENTRY`

They are not production failures in this phase.

## 36. Ambiguity Safety

Ambiguous situations are not arbitrarily resolved.

Examples:

- duplicate caption numbers
- duplicate list entry numbers
- multiple tables for one list number
- multiple list entries for one table number

## 37. Evidence

Semantic evidence labels include:

- `academic-section-boundary`
- `visible-document-paragraph`
- `table-list-entry-pattern`
- `page-number-suffix-ignored`
- `structural-table-occurrence`
- `caption-number-identity`
- `duplicate-caption-number`
- `duplicate-list-entry-number`

No raw XML is exposed.

## 38. Diagnostics

No new report diagnostics were added.

The facts are available for future diagnostic/report phases, but golden diagnostics remain 0.

## 39. Coverage Before / After

Before:

- COMPLETE: 24
- PARTIAL: 19
- SHALLOW: 3
- MISSING: 0

After:

- COMPLETE: 24
- PARTIAL: 19
- SHALLOW: 3
- MISSING: 0

No coverage promotion was made because the production `list-of-tables` rule remains intentionally shallow/presence-only.

## 40. Trust Before / After

Before:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

After:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

Trust metadata was not inflated.

## 41. Focused Regression

Added:

- `tests/audit/tableListConsistencySemanticRegression.cjs`

It covers structural table detection, plain text false positives, caption association, placement, split-run captions, duplicate identities, list section status, entry parsing, page suffix handling, association states, body reference behavior, TOC/textbox/revision/table-cell exclusions, next-section boundaries, field/hyperlink visible text, and rendered page-number non-validation.

## 42. Existing Regressions

Relevant previous regressions were run:

- required section semantics
- summary/abstract/keywords semantics
- abbreviation semantics
- page number sequence semantics
- bibliography semantics
- figure Level 3 cleanup
- post-Level 3 documentation alignment
- object semantic shadow regression
- semantic figure structural evidence migration
- figure caption format pilot migration

All passed.

## 43. Golden

Golden remained:

- 46/46
- 100%
- diagnostics 0

## 44. Corpus

Corpus remained:

- 31 regression fixtures
- 11 exploratory fixtures

All passed.

## 45. Typecheck / Lint / Build

Required gates passed:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

The existing Vite large-chunk warning remains non-blocking.

## 46. DOCX Churn

No DOCX files were added or modified.

The focused regression uses synthetic XML.

## 47. Files Changed

Production:

- `src/features/analysis/types/index.ts`
- `src/features/analysis/parsers/tableListSemanticsNormalizer.ts`
- `src/features/analysis/analysisService.ts`

Tests:

- `tests/audit/tableListConsistencySemanticRegression.cjs`

Documentation:

- `docs/PHASE_4F_08_TABLE_LIST_OF_TABLES_CONSISTENCY_SOURCE_GROUNDING_AND_SEMANTIC_FOUNDATION.md`

## 48. Remaining Limitations

Remaining limitations:

- No production failure for missing individual list entries.
- No production failure for orphan list entries.
- No title equality validation.
- No list ordering validation.
- No rendered page-number validation.
- No generated TOC/list field correctness validation.
- No continuation-table semantics.
- No table typography/table-cell typography validation.

## 49. Next Domain

Recommended next domain:

Figure/List-of-Figures Source-Bounded Semantic Foundation

Rationale:

- `list-of-figures` remains SHALLOW.
- Figure object taxonomy is more complex than table identity.
- The table-list model provides a reusable but not blindly copied pattern.

## 50. Final Decision

Decision:

OPTION B - TABLE/LIST SEMANTIC FOUNDATION COMPLETE, CONSISTENCY BOUNDED BY SOURCE

## 51. Recommended Next Phase

Recommended next phase:

PHASE 4F-09 FIGURE / LIST-OF-FIGURES SOURCE-BOUNDED SEMANTIC FOUNDATION

Constraints:

- Do not regress figure Level 3.
- Do not reintroduce generic `w:drawing` figure identity.
- Keep production failures bounded by source support.
