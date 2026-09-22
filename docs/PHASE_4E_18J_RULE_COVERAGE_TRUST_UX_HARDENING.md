# Phase 4E-18J - Rule Coverage Trust UX Hardening

## 1. Executive summary

Karar: **OPTION A - Rule coverage trust UX is production-ready.**

Bu faz, 4E-18I coverage modelini degistirmeden rapor sunumunu sertlestirdi. Compliance outcome ve evaluation coverage ayri kalir; UI, partial veya relevant-but-zero-evaluable durumlarini metinsel olarak gorunur bicimde niteler.

## 2. Starting state

- Branch: `main`
- HEAD: `c16ecc2`
- origin/main: `c16ecc2`
- Calisma agaci beklenen sekilde kirliydi.
- 4E-18D/E/F/G/H/I local degisiklikleri korundu.
- Stage, commit, push, stash, reset veya restore yapilmadi.

## 3. 18I coverage contract

18I contract aynen korundu:

- outcome: `PASSED | FAILED | NOT_APPLICABLE`
- coverage: `complete | partial | none`
- coverage score aritmetigine katilmaz
- ilk production coverage integration yalniz `figure-object-alignment`

## 4. UX ambiguity/problem

18I baseline UX:

- `PASSED + complete`: normal PASSED kart, coverage mesaji yok.
- `FAILED + complete`: normal FAILED kart, coverage mesaji yok.
- `PASSED + partial`: badge ve detay icinde not vardi; fakat mapper JSX icindeydi.
- `FAILED + partial`: badge ve detay notu vardi; failure primary kaldi.
- `N/A + no relevant`: normal N/A.
- `N/A + relevant/zero-evaluable`: badge vardi, fakat trust summary partial kadar net degildi.

Ana risk, `PASSED` etiketinin partial coverage'i gorsel olarak fazla bastirmasiydi.

## 5. Outcome vs coverage presentation

Outcome hala primary status olarak render edilir. Coverage yalniz qualifier olarak gosterilir. UI dorduncu status uretmez.

## 6. UX semantic matrix

| Case | Primary label | Coverage label | Supporting sentence | Trust implication | Diagnostic expected |
|---|---|---|---|---|---|
| PASSED + complete | Basarili | none | existing message | rule scope evaluated | no |
| FAILED + complete | Basarisiz | none | existing evidence | proven failure | no |
| PASSED + partial | Basarili | Kismi degerlendirme | evaluable objects passed; some not verified | qualified pass | often yes |
| FAILED + partial | Basarisiz | Kismi degerlendirme | proven failure plus unevaluated objects | failure remains primary | often yes |
| N/A + no relevant | Uygulanamaz | none | existing N/A message | no relevant scope | no |
| N/A + relevant/zero-evaluable | Uygulanamaz | Otomatik dogrulanamadi | relevant object found, auto validation unavailable | manual review may be needed | often yes |

## 7. PASSED + complete

Normal PASSED UX remains. No "Tam degerlendirme" badge is shown, so golden stays clean.

## 8. FAILED + complete

Normal FAILED UX remains. Coverage does not distract from evidence or correction guidance.

## 9. PASSED + partial

Rule card shows `Kismi degerlendirme` and visible summary:

`Degerlendirilebilen nesnelerde ihlal bulunmadi; 1 ilgili nesne otomatik olarak dogrulanamadi.`

Details include the numeric count, e.g. `2 ilgili nesneden 1'i otomatik olarak degerlendirildi.`

## 10. FAILED + partial

Rule card keeps FAILED primary. Coverage summary says:

`Kural basarisiz; ayrica 1 ilgili nesne otomatik olarak dogrulanamadi.`

It does not imply unevaluated objects failed.

## 11. N/A no relevant object

Ordinary N/A remains ordinary. No coverage badge/noise is added for `relevantCount=0`.

## 12. N/A relevant-but-unevaluable

Rule card shows `Otomatik dogrulanamadi` and explains:

`Ilgili nesne bulundu ancak bu kural otomatik olarak dogrulanamadi.`

This distinguishes it from ordinary no-scope N/A without changing status.

## 13. Coverage count wording

The presentation helper handles:

- `1/1`: `1 ilgili nesneden 1'i otomatik olarak degerlendirildi.`
- `1/2`: `2 ilgili nesneden 1'i otomatik olarak degerlendirildi.`
- `0/1`: `1 ilgili nesneden hicbiri otomatik olarak degerlendirilemedi.`
- `0/2`: `2 ilgili nesneden hicbiri otomatik olarak degerlendirilemedi.`
- `2/3`: `3 ilgili nesneden 2'si otomatik olarak degerlendirildi.`

## 14. Presentation mapper

Yeni saf mapper:

- `src/features/analysis/report/ruleCoveragePresentation.ts`

Exports:

- `toRuleCoveragePresentation`
- `getCoverageTrustMessage`
- `hasCoverageTrustQualification`
- `formatCoverageEvaluationCount`

React coverage'i evidence veya diagnostics uzerinden yeniden hesaplamaz.

## 15. Coverage vs diagnostics

Coverage rule-level evaluation scope bilgisidir. Diagnostics object-level manual review bilgisidir. UI bu iki sayiyi esitlemez.

## 16. Manual-review deduplication

Manual review summary halen diagnostics count'a dayanir. Partial coverage summary `unsur` sayisini artirmaz ve diagnostic section'i duplicate etmez.

## 17. Score trust messaging

Trust note, exceptional coverage varsa ek mesaj gosterir:

`Bazi kurallar yalnizca otomatik olarak degerlendirilebilen nesneler uzerinde kontrol edildi. Ilgili fakat dogrulanamayan nesneler icin manuel inceleme gerekebilir.`

Score percentage degismez.

## 18. Rule card hierarchy

Kart sirasi:

1. rule name
2. severity + coverage qualifier + compliance status
3. visible coverage summary when exceptional
4. details: message, expected/actual, coverage detail, evidence, guidance, rule code

## 19. Filters/categories

Filters remain outcome-based: all, FAILED, PASSED, NOT_APPLICABLE. Categories unchanged. No partial category/filter added.

## 20. Accessibility

Coverage state text labels with actual words. Meaning is not color-only. Existing `details`, headings, button semantics remain unchanged.

## 21. Responsive behavior

Coverage badge wraps in existing meta row. Coverage summary and detail use normal wrapping and no fixed width.

## 22. Production-path cases

`ruleCoverageTrustUxRegression.cjs` uses real `analyzeDocx()` output for:

- inline PASS + complete
- inline FAIL + complete
- anchor-only N/A + relevant/unevaluable
- inline PASS + anchor -> PASSED + partial
- inline FAIL + anchor -> FAILED + partial
- golden
- diagnostic-only fixture

Synthetic DOCX packages are generated in memory only.

## 23. Golden UX

Golden remains `46/46`, score `100`, diagnostics `0`. Coverage complete payload exists for figure alignment, but no exceptional coverage UI/trust copy is shown.

## 24. Score differential

18J changed presentation only. Counts remain status-based:

| Case | Score/count behavior |
|---|---|
| golden | unchanged, 46/46, 100 |
| inline pass | status-based score unchanged |
| anchor only | N/A remains N/A |
| pass + anchor | partial does not alter passed/failed/N/A/score |
| fail + anchor | failure remains status-based |

## 25. Coverage differential

Coverage payload from 18I is unchanged. 18J maps that payload to UX only.

## 26. Diagnostic differential

Diagnostic production policy and counts are unchanged. Existing diagnostic UX audit remains PASS.

## 27. Existing audit parity

4E-18C/D/E/F/G/H/I audits passed after 18J.

## 28. Quality gates

Passed:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run test:golden`
- `npm.cmd run test:corpus`
- `node tests/audit/ruleCoverageTrustUxRegression.cjs`
- `node tests/audit/partialRuleApplicabilityCoverageRegression.cjs`
- required 4E-18C through 4E-18H and source grounding audits

Build emitted only the existing Vite chunk-size warning.

## 29. Fixture binary state

No tracked DOCX fixture was rewritten in this phase. The six known binary-churn fixtures remain the pre-existing container-byte churn.

## 30. Git diff

New 18J changes:

- `src/features/analysis/report/ruleCoveragePresentation.ts`
- `src/features/analysis/report/components/AnalysisReportView.tsx`
- `src/features/analysis/report/components/AnalysisReportView.css`
- `tests/audit/ruleCoverageTrustUxRegression.cjs`
- this document

New 18J validator changes: none. Parser changes: none. Scoring changes: none.

## 31. Remaining limitations

- No browser screenshot/visual regression suite was added.
- Coverage UX is generic, but only figure alignment currently emits production coverage.
- Future object rules should adopt coverage one by one with rule-specific domain semantics.

## 32. Phase decision

**OPTION A - Rule coverage trust UX is production-ready.**

## 33. Recommended next phase

**Phase 4E-18K - Browser-Level Report Visual Regression**

The next safest step is visual regression coverage before broadening coverage semantics to more validators.
