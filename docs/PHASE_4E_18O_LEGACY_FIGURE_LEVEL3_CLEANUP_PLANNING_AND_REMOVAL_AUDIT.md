# PHASE 4E-18O - Legacy Figure LEVEL 3 Cleanup Planning and Removal Audit

## 1. Executive summary

Phase 4E-18O audited the repository after Phase 4E-18N to decide whether legacy figure bridge surfaces can move to LEVEL 3 cleanup.

Final decision: **OPTION B - LEVEL 3 CLEANUP READY WITH TEST MIGRATION**.

Production academic figure identity and the migrated figure validators no longer require `DocumentFigureOccurrence`, `DocumentFigures`, `NormalizedDocument.figures`, or `document.figures.items`. However, the legacy figure parser/type surface is still produced, historical tests and audits still inspect it, and `ObjectCaptionFormatValidator` still contains an inactive non-pilot figure compatibility branch that can read `document.figures.items`.

Post-18P superseded note: this sentence records the 18O checkpoint before cleanup execution. Phase 4E-18P subsequently removed the legacy parser/type/plumbing surfaces and the inactive figure caption-format compatibility branch. In the current production architecture, the legacy figure bridge is absent.

## 2. Starting checkpoint

Verified before the audit:

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `14ce5be` |
| origin/main | `14ce5be` |
| Commit | `14ce5be feat: harden academic object semantics and report trust` |

The starting working tree contained the expected local 18N/18M changes and no DOCX fixture changes.

## 3. 18L and 18N baseline

18L established:

- phase decision: `OPTION A`;
- retirement level: `LEVEL 2`;
- generic `w:drawing` does not establish academic figure identity;
- production figure presence comes from semantic resolution;
- legacy `DocumentFigureOccurrence` remained a structural bridge only.

18N then completed the prerequisite semantic structural evidence migration:

- `figure-object-alignment` uses semantic `ObjectRepresentationOccurrence` evidence;
- `figure-caption-placement` uses semantic association position;
- `figure-in-text-reference` uses semantic representation evidence;
- anchor coverage candidate counting uses semantic representations;
- table paths were unchanged.

## 4. Legacy surface inventory after 18N

Remaining production writer surfaces:

- `DocumentFigureOccurrence` in `src/features/analysis/types/index.ts`;
- `DocumentFigures` in `src/features/analysis/types/index.ts`;
- `NormalizedDocument.figures` in `src/features/analysis/types/index.ts`;
- `parseFigures()` in `src/features/analysis/parsers/documentCaptionsNormalizer.ts`;
- the figure branch of `associateCaptionOccurrences()` in `documentCaptionsNormalizer.ts`;
- `figures: visualStructure.figures` in `src/features/analysis/parsers/documentXmlParser.ts`.

Remaining source reader surface:

- `src/features/analysis/rules/validators/ObjectCaptionFormatValidator.ts` has a non-pilot figure compatibility branch that reads `document.figures.items`.

Current production rule metadata uses the pilot rule id `comu.applied-sciences.food-technology.bachelor.figure-caption-format`, so the active figure caption-format path is semantic. The remaining reader is still production code, but it is not active for the current production figure rule.

## 5. Active production identity and applicability

`src/features/analysis/rules/objectApplicability.ts` is semantic-only:

- `hasFigurePresenceForConditionalRequirement()` returns `getDeclaredAcademicFigures(document).length > 0`;
- `getDeclaredAcademicFigures()` reads `document.objectSemantics.resolutions`;
- no fallback to `document.figures.items`, `document.figures.count`, or `document.figures.hasFigures` remains.

Therefore `document.figures.count` and `document.figures.hasFigures` are dead as production academic figure facts.

## 6. Figure validators

| Rule | 18O status |
| --- | --- |
| `figure-object-alignment` | Semantic representation evidence; coverage semantic; no legacy figure read. |
| `figure-caption-placement` | Semantic representation plus association position; no legacy figure read. |
| `figure-caption-format` | Active pilot path semantic; residual non-pilot compatibility branch still reads legacy figures. |
| `figure-in-text-reference` | Semantic representation evidence; no legacy figure read. |
| `list-of-figures` | `hasFigures` fact resolves through semantic declared figures. |

## 7. Semantic parity for LEVEL 3 removal

Current semantic facts cover the figure structural data needed by production validators:

| Legacy field | Semantic replacement |
| --- | --- |
| `id` | `ObjectRepresentationOccurrence.id` |
| `paragraphId` | `ObjectRepresentationOccurrence.paragraphId` |
| `paragraphIndex` | `ObjectRepresentationOccurrence.paragraphIndex` |
| `blockIndex` | `ObjectRepresentationOccurrence.blockIndex` |
| `drawingType` | `ObjectRepresentationOccurrence.drawingType` |
| `alignment` | `ObjectRepresentationOccurrence.alignment` plus style fallback |
| `alignmentSource` | `ObjectRepresentationOccurrence.alignmentSource` plus style fallback |
| `captionId` | `ObjectCaptionAssociation.captionId` / `AcademicObjectResolution.captionId` |
| `captionPosition` | `ObjectCaptionAssociation.position` |

Missing semantic structural facts for current production figure behavior: **NONE**.

## 8. Test and audit dependency inventory

The new non-mutating audit found 11 legacy test/audit dependency files:

- `tests/golden/experimentalGoldenRegression.cjs`
- `tests/audit/alternateContentAudit.cjs`
- `tests/audit/alternateContentResolutionRegression.cjs`
- `tests/audit/anchoredDrawingSemanticOrderingAudit.cjs`
- `tests/audit/drawingMlTextBoxAudit.cjs`
- `tests/audit/figureCaptionFormatPilotMigration.cjs`
- `tests/audit/legacyFigurePresenceRetirementRegression.cjs`
- `tests/audit/objectRepresentationAudit.cjs`
- `tests/audit/objectSemanticCoverageReadinessAudit.cjs`
- `tests/audit/remainingRepresentationAudit.cjs`
- `tests/audit/semanticFigureStructuralEvidenceMigrationRegression.cjs`

Classification: test/audit introspection and compatibility debt, not active academic identity.

## 9. Rule evidence

`createObjectEvidence()` still accepts `DocumentFigureOccurrence | ObjectRepresentationOccurrence` for compatibility, but migrated figure validators pass semantic `ObjectRepresentationOccurrence`. This is a type-level compatibility bridge, not an active figure decision dependency.

## 10. Table isolation

Table semantics must remain untouched in LEVEL 3 cleanup:

- keep `DocumentTableOccurrence`;
- keep `DocumentTables`;
- keep table parsing and table caption association;
- keep table caption format, placement, alignment, reference, and list behavior.

Any cleanup should split the shared table/figure helper paths before deleting figure-only legacy code.

## 11. Dual-state risk

Keeping both `document.figures` and `objectSemantics` creates duplicate structural state. Known divergence areas include revision visibility, `AlternateContent`, anchors, unknown drawings, grouped drawings, textboxes, and caption association.

After 18N, the legacy figure bridge provides no unique production debug value that is not already available through semantic representations, semantic captions, associations, resolutions, diagnostics, coverage, and rule evidence.

## 12. LEVEL 3 target removal

Target removal set:

- remove `DocumentFigureOccurrence`;
- remove `DocumentFigures`;
- remove `NormalizedDocument.figures`;
- remove `parseFigures()`;
- remove the figure branch of `associateCaptionOccurrences()`;
- remove figure return plumbing from `DocumentVisualStructure` and `parseDocumentXml()`;
- remove `DocumentFigureOccurrence` from `createObjectEvidence()` type compatibility;
- remove or replace the non-pilot figure branch in `ObjectCaptionFormatValidator`;
- migrate historical tests/audits to semantic fixtures or semantic assertions.

## 13. Cleanup strategy

Recommended strategy: **SPLIT**.

Suggested execution:

1. Migrate tests/audits and remove the inactive non-pilot figure caption-format compatibility branch.
2. Remove legacy parser/type/plumbing surfaces.
3. Re-run typecheck, lint, build, golden, corpus, 18C-18N focused audits, and browser report verification.

## 14. Runtime verification

| Command | Result |
| --- | --- |
| `node tests/audit/legacyFigureLevel3ReadinessAudit.cjs` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS; existing chunk-size warning only |
| `npm.cmd run test:golden` | PASS; `46/46` |
| `npm.cmd run test:corpus` | PASS; `31 regression, 11 exploratory fixture` |
| `node tests/audit/semanticFigureStructuralEvidenceMigrationRegression.cjs` | PASS |
| `node tests/audit/legacyFigurePresenceRetirementRegression.cjs` | PASS |
| `node tests/audit/figureCaptionFormatPilotMigration.cjs` | PASS |
| `node tests/audit/unresolvedAcademicObjectDiagnosticRegression.cjs` | PASS |
| `node tests/audit/frontMatterAcademicScopeRegression.cjs` | PASS |
| `node tests/audit/anchoredObjectValidationApplicabilityGuard.cjs` | PASS |
| `node tests/audit/partialRuleApplicabilityCoverageRegression.cjs` | PASS |
| `node tests/audit/ruleCoverageTrustUxRegression.cjs` | PASS |
| `node tests/audit/browserReportVisualRegressionAudit.cjs` | PASS |
| `npm.cmd run test:browser-report` | `BROWSER_RUNTIME_UNAVAILABLE`; browser exited before assertions with code `2147483651` and timed out waiting for debugging endpoint |

No tracked DOCX fixture churn was introduced.

## 15. Final answers

1. Phase decision: **OPTION B**.
2. Retirement level: **LEVEL 3 cleanup ready with test migration**.
3. Generic `w:drawing` establishes academic figure identity: **NO**.
4. Production academic figure presence comes from semantic resolution: **YES**.
5. Legacy `DocumentFigureOccurrence` still exists: **YES**, structural/type/parser compatibility only, not academic identity.
6. `figure-object-alignment`: semantic production path, PASS in audit chain.
7. `figure-caption-placement`: semantic production path, PASS in audit chain.
8. `figure-caption-format`: active pilot path semantic; residual non-pilot legacy compatibility branch remains.
9. `figure-in-text-reference`: semantic production path, PASS in audit chain.
10. `list-of-figures`: semantic declared-figure presence through `hasFigures` fact helper.
11. Unresolved picture/chart/diagram/group: no academic figure identity unless declared by semantic resolution; unresolved technical diagnostics preserved where applicable.
12. Anchored drawings: not academic identity by themselves; semantic coverage marks unsupported/unevaluated cases.
13. Deleted/moveFrom: invisible to semantic academic figure identity; inserted/moveTo remains visible.
14. Front-matter: suppressed from main-content academic figure requirements.
15. Diagnostics: preserved.
16. Coverage semantics: preserved.
17. Score arithmetic changed: **NO**.
18. Table semantics changed: **NO**.
19. Golden result: `46/46`, score `100`, diagnostics `0`.
20. Regression corpus: `31 regression PASS`.
21. Exploratory corpus: `11 exploratory PASS`.
22. Browser report regression: static audit PASS; runtime browser unavailable before assertions.
23. 4E-18C-K audit chain: PASS for safe focused audits run in this phase.
24. Remaining architectural limitations: legacy figure writer/parser/type surfaces remain, 11 test/audit files still inspect legacy figures, non-pilot figure caption-format compatibility branch remains, browser runtime unavailable locally.
25. Exact recommended next phase: **Phase 4E-18P - Legacy Figure Bridge LEVEL 3 Cleanup Execution**.

## 16. Final summary

Decision: **OPTION B - LEVEL 3 CLEANUP READY WITH TEST MIGRATION**.

Remaining blocker: migrate/remove legacy test/audit introspection and the inactive non-pilot figure caption-format compatibility branch before deleting parser/type/plumbing surfaces.

Recommended next phase: **Phase 4E-18P - Legacy Figure Bridge LEVEL 3 Cleanup Execution**.

## 17. Post-18P current-state note

The remaining blocker above was historical to 18O. Phase 4E-18P completed the recommended execution phase:

- `DocumentFigureOccurrence`, `DocumentFigures`, `NormalizedDocument.figures`, `document.figures`, and `parseFigures()` were removed from production source.
- Figure caption-format no longer has a legacy figure fallback.
- Historical tests/audits were migrated or converted to static absence guards where appropriate.

Current authority for figure bridge retirement is `docs/PHASE_4E_18P_LEGACY_FIGURE_BRIDGE_LEVEL3_CLEANUP_EXECUTION.md`.
