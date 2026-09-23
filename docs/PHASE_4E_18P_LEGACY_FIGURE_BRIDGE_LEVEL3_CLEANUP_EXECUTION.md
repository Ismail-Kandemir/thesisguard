# PHASE 4E-18P - Legacy Figure Bridge LEVEL 3 Cleanup Execution

## 1. Executive summary

Phase 4E-18P executes the LEVEL 3 cleanup approved in Phase 4E-18O.

Final decision: **OPTION B - LEVEL 3 COMPLETE WITH HISTORICAL TEST REFERENCES**.

The production legacy figure bridge is removed. Academic figure identity, figure structural evidence, anchor coverage, diagnostics, and front-matter behavior now flow through the semantic model only.

This document is the current authority for production figure bridge retirement. LEVEL 3 is complete for the production architecture described here.

## 2. Starting checkpoint

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `14ce5be` |
| origin/main | `14ce5be` |
| Commit | `14ce5be feat: harden academic object semantics and report trust` |
| Initial status | Expected uncommitted 18M, 18N, and 18O work only |
| Initial diff check | PASS; line-ending warnings only |

## 3. 18O decision

18O decision was `OPTION B`: LEVEL 3 cleanup ready with test migration. Remaining blockers were the inactive figure caption-format fallback, legacy parser/type/plumbing, and historical test/audit introspection.

## 4. Pre-cleanup inventory

Production definitions/writers before cleanup:

- `DocumentFigureOccurrence`
- `DocumentFigures`
- `NormalizedDocument.figures`
- `documentCaptionsNormalizer.parseFigures()`
- legacy figure branch in `associateCaptionOccurrences()`
- `documentXmlParser` figure plumbing

Compatibility reader before cleanup:

- `ObjectCaptionFormatValidator` non-pilot figure branch.

Test/audit readers before cleanup were the 11 files listed in 18O.

## 5. Removed production surfaces

Removed from production source:

- `DocumentFigureOccurrence`
- `DocumentFigures`
- `NormalizedDocument.figures`
- `document.figures`
- `document.figures.items`
- `document.figures.count`
- `document.figures.hasFigures`
- `parseFigures()`

## 6. Removed compatibility branch

`ObjectCaptionFormatValidator` now routes all figure caption-format evaluation through semantic declared/matched figure captions. The table path still uses existing table occurrence behavior.

## 7. Parser cleanup

`documentCaptionsNormalizer` no longer extracts figure occurrences. It still parses:

- blocks;
- captions;
- tables;
- semantic object representations/resolutions.

Table caption association remains intact. Semantic DrawingML parsing remains in `objectSemanticsNormalizer`.

## 8. Type cleanup

`NormalizedDocument` no longer exposes `figures`. Figure-specific legacy collection and occurrence types were removed. `FigureDrawingType` remains because semantic object representations still use it.

## 9. Test/audit migration

Runtime test/audit usage of `document.figures` was migrated to:

- `document.objectSemantics.representations`;
- `document.objectSemantics.associations`;
- `document.objectSemantics.resolutions`;
- `getDeclaredAcademicFigures()`.

Exact legacy names remain only in static absence guards and historical docs.

## 10. Semantic independence proof

`semanticFigureStructuralEvidenceMigrationRegression.cjs` passes without constructing fake legacy figure state. It proves:

- declared semantic figures drive validators;
- generic drawings do not become academic figures;
- deleted/moveFrom drawings remain invisible;
- inserted/moveTo drawings remain visible;
- table golden behavior remains passed.

## 11. Alignment result

Preserved:

- declared inline pass/fail behavior;
- declared anchor is not physically evaluable;
- anchor coverage reports relevant/evaluated/unevaluated counts semantically;
- inline plus anchor produces partial coverage;
- generic inline/anchor drawings do not create academic figure identity.

## 12. Caption placement result

Figure placement uses `ObjectCaptionAssociation.position`. Correct placement passes, wrong placement fails, and unresolved generic drawings do not create placement failures. Table placement remains unchanged.

## 13. Caption format result

Figure caption format uses semantic declared/matched figure captions only. The legacy fallback is removed. Table caption format remains unchanged.

## 14. In-text reference result

Figure references use semantic declared figure identities and semantic representation evidence. Generic drawings do not create reference requirements. Table reference behavior remains unchanged.

## 15. List-of-figures result

`hasFigures` conditional applicability is semantic: declared academic figure presence controls the rule. Generic drawings alone do not require a figure list.

## 16. Anchor result

Anchor coverage remains semantic:

- generic anchor: not a figure;
- declared figure anchor: academic figure, physical alignment not evaluable;
- coverage remains trust metadata only.

## 17. Revision visibility

Preserved:

- `w:del`: invisible;
- `w:moveFrom`: invisible;
- `w:ins`: visible;
- `w:moveTo`: visible.

## 18. Front-matter

Front-matter generic objects do not trigger main-content figure rules. Main-content declared figures keep normal semantic behavior. Unknown scope behavior remains conservative.

## 19. Diagnostics

Diagnostics remain semantic and separate from `RuleResult`.

Preserved diagnostic codes:

- `UNRESOLVED_ACADEMIC_OBJECT`
- `UNSUPPORTED_OBJECT_REPRESENTATION`
- `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION`
- `AMBIGUOUS_ACADEMIC_OBJECT`

## 20. Coverage

Coverage states remain:

- `complete`
- `partial`
- `none`

Coverage remains trust metadata and does not affect score arithmetic.

## 21. Rule evidence

Figure object evidence now uses `ObjectRepresentationOccurrence`. `DocumentFigureOccurrence` is no longer accepted by `createObjectEvidence()`.

## 22. Table isolation

Preserved:

- `DocumentTableOccurrence`
- `DocumentTables`
- `document.tables`
- table alignment
- table caption placement
- table caption format
- table in-text reference
- list-of-tables

## 23. Static absence proof

`node tests/audit/legacyFigureLevel3CleanupRegression.cjs` PASS.

Post-cleanup `src/` search for the exact legacy bridge patterns returned zero hits:

- `DocumentFigureOccurrence`
- `DocumentFigures`
- `NormalizedDocument.figures`
- `document.figures`
- `figures.items`
- `figures.count`
- `figures.hasFigures`
- `parseFigures`

## 24. Golden

`npm.cmd run test:golden`: PASS, `46/46`.

Golden score: `100%`.

Golden diagnostics: `0`.

## 25. Corpus

`npm.cmd run test:corpus`: PASS, `31 regression, 11 exploratory fixture`.

## 26. Audit chain

Passed:

- 18C: `figureCaptionFormatPilotMigration.cjs`
- 18D: `unresolvedAcademicObjectDiagnosticRegression.cjs`
- 18F: `frontMatterAcademicScopeRegression.cjs`
- 18H: `anchoredObjectValidationApplicabilityGuard.cjs`
- 18I: `partialRuleApplicabilityCoverageRegression.cjs`
- 18J: `ruleCoverageTrustUxRegression.cjs`
- 18L: `legacyFigurePresenceRetirementRegression.cjs`
- 18N: `semanticFigureStructuralEvidenceMigrationRegression.cjs`
- 18O: `legacyFigureLevel3ReadinessAudit.cjs`
- 18P: `legacyFigureLevel3CleanupRegression.cjs`

## 27. Browser result

Static browser audit: PASS.

Browser runtime attempt:

- `npm.cmd run test:browser-report`
- Result: `BROWSER_RUNTIME_UNAVAILABLE`
- Reason: browser exited before assertions with code `2147483651`; runner timed out waiting for browser debugging endpoint.

## 28. DOCX safety

No `.docx` files became modified during the phase.

## 29. Remaining legacy figure debt

Remaining production legacy figure debt: **NONE**.

Historical docs and static absence guards still mention exact legacy names.

## 30. LEVEL 3 final state

LEVEL 3 is complete for production architecture:

- academic figure identity: semantic;
- figure structural evidence: semantic;
- anchor coverage: semantic;
- diagnostics: semantic;
- front-matter scope: semantic;
- table architecture preserved.

## 31. Known limitations

Browser runtime is unavailable in this local session before assertions. The static browser report audit passed.

Some historical audit labels still describe earlier phase terminology, but runtime dependency on the removed production bridge is gone.

## 32. Recommended next phase

Recommended next phase: **Phase 4E-18Q - Post-LEVEL 3 Historical Audit Wording Cleanup and Documentation Alignment**.
