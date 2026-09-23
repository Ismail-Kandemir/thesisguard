# PHASE 4E-18M - Legacy Figure Bridge Dependency and LEVEL 3 Readiness

## 1. Executive summary

Phase 4E-18M audited the remaining legacy figure bridge after Phase 4E-18L. No production semantics were changed.

Final decision: **OPTION B - LEVEL 3 READY WITH PREREQUISITE MIGRATION**.

Academic figure identity is no longer legacy-dependent, but production validators still depend on `DocumentFigureOccurrence` / `document.figures.items` for structural evidence, physical alignment fields, object evidence IDs, and anchored coverage candidate counting. A safe LEVEL 3 cleanup first needs a narrow structural evidence migration from legacy figure occurrences to semantic object representations or an equivalent semantic structural evidence model.

Post-18P superseded note: this document records the historical state at the end of Phase 4E-18M. Phase 4E-18N migrated figure structural evidence to the semantic model, Phase 4E-18O proved LEVEL 3 cleanup readiness, and Phase 4E-18P completed LEVEL 3 cleanup. In the current production architecture, `DocumentFigureOccurrence`, `DocumentFigures`, `NormalizedDocument.figures`, `document.figures`, and `parseFigures()` no longer exist.

## 2. Starting checkpoint

Verified before audit:

| Check | Result |
| --- | --- |
| Branch | `main` |
| HEAD | `14ce5be` |
| origin/main | `14ce5be` |
| Commit | `14ce5be feat: harden academic object semantics and report trust` |
| Initial working tree | clean |

## 3. 18L baseline

Phase 4E-18L is the source of truth for the current retirement baseline:

- Decision: `OPTION A`
- Retirement level: `LEVEL 2`
- Generic `w:drawing` establishes academic figure identity: `NO`
- Production academic figure identity comes from semantic resolution: `YES`
- Legacy `DocumentFigureOccurrence`: `STRUCTURAL-BRIDGE-ONLY`
- Golden: `46/46`, score `100`, diagnostics `0`
- Regression corpus: `31 regression PASS`
- Exploratory corpus: `11 exploratory PASS`
- Browser regression: `PASS`
- Score arithmetic changed: `NO`
- Table semantics changed: `NO`

18L recommended deciding whether to keep LEVEL 2 permanently or plan a smaller LEVEL 3 cleanup that removes only proven-unused bridge surfaces. This phase answers that recommendation.

## 4. Complete legacy surface inventory

| Surface | Defined in | Written by | Read by | Runtime purpose | Academic identity? | Structural evidence? | Test-only? | Production required? | Removal risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DocumentFigureOccurrence` | `src/features/analysis/types/index.ts` | `parseFigures()` in `documentCaptionsNormalizer.ts` | `objectApplicability.ts`, figure validators, `ruleEvidence.ts`, tests/audits | Figure-like structural occurrence shape | No in semantic path | Yes | No | Yes today | High until evidence migration |
| `DocumentFigures` | `src/features/analysis/types/index.ts` | `normalizeDocumentCaptions()` | `NormalizedDocument.figures`, tests | Collection contract | No | Yes | No | Yes today | Medium/high |
| `NormalizedDocument.figures` | `src/features/analysis/types/index.ts` | `parseDocumentXml()` from visual structure | `objectApplicability.ts`, tests/audits | Legacy bridge collection | No in semantic path | Yes | No | Yes today | High |
| `document.figures.items` | `NormalizedDocument.figures` | `parseFigures()` + caption association | `objectApplicability.ts`, `ObjectCaptionFormatValidator` non-pilot legacy branch, tests/audits | Structural matching, compatibility fallback, anchor candidate counting | No when `objectSemantics` exists | Yes | No | Yes today | High |
| `document.figures.count` | `normalizeDocumentCaptions()` | same | tests/audits | Count parity / introspection | No | Limited | Mostly yes | No direct production consumer found | Low |
| `document.figures.hasFigures` | `normalizeDocumentCaptions()` | same | golden assertion only in source search; production hasFigures fact uses helper | Legacy fact parity | No | No | Mostly yes | No direct production consumer found | Low |
| `parseFigures()` | `documentCaptionsNormalizer.ts` | parser | writes `DocumentFigureOccurrence[]` | Extracts non-textbox `w:drawing`, paragraph/block/drawingType/alignment | No | Yes | No | Yes today | High |
| Legacy figure caption association branch | `associateCaptionOccurrences()` in `documentCaptionsNormalizer.ts` | parser | writes `captionId`/`captionPosition` onto figures | Legacy caption bridge and evidence compatibility | No in semantic path | Yes | No | Yes today | Medium |
| `getDeclaredAcademicFigureOccurrences()` | `objectApplicability.ts` | helper | alignment, placement, body paragraph filtering | Maps semantic declared identity to legacy occurrence | No, selector derives identity semantically first | Yes | No | Yes today | High |
| `getDeclaredAcademicFigureIdentities()` | `objectApplicability.ts` | helper | in-text reference validator | Declared figure caption + legacy occurrence evidence | No | Yes | No | Yes today | High |
| `getDeclaredAcademicFigureCarrierParagraphIds()` | `objectApplicability.ts` | helper | `bodyParagraphs.ts` | Excludes declared figure carrier paragraphs from body text checks | No | Paragraph ownership | No | Yes today | Medium |
| `findStructuralFigureOccurrence()` | `objectApplicability.ts` | helper | `getDeclaredAcademicFigures()` | Joins semantic representation to legacy occurrence by paragraph/block/drawingType | No | Yes | No | Yes today | High |
| Anchor coverage candidate helpers | `objectApplicability.ts` | helper | `getFigurePhysicalAlignmentCoverage()` | Counts visible anchored picture candidates with adjacent figure captions | No | Yes | No | Yes today | High |
| `createObjectEvidence()` figure branch | `ruleEvidence.ts` | validators | report UI consumes evidence | Produces rule evidence from table/figure occurrences | No | Yes | No | Yes today | Medium/high |
| Test/audit legacy introspection | `tests/golden`, `tests/audit` | tests | tests | Regression parity and historical audits | No | Yes | Yes | No | Test migration needed |

Inventory count used for final report: **15 legacy bridge surfaces**. Production-required surfaces today: **10**. Test-only or mostly-test surfaces: **3**. Dead candidates: **2** (`figures.count`, `figures.hasFigures` as production identity facts; both still useful for tests/parity).

## 5. Data-flow classification

| Consumer | Classification | Evidence |
| --- | --- | --- |
| `hasFigurePresenceForConditionalRequirement()` semantic branch | A via semantic model | Uses `getDeclaredAcademicFigures(document).length > 0` when `objectSemantics` exists. |
| `document.figures.items` fallback in `hasFigurePresenceForConditionalRequirement()` | H | Only used when `!document.objectSemantics`. |
| `findStructuralFigureOccurrence()` | B/C | Joins semantic representation to legacy structural occurrence. |
| `ObjectAlignmentValidator` figure branch | B/D/F | Identity is semantic; alignment/evidence/coverage use structural occurrence. |
| `ObjectCaptionPlacementValidator` figure branch | B/F | Uses declared semantic occurrence, then legacy caption position. |
| `ObjectCaptionFormatValidator` pilot branch | A/B via semantic representation and captions | Figure pilot uses semantic resolutions directly, not `DocumentFigureOccurrence`; non-pilot legacy branch remains for generic helper compatibility. |
| `ObjectInTextReferenceValidator` figure branch | B/F | Semantic identity, legacy occurrence for evidence. |
| `ConditionalRequiredSectionValidator` / list-of-figures | A via helper | Reads document fact through `hasFigurePresenceForConditionalRequirement()`. |
| `bodyParagraphs.ts` figure-carrier exclusion | B | Excludes paragraphs carrying declared semantic figures. |
| `academicObjectDiagnostics.ts` | E | Uses only `objectSemantics`. |
| `ruleEvidence.ts` object evidence | F | Shared table/figure occurrence evidence creation. |
| `tests/audit` legacy count readers | G | Regression introspection. |

No production legacy consumer remains in category A. LEVEL 2 retirement is complete for academic identity.

## 6. Call graph

Legacy bridge path:

```text
documentXmlParser.parseDocumentXml()
-> normalizeDocumentCaptions()
-> parseFigures()
-> DocumentFigureOccurrence[]
-> associateCaptionOccurrences()
-> NormalizedDocument.figures
-> objectApplicability bridge helpers
-> ObjectAlignmentValidator / ObjectCaptionPlacementValidator / ObjectInTextReferenceValidator / bodyParagraphs
-> ruleEvidence.createObjectEvidence()
-> AnalysisReportView evidence rendering
```

Semantic path:

```text
documentXmlParser.parseDocumentXml()
-> normalizeDocumentCaptions()
-> normalizeObjectSemantics(xmlDocument, paragraphs, blocks)
-> ObjectRepresentationOccurrence[]
-> CaptionOccurrence[]
-> ObjectCaptionAssociation[]
-> AcademicObjectResolution[]
-> normalizeAcademicDocumentScopes()
-> getDeclaredAcademicFigures()
-> figure applicability / validators / diagnostics
```

The paths intersect in `objectApplicability.ts`, where semantic declared figures are mapped back to `DocumentFigureOccurrence` for structural evidence.

## 7. Semantic model dependency

`objectSemantics` itself does **not** depend on `DocumentFigureOccurrence`.

Evidence:

- `normalizeObjectSemantics(xmlDocument, paragraphs, blocks)` receives raw XML, paragraphs, and blocks; it does not receive `document.figures`.
- `ObjectRepresentationOccurrence.id` is generated as `object-representation-N`.
- Paragraph ownership comes from semantic OOXML traversal through `paragraphIndexByElement`, then paragraph IDs from the shared parsed paragraph list.
- `drawingType` is parsed directly from `wp:anchor` / `wp:inline` in the semantic normalizer.
- Caption association uses representation `blockIndex`, `drawingType`, caption occurrences, paragraphs, and blocks.
- There is no `structuralOccurrenceId` or `representationId -> figureId` persisted bridge field.

If legacy parser extraction were removed today, semantic representations/resolutions/diagnostics could still be produced. However, figure validators that expect `DocumentFigureOccurrence` structural evidence would lose alignment, captionPosition, legacy object IDs, and some anchor coverage candidate machinery unless migrated.

## 8. Validator dependency matrix

| Rule | Academic identity source | Structural evidence source | Legacy figure dependency | Semantic dependency | Can bridge be removed today? | Migration required before removal? | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `figure-object-alignment` | `getDeclaredAcademicFigures()` | `DocumentFigureOccurrence` plus paragraph formatting | Yes: occurrence, alignment fields, paragraph ID, drawingType, coverage anchor candidates | Yes | No | Move alignment/evidence/anchor coverage to semantic representation structural facts | High |
| `figure-caption-placement` | `getDeclaredAcademicFigureOccurrences()` | `DocumentFigureOccurrence.captionPosition` | Yes | Yes | No | Compute placement from semantic association position or add semantic placement evidence | Medium/high |
| `figure-caption-format` | Semantic resolution/association/caption in pilot path | Semantic caption paragraph formatting | No for pilot rule; legacy branch remains for non-pilot generic path | Yes | Mostly yes for this exact production pilot | Remove or replace non-pilot legacy branch after confirming no other figure format rule uses it | Low/medium |
| `figure-in-text-reference` | `getDeclaredAcademicFigureIdentities()` | `DocumentFigureOccurrence` for object evidence | Yes | Yes | No | Evidence can point to semantic representation instead of legacy occurrence | Medium |
| `list-of-figures` | `hasFigurePresenceForConditionalRequirement()` -> semantic declared count | No object evidence | No in production semantic path; fallback exists | Yes | Yes for production, not for compatibility fallback | Remove fallback only after synthetic/mock compatibility migration | Low/medium |

## 9. Anchor dependency

Inline/anchor distinction exists in both models:

- Legacy: `DocumentFigureOccurrence.drawingType`
- Semantic: `ObjectRepresentationOccurrence.drawingType`

Current anchor coverage still depends on legacy bridge because `countDeclaredAnchoredFigureCandidates()` iterates `document.figures.items`, filters `drawingType === "anchor"`, checks semantic visibility/scope for matching anchor pictures, and checks adjacent legacy `DocumentCaption` blocks.

The 4E-18G/H/I behavior can be preserved after LEVEL 3 only if anchor candidate counting is migrated to semantic representations:

```text
semantic representation kind=picture
AND drawingType=anchor
AND academicScope != front-matter
AND not declared
AND adjacent figure caption
=> coverage relevant unevaluated candidate
```

Without that migration, anchor-only declared-candidate behavior (`NOT_APPLICABLE`, coverage `none`, relevant > 0, evaluated = 0, unevaluated > 0) would be at risk.

## 10. Caption association dependency

Semantic caption association does not depend on legacy figure occurrence IDs. It uses:

- `ObjectRepresentationOccurrence.blockIndex`
- `ObjectRepresentationOccurrence.drawingType`
- `CaptionOccurrence.blockIndex`
- paragraph/block adjacency
- `representation.kind` to decide expected academic type

Association states:

- `matched`: single adjacent declared caption with matching academic type.
- `missing`: no adjacent caption.
- `ambiguous`: anchor/non-deterministic position or multiple/unusable candidates.
- `conflicting`: declared caption type conflicts with representation expected type.
- `not-attempted`: textbox scope excluded.

LEVEL 3 cleanup can preserve semantic association. What would break is legacy `DocumentFigureOccurrence.captionId` / `captionPosition` evidence unless validators read semantic `ObjectCaptionAssociation.position` and caption IDs directly.

## 11. Revision visibility dependency

Semantic parser uses `isInsideInvisibleCurrentDocumentRevision()` and excludes `w:del` / `w:moveFrom`, while preserving `w:ins` / `w:moveTo`. Paragraph text parsing uses the same revision visibility module for runs.

Legacy `parseFigures()` does not call revision visibility directly; 4E-18G/18L evidence shows deleted/moveFrom may remain structurally observable in legacy path but no longer become academic identity through semantic resolution.

LEVEL 3 cleanup can preserve deleted/moveFrom invisibility and inserted/moveTo visibility by keeping semantic revision visibility as the source. It may also remove a legacy false-positive structural path.

## 12. Front-matter dependency

Front-matter scope is assigned by `normalizeAcademicDocumentScopes()` using paragraphs, blocks, and required section boundaries. It updates `objectSemantics.representations[].academicScope`.

This is not dependent on `DocumentFigureOccurrence`. LEVEL 3 cleanup should not affect front-matter suppression if semantic `blockIndex` / `paragraphIndex` fields remain.

## 13. Diagnostic dependency

Diagnostics are semantic-only:

- `buildAnalysisDiagnostics(objectSemantics)`
- representation kind/scope/academicScope
- association status/reasons
- resolution status/reasons
- technical evidence from semantic representation

Codes preserved by semantic facts:

- `UNRESOLVED_ACADEMIC_OBJECT`
- `UNSUPPORTED_OBJECT_REPRESENTATION`
- `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION`
- `AMBIGUOUS_ACADEMIC_OBJECT`

Legacy figure occurrences are not required for diagnostic generation.

## 14. Coverage dependency

4E-18I coverage currently depends on both semantic identity and legacy structural bridge:

- `evaluatedCount`: declared semantic figures with `structuralOccurrence !== null` and inline drawing type.
- `relevantCount`: evaluated inline declared figures plus legacy-driven anchored candidates.
- `unevaluatedCount`: anchored candidates counted from `document.figures.items`.

A LEVEL 3 cleanup must migrate coverage counts to semantic representations and maintain `complete`, `partial`, and `none` meanings.

## 15. Table isolation

Table semantics are separate and must not be changed.

Shared infrastructure exists:

- `DocumentTableOccurrence | DocumentFigureOccurrence` union in object validators.
- `associateCaptionOccurrences()` handles both table and figure legacy occurrence branches.
- `createObjectEvidence()` handles table and figure evidence.
- `ObjectCaptionFormatValidator`, `ObjectCaptionPlacementValidator`, and `ObjectInTextReferenceValidator` branch by object kind.

LEVEL 3 cleanup must split or adapt only the figure side. Table occurrence parsing, table caption placement, table caption format, table reference identity, nested-table behavior, and table evidence must remain unchanged.

## 16. Mock/test compatibility

Synthetic normalized documents exist in `tests/golden/experimentalGoldenRegression.cjs`. They manually populate `figures` and also now include empty `objectSemantics` in the empty mock. Some helper fallbacks in `objectApplicability.ts` still support documents without `objectSemantics`, even though the current `NormalizedDocument` type requires it.

Classification:

- Manual fixture documents with `figures`: test compatibility and validator unit coverage.
- `!document.objectSemantics` fallback: backwards compatibility debt for older mocks; not a production necessity in the current parser path.
- Audit scripts reading `document.figures.count/items`: audit introspection and historical parity.

LEVEL 3 needs test migration from legacy occurrence mocks to semantic representation/resolution mocks or a new semantic structural evidence fixture helper.

## 17. Dead surface candidates

No production structural surface is proven dead.

Candidate dead or removable-after-test-migration surfaces:

- `document.figures.hasFigures` as production fact source: no direct production reader found; list-of-figures uses semantic helper through `documentFactEvaluator`.
- `document.figures.count` as production fact source: no direct production reader found; tests/audits use it for parity.
- `!document.objectSemantics` fallback paths in `objectApplicability.ts`: compatibility fallback, not production parser path.

These are not safe to delete blindly because tests and compatibility expectations still reference them.

## 18. LEVEL 3 target architecture

Minimal target architecture:

```text
OOXML
-> ObjectRepresentationOccurrence
-> ObjectCaptionAssociation
-> AcademicObjectResolution
-> semantic figure structural evidence
-> validators / coverage / report evidence
```

To remove `DocumentFigureOccurrence`, semantic structural evidence must cover:

- stable object ID usable in rule evidence;
- paragraph ownership: `paragraphId`, `paragraphIndex`, `blockIndex`;
- `drawingType`;
- physical alignment and alignment source for inline figures;
- caption ID and caption position/association position;
- anchor candidate counting fields;
- report evidence mapping compatible with `ObjectRuleEvidence`.

Do not add unused fields. Most location fields already exist on `ObjectRepresentationOccurrence`; the missing high-risk items are alignment/alignmentSource and validator-ready evidence/caption-position mapping.

## 19. Removal plan

Do not implement in 18M. Proposed future sequence:

1. Add or derive semantic figure structural evidence for alignment, caption position, and report evidence.
2. Migrate `ObjectAlignmentValidator` figure branch to semantic structural evidence.
3. Migrate anchor coverage candidate counting from `document.figures.items` to semantic representations.
4. Migrate `ObjectCaptionPlacementValidator` and `ObjectInTextReferenceValidator` figure evidence away from `DocumentFigureOccurrence`.
5. Remove `!document.objectSemantics` compatibility fallbacks or move them to test-only helpers.
6. Migrate synthetic/mock tests and audit introspection to semantic fixtures.
7. Remove `DocumentFigureOccurrence`, `DocumentFigures`, `parseFigures()`, and figure branch of legacy caption association.
8. Run typecheck, lint, build, golden, corpus, browser report regression, and focused 4E-18C-L audit chain.

## 20. Permanent LEVEL 2 analysis

Permanent LEVEL 2 remains defensible if the project values debug/evidence compatibility over cleanup:

- Benefits: low implementation risk, existing evidence/report behavior stable, tests remain readable, useful parser parity diagnostics.
- Costs: duplicate structural state, legacy false-positive risk if new consumers bypass semantic helpers, maintenance complexity in `objectApplicability.ts`, extra parser work/memory.
- Current assessment: permanent LEVEL 2 is acceptable short-term, but the bridge is now a known architectural debt. LEVEL 3 is worthwhile only after the narrow structural evidence migration above.

## 21. Runtime verification

Static/data-flow audit commands used:

- checkpoint git commands
- targeted file reads for 18L, parser, semantic normalizer, validators, diagnostics, report builder, analysis service
- repo-wide `rg` searches for legacy surfaces and consumers

Quality gates run in this phase:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS; existing Vite chunk-size warning only |
| `npm.cmd run test:golden` | PASS; `Golden fixture regression passed: 46/46.` |
| `npm.cmd run test:corpus` | PASS; `31 regression, 11 exploratory fixture.` |
| `node tests/audit/legacyFigurePresenceRetirementRegression.cjs` | PASS; golden `46/46`, score `100`, diagnostics `0` |

No tracked DOCX-mutating audits were run as part of the audit design.

## 22. Risks

- Removing legacy bridge before migrating alignment/evidence would break figure-object-alignment.
- Removing anchor bridge before semantic anchor coverage migration would regress 4E-18G/H/I coverage behavior.
- Removing legacy object evidence before report evidence migration would alter rule evidence payloads.
- Shared table/figure helper edits could accidentally alter table semantics.
- Synthetic tests may fail if compatibility fallbacks are removed before test fixtures migrate.

## 23. Final decision

**OPTION B - LEVEL 3 READY WITH PREREQUISITE MIGRATION**.

Reason: production academic identity no longer depends on legacy figure presence, but production structural evidence still does. LEVEL 3 can be planned, but direct removal is not safe today.

## 24. Recommended next phase

Recommended next phase: **Phase 4E-18N - Semantic Figure Structural Evidence Migration**.

Goal: migrate figure validator structural evidence, physical alignment, caption-position evidence, and anchor coverage candidate counting from `DocumentFigureOccurrence` to semantic representation/association facts without changing score arithmetic, rule metadata, table semantics, or diagnostics.

## 25. Post-18P current-state note

The LEVEL 2 result and LEVEL 3 readiness decision above are historical 18M findings, not the current repository state. They were superseded by:

- `docs/PHASE_4E_18N_SEMANTIC_FIGURE_STRUCTURAL_EVIDENCE_MIGRATION.md`: production figure structural evidence migrated to semantic `ObjectRepresentationOccurrence` / `ObjectCaptionAssociation` facts.
- `docs/PHASE_4E_18O_LEGACY_FIGURE_LEVEL3_CLEANUP_PLANNING_AND_REMOVAL_AUDIT.md`: LEVEL 3 cleanup readiness proven after test/audit migration planning.
- `docs/PHASE_4E_18P_LEGACY_FIGURE_BRIDGE_LEVEL3_CLEANUP_EXECUTION.md`: LEVEL 3 cleanup executed and production legacy figure bridge removed.

Current source of truth after 18P: academic figure identity, figure structural evidence, anchor coverage, diagnostics, and front-matter scope are semantic. The legacy figure bridge is absent from production source.
