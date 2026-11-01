# SDÜ Sprint 37 — Guard calibration audit

Tarih: 1 Kasım 2026. Yalnız audit; akademik onay veya production onboarding değildir.
Sprint 35–36 uygulamaları ve production parser değiştirilmedi. Sınıflar akademik kararların yerine geçmez.

## Yöntem ve sayım sınırı

Regresyon: [sduGuardCalibrationAuditRegression.cjs](../../tests/audit/sduGuardCalibrationAuditRegression.cjs).
Normal çalıştırma read-only'dir; yalnız açık `--write-report` seçeneği bu dokümanı üretir.
Sentetik paket varyantları bellekte hazırlanır. Mevcut DOCX'ler ve incelenen uygulamalar SHA-256 ile korunur.
Candidate seçimi guard'ın gerçek `evidenceReference.rawValues` çıktısından gözlemlenir; detector kopyalanmaz.
Raw/normalized metin, bağımsız heading provenance ve occurrence identity ayrıdır.
Manuel relevance etiketleri kontrollü senaryonun bilinen yapım amacıdır; akademik alias, otomatik detector veya gerçek belge ground truth değildir.
Generic sözcüklerin etiketi bu test bağlamında negatiftir; aynı sözcüğün gerçek belge bağlamında her zaman ilgisiz olduğu iddia edilmez.
İlk audit varsayımı olan “terminal section içeren boş belge kapalı yokluktur” doğrulanmadı:
mevcut semanticQualification paragraf envanteri boşsa coverage'ı open tutar. Bu iki boş kontrol U→U/insufficient-evidence olarak kaydedildi; uygulama değiştirilmedi.

37 SEC-19 senaryosu + 54 margin değerlendirmesi = **91 kontrollü değerlendirme**.
Margin üst/alt ayrı sayılır. Confusion matrix paragraf bazındadır; split senaryosu üç, exact-plus-generic iki paragraf içerir; boş senaryolar sıfırdır.
İki mevcut DOCX üzerindeki 22 pilot kontrolü ayrı baseline doğrulamasıdır; aşağıdaki hata/kalibrasyon toplamlarına eklenmez.

## SEC-19 candidate confusion matrix

Normatif kayıtlı ad: **Yaygın Etki/Katma Değer/Kullanılabilirlik**.

| Kontrollü relevance | Candidate seçildi | Seçilmedi |
| --- | ---: | ---: |
| İlgili (authored positive) | TP 24 | FN 0 |
| İlgisiz (authored negative) | FP 9 | TN 5 |

FP içeren senaryo: **9**. Bunlardan üretilen guarded compliant: **0**.
Candidate false positive, false compliant demek değildir. Buradaki zarar, kanıtlanmış yokluğu veya exact compliance'ı gereksiz U'ya yöneltme potansiyelidir.
Identity sütunu original assessment certainty'sidir; `not-required` kapalı yokluk gözlemi olabilir ve adayın kimliğini doğrulamaz.
Yapısal sütun her paragrafın bağımsız heading provenance'ını gösterir; tam evidence/reason/styleIds/occurrence identity regresyon JSON çıktısında korunur.

| Senaryo | Raw heading | Normalized heading | Heading certainty / placement | Candidate | Original identity | Coverage | Original → guarded | Reason | Sınıf |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| exact | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → compliant | decision-preserved | confirmed-compliance-preserved |
| NFC | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → compliant | decision-preserved | confirmed-compliance-preserved |
| NFD | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → compliant | decision-preserved | confirmed-compliance-preserved |
| uppercase | ["YAYGIN ETKİ/KATMA DEĞER/KULLANILABİLİRLİK"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| lowercase | ["yaygın etki/katma değer/kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| diacritics | ["Yaygin Etki/Katma Deger/Kullanilabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| slash-hyphen | ["Yaygın Etki-Katma Değer-Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| slash-fullwidth | ["Yaygın Etki／Katma Değer／Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| slash-space | ["Yaygın Etki Katma Değer Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| whitespace | ["  Yaygın  Etki / Katma Değer / Kullanılabilirlik  "] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| NBSP | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| word-boundary-deletion | ["YaygınEtkiKatmaDeğerKullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| malformed-punctuation | ["Ya!ygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | justified-uncertainty |
| partial-impact | ["Yaygın Etki"] | ["yayginetki"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | justified-uncertainty |
| partial-value | ["Katma Değer"] | ["katmadeger"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | justified-uncertainty |
| partial-usability | ["Kullanılabilirlik"] | ["kullanilabilirlik"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | justified-uncertainty |
| split | ["Yaygın Etki","Katma Değer","Kullanılabilirlik"] | ["yayginetki","katmadeger","kullanilabilirlik"] | [["confirmed","body"],["confirmed","body"],["confirmed","body"]] | [true,true,true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | justified-uncertainty |
| generic-Değer | ["Değer"] | ["deger"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| generic-Etki | ["Etki"] | ["etki"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| generic-A | ["A"] | ["a"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| generic-Y | ["Y"] | ["y"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| generic-K | ["K"] | ["k"] | [["confirmed","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| unrelated-Z | ["Z"] | ["z"] | [["confirmed","body"]] | [false] | ["not-required"] | closed | violation → violation | decision-preserved | confirmed-violation-preserved |
| unrelated-Q | ["Q"] | ["q"] | [["confirmed","body"]] | [false] | ["not-required"] | closed | violation → violation | decision-preserved | confirmed-violation-preserved |
| unrelated-Sonuçlar | ["Sonuçlar"] | ["sonuclar"] | [["confirmed","body"]] | [false] | ["not-required"] | closed | violation → violation | decision-preserved | confirmed-violation-preserved |
| unrelated-body | ["Unrelated body"] | ["unrelatedbody"] | [["non-heading","body"]] | [false] | ["not-required"] | closed | violation → violation | decision-preserved | confirmed-violation-preserved |
| name-only | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["non-heading","body"]] | [true] | ["unresolved"] | closed | undetermined → undetermined | decision-preserved | insufficient-evidence |
| misleading-style | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["unresolved","body"]] | [true] | ["unresolved"] | closed | undetermined → undetermined | decision-preserved | insufficient-evidence |
| nested-heading | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["ambiguous"] | closed | undetermined → undetermined | decision-preserved | insufficient-evidence |
| open-exact | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | ["yayginetkikatmadegerkullanilabilirlik"] | [["confirmed","body"]] | [true] | ["confirmed"] | open | undetermined → undetermined | decision-preserved | insufficient-evidence |
| open-generic-A | ["A"] | ["a"] | [["confirmed","body"]] | [true] | [] | open | undetermined → undetermined | identity-equivalence-unapproved | candidate-false-positive |
| open-unrelated | ["Unrelated body"] | ["unrelatedbody"] | [["non-heading","body"]] | [false] | [] | open | undetermined → undetermined | decision-preserved | insufficient-evidence |
| exact-plus-generic | ["Yaygın Etki/Katma Değer/Kullanılabilirlik","A"] | ["yayginetkikatmadegerkullanilabilirlik","a"] | [["confirmed","body"],["non-heading","body"]] | [true,true] | ["confirmed"] | closed | compliant → undetermined | identity-equivalence-unapproved | candidate-false-positive |
| table-generic | ["Değer"] | ["deger"] | [["non-heading","table"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| body-generic | ["Etki"] | ["etki"] | [["non-heading","body"]] | [true] | ["not-required"] | closed | violation → undetermined | partial-identity-unresolved | candidate-false-positive |
| empty-with-terminal-section | [] | [] | [] | [] | [] | open | undetermined → undetermined | decision-preserved | insufficient-evidence |
| open-empty | [] | [] | [] | [] | [] | open | undetermined → undetermined | decision-preserved | insufficient-evidence |

## Margin evidence matrix

OOXML integer twips → cm dönüşümü mevcut parser sözleşmesinden: `n × 127 / 72000`.
Parser iki ondalığa yuvarlar; bu bir akademik tolerans değildir. `2.499cm` ve `2.501cm` raw olarak farklıdır, parser ikisini 2.50 yapar.
Aşağıdaki her satır üst ve alt pilotlarda ayrı doğrulanmıştır; sonuçları aynıdır. Parsed ve precision dizilerinin sırası raw section sırasıdır.
Coverage çiftinde ilk değer margin population, ikincisi extraction coverage'dır; bunlar aynı kavram değildir.
Integer için temsil adımı `127/72000 cm`; kabul edilebilir quantization/akademik tolerans onaylanmamıştır.

| Senaryo (iki side) | Raw OOXML | Unit | Raw mathematical cm | Parsed cm | Coverage: margin/extraction | Original → guarded | Uncertainty reason | Sınıf |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| exact-cm | ["2.5cm"] | ["cm"] | [2.5] | [2.5] | closed/closed | compliant → compliant | decision-preserved (none) | confirmed-compliance-preserved |
| 2.499cm | ["2.499cm"] | ["cm"] | [2.499] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 2.501cm | ["2.501cm"] | ["cm"] | [2.501] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1414 | ["1414"] | ["twips"] | ["179578/72000"] | [2.49] | closed/closed | violation → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1415 | ["1415"] | ["twips"] | ["179705/72000"] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1416 | ["1416"] | ["twips"] | ["179832/72000"] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1417 | ["1417"] | ["twips"] | ["179959/72000"] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1418 | ["1418"] | ["twips"] | ["180086/72000"] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1419 | ["1419"] | ["twips"] | ["180213/72000"] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1420 | ["1420"] | ["twips"] | ["180340/72000"] | [2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1421 | ["1421"] | ["twips"] | ["180467/72000"] | [2.51] | closed/closed | violation → undetermined | precision-unapproved (precision) | justified-uncertainty |
| 1701 | ["1701"] | ["twips"] | ["216027/72000"] | [3] | closed/closed | violation → undetermined | precision-unapproved (precision) | potential-overconservatism |
| 3cm | ["3cm"] | ["cm"] | [3] | [3] | closed/closed | violation → violation | decision-preserved (none) | confirmed-violation-preserved |
| missing | [null] | ["missing"] | [null] | [null] | closed/closed | undetermined → undetermined | evidence-unavailable (missing-evidence) | insufficient-evidence |
| malformed | ["0x589"] | ["malformed"] | [null] | [null] | closed/closed | undetermined → undetermined | evidence-unavailable (missing-evidence) | insufficient-evidence |
| multi-exact | ["2.5cm","2.5cm"] | ["cm","cm"] | [2.5,2.5] | [2.5,2.5] | closed/closed | compliant → compliant | decision-preserved (none) | confirmed-compliance-preserved |
| multi-integer | ["2.5cm","1417"] | ["cm","twips"] | [2.5,"179959/72000"] | [2.5,2.5] | closed/closed | compliant → undetermined | precision-unapproved (precision) | justified-uncertainty |
| multi-missing | ["2.5cm",null] | ["cm","missing"] | [2.5,null] | [2.5,null] | closed/closed | undetermined → undetermined | evidence-unavailable (missing-evidence) | insufficient-evidence |
| multi-confirmed-missing | ["3cm",null] | ["cm","missing"] | [3,null] | [3,null] | closed/closed | violation → violation | decision-preserved (none) | confirmed-violation-preserved |
| multi-1701-missing | ["1701",null] | ["twips","missing"] | ["216027/72000",null] | [3,null] | closed/closed | violation → undetermined | evidence-unavailable (missing-evidence) | potential-overconservatism |
| multi-1701-exact | ["1701","2.5cm"] | ["twips","cm"] | ["216027/72000",2.5] | [3,2.5] | closed/closed | violation → undetermined | precision-unapproved (precision) | potential-overconservatism |
| open-exact | ["2.5cm","2.5cm"] | ["cm","cm"] | [2.5,2.5] | [2.5,2.5] | open/closed | undetermined → undetermined | decision-preserved (existing) | insufficient-evidence |
| open-integer | ["1421","1417"] | ["twips","twips"] | ["180467/72000","179959/72000"] | [2.51,2.5] | open/closed | violation → undetermined | precision-unapproved (precision) | justified-uncertainty |
| open-confirmed | ["3cm","2.5cm"] | ["cm","cm"] | [3,2.5] | [3,2.5] | open/closed | violation → violation | decision-preserved (none) | confirmed-violation-preserved |
| open-1701 | ["1701","2.5cm"] | ["twips","cm"] | ["216027/72000",2.5] | [3,2.5] | open/closed | violation → undetermined | precision-unapproved (precision) | potential-overconservatism |
| open-extraction | ["2.5cm"] | ["cm"] | [2.5] | [2.5] | closed/open | compliant → undetermined | evidence-unavailable (missing-evidence) | insufficient-evidence |
| multi-confirmed-integer | ["3cm","1701"] | ["cm","twips"] | [3,"216027/72000"] | [3,3] | closed/closed | violation → violation | decision-preserved (none) | confirmed-violation-preserved |

## 1701 twips ve aşırı muhafazakârlık bulguları

- `1701 × 127 / 72000 = 216027/72000 = 3.000375 cm`; parser sonucu **3 cm**.
- 2.5 cm farkı `36027/72000 = 0.500375 cm` = **283.677165… twips**. Bir twip adımı bu farkı açıklamaz.
- Raw değer geçerli ve safe integer'dır; ölçüm kayıp, malformed veya floating-point taşması değildir.
- Guard'ın `exactCm` dalı yalnız raw decimal `cm` kabul eder. Integer raw değer `null` sınıfına girer; `confirmedViolation` integer'dan kurulamaz.
- Ardından exact `2.5cm` dışındaki raw değerler `precision-unapproved` ile U olur. Bu nedenle 1701 için V→U teknik extraction belirsizliğinden değil, integer temsillerine topluca uygulanan **onaylanmamış precision/quantization politikası kısıtından** kaynaklanır.
- Yakın integer değerleri otomatik V yapmamak için getirilen kısıt, açıkça uzak integer karşıörneklere de yayılmıştır. Audit etiketi `potential-overconservatism`dir; bu rapor guarded sonucu V'ye değiştirmez veya yeni bir uzaklık eşiği tanımlamaz.
- SEC-19 `expected.includes(normalized)` gibi alt dize taraması, tek harfleri ve generic sözcükleri seçer. Structural identity yalnız compliance korumasında kullanılır; candidate taraması table/body/heading ayrımı yapmaz.
- Exact başlık + unrelated `A` kontrolünde original C de U'ya düşer. Bu yalnız yokluk kararlarını etkileyen bir sorun değildir.

Potansiyel gereksiz U downgrade: **16** (8 SEC-19, 8 margin).
Bu sayı onaylanmış yeni akademik karar sayısı değildir. Önceden U olan open generic kontrolü yeni downgrade sayılmaz.
Korunan confirmed violation: **12** kontrollü değerlendirme; kapalı yokluk ve explicit 3cm karşıörnekleri içerir.

| Calibration sınıfı | Kontrollü değerlendirme sayısı |
| --- | ---: |
| justified-uncertainty | 38 |
| potential-overconservatism | 8 |
| candidate-false-positive | 9 |
| confirmed-violation-preserved | 12 |
| confirmed-compliance-preserved | 7 |
| insufficient-evidence | 17 |

## Mevcut iki DOCX — Sprint 35/36 baseline korunması

Her DOCX'te 11 pilotun guard metadata/kararı Sprint 35 ile Sprint 36 arasında eşit bulundu. Aşağıda yalnız üç değişen pilot gösterilir; bu altı satır kontrollü hata toplamlarına katılmaz.

| DOCX | Execution ID | Original → guarded | Reason | Raw selection |
| --- | --- | --- | --- | --- |
| full-correct.docx | pilot.sdu.2026.section.impact-value-usability.presence | violation → undetermined | partial-identity-unresolved | ["Değer","A"] |
| full-correct.docx | pilot.sdu.2026.margin.top | violation → undetermined | precision-unapproved | ["1701","1701"] |
| full-correct.docx | pilot.sdu.2026.margin.bottom | compliant → undetermined | precision-unapproved | ["1417","1417"] |
| automatic-heading-numbering-synthetic.docx | pilot.sdu.2026.section.impact-value-usability.presence | violation → undetermined | partial-identity-unresolved | ["Değer","A"] |
| automatic-heading-numbering-synthetic.docx | pilot.sdu.2026.margin.top | violation → undetermined | precision-unapproved | ["1701","1701"] |
| automatic-heading-numbering-synthetic.docx | pilot.sdu.2026.margin.bottom | compliant → undetermined | precision-unapproved | ["1417","1417"] |

Corpus SEC-19 raw selection bağlamı:

- full-correct.docx: [{"text":"Değer","inTable":true,"heading":"non-heading"},{"text":"A","inTable":true,"heading":"non-heading"}].
- automatic-heading-numbering-synthetic.docx: [{"text":"Değer","inTable":true,"heading":"non-heading"},{"text":"A","inTable":true,"heading":"non-heading"}].

## Uygulanmamış politika iyileştirme önerileri

| Öneri | Beklenen fayda | False-positive riski | False-negative riski | Gerekli onay | Production etkisi |
| --- | --- | --- | --- | --- | --- |
| SEC-19 candidate için keyfi karakter sayısı yerine token sınırları ve tam bileşen/çoklu ayırt edici bileşen bağlamını incele; generic/tek harfleri tek başına yeterli sayma | A/Etki/Değer gürültüsünü azaltır | Sık geçen bileşenler yine aday olabilir | Fazla sert eşik genuine partial/split adayı kaçırıp yanlış yokluk V üretebilir | Teknik kalibrasyon ve ayrı pilot değişiklik incelemesi; compliant eşdeğerliği genişleyecekse ayrıca akademik onay | Bu sprintte yok; production uygulanmaz |
| Mevcut occurrence, revision, placement, block ve heading provenance kaynaklarını yeniden kullan; exact confirmed heading'i ilgisiz distractor'dan ayır | Paralel identity detector kurmadan aday bağlamını güçlendirir | Heading style tek başına akademik kimlik sanılırsa risk sürer | Yalnız confirmed heading zorunluluğu unresolved gerçek başlıkları elememeli; U yolu korunmalı | Teknik semantic inceleme; alias/case/slash kabulü için akademik onay | Yok; normalizer değiştirilmez |
| Raw integer, explicit unit, rounding kaybı ve ölçüm yokluğunu ayrı metadata sınıflarıyla incele | 1701 ile yakın 1417'nin aynı gerekçede kaybolmasını önler | Quantization bandı akademik tolerans sanılırsa false C/V riski | Aşırı geniş U alanı açık ihlalleri saklayabilir | Teknik birim/temsil kanıtı + native belge; kabul sınırı/precision kararı için yetkili normatif onay | Yok; parser/legacy precision değişmez |
| Kaynağa dayalı, temsil belirsizliğinden ayrı bir confirmed violation koruma politikası hazırla; açık integer karşıörnekleri ayrıca test et | 1701 gibi uzak değerlerde gereksiz downgrade'i azaltabilir; bir section'daki karşıörnek diğer eksik section'dan bağımsız kalır | Onaysız numeric threshold normal integer temsillerini false V yapabilir | Fazla geniş koruma eşiği gerçek ihlali U'da bırakabilir | Birim matematiği teknik; neyin akademik ihlal sayılacağı ve yakın temsil sınırı ayrıca onaylanmalı | Yok; yalnız sonraki pilot kararına öneri |
| Missing/malformed/reference uyuşmazlığını fail-closed tut; candidate FP'den ayır; admission reddini violation sayma | Eksik kanıttan kesinlik üretmez | Yanlış missing etiketi gereksiz U artırır | Yanlış eşlenmiş raw veri fark edilmezse kanıtsız C riski | Teknik veri bütünlüğü incelemesi; yeni akademik şart gerektirmez | Yok; v1/provenance/scoring sınırları korunur |

Hiçbir öneri alias, nearest-integer target, ± tolerans veya production requirement olarak kabul edilmedi.

## Remaining blockers ve Sprint 38

- **P0 SEC-19 identity policy** (DR-33-04) açık: geniş eşdeğerlik onayı yok; candidate specificity ve structural bağlam ayrı pilot kalibrasyonu istiyor.
- **P0 margin precision policy** (DR-33-03) açık: 1415–1420 implementation kabul bandı normatif tolerans değildir; uzak integer violation koruması ayrı değerlendirilmelidir.
- **P1 kaynak/scope** (DR-33-01/02) açık: iki kılavuzun byte/metin/kapsam reconciliation'ı bu audit ile yapılmadı; provenance registered-hash-only olarak kalır.
- **P1 native/gerçek belge** (DR-33-05) açık: sentetik ZIP başarıları Word/LibreOffice-native veya gerçek öğrenci kanıtı değildir.
- Bu audit önceki P0/P1'leri kapatmaz. Sprint 35–36 için bildirilen test başarısı, production blocker'larının kapandığı anlamına gelmez.

**Sprint 38: GO — yalnız sınırlı test/pilot candidate specificity ve evidence sınıflaması tasarımı için.**
Margin karar değişikliği ve akademik eşdeğerlikler ilgili onay/kanıt kapıları tamamlanmadan aktive edilmemeli.
**Production onboarding: NO-GO.** Gerçek scope admission default-deny, authorization `not-granted`.

## QA ve yeniden üretim

- Audit: 91 kontrollü karar, 22 ayrı corpus pilot baseline kontrolü, beklenmeyen karar 0; protected file/DOCX hash kontrolü.
- Bu sprintte ayrıca doğrulanan regresyonlar: Sprint 35 **48/48 PASS**, Sprint 36 **63/63 PASS**; uygulamalar değiştirilmedi.
- Typecheck, lint ve build **PASS**; build 500 kB chunk boyutu uyarısı verdi. Diff whitespace kontrolü **PASS**; status yalnız önceki untracked uygulamalar ile yeni audit dosyalarını gösterdi.
- `npm.cmd run test` çalıştırılmadı. Production/DOCX değişikliği ve add/commit/push yok.

```powershell
node tests/audit/sduGuardCalibrationAuditRegression.cjs
node tests/audit/sduConservativeDecisionGuardRegression.cjs
node tests/audit/sduGuardedAssessmentBatchRegression.cjs
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Raporu aynı gözlemlerle yenilemek için: `node tests/audit/sduGuardCalibrationAuditRegression.cjs --write-report`.
Normal audit koşusu, bu dokümanın gözlemlerle birebir eşleştiğini de doğrular.

Yerel dayanaklar: [numeric contract](../MARGIN_NUMERIC_AND_PRECISION_CONTRACT.md),
[Sprint 33 karar hazırlığı](SDU_SPRINT_33_POLICY_APPROVAL_PREPARATION.md),
[Sprint 34 kaynak kapısı](SDU_SPRINT_34_SOURCE_ACQUISITION_GATE.md).
Yeni PDF erişimi, kaynak doğrulaması veya akademik onay iddiası yoktur.
