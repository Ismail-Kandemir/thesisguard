# Phase 4E-18E — Diagnostic Report UX & Score Trust Integration

## 1. Executive summary

Bu fazda 4E-18D diagnostic modeli üretim rapor UX'inde görünür hale getirildi. Diagnostics, failed `RuleResult` kartlarına eklenmedi; ayrı "İnceleme Gerektirenler" bölümü ve ayrı "Manuel inceleme" özeti olarak gösterildi. Uyumluluk puanı değişmedi ve skorun değerlendirilebilen kurallara göre hesaplandığı diagnostic olduğunda ayrıca açıklandı.

Faz kararı: **OPTION A — Diagnostic UX and score-trust integration are production-ready.**

## 2. Starting Git/local-change state

- Dal: `main`
- HEAD: `c16ecc2`
- `origin/main`: `c16ecc2`
- Çalışma ağacı başta kirliydi ve bu beklenen durumdu.
- Phase 4E-18D local değişiklikleri korunarak devam edildi.

## 3. Phase 4E-18D dependency

Bu faz, 4E-18D'nin `AnalysisReport.diagnostics` sözleşmesini kullandı. Diagnostic üretim politikası genişletilmedi.

## 4. UX problem

Kullanıcı aynı anda iki ayrı bilgiyi görmelidir:

- compliance sonucu: değerlendirilebilen kural kontrollerinin sonucu;
- analysis trust context: analyzer'ın sınıflandıramadığı veya güvenle ilişkilendiremediği nesneler.

## 5. Score vs analysis-trust contract

Uyumluluk puanı yalnızca uygulanabilir `RuleResult` sonuçlarından hesaplanır. Diagnostics skoru, failed count'u veya N/A count'u değiştirmez. Diagnostic varsa rapor, puanın değerlendirilebilen kurallara göre hesaplandığını ve ayrıca manuel inceleme gereken unsur bulunduğunu söyler.

## 6. Report integration architecture

Entegrasyon mevcut `AnalysisReportView` içine yapıldı. Yeni paralel rapor mimarisi kurulmadı. Diagnostic UI metinleri için küçük saf mapper eklendi:

- `src/features/analysis/report/diagnosticPresentation.ts`

## 7. Diagnostic section design

Diagnostics ayrı section olarak render edilir:

- başlık: `İnceleme Gerektirenler`
- count: `1 unsur`, `2 unsur`
- kartlar: RuleResult failed kartlarından ayrı görünür.

## 8. Score trust messaging

Diagnostic varsa bölüm açıklaması şunu aktarır: `Uyumluluk puanı değerlendirilebilen kurallara göre hesaplanmıştır.` Bu bir ceza veya adjusted score değildir.

## 9. Diagnostic presentation mapping

Kodlar kullanıcı diline çevrildi:

| Code | Title |
|---|---|
| `UNRESOLVED_ACADEMIC_OBJECT` | Akademik rol belirlenemedi |
| `UNSUPPORTED_OBJECT_REPRESENTATION` | Nesne otomatik sınıflandırma kapsamı dışında |
| `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION` | Nesne ile başlık ilişkisi belirsiz |
| `AMBIGUOUS_ACADEMIC_OBJECT` | Nesnenin akademik türü belirsiz |

## 10. Severity presentation

Diagnostic severity:

- `warning` → `İnceleme gerekli`
- `info` → `Bilgi`

Warning kırmızı failure stiliyle eşleştirilmedi.

## 11. Actionability

Kopya koşullu tutuldu. Örneğin kullanıcıya nesneyi akademik şekil/tablo kurallarına dahil edip etmemesi gerektiğini kontrol etmesi söylenir; nesnenin kesin şekil/tablo olduğu iddia edilmez.

## 12. Evidence/details

Diagnostic kartları kompakt detail gösterir:

- Nesne türü
- Analiz durumu
- Yaklaşık konum varsa
- Yakındaki başlık varsa

Raw OOXML ve internal ID primary copy olarak gösterilmez.

## 13. Empty state

`diagnostics.length === 0` ise diagnostic section render edilmez. "Belgede hiç belirsizlik yok" gibi aşırı iddialı bir empty state eklenmedi.

## 14. Filters/categories behavior

RuleResult filtreleri aynı kaldı. Diagnostics, `FAILED`, `PASSED`, `NOT_APPLICABLE` filtrelerine dahil edilmez ve university rule kategorilerine zorlanmaz.

## 15. Accessibility

Severity yalnız renkle aktarılmadı; text label da var. Section heading ve kart yapısı klavye/screen reader hiyerarşisiyle uyumlu tutuldu.

## 16. Responsive behavior

CSS narrow viewport için diagnostic header/title ve details grid'lerini tek kolona indirir; uzun metinler `overflow-wrap` ile sarılır.

## 17. Golden UX

Golden production path:

- diagnostics: `0`
- reviewRequired: `false`
- `46/46`
- score: `100`
- diagnostic warning section yok.

## 18. Diagnostic fixture UX

`chart-object-synthetic.docx` production path:

- diagnostics: `1`
- code: `UNRESOLVED_ACADEMIC_OBJECT`
- reviewRequired: `true`
- score: `98`
- failed count: `1`

Skor ve failed count önce/sonra aynı kaldı.

## 19. Multiple diagnostic behavior

Synthetic chart + unknown drawing runtime data:

- diagnostic count: `2`
- review text: `2 unsur`
- IDs unique.

## 20. Score differential

| Case | Score before | Score after | Failed before | Failed after | Diagnostics |
|---|---:|---:|---:|---:|---:|
| golden | 100 | 100 | 0 | 0 | 0 |
| chart | 98 | 98 | 1 | 1 | 1 |
| unknown-drawing | 98 | 98 | 1 | 1 | 1 |
| ambiguous synthetic | 0 | 0 | 0 | 0 | 1 |

## 21. RuleResult isolation

Diagnostics ayrı alan olarak tüketildi. `report.results` listesi ve filtreleri değiştirilmedi.

## 22. Validator/parser safety

Validator değişikliği yok. Parser semantic değişikliği yok. Diagnostic policy genişletilmedi.

## 23. Official-template limitation

Official binaries bu makinede yoktu. Source manifest audit binary integrity için `SKIPPED=4` raporladı. Diagnostic noise official templates üzerinde hâlâ runtime doğrulanmadı.

## 24. Front-matter limitation

Front-matter academic scope çözülmedi. UI, uncaptioned picture için hata veya kesin akademik rol iddiasında bulunmaz.

## 25. Anchored-drawing limitation

Anchored drawing ordering çözülmedi. UI XML sırasını görsel yerleşim doğrusu olarak sunmaz.

## 26. Tests

Yeni audit:

- `tests/audit/diagnosticReportUxRegression.cjs`

Kapsam:

- production `analyzeDocx` path
- golden review state
- chart/unknown score parity
- ambiguous diagnostic presentation
- multiple diagnostic count
- Turkish pluralization
- raw technical identifier primary-copy guard

## 27. Quality gates

Geçen kapılar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:golden`
- `npm run test:corpus`
- `node tests/audit/diagnosticReportUxRegression.cjs`
- `node tests/audit/unresolvedAcademicObjectDiagnosticRegression.cjs`
- `node tests/audit/figureCaptionFormatPilotMigration.cjs`
- `node tests/audit/objectSemanticShadowRegression.cjs`
- `node tests/audit/objectSemanticCoverageReadinessAudit.cjs`
- `node tests/audit/academicObjectSemanticsAudit.cjs`
- `node tests/audit/ruleSourceGroundingAudit.cjs`
- `node tests/audit/primaryRuleGroundingAudit.cjs`
- `node tests/audit/primarySourceManifestAudit.cjs`

## 28. Git diff

4E-18D local changes korundu. 4E-18E ekleri:

- `src/features/analysis/report/diagnosticPresentation.ts`
- `src/features/analysis/report/components/AnalysisReportView.tsx`
- `src/features/analysis/report/components/AnalysisReportView.css`
- `tests/audit/diagnosticReportUxRegression.cjs`
- bu doküman

## 29. Remaining limitations

- Official template diagnostic noise bu makinede doğrulanmadı.
- Front-matter semantic scope çözülmedi.
- Anchored drawing ordering çözülmedi.
- UI component audit saf mapper/production report sözleşmesi seviyesinde; ayrı browser screenshot testi eklenmedi.

## 30. Phase decision

**OPTION A — Diagnostic UX and score-trust integration are production-ready.**

## 31. Recommended next phase

**Phase 4E-18F — Front-Matter Academic Scope Foundation**
