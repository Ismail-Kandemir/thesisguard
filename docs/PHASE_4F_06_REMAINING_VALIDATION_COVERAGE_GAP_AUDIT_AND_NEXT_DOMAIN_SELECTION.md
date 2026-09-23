# PHASE 4F-06 REMAINING VALIDATION COVERAGE GAP AUDIT AND NEXT DOMAIN SELECTION

## 1. Executive Summary

This phase is an audit-only checkpoint after the Phase 4F-05 page number sequence hardening. No production rule, parser, fixture, test, package, or configuration file was changed.

The active COMU Food Technology experimental validation surface contains 46 resolved rules. Current semantic coverage is:

- COMPLETE: 24
- PARTIAL: 19
- SHALLOW: 3
- MISSING: 0

The strongest remaining user-visible gap is bibliography and references validation. The current `Kaynaklar` rule validates required section presence only; it does not validate bibliography entries, reference formatting, ordering, hanging indentation, APA/source style, or text citation to reference-list correspondence.

Selected next domain:

OPTION A - BIBLIOGRAPHY / REFERENCES NEXT

## 2. Starting Checkpoint

- Branch: `main`
- Local HEAD: `6833965`
- `origin/main`: `6833965`
- Last commit: `6833965 feat: harden page number sequence semantics`
- Starting worktree: clean

Baseline test health before this audit was expected to remain:

- Golden: 46/46
- Golden score: 100%
- Golden diagnostics: 0
- Corpus: 31 regression documents, 11 exploratory documents

## 3. Full 46-Rule Inventory Summary

The resolved rule inventory remains unchanged after Phase 4F-05.

| Count | Coverage | Trust | Notes |
| ---: | --- | --- | --- |
| 24 | COMPLETE | HIGH | Static OOXML semantics are implemented with enough direct evidence and regression coverage for the current rule intent. |
| 19 | PARTIAL | MEDIUM | Rule intent is represented, but behavior is presence-only, max-only, section-boundary limited, or lacks deeper semantic validation. |
| 3 | SHALLOW | LOW | Conditional section presence exists, but object/list content semantics are not validated. |
| 0 | MISSING | N/A | No active resolved rule is completely unimplemented. |

Primary domain distribution:

- Typography: 2
- Spacing/alignment/body formatting: 3
- Margins: 4
- Headings and heading numbering: 6
- Page numbering: 2
- Required sections and section order: 14
- Summary and keywords: 4
- Table/figure object semantics: 8
- Conditional list sections: 3

## 4. Exact PARTIAL Rules

The 19 PARTIAL rules are:

1. `comu.applied-sciences.food-technology.bachelor.page-number`
2. `comu.applied-sciences.food-technology.bachelor.table-of-contents`
3. `comu.applied-sciences.food-technology.bachelor.references`
4. `comu.applied-sciences.food-technology.bachelor.summary-tr`
5. `comu.applied-sciences.food-technology.bachelor.summary-en`
6. `comu.applied-sciences.food-technology.bachelor.plagiarism-declaration`
7. `comu.applied-sciences.food-technology.bachelor.acceptance-approval`
8. `comu.applied-sciences.food-technology.bachelor.acknowledgements`
9. `comu.applied-sciences.food-technology.bachelor.introduction`
10. `comu.applied-sciences.food-technology.bachelor.conclusion`
11. `comu.applied-sciences.food-technology.bachelor.cv`
12. `comu.applied-sciences.food-technology.bachelor.experimental.general-information-literature`
13. `comu.applied-sciences.food-technology.bachelor.experimental.material-method`
14. `comu.applied-sciences.food-technology.bachelor.experimental.findings-discussion`
15. `comu.applied-sciences.food-technology.bachelor.experimental.section-order`
16. `comu.applied-sciences.food-technology.bachelor.summary-tr-word-count`
17. `comu.applied-sciences.food-technology.bachelor.summary-en-word-count`
18. `comu.applied-sciences.food-technology.bachelor.summary-tr-keywords`
19. `comu.applied-sciences.food-technology.bachelor.summary-en-keywords`

## 5. Exact SHALLOW Rules

The 3 SHALLOW rules are:

1. `comu.applied-sciences.food-technology.bachelor.list-of-tables`
2. `comu.applied-sciences.food-technology.bachelor.list-of-figures`
3. `comu.applied-sciences.food-technology.bachelor.list-of-abbreviations`

## 6. COMPLETE Sanity Check

No COMPLETE rule is reclassified in this audit.

The COMPLETE set is still appropriate for the stated rule intent because the rules have focused static semantics and existing regression coverage. Residual limitations are already trust-qualified, especially for figure taxonomy and static layout approximations, but they do not make the current COMPLETE classifications false for the active rule scope.

COMPLETE groups:

- Font family and font size: 2
- Body line height, alignment, and first-line indentation: 3
- Margins: 4
- Heading format, alignment, level format, and numbering: 6
- Page number sequence transition: 1
- Table/figure alignment, caption placement, caption format, and in-text object references: 8

False COMPLETE candidates found: 0.

## 7. Domain Grouping

| Domain | Active rule count | Coverage profile | Main residual gap |
| --- | ---: | --- | --- |
| Typography/body formatting | 5 | COMPLETE | Rendering-only paragraph gap semantics remain outside source-safe static validation. |
| Margins | 4 | COMPLETE | Section/layout edge cases are covered well enough for current static scope. |
| Headings | 6 | COMPLETE | Deeper heading semantics beyond formatting/order are not source-grounded. |
| Page numbering | 2 | 1 COMPLETE, 1 PARTIAL | Sequence semantics are strong; physical footer placement remains static-limited. |
| Required sections | 13 | PARTIAL | Presence is validated, but content quality and emptiness are not generally validated. |
| Section order | 1 | PARTIAL | Relative order is checked, but deeper section hierarchy/content quality is not. |
| Summary/keywords | 4 | PARTIAL | Max word count and keyword line checks exist; content quality is not validated. |
| Table/figure objects | 8 | COMPLETE | Object/list content consistency and richer table semantics are not covered. |
| Conditional lists | 3 | SHALLOW | Presence only; list entries and consistency are not validated. |
| Bibliography/references | 1 direct active rule | PARTIAL | Section presence only; bibliography entry and citation semantics are absent. |

## 8. Source Grounding Matrix

| Candidate area | Current source grounding | Current implementation | Audit judgment |
| --- | --- | --- | --- |
| References section presence | Primary direct | Required section presence | Implemented but shallow relative to user expectations. |
| Bibliography entry formatting | Citation/source guide artifact exists; exact local production mapping needs recheck | No active production validator | Strong candidate, but must remain source-scoped. |
| In-text citation to references correspondence | Not active in production | No bibliography citation resolver | Candidate only after direct source grounding. |
| Table object presence/alignment/caption/ref | Primary direct for active object rules | Active validators exist | Already substantially covered. |
| List of tables/figures content | Presence source exists; entry consistency is not clearly production-grounded | Conditional presence only | Not selected until source requirement is explicit. |
| Abbreviation list content | Primary direct for list presence; semantic content source is narrower | Conditional presence only | Recently hardened foundation; deeper checks need source care. |
| Heading numbering | Direct enough for current phase | Active semantic validator | Covered. |
| Page number sequence | Direct enough for current phase | Active semantic validator | Covered after 4F-05. |

## 9. Bibliography / References Audit

The active `references` rule currently checks only that a `Kaynaklar` section is present. It does not inspect the content of the section.

Detected gap categories:

- Empty or near-empty `Kaynaklar` section can satisfy the section presence rule.
- Bibliography entries are not segmented or counted.
- Entry formatting is not validated.
- Hanging indentation is not validated for references.
- Alphabetical ordering is not validated.
- Citation style, including APA-like details, is not validated.
- In-text citation to bibliography entry correspondence is not validated.
- Bibliography section boundaries are available from the academic section model, but not yet used for bibliography-specific validation.

Audit result: this is the most important remaining false-confidence surface because users are likely to interpret "Kaynaklar passed" as broader bibliography correctness.

## 10. In-Text Citation Audit

Current in-text citation validation is limited to table and figure references:

- `comu.applied-sciences.food-technology.bachelor.table-in-text-reference`
- `comu.applied-sciences.food-technology.bachelor.figure-in-text-reference`

There is no active bibliography citation validator for author-year, numeric, footnote, or other academic citation-reference correspondence.

Static feasibility is medium to high for extraction of citation-like tokens, but production validation must not assume a citation style without direct source evidence.

## 11. Tables Audit

Table coverage is comparatively strong for the active rule set.

Current strengths:

- `w:tbl` provides a strong OOXML object signal.
- Table object alignment has direct production semantics.
- Table caption placement and caption format have active validators.
- Table in-text object references are covered.
- Regression fixtures already exercise object-level behavior.

Remaining gaps:

- List of tables content is not checked against actual table captions.
- Table numbering sequence is not separately validated.
- Table cell typography and table-specific layout are not active production domains.
- Caption-to-object association remains static and section-sensitive, not renderer-backed.

Audit result: table semantics are a credible future candidate, but less urgent than bibliography because many table-facing rules already have production coverage.

## 12. Heading Audit

Heading coverage is one of the stronger areas.

Current strengths:

- Heading levels are detected semantically.
- Heading style and direct formatting inheritance are handled.
- Theme fonts and style inheritance are represented.
- Manual numbering and Word numbering are covered.
- Body section scoping reduces false positives.
- False heading detection was improved in prior phases.

Remaining gaps:

- Rendered spacing around headings is not validated.
- Deeper semantic title quality is outside current source scope.

Audit result: not selected for the next domain.

## 13. Body Typography Audit

Body typography coverage is strong for current static validation.

Current strengths:

- Direct formatting, style inheritance, document defaults, and theme fonts are represented.
- Mixed-run paragraphs are handled.
- TOC, table cell, list, caption, and heading exclusions reduce false positives.
- Line height, alignment, and first-line indentation are active.

Remaining gaps:

- Paragraph before/after rendered spacing remains source/rendering ambiguous.
- Footnote/endnote production coverage remains outside the active domain.

Audit result: not selected for the next domain.

## 14. Lists Audit

List coverage is split between required section presence and conditional list presence.

Current behavior:

- `İçindekiler` presence is checked.
- `Tablolar Listesi` presence is checked conditionally when tables are detected.
- `Şekiller Listesi` presence is checked conditionally when figures are detected.
- `Simgeler ve Kısaltmalar Listesi` presence is checked conditionally when abbreviations are detected.

Remaining gaps:

- Word TOC field existence is not required.
- List entries are not checked against actual headings, table captions, figure captions, or abbreviations.
- Page number references inside lists are not validated.

Audit result: list content consistency is important but needs clearer source and static feasibility boundaries before production hardening.

## 15. Conditional Rules Audit

The three SHALLOW rules are conditional list-section rules.

They are shallow because they validate required presence only after a trigger condition:

- `hasTables`
- `hasFigures`
- `hasAbbreviations`

Current false-confidence risks:

- A present but empty list section can pass.
- A list can omit actual objects/abbreviations and still pass.
- A list can include stale entries and still pass.
- Figure detection is less structurally reliable than table detection.
- Abbreviation detection is heuristic and may miss domain-specific notation.

Audit result: these are real gaps, but hardening them first would likely require table/figure/abbreviation list-content semantics and stronger source commitments.

## 16. Static OOXML Feasibility

| Domain | Static feasibility | Reason |
| --- | --- | --- |
| Bibliography section extraction | HIGH | Academic section occurrence boundaries already exist. |
| Bibliography entry segmentation | MEDIUM | Paragraph-level extraction is feasible, but multi-paragraph entries and style variation need careful confidence handling. |
| Bibliography formatting | MEDIUM-HIGH | Paragraph indentation, alignment, spacing, and run formatting facts already exist. |
| Citation-reference correspondence | MEDIUM | Token extraction is feasible; style/source ambiguity is the limiting factor. |
| Table object semantics | HIGH | `w:tbl` is structurally explicit. |
| Figure object semantics | MEDIUM | Drawings/images/shapes have multiple representations. |
| List content consistency | MEDIUM | Captions/headings can be extracted, but generated TOC/list fields and page numbers are not renderer-safe. |
| Heading numbering | HIGH | Already implemented with occurrence-aware semantics. |
| Page number sequence | MEDIUM-HIGH | Already hardened with section transition logic. |

## 17. Prerequisite Readiness

Bibliography prerequisites:

- Section occurrence model: READY
- Section content extraction: READY
- Paragraph formatting facts: READY
- Hanging-indent facts: READY
- Entry segmentation model: NEEDS FOUNDATION
- Citation-style source mapping: NEEDS SOURCE RECHECK
- Citation-reference correspondence: DEFER UNTIL SOURCE DIRECT

Table semantics prerequisites:

- Table object extraction: READY
- Caption extraction: READY
- In-text object reference extraction: READY
- List-of-tables content model: NEEDS FOUNDATION
- Page number/list field validation: NOT READY WITHOUT RENDERING OR SOURCE LIMITS

Shallow conditional prerequisite:

- Trigger detection: PARTIAL READY
- List content checking: NEEDS DOMAIN-SPECIFIC FOUNDATION

## 18. False-Confidence Findings

Eight false-confidence risks remain important:

1. `Kaynaklar` passing means section presence only, not bibliography correctness.
2. Bibliography citation-reference correspondence is absent.
3. Required section rules can pass with empty or placeholder content.
4. Conditional list rules can pass with empty list sections.
5. List of figures depends on weaker figure taxonomy than list of tables.
6. Abbreviation list triggering is heuristic and can miss or over-detect symbols.
7. Summary word-count rules check maximum length, not summary quality.
8. Page-number field placement remains static-limited even though page-number sequence is stronger.

None of these require reclassifying an existing COMPLETE rule in this audit.

## 19. Regression Coverage

Existing golden and corpus coverage is broad in the already-hardened areas:

- 46 golden rules are expected to remain green.
- Corpus regression set contains 31 regression documents.
- Corpus exploratory set contains 11 exploratory documents.
- Strong coverage exists for section semantics, headings, page sequence, body formatting, object captions, and table/figure references.

Weak regression coverage remains for:

- Real bibliography entry parsing.
- Bibliography formatting.
- Citation-reference correspondence.
- List of tables content consistency.
- List of figures content consistency.
- Conditional list content depth.
- Footnote/endnote production rules.

## 20. Corpus Coverage

Strong corpus areas:

- Margin and multi-section behavior.
- Tracked change and revision visibility behavior.
- Text boxes and alternate content.
- Page numbering and page-number sequence.
- Heading numbering and section-aware heading semantics.
- Split runs, theme fonts, document defaults, and style inheritance.
- Object semantics exploratory coverage.

Weak corpus areas:

- Bibliography/reference-list entry semantics.
- Academic citation parsing.
- Citation-to-reference-list consistency.
- Generated TOC/list field behavior.
- Conditional list-entry correctness.
- Settings-driven page layout variants such as even/odd layout.

## 21. User-Visible Impact

Bibliography and references have high user-visible impact because thesis authors often treat reference correctness as a core compliance requirement. A pass on `Kaynaklar` can be misread as confirming bibliography quality even when only section presence is checked.

Table semantics also have meaningful impact, but existing table rules already cover many visible table requirements. Shallow conditional lists are visible, but their deeper checks depend on list-entry and object correlation semantics.

## 22. Implementation Risk

Bibliography risk is medium:

- Section boundaries and paragraph facts are already available.
- Entry segmentation can be introduced conservatively with confidence levels.
- The main risk is over-asserting APA/citation style requirements without direct source grounding.

Table semantics risk is medium:

- Table object extraction is strong.
- List content/page number matching can become renderer-sensitive.

Shallow-first risk is medium-high:

- Presence checks are easy to harden incorrectly.
- Content consistency requires separate domain models for tables, figures, and abbreviations.

## 23. Architectural Fit

Bibliography fits the current architecture well if implemented as a semantic foundation:

- Use existing academic section occurrence boundaries.
- Reuse paragraph/run formatting facts.
- Add a bibliography-specific occurrence model only if source grounding supports it.
- Keep `RequiredSectionValidator` responsible for section presence.
- Avoid changing unrelated object, heading, or body typography validators.

This is a better architectural fit than forcing conditional list rules to become broad cross-domain validators.

## 24. Bibliography Readiness Deep Dive

Ready now:

- `Kaynaklar` section detection.
- Section text extraction.
- Paragraph-level document traversal.
- Paragraph indentation and spacing facts.
- Run/font inheritance facts.
- Regression harness and audit documentation pattern.

Needs foundation:

- Reference-list entry candidate segmentation.
- Empty/placeholder references section detection.
- Confidence scoring for ambiguous bibliography paragraphs.
- Source-confirmed formatting expectations.
- Source-confirmed ordering expectations.

Should remain deferred unless directly grounded:

- APA-specific enforcement.
- Citation-reference correspondence.
- DOI/URL normalization.
- External metadata lookup.

## 25. Table Readiness Deep Dive

Ready now:

- Structural table object detection.
- Table alignment validation.
- Table caption placement and format validation.
- Table in-text reference validation.

Needs foundation:

- List-of-tables entry extraction.
- Caption-to-list consistency.
- Table numbering sequence validation.
- Handling of generated fields and stale manual lists.

Reason for deferral:

- Active table rules already provide meaningful semantic coverage.
- The next table gap is mostly list consistency, which overlaps with the broader shallow conditional list problem.

## 26. Shallow-First Analysis

The SHALLOW rules are tempting because there are only three of them, but count alone should not determine the next phase.

Hardening them would require:

- Reliable object/abbreviation inventory generation.
- List-entry extraction.
- Caption/list matching.
- Figure taxonomy confidence handling.
- Source-safe behavior for generated lists and page numbers.

Audit result: shallow-first hardening is deferred until a domain-specific list-content foundation is selected.

## 27. Candidate Domain Comparison

| Candidate | User impact | Source readiness | Static feasibility | Regression gap | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Bibliography / references | HIGH | MEDIUM | MEDIUM-HIGH | HIGH | MEDIUM | Select |
| Table semantics | MEDIUM-HIGH | MEDIUM-HIGH | HIGH | MEDIUM | MEDIUM | Defer |
| Shallow conditional lists | MEDIUM | MEDIUM | MEDIUM | HIGH | MEDIUM-HIGH | Defer |
| Headings/body formatting | MEDIUM | HIGH | HIGH | LOW | LOW | Defer |

## 28. Selected Next Domain

Selected next domain:

OPTION A - BIBLIOGRAPHY / REFERENCES NEXT

## 29. Why Selected

Bibliography/references is selected because it has the highest combination of:

- User-visible importance.
- Current false-confidence risk.
- Lack of production semantic validation beyond section presence.
- Good architectural prerequisites from section and paragraph semantic foundations.
- Clear opportunity for conservative, source-grounded improvement.

## 30. Why Alternatives Deferred

Table semantics are deferred because active table rules already cover object alignment, caption placement, caption format, and table references. The next table gains are mostly list-content consistency and numbering sequence, which require a separate content-correlation foundation.

Shallow conditional list hardening is deferred because it depends on table, figure, and abbreviation inventory semantics. It should not be treated as a quick presence-rule patch.

Heading and body typography hardening are deferred because they are already among the strongest COMPLETE areas.

## 31. Proposed 4F-07 Scope

Recommended Phase 4F-07:

PHASE 4F-07 BIBLIOGRAPHY / REFERENCES SOURCE GROUNDING AND ENTRY SEMANTIC FOUNDATION

Proposed scope:

- Audit source-grounded bibliography/reference requirements.
- Keep the existing `references` required-section rule behavior stable unless source evidence supports additional checks.
- Introduce or prepare a bibliography section content model.
- Detect empty or placeholder-only references sections if directly source-safe.
- Segment bibliography entry candidates inside `Kaynaklar`.
- Capture paragraph ranges, text excerpts, indentation, spacing, and confidence for each entry candidate.
- Evaluate whether hanging indentation, ordering, or formatting checks are directly grounded.
- Add focused regression coverage only for source-supported behavior.

Explicit non-goals:

- Do not assume APA unless direct source grounding is confirmed.
- Do not implement citation-reference correspondence unless source grounding is direct.
- Do not use external metadata lookup.
- Do not introduce new dependencies.
- Do not change table/figure/list validators in this phase.

## 32. Proposed Success Criteria

Phase 4F-07 should be considered successful only if:

- Source grounding for bibliography behavior is documented.
- `Kaynaklar` section presence remains stable.
- Bibliography section content extraction is deterministic.
- Empty or placeholder-only reference sections are handled if source-safe.
- Entry candidate extraction has confidence-aware diagnostics.
- Unsupported bibliography style claims are explicitly excluded.
- Golden, corpus, typecheck, lint, build, and diff checks remain green.

## 33. Files Changed

This audit phase changed only:

- `docs/PHASE_4F_06_REMAINING_VALIDATION_COVERAGE_GAP_AUDIT_AND_NEXT_DOMAIN_SELECTION.md`

No `src/`, production rule config, package file, DOCX fixture, or existing test was modified.

## 34. Verification

Required verification commands for this audit:

- `npm run test:golden`
- `npm run test:corpus`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

Verification results are recorded in the final assistant response for this phase.

## 35. Final Decision

Final decision:

OPTION A - BIBLIOGRAPHY / REFERENCES NEXT

## 36. Recommended Next Phase

Recommended next phase name:

PHASE 4F-07 BIBLIOGRAPHY / REFERENCES SOURCE GROUNDING AND ENTRY SEMANTIC FOUNDATION

Recommended next phase type:

- Source-grounded semantic foundation
- Narrow production impact
- Conservative parser/model expansion
- No citation-style assumptions without direct source evidence
