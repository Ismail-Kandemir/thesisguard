# PHASE 4F-05 - Page Number Sequence and Front-Matter Transition Hardening

## 1. Executive summary

Phase 4F-05 strengthens page-number validation using only static DOCX/OOXML facts.

The page-number pipeline now preserves Word section ranges, `sectPr` source, `w:pgNumType` format/start facts, explicit start semantics, header/footer references, relationship-resolved target parts, referenced PAGE field ownership, and inherited header/footer references where statically determinable.

`PAGE_NUMBER_SEQUENCE` now maps its transition section through `AcademicSectionOccurrence` instead of raw section text. No renderer, Word automation, PDF conversion, page-count estimation, or physical layout assertion was added.

Final decision: **OPTION B - STATIC SEMANTICS COMPLETE WITH RENDERING BOUNDARIES**.

## 2. Starting checkpoint

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `5dbffe4` |
| origin/main | `5dbffe4` |
| Working tree | clean |
| Last commit | `5dbffe4 feat: add semantic section validation foundation` |

## 3. Related production rules

| Rule ID | Type | Expected | Validator |
| --- | --- | --- | --- |
| `comu.applied-sciences.food-technology.bachelor.page-number` | `PAGE_NUMBER` | required, footer, center | `PageNumberValidator` |
| `comu.applied-sciences.food-technology.bachelor.page-number-sequence` | `PAGE_NUMBER_SEQUENCE` | before `Giriş`: `lowerRoman`; from `Giriş`: `decimal`; restart `1` | `PageNumberSequenceValidator` |

## 4. Source grounding

SOURCE_DIRECT:

- Page number is required at bottom-center.
- Preliminary pages use lowercase Roman numbering.
- Main text and remaining pages use normal decimal numbering.

SOURCE_DERIVED:

- `Giriş` is the semantic transition section for main matter.
- Official templates support `w:pgNumType w:start="1"` at the `Giriş` transition.
- Static OOXML validation can check Word section metadata and PAGE fields.

RENDERING_DEPENDENT:

- Physical page coordinates.
- Actual rendered page count.
- Whether every rendered page visually shows the expected number.
- Whether a footer paragraph is physically bottom-center after Word layout.

NOT_SOURCE_SUPPORTED:

- Installing/using a renderer to derive page count.
- Validating cached PAGE field result text as authoritative.

## 5. Previous page-number implementation

Previously:

- `documentXmlParser` parsed `w:sectPr` and exposed `pageNumbering.sections` with only `endParagraphIndex`, `format`, and `start`.
- `headerFooterXmlParser` parsed PAGE fields from all header/footer parts.
- `PageNumberValidator` treated any parsed PAGE field as document-level proof.
- `PageNumberSequenceValidator` found the transition through raw `document.sections` matching and inferred decimal when `start` existed without `fmt`.

## 6. OOXML package surfaces

Used surfaces:

- `word/document.xml`
- `word/_rels/document.xml.rels`
- `word/header*.xml`
- `word/footer*.xml`
- `styles.xml` only for existing heading/formatting pipelines

Not added:

- `settings.xml` parsing for even/odd behavior.
- header/footer relationship files beyond `document.xml.rels`.

## 7. Word section model

`PageNumberSection` now carries optional semantic facts:

- `index`
- `startParagraphIndex`
- `endParagraphIndex`
- `source: paragraph | body`
- `format`
- `start`
- `startSemantics`
- `headerFooterReferences`
- `differentFirstPage`

Existing minimal test/mocks remain compatible because new fields are optional.

## 8. sectPr reconstruction

Paragraph-level `w:pPr/w:sectPr` is treated as ending the current Word section at that paragraph.

Body-level final `w:sectPr` is treated as the final section properties from the next paragraph after the previous section break through the end of the document. It is not blindly applied to the whole document.

## 9. pgNumType semantics

The parser preserves actual `w:pgNumType/@w:fmt` values as strings and `@w:start` as numbers.

Missing `w:pgNumType` or missing `w:fmt` is not treated as automatic decimal in the hardened sequence validator.

## 10. start/restart semantics

`w:start` creates `startSemantics: explicit-start`.

Missing start creates `continuation-or-inherited`.

The production restart requirement is satisfied only by explicit start evidence in parsed OOXML. Legacy minimal mocks with `start !== null` are still interpreted as explicit for backward-compatible unit coverage.

## 11. format inheritance

Within static OOXML semantics, missing section format inherits the previous explicit/effective format only when such a format was already established.

The validator does not invent decimal merely because `w:start` exists.

## 12. header/footer relationships

`document.xml.rels` is parsed for internal header/footer relationship targets. Section `headerReference` and `footerReference` elements are resolved to `word/header*.xml` and `word/footer*.xml` targets.

References record:

- header/footer location
- type: `default`, `first`, `even`
- relationship id
- target path
- explicit/inherited/unresolved resolution
- PAGE field count
- PAGE field alignments

## 13. PAGE field detection

PAGE detection remains instruction-aware:

- `w:fldSimple w:instr="PAGE ..."`
- complex `w:instrText` starting with `PAGE`

False proof rejected:

- `NUMPAGES`
- plain footer text such as `1`
- plain text `PAGE`
- unrelated footer part PAGE fields

Cached field result text is not authoritative.

## 14. first/even/default header-footer behavior

Default, first, and even reference types are preserved.

`w:titlePg` is preserved as `differentFirstPage`.

`evenAndOddHeaders` from settings is not parsed in this phase, so rendered even/odd applicability is not claimed.

## 15. academic section mapping

`PAGE_NUMBER_SEQUENCE` now uses `findAcademicSectionOccurrencesByNames` and the shared `AcademicSectionOccurrence` identity source.

The academic normalizer now collects `PAGE_NUMBER_SEQUENCE.expected.transitionSection`.

## 16. front/main transition

The source-grounded transition is:

- front matter before `Giriş`
- main matter from `Giriş`

The validator maps `Giriş` heading paragraph position to the containing Word section and checks section metadata from that point onward.

## 17. static vs rendered boundary

Validated:

- Word section order and ranges from `sectPr`
- static page-number format instructions
- explicit restart instruction
- referenced header/footer PAGE fields
- paragraph alignment inside referenced footer/header part

Out of scope:

- physical page sequence
- rendered bottom-center coordinates
- rendered first/even/odd page behavior
- cached field result correctness

## 18. validator migration

Migrated:

- `PageNumberSequenceValidator` transition lookup: raw `document.sections` -> `AcademicSectionOccurrence`.
- `PageNumberValidator` presence proof: global PAGE fields -> referenced section header/footer PAGE field evidence when section references exist.

## 19. presence semantics

Strong presence evidence:

- PAGE field in a referenced header/footer part for a Word section.

Fallback:

- legacy document-level PAGE fields only when no section header/footer references are available.

`pgNumType` alone is not page-number presence proof.

## 20. format semantics

Format validation uses actual/effective Word section numbering format. Missing format remains unresolved/failing when a source-grounded format is required.

## 21. restart semantics

Restart validation uses explicit `w:start` evidence. Missing start does not pass a restart requirement.

## 22. placement semantics

Static placement validation remains limited to:

- header/footer part ownership
- PAGE field in the expected location
- containing paragraph alignment

Rendered physical placement is out of scope.

## 23. ambiguity/unresolved semantics

Ambiguity is preserved when:

- transition section is missing or duplicated
- Word section cannot be mapped to the transition
- format/start evidence is missing
- relationship target cannot be resolved

Missing evidence is not converted into PASS.

## 24. evidence

Evidence remains bounded and user-readable:

- document-format evidence for format/start failures
- academic section evidence for duplicate transition sections
- section index for page-number section failures

Raw XML is not exposed.

## 25. diagnostics

No new global diagnostics were added. Golden diagnostics remain `0`.

## 26. coverage before/after

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

Page-number semantics are stronger, but rendered layout and first/even/odd behavior remain bounded; no metadata promotion was made.

## 27. focused regression

Added:

- `tests/audit/pageNumberSequenceSemanticRegression.cjs`

Coverage:

- Word section reconstruction
- body-level `sectPr`
- paragraph-level `sectPr`
- `pgNumType` format
- explicit start
- missing start
- PAGE field detection
- NUMPAGES false positive
- footer relationship ownership
- inherited footer handling
- Roman -> decimal transition
- academic section mapping
- rendering boundary safety

## 28. fixtures

No DOCX fixtures were added or modified.

The focused regression uses deterministic synthetic XML only.

## 29. previous-phase regressions

Required:

- `requiredSectionSemanticsRegression`
- `summaryAbstractKeywordsSemanticRegression`
- `abbreviationSymbolsSemanticRegression`
- `legacyFigureLevel3CleanupRegression`
- `postLevel3DocumentationAlignmentAudit`

## 30. existing page-number regressions

Existing page-number coverage remains in:

- `tests/golden/experimentalGoldenRegression.cjs`
- `experimental-page-number-fail.docx`
- `experimental-page-sequence-fail.docx`
- corpus regression

## 31. Golden

Expected: `46/46`, score `100%`, diagnostics `0`.

## 32. Corpus

Expected: `31 regression / 11 exploratory`.

## 33. typecheck/lint/build

Required:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

Existing Vite chunk-size warning is non-blocking.

## 34. files changed

Production source changed:

- `analysisService`
- `docxPackageReader`
- `documentXmlParser`
- `pageNumberingSemantics`
- `academicSectionsNormalizer`
- `PageNumberValidator`
- `PageNumberSequenceValidator`
- shared types

Test/doc additions:

- focused page-number audit
- this phase document

## 35. remaining limitations

- No rendered page count or rendered physical coordinates.
- `settings.xml` even/odd header behavior is not parsed.
- Cached PAGE result text is not trusted.
- Header/footer inheritance is modeled only from available section references.
- Relationship target resolution is limited to internal header/footer relationships.

## 36. next domain

Next domain: page-number diagnostics/trust UX or bibliography/citation semantics, depending on product priority.

## 37. final decision

**OPTION B - STATIC SEMANTICS COMPLETE WITH RENDERING BOUNDARIES**.

## 38. recommended next phase

**PHASE 4F-06 PAGE NUMBER TRUST DIAGNOSTICS OR BIBLIOGRAPHY SOURCE-GROUNDED SEMANTICS SELECTION**.
