# PHASE 4F-04 - Abbreviations and Symbols Semantic Consistency Foundation

## 1. Executive summary

Phase 4F-04 reviewed the `Simgeler ve Kısaltmalar Listesi` domain and implemented only source-grounded semantic hardening.

The active production rule remains a conditional section-presence rule: if abbreviation use is detected, the combined symbols/abbreviations list section must exist. This phase migrates that section lookup to the shared `AcademicSectionOccurrence` model and adds a minimal reusable `AcademicTermEntry` parser/fact model for abbreviation-list entries. It does not enable production body-to-list consistency, first-use expansion, unused-entry failure, alphabetical ordering, or symbol semantic validation.

Final decision: **OPTION B - SEMANTIC FOUNDATION COMPLETE, CONSISTENCY BOUNDED BY SOURCE**.

## 2. Starting state

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `f3b2a9e` |
| origin/main | `f3b2a9e` |
| Working tree | Phase 4F-01, 4F-02, and 4F-03 changes preserved |

Baseline before this phase: 46 active rules, golden `46/46`, score `100%`, diagnostics `0`, corpus `31 regression / 11 exploratory`.

## 3. Source grounding

Official source metadata and repository audits support only the conditional list-section requirement:

- Primary grounding: `tests/audit/data/comuFoodTechnologyPrimaryRuleGrounding.json`, rule `comu.applied-sciences.food-technology.bachelor.list-of-abbreviations`, evidence: abbreviations used -> list required.
- Secondary grounding: `docs/UNIVERSITY_RULES.md` and department README state the rule checks section presence only.
- `docs/UNIVERSITY_RULES.md` explicitly says the active rule does not validate list completeness, definitions, alphabetical ordering, body/list one-to-one matching, symbol semantic correctness, or first-use expansion.

Potential checks:

| Check | Classification | Decision |
| --- | --- | --- |
| Abbreviation list presence | SOURCE_DIRECT | Keep production rule |
| Symbol list presence | SOURCE_DIRECT only as combined section heading | No separate symbol rule |
| Alphabetical ordering | NOT_SOURCE_SUPPORTED | Not implemented |
| Definition format | SOURCE_DERIVED for reusable facts only | Parser foundation only |
| Body abbreviation must appear in list | NOT_SOURCE_SUPPORTED for production | Not enabled |
| Listed abbreviation must appear in body | NOT_SOURCE_SUPPORTED | Not implemented |
| First-use expansion | SOURCE_DIRECT text exists, but high NLP risk and not list consistency | Not implemented |
| Duplicate entries | SOURCE_DERIVED evidence only | Preserve occurrences |
| Conflicting definitions | SOURCE_DERIVED evidence only | Preserve, no fail |
| Symbol consistency | NOT_SOURCE_SUPPORTED | Not implemented |

## 4. Related rules

| Rule ID | Type | Expected | Validator | Source grounding | Current status |
| --- | --- | --- | --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.list-of-abbreviations` | `CONDITIONAL_REQUIRED_SECTION` | `Simgeler ve Kısaltmalar Listesi` when `hasAbbreviations=true` | `ConditionalRequiredSectionValidator` | Primary direct for conditional presence | Active |

Dormant infrastructure:

| Rule type | Validator | Production registration |
| --- | --- | --- |
| `ABBREVIATION_LIST_CONSISTENCY` | `AbbreviationListConsistencyValidator` | Not mapped to any active rule ID |

## 5. Previous implementation

Previously, `ConditionalRequiredSectionValidator` evaluated the triggering fact and then looked for matching headings in `document.sections` through the raw section-name matcher. This was presence-only.

The dormant `AbbreviationListConsistencyValidator` was content-aware and body-consistency-aware, but not source-enabled in the active 46-rule set.

## 6. Conditional list semantics

The active semantics remain:

- `hasAbbreviations=false` -> `NOT_APPLICABLE`
- `hasAbbreviations=true` and declared list section exists -> `PASSED`
- `hasAbbreviations=true` and declared list section missing -> `FAILED`

The rule must not become “list always required.”

## 7. Section semantic reuse

`ConditionalRequiredSectionValidator` now uses `findDeclaredAcademicSectionOccurrencesByNames`. The abbreviation list section identity therefore comes from the shared `AcademicSectionOccurrence` source of truth, including TOC/textbox/deleted/table-cell protections already established in 4F-02.

No independent abbreviation-section scanner was added.

## 8. Entry model

Added minimal reusable model:

- `AcademicTermEntry`
- `kind: abbreviation | symbol`
- `term`
- `normalizedTerm`
- `definition`
- `paragraphId`
- `paragraphIndex`
- `blockIndex`
- `sourceSectionId`
- `sourceSectionIdentity`
- `confidence`
- `status: valid | malformed`
- `parsingEvidence`

The model is a semantic fact foundation, not a new production failure surface.

## 9. Parsing rules

Supported abbreviation entry separators are the already-conservative forms:

- `AB<TAB>Definition`
- `AB  Definition` with aligned whitespace
- `AB - Definition`
- `AB: Definition`

The parser operates on normalized visible paragraph text, so split runs reconstruct correctly before parsing.

## 10. Normalization

Term normalization is conservative:

- Unicode NFC
- NBSP to normal space
- trim
- repeated whitespace collapse

Case is not folded. `DNA`, `Dna`, and `dna` are not normalized into the same term.

## 11. Body usage scope

No production body-to-list consistency validator was enabled.

The existing `hasAbbreviations` document fact still uses `getBodyParagraphs` with exclusions for captions, table cells, lists, TOC, and declared figure carrier paragraphs. Header/footer and textbox content are outside body scope. Bibliography/reference exclusion is not separately implemented for the conditional presence fact.

## 12. Token matching

No raw substring matching was added. Existing abbreviation detection tokenizes Unicode letters/numbers/hyphenated tokens and requires at least two uppercase letters.

The regression verifies that `AB` is not matched as a substring inside `LABORATUVAR`.

## 13. Symbol semantics

The active source only names the combined `Simgeler ve Kısaltmalar Listesi` section. It does not define automatable symbol entry grammar, symbol-body matching, or symbol consistency requirements.

Symbol entries are therefore not parsed by default and no symbol production validator was added.

## 14. Duplicate handling

`parseAcademicTermEntries` preserves duplicate occurrences. It does not collapse immediately to `Map<string, Entry>`.

Duplicate/conflicting definitions remain evidence for future audits, not production failures.

## 15. Malformed entries

Entries with a recognizable abbreviation term but empty/malformed definition are represented with `status: malformed` and `confidence: low`.

This distinguishes:

- section missing
- section present but empty
- entries missing
- malformed entries
- valid entries present

Production presence still depends only on the source-supported section rule.

## 16. Consistency direction

No production consistency direction was enabled:

- body -> list: not source-supported enough for production
- list -> body: not source-supported
- first use -> expansion: not implemented
- unused entries: not implemented

## 17. Unsupported potential checks

Unsupported as production failures:

- alphabetical order
- every body abbreviation must be listed
- every listed abbreviation must be used
- duplicate entry failure
- conflicting-definition failure
- symbol-body matching
- first-use expansion validation
- broad uppercase-token academic inference

## 18. Validator migration

Migrated:

- `ConditionalRequiredSectionValidator` section lookup from raw `document.sections` matching to shared declared academic-section occurrences.

Not migrated/enabled:

- `AbbreviationListConsistencyValidator` remains dormant because no active rule maps to it.

## 19. Evidence

Production evidence remains focused on missing section evidence for failed conditional presence.

Entry parser evidence includes source section identity, paragraph identity/index, valid/malformed status, and separator evidence. Large document text is not exposed.

## 20. Diagnostics

No new report diagnostics were added. Duplicate/malformed entry facts are kept as parser-level evidence.

Golden diagnostics remain expected at `0`.

## 21. Coverage before/after

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

The three SHALLOW rules remain conditional list-section rules. This phase improves semantic lookup for one of them but does not promote metadata because the conditional trigger and list content remain bounded.

## 22. Focused regression

Added:

- `tests/audit/abbreviationSymbolsSemanticRegression.cjs`

Covered:

- semantic section ownership
- boundary extraction
- TOC exclusion
- deleted revision exclusion
- textbox exclusion
- duplicate preservation
- malformed entries
- split-run entries
- substring false-positive protection
- punctuation and Turkish Unicode abbreviation detection
- case-sensitive normalization
- symbol parsing not enabled by default

## 23. Fixtures

No DOCX fixtures were added or modified.

The focused regression uses deterministic synthetic XML and parser-level structures.

## 24. Previous-domain regressions

Required previous-domain regressions:

- `node tests/audit/requiredSectionSemanticsRegression.cjs`
- `node tests/audit/summaryAbstractKeywordsSemanticRegression.cjs`
- `node tests/audit/legacyFigureLevel3CleanupRegression.cjs`
- `node tests/audit/postLevel3DocumentationAlignmentAudit.cjs`

## 25. Golden

Golden target remains `46/46`.

## 26. Corpus

Corpus target remains `31 regression / 11 exploratory`.

## 27. Typecheck/lint/build

Required gates:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

The existing Vite chunk warning remains non-blocking.

## 28. Remaining limitations

- `hasAbbreviations` is still heuristic and can treat all-uppercase body words as abbreviation-like tokens.
- First-use expansion is not validated.
- Body-to-list and list-to-body consistency are not production rules.
- Bibliography/reference sections are not separately excluded from the conditional abbreviation fact.
- Symbol entries and symbol usage are not semantically validated.
- Entry parser foundation is not surfaced in the report UI.

## 29. Next domain

Recommended next domain: page-number sequence / front-matter transition hardening, because it can reuse the same semantic section source.

## 30. Final decision

**OPTION B - SEMANTIC FOUNDATION COMPLETE, CONSISTENCY BOUNDED BY SOURCE**.

## 31. Recommended next phase

**PHASE 4F-05 PAGE NUMBER SEQUENCE SEMANTIC TRANSITION HARDENING**.
