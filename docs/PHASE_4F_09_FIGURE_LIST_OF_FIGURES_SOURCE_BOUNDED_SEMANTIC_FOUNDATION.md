# PHASE 4F-09 FIGURE LIST-OF-FIGURES SOURCE-BOUNDED SEMANTIC FOUNDATION

## 1. Executive summary

This phase adds a source-bounded `Şekiller Listesi` semantic foundation on top of the existing Figure Level 3 identity chain. It does not create a new figure detector, does not reintroduce legacy figure state, and does not convert list consistency facts into new production failures.

Final decision: OPTION B - FIGURE/LIST SEMANTIC FOUNDATION COMPLETE, CONSISTENCY BOUNDED BY SOURCE.

## 2. Starting checkpoint

- Branch: `main`
- Starting HEAD: `5303269`
- `origin/main`: `5303269`
- Initial worktree: clean
- Last commit: `5303269 feat: add table list semantic foundation`

## 3. Figure Level 3 invariant

Preserved. Academic figure identity remains:

`ObjectRepresentationOccurrence -> CaptionOccurrence / CaptionSemantic -> ObjectCaptionAssociation -> AcademicObjectResolution`.

No `DocumentFigureOccurrence`, `DocumentFigures`, `NormalizedDocument.figures`, `document.figures`, `parseFigures()`, or generic `w:drawing` identity was added.

## 4. Related production rules

| Rule ID | Expected | Validator | Source grounding | Coverage | Trust | Semantic dependency | Evidence | Regression coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.figure-object-alignment` | figure centered | `ObjectAlignmentValidator` | SOURCE_DIRECT for requirement; SOURCE_DERIVED for Level 3 identity | COMPLETE | HIGH | declared academic figure + inline physical alignment evidence | object/caption evidence | Level 3, coverage, golden, corpus |
| `comu.applied-sciences.food-technology.bachelor.figure-caption-placement` | figure caption after object | `ObjectCaptionPlacementValidator` | SOURCE_DIRECT | COMPLETE | HIGH | Level 3 association position | object/caption evidence | Level 3, golden, corpus |
| `comu.applied-sciences.food-technology.bachelor.figure-caption-format` | caption left, single line | `ObjectCaptionFormatValidator` | SOURCE_DIRECT | COMPLETE | HIGH | declared semantic caption | caption formatting evidence | caption pilot, golden, corpus |
| `comu.applied-sciences.food-technology.bachelor.figure-in-text-reference` | every reliable figure has body reference | `ObjectInTextReferenceValidator` | SOURCE_DIRECT | COMPLETE | HIGH | declared figure caption number | object evidence | focused regression, Level 3, golden, corpus |
| `comu.applied-sciences.food-technology.bachelor.list-of-figures` | `Şekiller Listesi` when figures exist | `ConditionalRequiredSectionValidator` | SOURCE_DIRECT for conditional section presence | SHALLOW | LOW | eligible declared semantic figures | missing-section evidence | focused regression, golden, corpus |

No new production rule ID was introduced.

## 5. Source grounding

SOURCE_DIRECT:

- Figure caption is required through caption placement semantics.
- Figure caption placement is below the figure.
- Figure caption format is left aligned and single spaced.
- Figure object alignment is centered when statically evaluable.
- Figure in-text references are required.
- `Şekiller Listesi` is required when figures exist.

SOURCE_DERIVED:

- Figure list entry identity can use visible `Şekil <number>` text inside the semantic `Şekiller Listesi` section.
- Caption/list number matching can be represented as a semantic fact.

NOT_SOURCE_SUPPORTED:

- Every figure must appear in the list as a production failure.
- Every list entry must resolve to a figure as a production failure.
- Caption/list title equality.
- List ordering and figure ordering enforcement.
- Rendered list page number correctness.
- Dotted leader formatting.

AMBIGUOUS:

- Continuation figures.
- Multi-paragraph list entries.
- Generated list fields with no visible cached result.
- Appendix or lettered figure numbering.

CONFLICTING: none found in the repository source grounding.

## 6. Supported requirements

Supported production behavior remains limited to current figure rules and conditional `Şekiller Listesi` section presence.

Supported semantic facts now include list section status, entry occurrences, figure-to-list associations, list-to-figure associations, missing entry facts, orphan entry facts, duplicate preservation, ambiguity states, and page suffix ignoring.

## 7. Unsupported requirements

Unsupported requirements remain facts-only or out of scope: completeness failure, orphan failure, exact title equality, ordering, rendered page number correctness, generated field correctness, and continuation figures.

## 8. Existing figure architecture

The architecture uses OOXML representation facts, caption semantic facts, association facts, and academic object resolution. Figure validators consume declared semantic figure identities through `objectApplicability`.

## 9. Eligible semantic figure set

Eligible figures are only `AcademicObjectResolution` entries with `status: "declared"` and `academicType: "figure"` plus a declared semantic figure caption. `ambiguous`, `unresolved`, and `excluded` resolutions are not eligible.

## 10. Caption identity

Caption identity is read from existing `CaptionSemantic`. Manual, split-run, or cached-field visible text is only as strong as the existing paragraph text and caption parser. No new caption regex was introduced for figure identity.

## 11. List-of-Figures section

`Şekiller Listesi` section identity uses `AcademicSectionOccurrence` through existing section lookup. There is no independent heading scanner.

## 12. Conditionality

Conditional list presence remains source-direct: if eligible semantic academic figures exist, `Şekiller Listesi` is required. Generic drawings do not trigger the condition.

## 13. List entry model

Added:

- `FigureListEntryOccurrence`
- `FigureListFigureAssociation`
- `FigureListEntryAssociation`
- `DocumentFigureList`

## 14. Entry boundaries

Entries are extracted only inside the semantic `Şekiller Listesi` boundary. The heading itself, blank paragraphs, TOC content, textbox content, table-cell content, deleted revision text, next academic sections, and non-owned content are excluded.

## 15. Entry identity

Entry identity is `Şekil` plus normalized decimal number. Title is metadata only.

## 16. Page-number suffix

Trailing cached page-number-like suffixes are ignored for identity. Rendered pagination correctness remains out of scope.

## 17. Figure/list association

Associations match eligible semantic figure caption numbers to figure list entry numbers.

States:

- `MATCHED`
- `MISSING_LIST_ENTRY`
- `ORPHAN_LIST_ENTRY`
- `AMBIGUOUS`
- `UNRESOLVED`

## 18. Missing entry

Missing list entries are preserved as semantic facts and do not create new production failures.

## 19. Orphan entry

Orphan list entries are preserved as semantic facts and do not create new production failures.

## 20. Duplicate identity

Duplicate list entries and duplicate figure caption numbers are preserved. Association becomes `AMBIGUOUS` instead of guessing.

## 21. Ambiguity safety

Ambiguous figures are not arbitrarily linked. Excluded and unresolved representations do not participate in list consistency.

## 22. Number consistency decision

Number consistency is source-derived as a semantic association fact. It is not promoted to a new production failure.

## 23. Title consistency decision

Title consistency is not source-supported as an exact production requirement. Titles are preserved for evidence.

## 24. Ordering decision

Ordering is not source-supported as a production requirement. Occurrence order is preserved only.

## 25. In-text reference interaction

Existing figure body-reference behavior is unchanged. It uses exact kind/number matching and excludes captions, list sections, TOC, headings, textbox content, deleted revisions, and table-cell content.

## 26. Generic drawing protection

Generic `w:drawing` without a declared semantic figure resolution does not create figure list associations and does not trigger `list-of-figures`.

## 27. Textbox protection

DrawingML/VML textbox content remains excluded from figure identity and figure list entry extraction.

## 28. Excluded representation handling

Excluded representations remain excluded and are not converted to resolved figures.

## 29. Table/figure isolation

Figure list entries require `Şekil`; `Tablo` entries do not resolve to figure entries. Table-list semantics are unchanged.

## 30. Evidence

Evidence labels include:

- `academic-section-boundary`
- `visible-document-paragraph`
- `figure-list-entry-pattern`
- `page-number-suffix-ignored`
- `academic-object-resolution`
- `semantic-caption-number-identity`
- `duplicate-caption-number`
- `duplicate-list-entry-number`
- `figure-list-entry-number-identity`

No raw XML dumps are exposed.

## 31. Diagnostics

No new report diagnostics were added. Golden diagnostics remain 0.

## 32. Coverage before/after

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

No coverage promotion was made because `list-of-figures` remains intentionally presence-only in production.

## 33. Trust before/after

Before:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

After:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

Trust metadata was not inflated.

## 34. Focused regression

Added `tests/audit/figureListSemanticRegression.cjs`.

It covers no-figure, generic drawing, textbox drawing, resolved figures, multiple figures, ambiguous and excluded figures, valid/missing/empty list section states, multiple and duplicate entries, split-run entries, page suffix ignoring, matched/missing/orphan/ambiguous associations, `Şekil 1` vs `Şekil 10`, table/figure isolation, TOC, deleted revisions, textbox content, next-section boundary, hyperlink/field-like visible text, no pagination assertion, conditional NOT_APPLICABLE, conditional FAIL, existing caption semantics, and generic drawing protection.

## 35. Level 3 regressions

Passed:

- `legacyFigureLevel3CleanupRegression.cjs`
- `postLevel3DocumentationAlignmentAudit.cjs`
- `semanticFigureStructuralEvidenceMigrationRegression.cjs`

## 36. Previous-phase regressions

Passed:

- `requiredSectionSemanticsRegression.cjs`
- `summaryAbstractKeywordsSemanticRegression.cjs`
- `abbreviationSymbolsSemanticRegression.cjs`
- `pageNumberSequenceSemanticRegression.cjs`
- `bibliographyEntrySemanticsRegression.cjs`
- `tableListConsistencySemanticRegression.cjs`

## 37. Golden

`npm.cmd run test:golden` passed: 46/46.

## 38. Corpus

`npm.cmd run test:corpus` passed: 31 regression, 11 exploratory.

## 39. typecheck/lint/build

`typecheck`, `lint`, and `build` passed during implementation. Final quality gates are recorded in the final report.

## 40. DOCX churn

No DOCX fixture was intentionally edited.

## 41. Files changed

Production:

- `src/features/analysis/types/index.ts`
- `src/features/analysis/parsers/figureListSemanticsNormalizer.ts`
- `src/features/analysis/analysisService.ts`

Tests:

- `tests/audit/figureListSemanticRegression.cjs`

Documentation:

- `docs/PHASE_4F_09_FIGURE_LIST_OF_FIGURES_SOURCE_BOUNDED_SEMANTIC_FOUNDATION.md`

## 42. Remaining limitations

- Figure/list completeness is facts-only.
- Orphan list entries are facts-only.
- Caption/list title equality is not enforced.
- List ordering is not enforced.
- Rendered list page numbers are out of scope.
- Continuation figures remain ambiguous.
- Multi-paragraph list entries are not merged heuristically.

## 43. Next domain

Remaining conditional-list production coverage and report surfacing of list semantic facts.

## 44. Final decision

OPTION B - FIGURE/LIST SEMANTIC FOUNDATION COMPLETE, CONSISTENCY BOUNDED BY SOURCE.

## 45. Recommended next phase

PHASE 4F-10 CONDITIONAL LIST SEMANTIC REPORTING AND SOURCE-BOUNDED COVERAGE DECISION.

## 46. Post-implementation regression triage

Phase 4F-09 verification initially left eight existing DOCX fixtures marked modified. They were not intentional 4F-09 artifacts; the phase explicitly avoided fixture rewrites. The files were restored from HEAD with path-specific `git restore`.

After fixture restoration, `node tests/audit/drawingMlTextBoxAudit.cjs` still failed on `drawingml-textbox-ownership-synthetic.docx` with `textbox-owned representation count: expected 0, received 1`. Triage classified this as CASE B - STALE TEST EXPECTATION.

Root cause: the audit expected zero structural textbox-owned `ObjectRepresentationOccurrence` records, but the current Level 3 semantic architecture intentionally preserves the DrawingML textbox as a structural representation with `kind: "textbox"` while resolving it as `excluded`. The representation does not become an eligible academic figure, does not reintroduce a legacy figure bridge, and does not affect figure-list semantics.

The audit was updated narrowly to assert the stronger semantic contract:

- one structural textbox representation may exist
- the textbox representation has `kind: "textbox"`
- its `AcademicObjectResolution` status is `excluded`
- its `academicType` is `null`
- it is not included in declared academic figures

No production fix was required. Figure Level 3 remains preserved, generic `w:drawing` still does not establish academic figure identity, and textbox-owned content remains excluded from academic figure identity. The DrawingML textbox audit passes after the expectation correction. Any DOCX churn created by the audit's fixture-generation step must be restored from HEAD before checkpointing.
