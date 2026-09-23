# PHASE 4F-07 BIBLIOGRAPHY REFERENCES SOURCE GROUNDING AND ENTRY SEMANTIC FOUNDATION

## 1. Executive Summary

This implementation phase moved the active `Kaynaklar` production rule from pure required-section presence to source-grounded bibliography section plus visible entry semantics.

The rule ID and rule config were not changed. The only production validator migration is:

- `comu.applied-sciences.food-technology.bachelor.references`

The implementation validates only what repository source evidence supports: a `Kaynaklar` section must exist and contain visible bibliography/source entries. It does not assume APA, MLA, Chicago, Harvard, IEEE, alphabetical ordering, hanging indent, entry grammar, URL/DOI format, or citation-reference correspondence.

Final decision:

OPTION B - BIBLIOGRAPHY SEMANTIC FOUNDATION COMPLETE, VALIDATION BOUNDED BY SOURCE

## 2. Starting Checkpoint

- Branch: `main`
- Starting HEAD: `6833965`
- `origin/main`: `6833965`
- Last commit: `6833965 feat: harden page number sequence semantics`
- Initial uncommitted state: untracked Phase 4F-06 audit document only

## 3. Preserved 4F-06 State

The Phase 4F-06 audit document was preserved and not modified, removed, restored, checked out, or reset.

4F-06 selected:

- OPTION A - BIBLIOGRAPHY / REFERENCES NEXT

4F-06 constraints carried forward:

- Do not assume citation style.
- Use `AcademicSectionOccurrence` as section source of truth.
- Reuse section boundaries.
- Preserve duplicate-looking entries as occurrences.
- Use visible text semantics.
- Keep unsupported bibliography style and citation-linking checks out of production.

## 4. Related Production Rules

Only one active bibliography/reference production rule exists:

| Rule ID | Type | Expected | Validator before | Validator after |
| --- | --- | --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.references` | `REQUIRED_SECTION` | `{ section: "Kaynaklar", required: true }` | `RequiredSectionValidator` | `BibliographyReferencesValidator` |

Related but not bibliography-entry rules:

- `comu.applied-sciences.food-technology.bachelor.table-in-text-reference`
- `comu.applied-sciences.food-technology.bachelor.figure-in-text-reference`

These remain object-reference rules and were not changed.

## 5. Source Grounding

Repository source grounding supports:

- `Kaynaklar` as the normative references section heading.
- Required presence of a references section.
- The concept that cited sources are listed in `Kaynaklar`.

Repository source grounding does not currently support production enforcement for:

- APA or another named style.
- Full bibliography entry grammar.
- URL/DOI validation.
- Citation-to-reference matching.
- Reference-to-citation matching.
- Hanging indent.
- Alphabetical ordering as an active production failure.

## 6. Supported Bibliography Requirements

Implemented production requirements:

- `Kaynaklar` section must be detected through academic section semantics.
- The section must contain at least one visible bibliography entry candidate.
- Entry candidates must come from visible document-flow paragraphs inside the semantic `Kaynaklar` boundary.
- Empty `Kaynaklar` sections now fail the `references` rule.

## 7. Unsupported Bibliography Assumptions

The following assumptions were explicitly not implemented:

- APA, MLA, Chicago, Harvard, IEEE, or other style enforcement.
- Alphabetical sorting.
- Hanging indentation.
- Specific first-line indentation.
- Specific left/right indentation.
- Specific line spacing or paragraph spacing.
- Bibliography-specific font family, font size, or alignment.
- Numbering/bullets requirement.
- Citation-reference correspondence.
- Reference-citation correspondence.
- Author/year/title field ordering.
- URL/DOI format.
- Multi-paragraph grouping as a confident production entry merge.

## 8. Previous Implementation

Previously, `comu.applied-sciences.food-technology.bachelor.references` used `RequiredSectionValidator`.

Behavior:

- Passed when a declared `Kaynaklar` academic section was found.
- Failed when no declared section was found.
- Did not inspect section content.
- Could pass a present but empty `Kaynaklar` heading.

## 9. Section Identity

The implementation uses the existing academic section model.

No independent `Kaynaklar` scanner was added. Section identity is resolved through:

- `markRequiredSectionHeadings`
- `normalizeDocumentHeadings`
- `normalizeAcademicDocumentScopes`
- `normalizeAcademicSections`
- `AcademicSectionOccurrence`

## 10. Section Boundary

Bibliography content is bounded by the selected `AcademicSectionOccurrence.boundary`.

Entry extraction starts after the `Kaynaklar` heading and stops before the next semantic or structural academic boundary at the same or higher level.

This protects against leakage into:

- `Ekler`
- `Özgeçmiş`
- Other final sections
- Unrelated following headings

## 11. Entry Semantic Model

Added optional normalized facts:

- `DocumentBibliography`
- `BibliographyEntryOccurrence`
- `BibliographyEntryFormattingFacts`

The model stores:

- source section occurrence ID
- paragraph IDs and paragraph indexes
- block range
- visible text
- normalized text
- entry index
- boundary status
- confidence
- resolved paragraph formatting facts
- evidence labels

## 12. Entry Boundary Strategy

The entry strategy is conservative:

- Each non-empty, visible, document-flow paragraph inside `Kaynaklar` is an entry candidate.
- Raw newline splitting is not used.
- Run boundaries are not entry boundaries.
- Duplicate-looking entries are not deduplicated.
- Potential continuation paragraphs are marked with low-confidence boundary status instead of being blindly merged.

## 13. Duplicate Preservation

Duplicate-looking bibliography paragraphs remain separate `BibliographyEntryOccurrence` records.

This preserves occurrence identity and avoids early semantic deduplication.

## 14. Split-Run Handling

Entry identity is paragraph-based.

Split runs such as:

- `Smith`
- `,`
- `2024`
- `. Title`

are reconstructed through existing paragraph visible text and become one entry candidate.

## 15. Visible-Text Ownership

The model uses existing paragraph visible-text semantics.

It inherits existing protections for:

- deleted revisions
- field instruction text
- textbox ownership
- TOC ownership
- table-cell ownership

## 16. Multi-Paragraph Behavior

Multi-paragraph bibliography entries are not confidently merged in this phase.

When a later paragraph starts like a continuation, it is marked:

- `POSSIBLE_CONTINUATION`

The section status becomes:

- `SECTION_PRESENT_UNRESOLVED_CONTENT`

The production rule can still pass when visible entries exist, but the semantic model avoids false certainty about entry boundaries.

## 17. Formatting Resolution

Formatting facts are captured for each entry candidate through the existing formatting infrastructure:

- paragraph style ID
- resolved paragraph alignment
- resolved line spacing
- resolved paragraph formatting
- indentation and spacing facts

No independent style resolver was added.

## 18. Hanging Indent

Hanging indent is parsed and available in entry formatting facts when present.

It is not production-enforced because this phase found no active source-grounded production requirement in the current rule set.

## 19. First-Line Indent

First-line indentation remains available through existing paragraph formatting facts.

It is not production-enforced for bibliography entries.

## 20. Line Spacing

Line spacing is captured as formatting evidence.

It is not production-enforced as a bibliography-specific rule.

## 21. Paragraph Spacing

Paragraph spacing before/after is captured when available.

It is not production-enforced as a bibliography-specific rule.

## 22. Font / Alignment

Bibliography-specific font family, font size, and alignment checks were not added.

General body typography validators remain unchanged and were not duplicated as bibliography-specific production rules.

## 23. Alphabetical Ordering Decision

Alphabetical ordering was not implemented.

Reason:

- The source material contains bibliography examples and audit notes, but this phase did not establish a safe production requirement plus deterministic key extraction for all supported entries.

## 24. Citation / Reference Correspondence Decision

Citation-reference correspondence was not implemented.

Reason:

- Existing object-reference rules are table/figure specific.
- Bibliography citation identity and bibliography entry identity require separate source-grounded models.
- Regex-only production matching would create false confidence.

## 25. Entry Syntax Decision

Full entry syntax validation was not implemented.

Reason:

- The repository source does not define one machine-checkable grammar for all entries.
- Large regex validators would overfit examples and under-represent valid academic references.

## 26. Empty-Section Semantics

The references rule now distinguishes:

- `SECTION_MISSING`
- `SECTION_PRESENT_EMPTY`
- `SECTION_PRESENT_WITH_ENTRIES`
- `SECTION_PRESENT_UNRESOLVED_CONTENT`

A present `Kaynaklar` heading with no visible entries now fails.

## 27. Validator Migration

The registry now maps:

- `comu.applied-sciences.food-technology.bachelor.references`

to:

- `BibliographyReferencesValidator`

The validator uses bibliography facts when present and builds them through `AcademicSectionOccurrence` fallback when older test harnesses have not precomputed them.

## 28. Evidence

Failure evidence is actionable and uses existing evidence types:

- missing section evidence when `Kaynaklar` is absent
- academic section evidence when `Kaynaklar` is present but empty
- ambiguous academic section evidence when identity cannot be declared safely

No raw XML dump is exposed.

## 29. Diagnostics

No report diagnostics were added in this phase.

The semantic model records unresolved entry-boundary content internally, but normal valid documents do not receive diagnostics. Golden diagnostic target remains 0.

## 30. Coverage Before / After

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

The `references` rule remains PARTIAL because bibliography formatting, ordering, syntax, and citation correspondence remain intentionally out of production.

## 31. Trust Before / After

Before:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

After:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

The `references` rule remains MEDIUM trust because entry-existence semantics improved, but full bibliography validation is not source-safe yet.

## 32. Focused Regression

Added:

- `tests/audit/bibliographyEntrySemanticsRegression.cjs`

Covered:

- valid bibliography section
- missing bibliography section
- empty bibliography section
- multiple entries
- duplicate-looking entries
- split-run entry
- deleted text exclusion
- textbox false-positive exclusion
- TOC false-positive exclusion
- next-section boundary protection
- blank paragraph safety
- formatting fact capture
- multi-paragraph ambiguity marking
- table-cell exclusion
- hyperlink and field cached visible text
- no raw-substring section detection

## 33. Existing Regressions

Required previous-phase regressions were run:

- `requiredSectionSemanticsRegression.cjs`
- `summaryAbstractKeywordsSemanticRegression.cjs`
- `abbreviationSymbolsSemanticRegression.cjs`
- `pageNumberSequenceSemanticRegression.cjs`
- `legacyFigureLevel3CleanupRegression.cjs`
- `postLevel3DocumentationAlignmentAudit.cjs`

All passed.

## 34. Golden

Golden remained:

- 46/46
- 100%
- diagnostics 0

## 35. Corpus

Corpus remained:

- 31 regression fixtures
- 11 exploratory fixtures

All existing corpus fixtures passed.

## 36. Typecheck / Lint / Build

Required quality gates:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

All passed. The existing Vite large-chunk warning remains non-blocking.

## 37. DOCX Churn Check

No DOCX fixture was created, rewritten, or modified.

The focused regression uses synthetic XML/unit-style infrastructure.

## 38. Files Changed

Production:

- `src/features/analysis/types/index.ts`
- `src/features/analysis/parsers/bibliographySemanticsNormalizer.ts`
- `src/features/analysis/rules/validators/BibliographyReferencesValidator.ts`
- `src/features/analysis/rules/ValidatorRegistry.ts`
- `src/features/analysis/analysisService.ts`

Tests:

- `tests/audit/bibliographyEntrySemanticsRegression.cjs`

Documentation:

- `docs/PHASE_4F_07_BIBLIOGRAPHY_REFERENCES_SOURCE_GROUNDING_AND_ENTRY_SEMANTIC_FOUNDATION.md`

Preserved from prior phase:

- `docs/PHASE_4F_06_REMAINING_VALIDATION_COVERAGE_GAP_AUDIT_AND_NEXT_DOMAIN_SELECTION.md`

## 39. Remaining Limitations

Remaining limitations:

- No APA/MLA/Chicago/Harvard/IEEE enforcement.
- No bibliography entry grammar validation.
- No alphabetical ordering validation.
- No hanging-indent production validation.
- No citation-reference correspondence.
- No reference-citation correspondence.
- Multi-paragraph entries are marked as ambiguous instead of merged.
- Generated bibliography managers are supported only through visible text, not through external metadata.

## 40. Next Domain

Recommended next domain:

Table/List Consistency Semantics

Rationale:

- Conditional list rules remain SHALLOW.
- Tables have strong structural object identity.
- List-of-tables consistency can build on existing caption and table semantics.

## 41. Final Decision

Decision:

OPTION B - BIBLIOGRAPHY SEMANTIC FOUNDATION COMPLETE, VALIDATION BOUNDED BY SOURCE

## 42. Recommended Next Phase

Recommended next phase:

PHASE 4F-08 TABLE / LIST-OF-TABLES CONSISTENCY SOURCE GROUNDING AND SEMANTIC FOUNDATION

Proposed scope:

- Source-ground list-of-tables content requirements.
- Reuse existing table occurrences and captions.
- Avoid page-number/rendered TOC assertions unless source and representation support them.
- Preserve table/figure semantics already hardened in previous phases.
