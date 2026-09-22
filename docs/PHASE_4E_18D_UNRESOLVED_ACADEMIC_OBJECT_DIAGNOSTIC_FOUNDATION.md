# Phase 4E-18D — Unresolved Academic Object Diagnostic Foundation

## 1. Executive summary

Bu faz, unresolved/ambiguous akademik nesne belirsizliği için skor dışı ve birinci sınıf diagnostic temelini üretime ekledi. `AnalysisReport.diagnostics`, `RuleResult` alanlarından ayrıdır ve compliance skorunu değiştirmez.

Faz kararı: **OPTION B — Domain/report foundation is safe, but user-facing UI should wait.**

## 2. Starting state

- Dal: `main`
- Başlangıç commit'i: `c16ecc2` (`feat: migrate figure caption format to semantic model`)
- `HEAD == origin/main == c16ecc2`
- Başlangıç çalışma ağacı temizdi.

## 3. Problem statement

Shadow semantic model, bazı teknik nesnelerin akademik rolünü güvenle belirleyemiyor. Bunları otomatik figure/table saymak yanlış failure üretebilir; tamamen görünmez bırakmak ise analiz güvenini zayıflatır.

## 4. RuleResult vs Diagnostic distinction

`RuleResult`, bilinen üniversite biçim şartının sağlanıp sağlanmadığını ifade eder. `AnalysisDiagnostic`, analyzer'ın mevcut normalized semantic facts ile sınıflandıramadığı veya güvenle ilişkilendiremediği nesneleri bildirir. Diagnostic PASS, FAIL veya N/A değildir.

## 5. Diagnostic domain model

Yeni model:

- `AnalysisDiagnostic`
- `AnalysisDiagnosticCode`
- `AnalysisDiagnosticSeverity`
- `AnalysisDiagnosticReason`
- `AnalysisDiagnosticEvidence`
- `AnalysisDiagnosticCaptionEvidence`

Üretici: `buildAnalysisDiagnostics(objectSemantics)`.

## 6. Severity model

Severity vocabulary: `info | warning`.

- `warning`: akademik doğrulama kapsamını etkileyebilecek belirsizlik.
- `info`: destek/coverage sınırlaması bulunan temsil türü.

`error` eklenmedi; bu fazda analyzer failure yok.

## 7. Reason taxonomy

- `missing-academic-declaration`
- `ambiguous-caption-association`
- `conflicting-caption-type`
- `unsupported-representation-semantics`

## 8. Representation policy matrix

| Kind | declared | unresolved | ambiguous/conflicting | excluded |
|---|---|---|---|---|
| picture | NORMAL_VALIDATION | SILENT | DIAGNOSTIC | SILENT |
| chart | NORMAL_VALIDATION | DIAGNOSTIC | DIAGNOSTIC | SILENT |
| diagram | NORMAL_VALIDATION | DIAGNOSTIC | DIAGNOSTIC | SILENT |
| group | NORMAL_VALIDATION | DIAGNOSTIC | DIAGNOSTIC | SILENT |
| textbox | SILENT | SILENT | SILENT | SILENT |
| vml-image | NORMAL_VALIDATION if declared later | UNSUPPORTED | DIAGNOSTIC | SILENT |
| ole | NORMAL_VALIDATION if declared later | UNSUPPORTED | DIAGNOSTIC | SILENT |
| equation | SILENT | SILENT | SILENT | SILENT |
| table | NORMAL_VALIDATION | SILENT | DIAGNOSTIC | SILENT |
| unknown-drawing | NORMAL_VALIDATION if declared later | UNSUPPORTED | DIAGNOSTIC | SILENT |

## 9. Unresolved policy

`chart`, `diagram`, `group` unresolved ise `UNRESOLVED_ACADEMIC_OBJECT` warning üretilir. `picture` ve `table` sessizdir; front-matter/layout false warning riski yüksektir. `equation` sessizdir; mevcut politika kullanıcıya anlamlı eylem sunmuyor.

## 10. Ambiguous policy

`association.status === ambiguous` için, equation hariç, `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION` warning üretilir.

## 11. Conflicting policy

`association.status === conflicting` için `AMBIGUOUS_ACADEMIC_OBJECT` warning üretilir. Bu formatting failure değildir.

## 12. Missing-association policy

Her `missing` association uyarı değildir. Sadece chart/diagram/group veya destek sınırlaması olan vml-image/OLE/unknown-drawing tanıya dönüşür.

## 13. Excluded policy

Textbox/excluded sessizdir. `excluded`, dekoratif/non-academic kanıtı olarak yorumlanmadı.

## 14. Front-matter findings

Front-matter scope hâlâ çözülmedi. Bu nedenle uncaptioned generic picture diagnostic'i özellikle bastırıldı.

## 15. Official template runtime findings

Yerel resmi DOCX binary snapshot'ları mevcut değildi. `primarySourceManifestAudit` binary integrity için `SKIPPED=4` raporladı; diagnostic noise resmi şablon üzerinde runtime doğrulanamadı.

## 16. Deduplication

Her `AcademicObjectResolution` en fazla bir diagnostic üretir. Precedence:

1. conflicting
2. ambiguous
3. unsupported representation
4. unresolved academic object

## 17. Diagnostic identity

ID deterministiktir: `diagnostic-${representation.id}-${code.toLowerCase()}`. `Date.now`, random UUID veya dosya adına bağlı kimlik kullanılmaz.

## 18. Evidence model

Evidence kompakt tutulur: representation ID/kind/scope, source part, block/paragraph, drawing type, association status/reasons, candidate caption IDs, bounded caption excerpts, resolution status/reasons ve sınırlı teknik evidence.

## 19. AnalysisReport integration

`AnalysisReport` artık `diagnostics: AnalysisDiagnostic[]` taşır. `ReportBuilder.build()` default `[]` ile geriye uyumlu, `analyzeDocx()` production path ise gerçek diagnostics üretir.

## 20. Score isolation

Scoring formülü değişmedi. `ReportBuilder` passed/failed/N/A/evaluated/score değerlerini yalnızca `RuleResult[]` üzerinden hesaplamayı sürdürüyor.

## 21. RuleResult isolation

Diagnostic builder validator çağırmaz ve `RuleResult` üretmez/değiştirmez. Golden ve corpus parity korundu.

## 22. Trust-context integration

Temel trust bilgisi rapor kontratına eklendi: `diagnostics` ayrı metadata olarak tüketilebilir. Ayrı `reviewRequired` alanı bu fazda eklenmedi; UI/trust summary 4E-18E'ye bırakıldı.

## 23. UI decision

UI değişikliği yapılmadı. Fazın güvenli sınırı domain + report contract olarak tutuldu.

## 24. Fixture results

Diagnostic counts:

| Fixture | Count | Codes |
|---|---:|---|
| full-correct | 0 | - |
| chart | 1 | `UNRESOLVED_ACADEMIC_OBJECT` |
| SmartArt/diagram | 1 | `UNRESOLVED_ACADEMIC_OBJECT` |
| group | 1 | `UNRESOLVED_ACADEMIC_OBJECT` |
| unknown-drawing | 1 | `UNSUPPORTED_OBJECT_REPRESENTATION` |
| VML image | 1 | `UNSUPPORTED_OBJECT_REPRESENTATION` |
| OLE | 1 | `UNSUPPORTED_OBJECT_REPRESENTATION` |
| equation | 0 | - |
| DrawingML textbox | 0 | - |
| VML textbox | 0 | - |
| captioned SmartArt | 0 | - |

## 25. Golden/corpus

Golden: `46/46`.

Corpus: `31 regression + 11 exploratory` geçti.

## 26. Pilot-validator parity

`figureCaptionFormatPilotMigration.cjs` PASS. Pilot rule parity intact.

## 27. Quality gates

Geçen kapılar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:golden`
- `npm run test:corpus`
- `node tests/audit/unresolvedAcademicObjectDiagnosticRegression.cjs`
- `node tests/audit/figureCaptionFormatPilotMigration.cjs`
- `node tests/audit/objectSemanticShadowRegression.cjs`
- `node tests/audit/objectSemanticCoverageReadinessAudit.cjs`
- `node tests/audit/academicObjectSemanticsAudit.cjs`
- `node tests/audit/ruleSourceGroundingAudit.cjs`
- `node tests/audit/primaryRuleGroundingAudit.cjs`
- `node tests/audit/primarySourceManifestAudit.cjs`

## 28. Source binary safety

Resmi binary'ler commit edilmedi veya fixture'a kopyalanmadı. Yerel snapshot'lar mevcut olmadığı için manifest binary integrity `SKIPPED=4`.

## 29. Remaining limitations

- Front-matter semantic scope çözülmedi.
- Anchored drawing ordering çözülmedi.
- Header/footer/footnote/endnote object semantics kapsamı genişletilmedi.
- UI rendering ve score trust copy eklenmedi.
- Official template diagnostic noise runtime doğrulanamadı.

## 30. Phase decision

**OPTION B — Domain/report foundation is safe, but user-facing UI should wait.**

## 31. Recommended next phase

**Phase 4E-18E — Diagnostic Report UX & Score Trust Integration**
