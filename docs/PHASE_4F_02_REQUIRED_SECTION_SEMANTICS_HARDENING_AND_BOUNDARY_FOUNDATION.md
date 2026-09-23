# PHASE 4F-02 - Required Section Semantics Hardening and Boundary Foundation

## 1. Executive summary

Phase 4F-02 adds a shared academic section semantic layer for required-section and section-order validation.

The implementation separates:

- heading representation: the paragraph text, numbering, style, and heading occurrence evidence;
- section identity: the normalized canonical rule identity and any alias candidates;
- section boundary: the content range owned by a recognized section occurrence.

`RequiredSectionValidator` and `SectionOrderValidator` now consume semantic section occurrences instead of scanning raw section candidates directly. Ambiguous section identity no longer silently passes presence or order validation.

## 2. Starting checkpoint

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `f3b2a9e` |
| origin/main | `f3b2a9e` |
| Commit | `f3b2a9e docs: align figure semantics after level 3 cleanup` |
| Initial working tree | one preserved untracked 4F-01 audit doc |

Preserved untracked file:

- `docs/PHASE_4F_01_NEXT_VALIDATION_DOMAIN_SELECTION_AND_COVERAGE_GAP_AUDIT.md`

## 3. Semantic model added

New normalized document field:

- `document.academicSections.occurrences`

Each occurrence records:

- canonical identity and candidate identities;
- recognition status: `declared`, `ambiguous`, or `unresolved`;
- confidence;
- heading paragraph and block location;
- visible/manual/Word numbering context;
- recognition evidence;
- content boundary;
- academic scope assignment when available.

The model is built by `normalizeAcademicSections` after heading normalization and academic scope normalization.

## 4. Matching behavior

Section recognition remains exact after existing Turkish/case/diacritic normalization. It does not use global substring matching.

Supported heading text forms now include:

- `GIRIS`
- `Giriş`
- `GİRİŞ`
- `1 Giriş`
- `1. Giriş`
- `1.   GİRİŞ`
- nested manual labels such as `1.1 Giriş` and `1.1. Giriş`

The semantic layer reuses existing rule-defined section names and aliases across required sections, conditional required sections, section order, word-count/keyword sections, page-number transition sections, and heading section expectations.

## 5. Exclusion behavior

The semantic layer starts from the existing curated `document.sections` candidates, so existing exclusions remain in force:

- table-of-contents entries do not create required-section presence;
- textbox paragraphs do not create required-section presence;
- table-cell paragraphs do not create required-section presence;
- deleted revision text does not create required-section presence;
- caption paragraphs removed by `markRequiredSectionHeadings` do not create required-section presence.

## 6. Boundary behavior

Section boundaries are derived from the combined structural heading stream and recognized section occurrences.

Important behavior:

- a level-0 section is not cut by nested level-1 or level-2 headings;
- the next same-or-higher structural heading closes the previous section;
- unknown level-0 headings can act as structural boundaries;
- duplicate section occurrences are preserved as distinct occurrences.

`sectionContent` now prefers the semantic boundary when the supplied section heading maps to an academic section occurrence.

## 7. Validators migrated

Migrated validators:

- `RequiredSectionValidator`
- `SectionOrderValidator`

Required-section validation passes only on a declared semantic occurrence. Ambiguous occurrences produce failed evidence with confidence metadata.

Section-order validation uses declared occurrences, preserves duplicate detection, and rejects ambiguous occurrences before trusting order.

## 8. Regression coverage

Added focused audit:

- `tests/audit/requiredSectionSemanticsRegression.cjs`

Covered cases:

- plain and mixed-case required section headings;
- manual numbering with and without dot;
- split-run reconstructed heading text;
- Word automatic numbering evidence;
- TOC, textbox, table-cell, deleted-revision, and caption exclusions;
- no substring matching;
- duplicate occurrence preservation;
- nested H2/H3 boundary behavior;
- unknown H1 boundary behavior;
- semantic section-order failure;
- ambiguous identity does not pass.

## 9. Non-changes

No rule config, rule IDs, score arithmetic, dependencies, or DOCX fixtures were changed.

No login, register, dashboard, or thesis-analysis product features were added.

The preserved 4F-01 audit document remains untracked and unchanged.

## 10. Verification

Verification commands run for this phase:

- `node tests/audit/requiredSectionSemanticsRegression.cjs`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:golden`
- `npm run test:corpus`

Additional figure/object documentation regressions are expected to remain green because this phase does not alter figure semantics or rule configuration.
