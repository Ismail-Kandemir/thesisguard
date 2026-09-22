# Phase 4E-18H - Anchored Object Validation Applicability Guard

## 1. Executive summary

Karar: **OPTION A - Anchored applicability guards are production-ready and physical overclaims are removed.**

Bu faz, anchor nesneler icin fiziksel hizalama ve figure presence overclaim'lerini daraltti. Uretim degisikligi koordinat parse etmez, raw DOCX reparse yapmaz ve Word layout engine eklemez. Guard, normalized `drawingType` ve mevcut semantic resolution uzerinden calisir.

Degisen davranislar:

- `figure-object-alignment`, `wp:anchor` nesneleri artik normal fiziksel hizalama kaniti olarak degerlendirmez.
- `hasFigures` conditional fact'i generic anchored drawing ile tetiklenmez; semantic declared figure varsa veya non-anchor legacy figure varsa true kalir.
- Mixed inline + anchor dokumanda inline fiziksel hizalama degerlendirilir, anchor ise mevcut diagnostic/trust katmaninda gorunur kalir.

## 2. Starting state

- Branch: `main`
- HEAD: `c16ecc2`
- origin/main: `c16ecc2`
- 4E-18D/E/F/G yerel degisiklikleri korunmustur.
- Altı DOCX fixture binary'si 4E-18G sirasinda mevcut audit scriptleri tarafindan yeniden yazilmis durumdaydi.
- Stage, commit, push, reset, restore, stash yapilmadi.

## 3. 4E-18G evidence

4E-18G su bulgulari runtime ile kanitlamisti:

- `wp:inline` ve `wp:anchor` ayrimi korunur.
- `ObjectRepresentationOccurrence.drawingType` bu ayrimi tasir.
- Anchor XML paragraph ownership rendered visual placement degildir.
- Anchor exact page/coordinate/order bilgisi current parser ile bilinmez.
- Caption placement ve caption format anchor icin zaten inline guard tasir.
- Legacy `document.figures.items` generic anchor'i figure sayar.
- Legacy figure path deleted/moveFrom anchor'i sayabilirken shadow object semantics gizler.

## 4. Source requirement vs analyzer capability

Kaynak requirement'i acik olabilir: sekil ortalanmali, sekil basligi altta olmalidir. Bu, analyzer'in `wp:anchor` icin rendered position'i kanitlayabildigi anlamina gelmez. Bu faz kaynak belirsizligi degil, analyzer evidence limitation'i cozer.

## 5. Rule-by-rule applicability matrix

| Rule | Evidence required | Inline safe? | Anchor safe? | Current data source | Guarded behavior | Classification |
|---|---|---:|---:|---|---|---|
| figure-object-alignment | physical horizontal placement | yes | no | legacy figures + paragraph formatting | only inline figures evaluated | ANCHOR_PHYSICAL_LAYOUT_UNSUPPORTED |
| figure-caption-placement | physical above/below | yes | no | legacy inline figure filter | unchanged; anchor N/A | SAFE_WITH_GUARD |
| figure-caption-format | caption paragraph formatting | pilot inline-only | pilot excludes anchor | shadow pilot + legacy paragraph bridge | unchanged | SAFE_WITH_GUARD |
| figure-in-text-reference | reliable caption identity/reference | yes for inline associated | not currently reliable | legacy inline associated captions | unchanged | SAFE_WITH_GUARD |
| list-of-figures | document-wide figure presence | yes | only declared semantic identity | conditional fact | generic anchor no longer triggers | LEGACY_PRESENCE_RISK_GUARDED |
| table rules | table layout/caption/reference | unaffected | n/a | `w:tbl` facts | unchanged | NOT_APPLICABLE |

## 6. Physical vs non-physical semantics

Physical:

- rendered horizontal alignment
- caption above/below visual placement
- page position

Non-physical:

- declared figure identity
- caption text/paragraph format
- in-text reference
- list membership

Anchor is not globally disabled. The guard targets unsupported physical evidence and unsafe generic presence.

## 7. Figure alignment problem

Before 4E-18H, mixed inline + anchor could produce `FAILED` because the anchor entered `figure-object-alignment` as `unknown`. That was not a proven formatting failure; it was unevaluable physical evidence.

After 4E-18H, `ObjectAlignmentValidator` evaluates only inline figure occurrences for figure physical alignment. Drawing counts still include all drawings in a paragraph when resolving inline paragraph alignment, so an inline drawing is not over-trusted if its paragraph contains additional drawings.

## 8. Caption placement problem

No production change was needed. `ObjectCaptionPlacementValidator` already filters figure occurrences to `drawingType === "inline"`. Anchor XML block order is not used as rendered above/below proof.

## 9. Caption format pilot

No production change was made. `ObjectCaptionFormatValidator` keeps the 4E-18C pilot contract:

- declared
- figure
- body
- inline
- matched
- same caption
- format resolvable

Anchor remains excluded because the pilot is intentionally narrow.

## 10. In-text reference

No production change was made. Current implementation consumes associated inline figure captions only. This avoids using ambiguous anchor association as reliable reference identity. A future semantic reference migration can revisit strongly declared anchors separately.

## 11. List-of-figures

`hasFigures` no longer returns true solely because `document.figures.items` contains an anchor. It returns true when:

- semantic resolutions include a declared figure, or
- legacy figure facts include at least one non-anchor figure.

This preserves existing inline behavior while preventing generic anchor/deleted-anchor presence from requiring a `Sekiller Listesi`.

## 12. Legacy figure presence

Legacy `parseFigures()` still records anchor drawings in `document.figures.items`; this was not removed. The guard is at applicability consumption points:

- alignment excludes anchor as physical evidence;
- list-of-figures fact excludes anchor-only legacy presence.

## 13. Revision visibility

Shadow object semantics correctly excludes `w:del` and `w:moveFrom` anchors and preserves visible `w:moveTo` anchors. Legacy figure path may still contain deleted/moveFrom anchors, but guarded `hasFigures` prevents those anchor-only legacy facts from triggering list-of-figures.

## 14. Applicability guard architecture

New helper:

- `src/features/analysis/rules/objectApplicability.ts`

It consumes normalized facts only:

- `DocumentFigureOccurrence.drawingType`
- `NormalizedDocument.objectSemantics.resolutions`

It does not parse raw XML, positions, offsets or coordinates.

## 15. Mixed inline+anchor policy

Contract:

- evaluable inline figure evidence remains evaluated;
- anchor physical evidence is ignored for physical alignment;
- anchor uncertainty remains visible through diagnostics;
- score arithmetic is unchanged.

Runtime mixed case:

| Rule | After |
|---|---|
| figure-object-alignment | `PASSED` for inline evidence |
| figure-caption-placement | `PASSED` for inline evidence |
| figure-caption-format | `PASSED` for inline pilot evidence |
| figure-in-text-reference | `FAILED` if inline figure lacks reference |
| list-of-figures | `FAILED` because inline declared figure exists |
| diagnostics | `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION` for anchor |

## 16. Diagnostic policy

No new diagnostic code was added in this phase. Existing ambiguity diagnostics already surface anchor object-caption uncertainty in report UX without score penalty. Generic unresolved non-anchor diagnostics remain separate.

## 17. Diagnostic deduplication

No duplicate diagnostic class was introduced. Current precedence remains:

- conflicting association -> `AMBIGUOUS_ACADEMIC_OBJECT`
- ambiguous association -> `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION`
- missing association + unresolved kind -> unresolved/unsupported diagnostic

Because anchors produce `ambiguous`, they do not also emit unresolved diagnostics for the same object.

## 18. Front-matter behavior

Front-matter unresolved/generic anchor does not trigger list-of-figures. Existing front-matter suppression for missing unresolved diagnostics is preserved. Ambiguous anchor diagnostics are unchanged from 4E-18G.

## 19. Unknown-scope behavior

Unknown scope is not silently treated as front matter. Generic anchor still does not become a definite figure, but ambiguity diagnostics may remain visible according to existing policy.

## 20. Inline regression safety

Runtime audit proves:

- correct inline centered figure remains `PASSED`;
- wrong inline alignment remains `FAILED`;
- inline caption above remains placement `FAILED`;
- inline caption format pilot remains `PASSED` when format is correct;
- inline figure still triggers list-of-figures.

## 21. Before/after differential

| Case | Before | After | Reason |
|---|---|---|---|
| anchor-only list-of-figures | `FAILED` | `NOT_APPLICABLE` | generic anchor is not safe figure presence |
| deleted anchor list-of-figures | `FAILED` | `NOT_APPLICABLE` | legacy invisible anchor no longer drives conditional fact |
| moveFrom anchor list-of-figures | `FAILED` | `NOT_APPLICABLE` | same revision visibility guard via applicability |
| inline + anchor alignment | `FAILED` | `PASSED` | anchor no longer contaminates physical alignment evaluation |
| anchor placement | `NOT_APPLICABLE` | `NOT_APPLICABLE` | existing guard preserved |
| anchor caption format | `NOT_APPLICABLE` | `NOT_APPLICABLE` | pilot guard preserved |

## 22. Score effects

Score arithmetic implementation did not change. RuleResult applicability changes can affect score naturally:

- anchor-only object-rule subset has no applicable figure rules after guard;
- mixed inline+anchor alignment can improve because the unsupported anchor no longer creates a false failure;
- diagnostics do not affect numerator, denominator, passed, failed or N/A counts.

## 23. Golden

Golden must remain `46/46`, score `100`, diagnostics `0`.

## 24. Corpus

Existing regression corpus should remain passing. No fixture expectation is updated for golden/corpus output.

## 25. Fixture mutation audit

Six DOCX fixture binaries were already modified by existing audit scripts:

- `alternate-content-figure-synthetic.docx`
- `alternate-content-semantic-collision-synthetic.docx`
- `alternate-content-text-synthetic.docx`
- `tracked-deleted-reference-synthetic.docx`
- `tracked-deleted-run-font-size-synthetic.docx`
- `tracked-inserted-run-synthetic.docx`

Read-only comparison against `HEAD` showed:

- file-level SHA-256 changed;
- file sizes stayed identical;
- ZIP entry name sets stayed identical;
- all ZIP entry content hashes stayed identical.

Conclusion: semantic ZIP/XML content did not change; only container bytes/metadata/compression ordering changed. Future fix: make mutation audits write to temp files or compare in memory.

## 26. Existing audits

4E-18D/E/F/G audit contracts are preserved, with 4E-18G updated to the new H production behavior for list-of-figures and mixed alignment.

## 27. Quality gates

Required gates:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:golden`
- `npm run test:corpus`
- `node tests/audit/anchoredObjectValidationApplicabilityGuard.cjs`
- 4E-18D/E/F/G and grounding/source audits

## 28. Git diff

New/changed H files:

- `src/features/analysis/rules/objectApplicability.ts`
- `src/features/analysis/rules/documentFactEvaluator.ts`
- `src/features/analysis/rules/validators/ObjectAlignmentValidator.ts`
- `tests/audit/anchoredObjectValidationApplicabilityGuard.cjs`
- `tests/audit/anchoredDrawingSemanticOrderingAudit.cjs`
- `docs/PHASE_4E_18H_ANCHORED_OBJECT_VALIDATION_APPLICABILITY_GUARD.md`

Scoring arithmetic files were not changed. University rule metadata was not changed.

## 29. Remaining limitations

- Strongly declared anchored figure identity is still blocked by current anchor association ambiguity.
- Partial rule applicability is represented only through existing RuleResult aggregation plus diagnostics.
- Anchor physical placement still cannot be proven without renderer-grade layout evidence.
- Legacy `document.figures.items` still contains anchor occurrences; guards prevent the targeted overclaims but do not retire the legacy model.

## 30. Phase decision

**OPTION A** - The targeted anchored applicability guards are production-ready for the proven issues in this phase.

## 31. Recommended next phase

**Phase 4E-18I - Partial Rule Applicability & Coverage Semantics**

The next gap is expressing partial coverage directly in RuleResult/report semantics instead of relying on a whole-rule result plus diagnostics.
