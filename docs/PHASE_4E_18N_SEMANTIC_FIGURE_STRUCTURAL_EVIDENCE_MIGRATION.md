# PHASE 4E-18N - Semantic Figure Structural Evidence Migration

## 1. Executive summary

Phase 4E-18N completes the prerequisite migration identified in 4E-18M. Production figure validators no longer need `DocumentFigureOccurrence`, `document.figures`, or `document.figures.items` for figure structural evidence.

Final decision: **OPTION A - MIGRATION COMPLETE**.

Legacy figure surfaces are intentionally retained for now. This is not LEVEL 3 cleanup. The migrated production path is:

```text
OOXML
-> ObjectRepresentationOccurrence
-> semantic structural evidence
-> ObjectCaptionAssociation / CaptionOccurrence
-> AcademicObjectResolution
-> figure validators
```

## 2. Starting checkpoint

Verified before implementation:

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `14ce5be` |
| origin/main | `14ce5be` |
| Commit | `14ce5be feat: harden academic object semantics and report trust` |
| Initial status | only allowed untracked 18M document |

Initial status:

```text
?? docs/PHASE_4E_18M_LEGACY_FIGURE_BRIDGE_DEPENDENCY_AND_LEVEL3_READINESS.md
```

## 3. 18M prerequisite

18M found:

- legacy academic identity dependency: `NO`
- legacy structural evidence dependency: `YES`
- affected production validators: `figure-object-alignment`, `figure-caption-placement`, `figure-in-text-reference`
- anchor coverage candidate counting depended on `document.figures.items`
- diagnostics and front-matter scope were already semantic-only
- table semantics must remain unchanged

## 4. Previous dependency graph

Before 18N:

```text
AcademicObjectResolution(declared figure)
-> getDeclaredAcademicFigures()
-> findStructuralFigureOccurrence()
-> document.figures.items
-> DocumentFigureOccurrence
-> figure validator evidence / alignment / placement / reference / coverage
```

## 5. New semantic structural evidence contract

`ObjectRepresentationOccurrence` now carries the minimal structural evidence needed by figure validators:

- `paragraphId`
- `paragraphIndex`
- `blockIndex`
- `drawingType`
- `alignment`
- `alignmentSource`

Representation identity remains `ObjectRepresentationOccurrence.id`. Academic identity remains separate in `AcademicObjectResolution`. Caption identity and caption position remain separate in `CaptionOccurrence` and `ObjectCaptionAssociation`.

No figure-specific assumption was added to generic representation identity. A generic `w:drawing` still does not become an academic figure without declared semantic resolution.

## 6. Parser/data-flow changes

`objectSemanticsNormalizer` now computes drawing alignment evidence directly during semantic OOXML traversal. It does not read `document.figures` or `DocumentFigureOccurrence`.

The alignment behavior mirrors the existing structural parser:

- inline drawing only;
- exactly one non-textbox drawing in the paragraph;
- paragraph must be empty;
- direct paragraph alignment becomes `paragraph` source;
- otherwise `unknown`.

Style-based fallback remains in `ObjectAlignmentValidator`, using the semantic representation paragraph identity.

## 7. Academic identity invariants

Academic figure identity still requires:

```text
AcademicObjectResolution.status === "declared"
AND AcademicObjectResolution.academicType === "figure"
```

`drawingType`, representation kind, alignment, and caption proximity do not establish academic figure identity by themselves.

## 8. Alignment migration

`figure-object-alignment` now uses `getDeclaredAcademicFigures()` semantic entries and evaluates semantic representations.

Evidence source changed from `DocumentFigureOccurrence` to `ObjectRepresentationOccurrence`. Coverage source also moved to semantic representations.

Table alignment path remains unchanged.

## 9. Caption placement migration

`figure-caption-placement` now uses semantic declared figure representations plus `ObjectCaptionAssociation.position`.

`captionPosition` was not duplicated onto the representation model. The validator derives the figure placement view from semantic association.

Table caption placement path remains unchanged.

## 10. In-text reference migration

`figure-in-text-reference` now builds figure object evidence from semantic declared figure representation plus the matched semantic/legacy caption bridge by paragraph.

Reference search semantics were not broadened. Table reference behavior remains unchanged.

## 11. Anchor coverage migration

Anchor coverage no longer reads `document.figures.items`.

Coverage now counts:

- declared semantic inline figures as evaluated;
- declared semantic anchors as relevant but unevaluated;
- undeclared visible main-content anchor picture candidates with adjacent figure captions as relevant but unevaluated;
- generic uncaptioned anchors as not relevant;
- front-matter anchors as not relevant;
- deleted/moveFrom anchors as invisible because semantic representations are not produced for them.

## 12. Caption association behavior

Semantic caption association remains the source for matched/missing/ambiguous/conflicting/not-attempted states. No legacy occurrence ID is used by semantic association.

Caption placement derives above/below from association position. Caption format pilot continues to use semantic association and semantic captions.

## 13. Revision visibility

Revision visibility remains shared and semantic:

- `w:del` invisible
- `w:moveFrom` invisible
- `w:ins` visible
- `w:moveTo` visible

No second visibility implementation was added.

## 14. Front-matter behavior

Front-matter scope remains separate from structural evidence. Generic front-matter objects do not become academic figures and do not trigger main-content figure rules.

## 15. Diagnostics

Diagnostics remain semantic-only through `buildAnalysisDiagnostics(objectSemantics)`.

Preserved codes:

- `UNRESOLVED_ACADEMIC_OBJECT`
- `UNSUPPORTED_OBJECT_REPRESENTATION`
- `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION`
- `AMBIGUOUS_ACADEMIC_OBJECT`

Diagnostics still do not alter score arithmetic.

## 16. Coverage

Coverage remains trust metadata only. No coverage-adjusted score was introduced.

Preserved states:

- `complete`
- `partial`
- `none`

## 17. Table isolation

Table paths were intentionally left unchanged:

- table alignment still uses `DocumentTableOccurrence`;
- table caption placement still uses table occurrence caption position;
- table caption format still uses the existing table path;
- table in-text reference still uses table occurrences;
- table rule results remain golden-passing.

## 18. Test/mock migration

The golden synthetic `createNegativeDocument()` mock was migrated to include semantic figure representation, semantic caption, association, and resolution facts. This avoids keeping production fallback behavior solely for old mock shape compatibility.

The new focused audit also proves semantic behavior with misleading or empty legacy figure data.

## 19. Legacy surfaces intentionally retained

The following were not removed in 18N:

- `DocumentFigureOccurrence`
- `DocumentFigures`
- `NormalizedDocument.figures`
- `document.figures.items`
- `document.figures.count`
- `document.figures.hasFigures`
- legacy parser extraction in `documentCaptionsNormalizer.ts`

They remain for later LEVEL 3 cleanup evaluation.

## 20. Runtime regression matrix

New focused audit:

```text
node tests/audit/semanticFigureStructuralEvidenceMigrationRegression.cjs
PASS
```

The audit covers inline pass/fail, declared anchor unevaluable coverage, inline+anchor partial coverage, generic inline/anchor non-identity, chart/diagram/group unresolved behavior, caption placement pass/fail, reference present/missing, revision visibility, front-matter suppression, diagnostics separation, score arithmetic, table golden behavior, and static source checks proving migrated validators do not read `document.figures.items/count/hasFigures`.

## 21. Golden result

```text
npm.cmd run test:golden
Golden fixture regression passed: 46/46.
```

Golden score remains `100` and diagnostics remain `0`.

## 22. Corpus result

```text
npm.cmd run test:corpus
Corpus regression passed: 31 regression, 11 exploratory fixture.
```

## 23. Browser/audit chain

Passed:

- `node tests/audit/semanticFigureStructuralEvidenceMigrationRegression.cjs`
- `node tests/audit/figureCaptionFormatPilotMigration.cjs`
- `node tests/audit/unresolvedAcademicObjectDiagnosticRegression.cjs`
- `node tests/audit/frontMatterAcademicScopeRegression.cjs`
- `node tests/audit/anchoredObjectValidationApplicabilityGuard.cjs`
- `node tests/audit/partialRuleApplicabilityCoverageRegression.cjs`
- `node tests/audit/ruleCoverageTrustUxRegression.cjs`
- `node tests/audit/legacyFigurePresenceRetirementRegression.cjs`
- `node tests/audit/browserReportVisualRegressionAudit.cjs`

Browser runtime regression was attempted twice:

```text
npm.cmd run test:browser-report
```

Both attempts failed at the local browser/CDP connection layer, not at an assertion:

- first: `read ECONNRESET`, browser process exited with code `2147483651`
- second: `Browser WebSocket connection failed`, browser process exited with code `2147483651`

The stuck Node child processes from the failed browser attempts were stopped. No DOCX fixture churn was introduced.

## 24. Known limitations

- Legacy figure surfaces still exist and are still populated.
- `ObjectCaptionFormatValidator` retains its non-pilot legacy branch for non-production/generic compatibility; the production 4E-18C figure-caption-format pilot remains semantic.
- Browser runtime regression could not be verified in this local browser session because the browser process failed before assertions.

## 25. LEVEL 3 readiness after 18N

LEVEL 3 is now ready from the production figure validator structural evidence perspective.

Remaining cleanup can focus on removing or retiring legacy figure surfaces and migrating historical audit/test introspection.

## 26. Recommended next phase

Recommended next phase: **Phase 4E-18O - Legacy Figure Bridge LEVEL 3 Cleanup Planning and Removal Audit**.

The next phase should decide exact deletion scope for `DocumentFigureOccurrence`, `DocumentFigures`, legacy `parseFigures()`, and compatibility/test-only surfaces without changing table semantics, score arithmetic, diagnostics, or rule metadata.
