# Sprint 45 — Section Evidence Classification

Tarih: 3 Kasım 2026. **Sprint 45 GO (yalnız test-only kapsam); production onboarding NO-GO.**

Classifier ve gate bağlantısı yalnız test ortamında uygulandı. Production parser,
RuleEngine, ReportBuilder, scoring, UI, üniversite kuralları, legacy üç durumlu
sonuç sözleşmesi, SDÜ guard/admission mantığı değiştirilmedi.
Production false-PASS sorunu bu sprintte kapatılmadı.

## 1. Yanlış ertelemenin kök nedeni

[Sprint 42](SPRINT_42_DOCX_COMPATIBILITY.md), [Sprint 43](SPRINT_43_MARGIN_FALSE_PASS_SAFETY.md),
[Sprint 44](SPRINT_44_ANALYSIS_READINESS_GATE.md) ve analysisReadinessGatePilot.ts incelendi.

Parser getSectionExtractionCoverage(), Word paragraph extraction dışındaki foreign
leaf text'i genel academic/text extraction belirsizliği olarak kaydediyor.
Equation fixture'ında bu metin m:oMathPara/m:oMath/m:r/m:t içindeki x=1.
Genel coverage'ın open olması section envanterinin eksik olduğunu göstermiyor.
Sprint 44 pilotu bu alanı doğrudan margin readiness engeli saydığı için gereksiz erteleme oluştu.

İncelenen fixture: tests/fixtures/comu/food-technology/experimental/equation-object-synthetic.docx.
SHA-256: bed79628008d70c7ddc1efdc4d07f94e560e713a06dc9dc648bdc3d1cf085510.

| Section | Source | Paragraph aralığı (0-based, inclusive) | Raw top/bottom/left/right twips | Parser cm |
| --- | --- | --- | --- | --- |
| 0 | paragraph | 0–19 | 1701/1417/1701/1417 | 3/2.5/3/2.5 |
| 1 | terminal body | 20–46 | 1701/1417/1701/1417 | 3/2.5/3/2.5 |

Her section'da bir doğrudan w:pgMar var; margin attribute'ları tam ve parse edilebilir.
Math yapısı 1 m:oMathPara + 1 m:oMath içeriyor. Section kanıtına müdahale eden bir
taşıyıcı yok. Production genel extraction coverage **open** kalıyor; classifier
boundaries=reliable, marginEvidence=complete, sectionCoverage=closed üretiyor.

| Kontrol | Genel extraction | Okunan boundary | Margin | Section coverage | Pilot kararı |
| --- | --- | --- | --- | --- | --- |
| Equation fixture | open | reliable, paragraph + body | complete | closed | ready |
| Yalnız paragraph section, terminal eksik | closed | reliable mevcut alt küme | complete | open | deferred |
| Equation + altChunk | open | reliable mevcut alt küme | complete | open | deferred |

Reliable, yalnız okunan sınırların yerleşimini ifade eder; kapsamın tamamlandığı
ayrı sectionCoverage alanıyla kanıtlanır.

## 2. Classifier tasarımı

Yeni modül: tests/audit/sectionEvidenceClassifier.ts.

- Sayısal margin ve paragraph sınırları için mevcut parseDocumentXml kullanılır;
  ikinci numeric parser, yeni tolerans veya akademik gereklilik eklenmez.
- Raw section yerleşimi/tekilliği bağımsız olarak denetlenir. Raw'dan yeniden
  üretilen pageSections, normalized document pageSections ile eşleşmelidir.
  Eşleşmeyen veya raw kanıtı olmayan girdi güvenilir sayılmaz.
- Current branch/revision traversal için mevcut getSemanticChildElements,
  selectAlternateContentBranch ve isInsideInvisibleCurrentDocumentRevision
  kullanılır. Paralel bir MCE veya revision resolver yazılmadı.
- Boundaries: document-flow paragraph pPr/sectPr ile doğrudan terminal body sectPr
  konumları denetlenir. Table cell, math/foreign wrapper içindeki section
  document-flow boundary olarak yükseltilmez.
- Margin evidence: her section'da tam bir doğrudan pgMar ve dört finite parser
  değeri gerekir. Eksik/duplicate pgMar, eksik/bozuk attribute ayrı engeldir.
- Section coverage: tek ve sondaki terminal body section, tutarlı mapping,
  doğrulanabilir yerleşim ve okunamayan aktif taşıyıcı bulunmaması gerekir.
  Terminal'den sonra paragraf veya duplicate terminal güvenilir sayılmaz.
- Aktif altChunk/subDoc/contentPart ile çözülemeyen AlternateContent section
  kapsamını open tutar. Seçilmemiş MCE branch ve görünmeyen deleted carrier,
  mevcut semantic seçim sözleşmesine göre current kanıtı etkilemez.
- General extraction, equation sayısı ve unsupported carrier'lar ayrı descriptive
  metadata'dır. Math varlığı bir whitelist değildir; math içindeki uygunsuz
  section veya math ile birlikte altChunk yine ertelenir.

Historical pPrChange/sectPrChange snapshot'ları güncel sınır kanıtı sayılmaz.
Bu statik classifier tam OOXML schema validator veya physical/rendered layout
kanıtı değildir. Bilinen taşıyıcılar ve test edilen yapıların ötesinde mutlak
uyumluluk/false-accept garantisi verilmez.

## 3. Test-only gate bağlantısı

analysisReadinessGatePilot.ts opt-in raw XML bağlamı alacak şekilde genişletildi:

```ts
evaluateAnalysisReadiness(document, rules, registry, documentXml)
runReadinessGatePilot(document, rules, executeAnalysis, documentXml)
```

Raw bağlam verilirse classifier'ın üç teknik boyutu birlikte kontrol edilir.
null raw açıkça deferred olur. Margin assess() ve tüm observation kontrolleri
korundu; genel text extraction eksikliği tek başına margin eksikliği sayılmaz.
Hazır olmak akademik olarak PASSED olmak değildir; farklı fakat güvenilir
margin'ler engine'e ulaşır ve mevcut FAILED kararını korur.

Raw argümanı verilmezse Sprint 44'ün konservatif baseline yolu korunur.
Bu, tarihsel regresyonu ve before/after karşılaştırmasını aynı modülde çalıştırır;
classifier'lı yol raw kanıt olmadan sessizce etkinleştirilmez. Production bu
fonksiyonların hiçbirini çağırmıyor.

Deferred classified pilot çağrılarında engine/builder çağrıları 0/0, report/score
yok. Ready çağrılarında çağrılar 1/1; aynı document/rules üzerinde legacy margin
raporuyla deep-equal sonuç alınır. Normalized document mutation yapılmaz.
Dördüncü RuleResult durumu veya belirsizlikten FAILED/N/A eşlemesi yok.

## 4. 44 fixture kabul/ertele karşılaştırması

| Grup | Sprint 44 baseline ready/deferred | Classifier bağlı ready/deferred |
| --- | --- | --- |
| 31 regression | 31/0 | 31/0 |
| 11 exploratory | 10/1 | 11/0 |
| 2 manual fixture | 2/0 | 2/0 |
| Toplam | 43/1 | 44/0 |

Manual dosyaların önceki Unknown/unverified provenance kaydı değiştirilmedi.
Kabul burada yalnız statik section/margin readiness anlamına gelir; Word-native,
gerçek kullanıcı uyumluluğu veya akademik bütün-belge uygunluğu değildir.

| DOCX | Sprint 44 baseline | Classifier bağlı pilot |
| --- | --- | --- |
| ThesisGuard_3cm_YENI_TEST.docx | ready | ready |
| ThesisGuard_margin_2_5cm_synthetic.docx | ready | ready |
| alternate-content-figure-synthetic.docx | ready | ready |
| alternate-content-semantic-collision-synthetic.docx | ready | ready |
| alternate-content-text-synthetic.docx | ready | ready |
| automatic-heading-numbering-synthetic.docx | ready | ready |
| chart-object-synthetic.docx | ready | ready |
| complex-field-cached-result-synthetic.docx | ready | ready |
| docdefaults-theme-synthetic.docx | ready | ready |
| drawingml-textbox-font-size-synthetic.docx | ready | ready |
| drawingml-textbox-ownership-synthetic.docx | ready | ready |
| drawingml-textbox-semantic-collision-synthetic.docx | ready | ready |
| endnote-visible-content-synthetic.docx | ready | ready |
| equation-object-synthetic.docx | deferred | ready |
| experimental-indentation-fail.docx | ready | ready |
| experimental-margin-fail.docx | ready | ready |
| experimental-object-alignment-fail.docx | ready | ready |
| experimental-page-number-fail.docx | ready | ready |
| experimental-page-sequence-fail.docx | ready | ready |
| experimental-paragraph-format-fail.docx | ready | ready |
| experimental-typography-fail.docx | ready | ready |
| footnote-section-collision-synthetic.docx | ready | ready |
| footnote-visible-content-synthetic.docx | ready | ready |
| full-correct.docx | ready | ready |
| grouped-drawing-object-synthetic.docx | ready | ready |
| multi-section-final-margin-fail-synthetic.docx | ready | ready |
| multi-section-margin-all-correct-synthetic.docx | ready | ready |
| multi-section-margin-synthetic.docx | ready | ready |
| ole-object-synthetic.docx | ready | ready |
| smartart-caption-collision-synthetic.docx | ready | ready |
| smartart-object-synthetic.docx | ready | ready |
| split-runs-synthetic.docx | ready | ready |
| style-inheritance-synthetic.docx | ready | ready |
| textbox-font-size-synthetic.docx | ready | ready |
| textbox-semantic-collision-synthetic.docx | ready | ready |
| toc-field-marked-synthetic.docx | ready | ready |
| toc-field-unmarked-synthetic.docx | ready | ready |
| tracked-deleted-reference-synthetic.docx | ready | ready |
| tracked-deleted-run-font-size-synthetic.docx | ready | ready |
| tracked-inserted-run-synthetic.docx | ready | ready |
| tracked-move-semantic-collision-synthetic.docx | ready | ready |
| tracked-move-synthetic.docx | ready | ready |
| unknown-drawing-object-synthetic.docx | ready | ready |
| vml-image-object-synthetic.docx | ready | ready |

## 5. False-accept / false-defer ve güvenlik regresyonları

Yeni regresyon: tests/audit/sectionEvidenceClassificationRegression.cjs.

27 in-memory OOXML senaryosu: 8 kabul ve 19 ertele beklentisi; tamamı doğru.
Ek üç bütünlük kontrolü: normalized margin tampering, null raw, duplicate body.
44 fixture'ın her birinde null raw'ın kabul edilmemesi ayrıca kontrol edildi.

| Senaryo | Beklenen ve elde edilen |
| --- | --- |
| complete-single | ready |
| complete-multi-different-margins | ready |
| equation-only | ready |
| foreign-text-only | ready |
| missing-terminal | deferred |
| missing-all-sections | deferred |
| missing-pgMar | deferred |
| missing-top | deferred |
| malformed-top | deferred |
| negative-unsigned-left | deferred |
| duplicate-pgMar | deferred |
| missing-earlier-margin-with-later-violation | deferred |
| unsupported-altChunk | deferred |
| unsupported-subDoc | deferred |
| unsupported-contentPart | deferred |
| equation-plus-altChunk | deferred |
| equation-without-terminal | deferred |
| duplicate-terminal | deferred |
| trailing-paragraph-after-terminal | deferred |
| table-cell-section | deferred |
| equation-containing-section | deferred |
| unresolved-MCE | deferred |
| selected-fallback-carrier | deferred |
| inactive-choice-carrier | ready |
| selected-fallback-section | ready |
| deleted-carrier | ready |
| renamed-prefix | ready |

Ölçülen kapsamda false-accept=0, false-defer=0.
Equation-only / equation+altChunk ayrımı özellikle korundu. Bozuk/eksik pgMar,
açık section kapsamı ve gerçek eksik kanıtlar kabul edilmedi.
Bu sayılar test population'ına aittir; keyfi DOCX'ler için güvenlik garantisi değildir.

Sprint 43 production güvenlik testi hâlâ **FAIL**: production path değiştirilmediği
için 12 safety assertion devam ediyor. Sprint 43 --audit-contract PASS olsa da
productionSafety=FAIL kalır. Sprint 44 normal regresyonu eski raw'sız baseline'ı
doğrular; oradaki historical equation defer, classifier yolunun sonucu değildir.
Bu iki tarihsel kanıt veya assertion gevşetilmedi.

## 6. QA

Package.json gerçek script adları kullanıldı; npm.cmd run test çalıştırılmadı.

| Komut / kontrol | Sonuç |
| --- | --- |
| node tests/audit/sectionEvidenceClassificationRegression.cjs | PASS; 27 senaryo + 3 bütünlük kontrolü + 44 fixture |
| node tests/audit/docxMarginComparisonRegression.cjs | PASS; Sprint 41 |
| node tests/audit/docxCompatibilityRegression.cjs | PASS; Sprint 42, 44 fixture + 37 senaryo |
| node tests/audit/marginFalsePassSafetyRegression.cjs | **FAIL**, exit 1; mevcut production safety sorunu |
| node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract | PASS; productionSafety FAIL olarak korunur |
| node tests/audit/analysisReadinessGateRegression.cjs | PASS; Sprint 44 historical raw'sız baseline, uyumluluk bulgusu FAIL olarak korunur |
| npm.cmd run test:golden | PASS; 46/46 |
| npm.cmd run test:corpus | PASS; 31 regression + 11 exploratory |
| npm.cmd run typecheck | PASS |
| Yeni classifier ve pilot için ayrıca strict tsc --noEmit | PASS; tests app tsconfig dışında olduğu için ayrıca doğrulandı |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS; mevcut 726,54 kB JS chunk boyut uyarısı |
| git diff --check | PASS; yeni untracked dosyaların içeriğini kapsamaz |
| node --check tests/audit/sectionEvidenceClassificationRegression.cjs | PASS |
| QA öncesi/sonrası hash kontrolü | PASS; src ağacı, 44 DOCX ve korunan 11 eski test/guard/rapor değişmedi |
| git status --short | Başlangıçtaki yedi untracked dosya korunuyor; üç yeni Sprint 45 dosyası var. Mevcut test-only pilotun içeriği değiştirildi |

Manuel tekrar:

```powershell
node tests/audit/sectionEvidenceClassificationRegression.cjs
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract
node tests/audit/analysisReadinessGateRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
.\node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable --strict --skipLibCheck --types vite/client tests/audit/sectionEvidenceClassifier.ts tests/audit/analysisReadinessGatePilot.ts
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Sprint 43 güvenlik komutunun exit 1 sonucu çözülmüş sayılmamalıdır.

## 7–9. Production hazırlığı ve karar

**Production entegrasyonuna henüz hazır değil.** Corpus üzerindeki tek gereksiz
erteleme giderildi ve test edilen eksik kanıtlar korunuyor; ancak classifier yalnız
test ortamında çalıştı. Merkezi semantic source'a entegrasyon tasarımı, browser XML
davranışı, daha geniş/native belge kapsamı, gerçek analyzeDocx üzerinden
engine/builder durdurma ve UI erteleme davranışı ayrıca doğrulanmalı.
Raw ve normalized kanıtın aynı paketten geldiği sınır da production'da kurulmalı.
Mevcut genel academic extraction coverage bu sprintte değiştirilmedi.

**Sprint 45 GO:** istenen test-only classification, gate bağlantısı ve 44 fixture
karşılaştırması tamamlandı; ölçülen test population'ında yeni false-accept yok.
**Production onboarding NO-GO:** production false-PASS yolu ve önceki bağımsız
native/source/onboarding engelleri sürüyor.

Yeni dosyalar: classifier, yeni regresyon ve bu rapor. Değiştirilen mevcut dosya:
yalnız test-only analysisReadinessGatePilot.ts. Mevcut Sprint 41–44 rapor ve
regresyonları korunuyor. Production, SDÜ guard/admission ve mevcut DOCX'ler
değiştirilmedi. Git add, commit veya push yapılmadı.
