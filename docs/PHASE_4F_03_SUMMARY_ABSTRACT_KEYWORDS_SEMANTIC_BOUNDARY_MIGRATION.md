# PHASE 4F-03 - Summary / Abstract / Keywords Semantic Boundary Migration

## 1. Executive summary

Phase 4F-03 migrates Summary, Abstract, and Keywords validation onto the shared academic section semantic foundation added in Phase 4F-02.

`SECTION_WORD_COUNT` and `SECTION_KEYWORDS` now consume `AcademicSectionOccurrence` records and semantic section boundaries instead of independently matching raw `DocumentSection` names. The migration keeps existing rule IDs, rule values, score arithmetic, separators, keyword labels, and result conventions.

## 2. Starting checkpoint

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `f3b2a9e` |
| origin/main | `f3b2a9e` |
| Working tree | Phase 4F-01 and 4F-02 changes preserved |

No restore, reset, checkout, commit, or push was performed.

## 3. 4F-02 foundation consumed

This phase reuses:

- `AcademicSectionOccurrence`
- canonical section identity
- declared / ambiguous section status
- duplicate occurrence preservation
- semantic boundaries
- TOC / revision / textbox / table-cell exclusions from the parsing and section candidate pipeline
- unknown structural heading boundary behavior

## 4. Related rules

Related production rules:

| Rule ID | Type | Expected | Validator |
| --- | --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.summary-tr` | `REQUIRED_SECTION` | `Özet` required | `RequiredSectionValidator` |
| `comu.applied-sciences.food-technology.bachelor.summary-en` | `REQUIRED_SECTION` | `Abstract` required | `RequiredSectionValidator` |
| `comu.applied-sciences.food-technology.bachelor.summary-tr-word-count` | `SECTION_WORD_COUNT` | `Özet`, max `200` | `SectionWordCountValidator` |
| `comu.applied-sciences.food-technology.bachelor.summary-en-word-count` | `SECTION_WORD_COUNT` | `Abstract`, max `200` | `SectionWordCountValidator` |
| `comu.applied-sciences.food-technology.bachelor.summary-tr-keywords` | `SECTION_KEYWORDS` | `Özet`, `Anahtar Kelimeler`, `3-5`, comma, section-end | `SectionKeywordsValidator` |
| `comu.applied-sciences.food-technology.bachelor.summary-en-keywords` | `SECTION_KEYWORDS` | `Abstract`, `Keyword`, `3-5`, comma, section-end | `SectionKeywordsValidator` |

## 5. Previous implementation

Previously:

- word-count validation used `sectionNameMatcher` against `document.sections`;
- keyword validation used `sectionNameMatcher` against `document.sections`;
- section content was extracted through `sectionContent`, which had already started consuming semantic boundaries in 4F-02 when available;
- validator fallback still depended on raw section occurrence lists.

## 6. Legacy scan paths found

Legacy direct scan paths found and migrated:

- `SectionWordCountValidator.findSectionOccurrences`
- `SectionKeywordsValidator.findSectionOccurrences`

`sectionNameMatcher` remains legitimate inside the shared academic section normalizer.

## 7. Semantic migration

Migrated validators:

- `SectionWordCountValidator`: `SEMANTIC`
- `SectionKeywordsValidator`: `SEMANTIC`

Both validators now use `findAcademicSectionOccurrencesByNames` and `findDeclaredAcademicSectionOccurrencesByNames`.

Ambiguous semantic occurrences fail conservatively. Duplicate declared occurrences fail conservatively. Missing sections remain `NOT_APPLICABLE` for these content validators, preserving existing required-section ownership.

## 8. Section content extraction

`getAcademicSectionContentParagraphs` extracts content from `AcademicSectionOccurrence.boundary`.

It excludes:

- the heading paragraph itself;
- TOC paragraphs;
- textbox paragraphs;
- table-cell paragraphs.

This keeps section content extraction aligned with visible body text and prevents keyword-like textbox content from satisfying section keyword rules.

## 9. Summary boundaries

Summary content is owned by the `Özet` semantic occurrence and stops at the semantic boundary.

The boundary is not extended merely because a later section is not the expected Summary/Abstract pair.

## 10. Abstract boundaries

Abstract content is owned by the `Abstract` semantic occurrence and stops at the semantic boundary.

Turkish Summary content does not leak into Abstract content, and Abstract content does not leak into following sections such as References.

## 11. Keyword ownership

Keyword lines are parsed only inside the semantic content of their owning section:

- `Anahtar Kelimeler` belongs to `Özet`;
- `Keyword` belongs to `Abstract`.

Cross-section keyword leakage is covered by the focused regression.

## 12. Keyword recognition

Keyword recognition remains source-grounded:

- exact configured labels after case/whitespace normalization;
- required colon separator;
- configured comma separator only.

No arbitrary substring keyword recognition was added.

## 13. Keyword extraction/counting

Keyword parsing separates the label from the values after the colon.

The configured comma separator splits values, empty values are ignored, and the label is not counted as a keyword.

## 14. Empty content handling

Heading presence and content are distinct.

`SECTION_WORD_COUNT` can detect an empty section when a min-bound rule requires content. Current production Summary/Abstract rules are max-only, so empty content is not newly failed unless a source-grounded min rule exists.

`SECTION_KEYWORDS` fails when a keyword label has no values because the extracted keyword count is below the configured minimum.

## 15. Duplicate/ambiguity handling

Duplicate Summary/Abstract semantic occurrences are not merged and not silently reduced to the first occurrence.

Ambiguous section identity fails conservatively for word-count and keyword validators.

## 16. TOC/revision/textbox exclusions

The focused regression covers:

- Summary/Abstract in TOC;
- deleted keyword lines;
- textbox keyword-like lines;
- body substring false positives.

## 17. Cross-section leakage protection

Semantic section boundaries prevent:

- Turkish Summary text from leaking into Abstract content;
- Abstract text from leaking into following sections;
- keyword lines from being attributed to the wrong section.

## 18. Evidence

Section evidence for word-count and duplicate/ambiguity failures now uses semantic section occurrence evidence, including paragraph index, block index when available, and confidence.

Keyword line evidence remains paragraph-level for actionable label/count/placement failures.

## 19. Diagnostics

No new report diagnostics were added. Golden diagnostics remain `0`.

Duplicate/ambiguous Summary or Abstract conditions are represented as validator failures with evidence rather than global diagnostics.

## 20. Result semantics

Preserved semantics:

- missing content section: `NOT_APPLICABLE` for `SECTION_WORD_COUNT` / `SECTION_KEYWORDS`;
- duplicate section: `FAILED`;
- ambiguous section identity: `FAILED`;
- empty keyword values: `FAILED`;
- valid counts and section-end placement: `PASSED`.

Required section absence remains owned by `RequiredSectionValidator`.

## 21. Coverage metadata before/after

Before:

- COMPLETE `24`
- PARTIAL `19`
- SHALLOW `3`
- MISSING `0`
- HIGH `24`
- MEDIUM `19`
- LOW `3`

After:

- COMPLETE `24`
- PARTIAL `19`
- SHALLOW `3`
- MISSING `0`
- HIGH `24`
- MEDIUM `19`
- LOW `3`

Coverage metadata was not inflated because this phase improves semantic trust for a subset of existing partial rules without changing the formal coverage inventory.

## 22. Focused regression

Added:

- `tests/audit/summaryAbstractKeywordsSemanticRegression.cjs`

Covered:

- semantic Summary lookup;
- semantic Abstract lookup;
- boundaries;
- nested heading behavior;
- unknown structural heading behavior;
- TOC / textbox / deleted revision exclusions;
- split-run keyword line;
- empty section detection under min-bound rule;
- cross-section leakage;
- keyword ownership;
- keyword false positives;
- duplicate section safety;
- ambiguous section safety;
- keyword count below / within / above range.

## 23. Fixtures

No DOCX fixtures were added or modified.

The focused regression uses synthetic XML and in-memory normalized document mocks only.

## 24. 4F-02 regression

`node tests/audit/requiredSectionSemanticsRegression.cjs` remains passing.

## 25. Golden

Golden remains `46/46`.

## 26. Corpus

Corpus remains `31 regression / 11 exploratory`.

## 27. Figure regression

Figure Level 3 cleanup and post-Level 3 documentation alignment regressions remain passing.

## 28. Typecheck/lint/build

Required gates remain passing. The production build still emits the existing non-blocking Vite chunk-size warning.

## 29. Files changed

Production source changed in:

- `src/features/analysis/parsers/academicSectionsNormalizer.ts`
- `src/features/analysis/rules/academicSectionLookup.ts`
- `src/features/analysis/rules/sectionContent.ts`
- `src/features/analysis/rules/validators/SectionWordCountValidator.ts`
- `src/features/analysis/rules/validators/SectionKeywordsValidator.ts`

Test/doc additions:

- `tests/audit/summaryAbstractKeywordsSemanticRegression.cjs`
- `docs/PHASE_4F_03_SUMMARY_ABSTRACT_KEYWORDS_SEMANTIC_BOUNDARY_MIGRATION.md`

Phase 4F-01 and 4F-02 working-tree files remain preserved.

## 30. Remaining limitations

- No rendered page-layout proof is added.
- No new minimum word count is introduced for production Summary/Abstract because current source-grounded rules are max-only.
- Keyword semantic quality, uniqueness, language quality, and scientific suitability are not validated.
- Only configured labels and comma separators are accepted.

## 31. Next domain

The next unlocked domain is page-number sequence / front-matter transition hardening, because it can now consume the same semantic section identity and boundary foundation.

## 32. Final decision

OPTION B - SEMANTIC MIGRATION COMPLETE WITH BOUNDED LIMITATIONS.

## 33. Recommended next phase

PHASE 4F-04 PAGE NUMBER SEQUENCE SEMANTIC TRANSITION HARDENING
