# Phase 4E-18I - Partial Rule Applicability and Coverage Semantics

## 1. Executive summary

Karar: **OPTION A - Partial applicability/coverage semantics are production-ready for controlled rule adoption.**

Bu faz, compliance sonucu ile evaluation coverage bilgisini ayirdi. `RuleResult.status` mevcut `PASSED | FAILED | NOT_APPLICABLE` semantigini korur; coverage metadata ayri ve ortogonaldir. Ilk production entegrasyonu yalniz `figure-object-alignment` icindir.

## 2. Starting state

- Branch: `main`
- HEAD: `c16ecc2`
- origin/main: `c16ecc2`
- Calisma agaci beklenen sekilde kirliydi.
- 4E-18D/E/F/G/H local degisiklikleri korundu.
- Stage, commit, push, stash, reset veya restore yapilmadi.

## 3. Problem definition

Anchor bir sekil akademik olarak ilgili olabilir, fakat physical alignment icin otomatik olarak guvenle degerlendirilemeyebilir. Eski tek boyutlu sonuc modeli `PASSED` sonucunda kapsam abartisi, `N/A` sonucunda ise ilgili ama unevaluable nesne ayrimini kaybettirme riski tasiyordu.

## 4. Outcome vs coverage

Outcome kuralin compliance sonucudur. Coverage, kuralin ilgili nesne kapsamindan ne kadarinin otomatik degerlendirilebildigini soyler. Coverage dorduncu compliance status degildir.

## 5. Existing RuleResult architecture

`RuleResult` skor, filtreleme ve rule-card durumlari icin `status` ve geriye uyumlu `passed` alanlarini kullanir. `ReportBuilder` skor hesabini yalniz `PASSED` ve `FAILED` sayilarindan yapar.

## 6. Coverage domain model

`RuleResult.coverage?: RuleEvaluationCoverage` eklendi:

- `status`: `complete | partial | none`
- `relevantCount`
- `evaluatedCount`
- `unevaluatedCount`
- `reasons`

Opsiyonel tutuldu; tum 46 kural bu fazda migrate edilmedi.

## 7. Count semantics

Coverage sayilari teknik drawing sayisi degildir. Figure physical alignment icin sayim, normalized document facts uzerinden beyanli/evaluable figure kapsamindadir.

## 8. Relevant object definition

Figure alignment icin relevant object:

- inline ve figure caption ile akademik kimligi kurulmus figure; veya
- gorunur `anchor` picture, front-matter disinda, adjacent declared figure caption ile akademik olarak ilgili gorunen nesne.

Generic unresolved anchor relevant sayilmaz.

## 9. Evaluable object definition

Evaluable figure alignment object, mevcut 4E-18H politikasina gore `drawingType === "inline"` olan ve akademik figure identity tasiyan sekildir.

## 10. Unevaluable object definition

Unevaluable figure alignment object, relevant fakat physical alignment evidence'i desteklenmeyen anchor figure adayidir. Reason bu fazda dar tutuldu: `unsupported-anchored-placement`.

## 11. Complete coverage

Tum relevant nesneler otomatik degerlendirilebildiginde coverage `complete` olur. Inline pass ve inline fail senaryolari complete coverage uretir.

## 12. Partial coverage

En az bir relevant nesne degerlendirilmis, en az bir relevant nesne degerlendirilememisse coverage `partial` olur. Bu durum status'u degistirmez.

## 13. No-evaluable-object case

Relevant nesne var fakat `evaluatedCount=0` ise rule outcome `NOT_APPLICABLE` kalir; coverage `none`, `relevantCount>0`, `unevaluatedCount>0` olur.

## 14. N/A distinctions

`NOT_APPLICABLE + coverage.relevantCount=0` no relevant object demektir. `NOT_APPLICABLE + coverage.relevantCount>0` ilgili nesne bulundugunu fakat otomatik dogrulamanin mumkun olmadigini ifade eder.

## 15. Figure alignment integration

Production entegrasyonu `ObjectAlignmentValidator` ile sinirlidir. Validator inline figure evidence'i degerlendirmeye devam eder; coverage `objectApplicability.ts` helper'i tarafindan uretilir.

## 16. Mixed inline+anchor policy

Inline figure alignment sonucu kullanilir. Anchor figure physical alignment icin failure sayilmaz; coverage partial olarak gorunur ve diagnostics ayri kalir.

## 17. Failed + partial behavior

Inline evaluable figure kesin ihlal ediyorsa status `FAILED` olur. Anchor'in unevaluable olmasi kanitlanmis failure'i silmez.

## 18. Passed + partial behavior

Evaluated inline figure'lar beklenen hizadaysa status `PASSED` olabilir; fakat coverage `partial` ise UI "tum sekiller dogrulandi" iddiasinda bulunmaz.

## 19. Diagnostics relationship

Coverage machine-readable kapsam bilgisidir. Diagnostic, kullaniciya manuel inceleme gerektiren semantic belirsizligi anlatir. Ayni root cause icin yeni duplicate diagnostic uretilmedi.

## 20. Score isolation

Skor aritmetigi degismedi. `ReportBuilder` hala:

- passed = `PASSED`
- failed = `FAILED`
- evaluated = passed + failed
- score = round(passed / evaluated * 100)

Coverage bu hesaba katilmaz.

## 21. Trust UX

Report trust note, partial coverage varsa bazi kurallarin yalniz otomatik degerlendirilebilen nesneler uzerinde kontrol edildigini soyler.

## 22. Rule card UX

Partial coverage icin kucuk `Kismi degerlendirme` rozeti ve sayisal not gosterilir. Relevant-but-zero-evaluable `N/A` icin `Otomatik dogrulanamadi` metni gosterilir.

## 23. Front-matter behavior

Front-matter anchor coverage relevant count'u sisirmez. 4E-18F kapsam davranisi korunur.

## 24. Revision visibility

Deleted ve moveFrom anchor'lar visible semantic representation ile eslesmedigi icin coverage'a girmez. Visible moveTo anchor adjacent declared caption ile relevant-but-unevaluable olabilir.

## 25. Legacy figure isolation

Coverage legacy generic figure presence'a geri donmez. Anchor sayimi, visible semantic representation cross-check'i ve declared figure caption adjacency ile daraltilir.

## 26. Other validator readiness

Caption placement future partial coverage icin adaydir, ancak bu fazda migrate edilmedi. In-text reference ve list-of-figures anchor'i fiziksel kural gibi ele almamalidir; rule-specific coverage gerekir.

## 27. Before/after differential

| Case | Status | Coverage | Diagnostics | Score |
|---|---|---|---:|---:|
| golden | PASSED | complete 1/1 | 0 | 100 |
| inline pass | PASSED | complete 1/1 | 0 | 100 |
| inline fail | FAILED | complete 1/1 | 0 | 0 |
| anchor only | NOT_APPLICABLE | none 0/1 | 1 | 0 |
| mixed pass+anchor | PASSED | partial 1/2 | 1 | 100 |
| mixed fail+anchor | FAILED | partial 1/2 | 1 | 0 |

## 28. Golden

Golden production path remains `46/46`, score `100`, diagnostics `0`. Figure alignment coverage is `complete`.

## 29. Corpus

Corpus regression passed: 31 regression and 11 exploratory fixtures. Existing status expectations stayed unchanged.

## 30. Existing audit parity

4E-18C, 4E-18D, 4E-18E, 4E-18F, 4E-18G and 4E-18H audits passed. Source/grounding audits passed.

## 31. Quality gates

Passed:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run test:golden`
- `npm.cmd run test:corpus`
- `node tests/audit/partialRuleApplicabilityCoverageRegression.cjs`
- required 4E-18C through 4E-18H and source grounding audits

Build emitted only the existing Vite chunk-size warning.

## 32. Fixture binary state

No fixture generator was run in write mode. The six known DOCX binary churn files remain existing local churn and received no intentional semantic edit in this phase.

## 33. Git diff

New/changed 4E-18I files:

- `src/features/analysis/types/RuleResult.ts`
- `src/features/analysis/types/index.ts`
- `src/features/analysis/rules/objectApplicability.ts`
- `src/features/analysis/rules/validators/ObjectAlignmentValidator.ts`
- `src/features/analysis/report/components/AnalysisReportView.tsx`
- `src/features/analysis/report/components/AnalysisReportView.css`
- `tests/audit/partialRuleApplicabilityCoverageRegression.cjs`
- this document

Previous D/E/F/G/H local changes remain unstaged.

## 34. Remaining limitations

- Coverage is implemented only for `figure-object-alignment`.
- Anchor relevance for coverage uses declared adjacent figure caption plus visible semantic representation; it does not claim rendered placement.
- No coverage-adjusted score exists.
- Full expansion to caption placement/list/reference rules remains future work.

## 35. Phase decision

**OPTION A - Partial applicability/coverage semantics are production-ready for controlled rule adoption.**

## 36. Recommended next phase

**Phase 4E-18J - Rule Coverage Trust UX Hardening**

Next step should harden report-level trust presentation and only then consider expanding coverage to caption placement.
