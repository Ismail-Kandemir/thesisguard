# PHASE 4F-01 - Next Validation Domain Selection and Coverage Gap Audit

## 1. Executive summary

Phase 4F-01 is an audit-only selection phase for the next validation expansion domain. No production source, rule JSON, dependency, or DOCX fixture was changed.

Final decision: **OPTION B - REQUIRED SECTIONS / ORDER NEXT**.

The strongest next domain is required section and section-order semantics. It owns the largest active rule surface, is a prerequisite for summary/abstract content boundaries, drives the page-numbering transition boundary through `Giriş`, and affects abbreviation/list scope. The current implementation has good normalization foundations, but it still begins from broad document-scope paragraph candidates and then matches expected section names. That is useful and tested, yet it is also the highest-value place to reduce false confidence before adding deeper content validators.

Secondary next domain: **SUMMARY / ABSTRACT / KEYWORDS**.

## 2. Starting checkpoint

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `f3b2a9e` |
| origin/main | `f3b2a9e` |
| Commit | `f3b2a9e docs: align figure semantics after level 3 cleanup` |
| Initial working tree | clean |

Known baseline remains: experimental rule set `46`, golden `46/46`, golden score `100%`, diagnostics `0`, corpus `31 regression / 11 exploratory`, missing validator `0`, duplicate resolved rule ID `0`, figure semantics LEVEL 3 complete.

## 3. 46-rule inventory summary

Experimental selection resolves to 46 enabled rules:

| Type | Count |
| --- | ---: |
| `FONT_FAMILY` | 1 |
| `FONT_SIZE` | 1 |
| `HEADING` | 3 |
| `LINE_SPACING` | 1 |
| `PARAGRAPH_ALIGNMENT` | 1 |
| `MARGIN` | 4 |
| `HEADING_ALIGNMENT` | 1 |
| `PARAGRAPH_INDENTATION` | 1 |
| `HEADING_LEVEL_FORMAT` | 1 |
| `PAGE_NUMBER` | 1 |
| `PAGE_NUMBER_SEQUENCE` | 1 |
| `REQUIRED_SECTION` | 13 |
| `SECTION_ORDER` | 1 |
| `HEADING_NUMBERING` | 1 |
| `CONDITIONAL_REQUIRED_SECTION` | 3 |
| `SECTION_WORD_COUNT` | 2 |
| `SECTION_KEYWORDS` | 2 |
| `OBJECT_ALIGNMENT` | 2 |
| `OBJECT_CAPTION_PLACEMENT` | 2 |
| `OBJECT_CAPTION_FORMAT` | 2 |
| `OBJECT_IN_TEXT_REFERENCE` | 2 |

Inventory details:

- Typography/body formatting/margins/heading formatting: 14 rules.
- Page numbering domain: 2 rules.
- Required sections/order/heading numbering: 15 rules.
- Summary/abstract/keywords: 6 rules when counting required-section presence, word count, and keyword rules.
- Abbreviation presence: 1 active production rule.
- Table/figure object and caption/reference domain: 8 rules, with figure semantics already closed by 4E-18P/18Q.

## 4. Validator inventory

Production registry maps all 46 resolved rules to validators. Validator count in active registry classes is 19:

| Validator | Production role | Main facts read | Depth |
| --- | --- | --- | --- |
| `FontFamilyValidator` | body visible text font family | paragraphs/runs/effective formatting | structural |
| `FontSizeValidator` | body visible text size | paragraphs/runs/effective formatting | structural |
| `LineSpacingValidator` | body line spacing | body paragraphs/effective paragraph formatting | structural |
| `AlignmentValidator` | body paragraph alignment | body paragraphs/effective alignment | structural |
| `MarginValidator` | page margins | page section margins | structural |
| `HeadingValidator` | style-named Heading1/2/3 formatting | heading style/runs | structural |
| `HeadingAlignmentValidator` | academic heading alignment | `document.headings` | semantic/structural |
| `HeadingLevelFormatValidator` | trusted level-0 academic heading format | `document.headings` | semantic/structural |
| `HeadingNumberingValidator` | rule-defined academic heading levels | `document.headings` | semantic/structural |
| `ParagraphIndentationValidator` | academic body paragraph indentation | section ranges/body paragraphs | structural |
| `PageNumberValidator` | PAGE field presence/location/alignment | header/footer PAGE fields | static OOXML |
| `PageNumberSequenceValidator` | front/main page-number format/restart | sections + `pageNumbering.sections` | static OOXML + inferred boundary |
| `RequiredSectionValidator` | section presence | `document.sections` + matcher | semantic text |
| `SectionOrderValidator` | relative order and duplicates | `document.sections` + matcher | semantic text |
| `ConditionalRequiredSectionValidator` | conditional list section presence | document facts + sections | mixed |
| `SectionWordCountValidator` | section content word count | section boundary helper + word count | semantic text |
| `SectionKeywordsValidator` | keyword line count and placement | section content + keyword parser | semantic text |
| `ObjectAlignmentValidator` | table/figure object alignment | table facts / semantic figure representations | structural/semantic |
| Object caption/reference validators | placement, format, in-text reference | captions, associations, object references | semantic/structural |

`AbbreviationListConsistencyValidator` exists but is not mapped to any current production rule ID in the 46-rule experimental set.

## 5. Coverage matrix

| Rule group | Rules | Implementation | OOXML evidence | Regression coverage | FP risk | FN risk | Production trust |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Typography/font | 2 | COMPLETE | STRONG | STRONG | LOW | LOW | HIGH |
| Body spacing/alignment/indent | 3 | COMPLETE | STRONG | STRONG | LOW | MEDIUM | HIGH |
| Margins | 4 | COMPLETE | STRONG | STRONG | LOW | LOW | HIGH |
| Heading format/alignment/numbering | 6 | COMPLETE | STRONG | STRONG | MEDIUM | MEDIUM | HIGH |
| Page number field | 1 | PARTIAL | MODERATE | STRONG | MEDIUM | MEDIUM | MEDIUM |
| Page number sequence | 1 | COMPLETE | STRONG for `pgNumType`, MODERATE for section binding | STRONG | MEDIUM | MEDIUM | MEDIUM |
| Required sections | 13 | PARTIAL | MODERATE | MODERATE | MEDIUM | MEDIUM | MEDIUM |
| Section order | 1 | PARTIAL | MODERATE | MODERATE | MEDIUM | MEDIUM | MEDIUM |
| Conditional list sections | 3 | SHALLOW | MODERATE | MODERATE | MEDIUM | HIGH | LOW |
| Summary word count | 2 | PARTIAL | MODERATE | MODERATE | MEDIUM | MEDIUM | MEDIUM |
| Summary keywords | 2 | PARTIAL | MODERATE | MODERATE | MEDIUM | MEDIUM | MEDIUM |
| Table/figure object/caption/reference | 8 | COMPLETE | STRONG | STRONG | LOW | MEDIUM | HIGH |

Roll-up:

- COMPLETE: 24
- PARTIAL: 19
- SHALLOW: 3
- MISSING: 0

Production trust:

- HIGH: 24
- MEDIUM: 19
- LOW: 3

## 6. False-confidence findings

1. Required-section matching starts from all document-scope non-TOC, non-table-cell paragraphs. Exact normalized text matching is safe against substrings, but a normal paragraph whose whole text equals a required heading can still satisfy a presence rule unless further heading evidence is required.
2. `RequiredSectionValidator` only checks presence. It does not inspect content, duplicate sections, heading style, page boundary, or section body emptiness.
3. `SectionOrderValidator` checks relative order among located expected sections and detects duplicate expected sections, but missing sections are delegated to separate required-section rules. That is correct ownership, but it can make order PASS when required presence FAILS.
4. `SectionWordCountValidator` and `SectionKeywordsValidator` return `NOT_APPLICABLE` when the section is missing. This avoids duplicate failures but relies on required-section rules remaining enabled and correctly matched.
5. `PageNumberValidator` proves a PAGE field exists in a header/footer part and that the containing paragraph has alignment metadata. It does not prove rendered physical bottom-center placement on each page.
6. Conditional list rules can look strong in golden while only proving section presence under a document fact. List content consistency is intentionally not covered.
7. Abbreviation presence uses an uppercase-token heuristic. It has exclusions for captions, table cells, lists, TOC, and figure carriers, but it does not understand acronym definitions, common institutional terms, or unused listed entries.

False-confidence count: **7**.

## 7. Page numbering analysis

Current implementation:

- `headerFooterXmlParser` parses `w:fldSimple` and complex `w:instrText` whose instruction starts with `PAGE`.
- It records source header/footer part, location, field structure, and containing paragraph alignment.
- `documentXmlParser` parses paragraph-level and final body-level `w:sectPr`.
- `w:pgNumType/@w:fmt` and `@w:start` are normalized into `pageNumbering.sections`.
- `PageNumberValidator` checks required PAGE field, expected location, and expected paragraph alignment.
- `PageNumberSequenceValidator` maps the transition section to the containing page-number section and checks before/from format plus optional restart.

Answers:

- Page number presence: yes, by PAGE field in header/footer XML.
- Number format: yes, statically through `w:pgNumType/@w:fmt` for supported `decimal` and `lowerRoman`.
- Start number: yes, through `w:pgNumType/@w:start`.
- Section restart: yes, when section properties are present and can be mapped to the transition section.
- Front/main distinction: inferred from the transition section, currently `Giriş`.
- Real PAGE field: yes for simple and complex field instruction forms in header/footer parts.
- Header/footer placement: part location is known; physical page placement is not rendered.
- Rendering dependency: exact visual bottom-center location, first/even/odd page behavior, linked headers/footers across sections, and actual page count/rendered page assignment are not fully proven by static OOXML alone.

Readiness:

- Parser readiness: HIGH for static OOXML facts.
- Normalized model readiness: MEDIUM.
- Validator readiness: MEDIUM.
- Test infrastructure readiness: HIGH.
- Source grounding readiness: HIGH.
- Implementation complexity: HIGH for deeper section-aware header/footer behavior.
- Expected product value: MEDIUM/HIGH.
- Regression risk: MEDIUM/HIGH.

## 8. Required sections analysis

Current implementation:

- `documentSectionsParser` creates a `DocumentSection` candidate for each document-scope paragraph with non-empty normalized text, excluding TOC entries and table cells.
- `sectionNameMatcher` normalizes Turkish/case/diacritics and supports manual numeric prefixes like `1.`, `1.1.`, `1.1.1.`.
- `markRequiredSectionHeadings` marks rule-defined section headings and excludes caption paragraphs from the section list.
- `RequiredSectionValidator` checks whether any section candidate matches the expected section or aliases.
- `SectionOrderValidator` locates expected sections, detects duplicate expected section occurrences, and checks relative paragraph order.
- Corpus fixtures cover TOC/textbox/alternate-content/footnote collisions and automatic heading numbering.

Gaps:

- Presence does not require heading style, heading numbering, isolated heading paragraph, or `isRuleDefinedHeading`.
- Empty section content is not a required-section failure.
- Some semantic boundaries are handled downstream by `sectionContent`, but required-section itself is still a name-presence check.
- Duplicate handling is stronger in order/word-count/keyword/page-sequence validators than in required-section presence.

Readiness:

- Parser readiness: HIGH.
- Normalized model readiness: MEDIUM/HIGH.
- Validator readiness: MEDIUM.
- Test infrastructure readiness: HIGH.
- Source grounding readiness: HIGH.
- Implementation complexity: MEDIUM.
- Expected product value: HIGH.
- Regression risk: MEDIUM.

## 9. Summary/abstract/keywords analysis

Current implementation:

- `summary-tr` and `summary-en` are `REQUIRED_SECTION` rules.
- `summary-tr-word-count` and `summary-en-word-count` use `SectionWordCountValidator`.
- `summary-tr-keywords` and `summary-en-keywords` use `SectionKeywordsValidator`.
- `getSectionContentParagraphs` uses the next rule-defined section as the boundary.
- `sectionKeywordsParser` requires exact label before `:` and configured separators.

Answers:

- Section detection: uses shared section matcher; reliable when section headings are reliable.
- Content boundaries: yes, by next rule-defined section.
- Empty section: word count can fail if `min` exists, but current rules only set `max: 200`, so empty summary is not directly failed by word-count.
- Keyword line: yes, exact configured label plus colon.
- Keyword count: yes, 3-5.
- Separator normalization: comma only by config.
- Duplicate keywords: not checked.
- Turkish/English pairing: not checked.
- Typography/semantics separation: mostly separated.
- TOC/body false positives: inherits section pipeline protections and risks.

Readiness:

- Parser readiness: MEDIUM/HIGH.
- Normalized model readiness: MEDIUM.
- Validator readiness: MEDIUM.
- Test infrastructure readiness: MEDIUM.
- Source grounding readiness: HIGH.
- Implementation complexity: MEDIUM.
- Expected product value: HIGH.
- Regression risk: MEDIUM.

## 10. Abbreviations analysis

Current implementation:

- `documentAbbreviationsNormalizer` detects uppercase/numeric tokens with at least two uppercase letters.
- It reads body paragraphs via `getBodyParagraphs` and excludes captions, table cells, lists, TOC, and figure carriers.
- `list-of-abbreviations` is a `CONDITIONAL_REQUIRED_SECTION` rule using `hasAbbreviations`.
- `AbbreviationListConsistencyValidator` exists and can compare detected body abbreviations with parsed list entries, but no production rule currently uses it.

Answers:

- List presence: yes, conditionally.
- Actual list entries: parser helper exists for consistency validator, not active in the 46-rule production set.
- Body usage vs list matching: validator exists but inactive.
- Undefined abbreviation: inactive.
- Unused listed abbreviation: not implemented.
- Case sensitivity: uppercase-token based.
- Punctuation: token regex handles letters/numbers and hyphenated uppercase tokens.
- Common words/acronym false positives: medium/high risk.
- Turkish characters: Unicode uppercase support exists.
- Scope: body helper exclusions exist, but deeper semantic abbreviation definition is not modeled.

Readiness:

- Parser readiness: MEDIUM.
- Normalized model readiness: LOW/MEDIUM.
- Validator readiness: LOW for production, MEDIUM for dormant consistency validator.
- Test infrastructure readiness: MEDIUM.
- Source grounding readiness: MEDIUM; SOURCE_RECHECK_REQUIRED before enabling consistency.
- Implementation complexity: MEDIUM/HIGH.
- Expected product value: MEDIUM/HIGH.
- Regression risk: HIGH.

## 11. Other candidate findings

No other candidate outranks the four requested domains for the next production validation track. Bibliography/citation consistency and object-list content consistency remain documented future opportunities, but current source grounding and parser safety make them less feasible than section semantics.

## 12. Dependency graph

Observed dependency graph:

```text
required section semantics
-> section order
-> summary/abstract word-count and keyword boundaries
-> page-number transition section binding
-> academic front-matter/main-content scope
-> object applicability front-matter suppression
-> abbreviation/list section boundary safety
```

Abbreviation consistency also depends on section boundary safety because the list section must be excluded from body abbreviation usage.

## 13. OOXML feasibility boundaries

STATIC OOXML FACT:

- `w:sectPr`
- `w:pgNumType/@w:fmt`
- `w:pgNumType/@w:start`
- header/footer part location
- PAGE field instruction text
- paragraph `w:jc`
- paragraph/table/textbox/TOC/revision visibility markers already normalized elsewhere

INFERRED DOCUMENT FACT:

- transition from front matter to main content through a matched `Giriş` section.
- section content boundaries from one rule-defined heading to the next.
- abbreviation presence from uppercase-token heuristic.

RENDERING-DEPENDENT FACT:

- physical page number position on the rendered page.
- whether a footer is visually bottom-center after margins/tabs/section inheritance.
- actual page where a section starts.

UNRELIABLE WITHOUT WORD/LIBREOFFICE:

- rendered pagination, page count, exact visual location, and natural page-flow effects.

## 14. Not-applicable semantics

Current semantics are mostly intentional:

- Required section absence is `FAILED`.
- Section order can `PASSED` with missing sections, because missing is owned by required-section rules.
- Word count and keyword rules are `NOT_APPLICABLE` when their section is absent.
- Conditional list sections are `NOT_APPLICABLE` when the triggering fact is false.
- Page sequence is `NOT_APPLICABLE` when the transition section is missing.

Audit risk: these ownership boundaries are sensible, but report trust depends on the prerequisite required-section rule being reliable and enabled.

## 15. Corpus coverage

Corpus coverage by candidate:

- Page numbering: positive golden plus `experimental-page-number-fail.docx` and `experimental-page-sequence-fail.docx`; strong targeted negative coverage for current static scope.
- Required sections/order: golden plus many collision/scope fixtures such as TOC, textbox, alternate-content, footnote exploratory, automatic heading numbering, and section-order smoke coverage; moderate/strong, but fewer isolated real-DOCX missing/duplicate section fixtures than the importance of the domain suggests.
- Summary/abstract/keywords: golden plus split-run keyword reconstruction and validator smoke checks; moderate. Missing duplicate keywords, empty summary, misplaced keywords, and language-pair cases are gaps.
- Abbreviations: golden detects `DNA`; split-run fixture covers body reconstruction; positive/negative abbreviation fixture references exist in test plan/corpus history, but production only enforces list presence. Undefined/unused/list-entry matching lacks active production coverage.

## 16. Golden limitations

Golden `46/46` does not prove:

- required-section false positives cannot occur from prose paragraphs with exact section-like text.
- duplicate required sections are always surfaced by every relevant rule.
- empty `Özet` / `Abstract` content fails when only `max: 200` word-count is configured.
- duplicate or semantically poor keywords fail.
- page numbers are physically rendered at bottom center on every page.
- first/even/odd header/footer inheritance is correct for every section.
- abbreviation list contents match all body abbreviations.
- unused listed abbreviations are detected.

## 17. Source grounding readiness

| Domain | Readiness | Note |
| --- | --- | --- |
| Page numbering | HIGH | Existing source supports footer/center and roman-to-decimal sequence; deeper rendering claims need restraint. |
| Required sections/order | HIGH | Guide section structure and study-type section order are already modeled. |
| Summary/abstract/keywords | HIGH | 200-word and 3-5 keyword requirements are already grounded. |
| Abbreviations | MEDIUM | Presence is grounded; consistency/undefined/unused checks need SOURCE_RECHECK_REQUIRED before production enablement. |

## 18. Domain comparison

| Domain | Parser | Model | Validator | Tests | Source | Complexity | Value | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Page numbering | HIGH | MEDIUM | MEDIUM | HIGH | HIGH | HIGH | MEDIUM/HIGH | MEDIUM/HIGH |
| Required sections/order | HIGH | MEDIUM/HIGH | MEDIUM | HIGH | HIGH | MEDIUM | HIGH | MEDIUM |
| Summary/abstract/keywords | MEDIUM/HIGH | MEDIUM | MEDIUM | MEDIUM | HIGH | MEDIUM | HIGH | MEDIUM |
| Abbreviations | MEDIUM | LOW/MEDIUM | LOW/MEDIUM | MEDIUM | MEDIUM | MEDIUM/HIGH | MEDIUM/HIGH | HIGH |

## 19. Selected next domain

Selected next domain: **Required Sections / Section Order**.

Why:

- It has the largest active structure-rule surface: 13 required-section rules plus section order and downstream heading/page/summary dependencies.
- It is a prerequisite for reliable summary boundaries, page-number sequence transition, academic scope, and abbreviation-list boundary safety.
- It has clear source grounding and manageable implementation complexity.
- It can reduce false confidence without requiring a rendering engine.
- It unlocks safer later validators.

## 20. Secondary next domain

Secondary next domain: **Summary / Abstract / Keywords**.

Reason: once section identity and boundaries are hardened, summary/abstract content validation can add high product value with lower false-positive risk.

## 21. Next implementation phase design

Proposed phase: **Phase 4F-02 - Required Section Semantics Hardening and Boundary Foundation**.

Exact goal:

- Strengthen section identity and boundary confidence for required sections and section order without broadening academic rule semantics.

Parser changes expected:

- Add explicit section-candidate confidence metadata, such as exact heading-like paragraph, manual/Word numbering evidence, style evidence, and exclusion reason.
- Preserve current exact normalized text matching but distinguish candidate paragraph from confirmed rule-defined section heading.

Normalized model changes expected:

- Extend `DocumentSection` with confidence/source fields if needed.
- Preserve `isRuleDefinedHeading` and `isObjectReferenceExcluded`, but make downstream validators able to require confirmed section identity.

Validators affected:

- `RequiredSectionValidator`
- `SectionOrderValidator`
- `SectionWordCountValidator`
- `SectionKeywordsValidator`
- `PageNumberSequenceValidator`
- `academicDocumentScopeNormalizer`

Tests required:

- Exact required heading positive.
- Body prose exact-title false positive.
- Duplicate required section.
- Missing section plus order ownership.
- Numbered manual heading.
- Word-numbered heading.
- TOC/textbox/table-cell/revision collision preservation.
- Summary boundary regression.
- Page transition section binding regression.

Fixtures required:

- Prefer synthetic DOCX fixtures derived from `full-correct.docx`; do not mutate existing fixtures in-place.
- Add focused negative fixtures only after parser design is approved.

Production risks:

- Over-tightening section identity could create false missing-section failures for valid documents with plain unstyled headings.
- Section hardening could affect page sequence, summary boundaries, body paragraph filtering, and object scope.

Explicit non-goals:

- No bibliography/citation grammar.
- No rendered page-start validation.
- No summary language-quality/NLP validation.
- No abbreviation consistency enablement.
- No figure semantics reopening.

## 22. Production source invariant

This phase did not modify `src/`.

Verification results:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; existing Vite chunk-size warning only |
| `npm run test:golden` | PASS; `46/46` |
| `npm run test:corpus` | PASS; `31 regression, 11 exploratory fixture` |

## 23. Files changed

- `docs/PHASE_4F_01_NEXT_VALIDATION_DOMAIN_SELECTION_AND_COVERAGE_GAP_AUDIT.md`

No audit script was added because the repository facts were already inspectable through existing code, rule JSON, test plan, fixture manifest, golden, and corpus harnesses.

## 24. Final decision

**OPTION B - REQUIRED SECTIONS / ORDER NEXT**.

## 25. Recommended next phase

Recommended next phase: **Phase 4F-02 - Required Section Semantics Hardening and Boundary Foundation**.
