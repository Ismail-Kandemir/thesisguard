# SDÜ Sprint 38 — Conservative Guard v2 experimental

Tarih: 1 Kasım 2026. Yalnız test/pilot; production onboarding değildir.

## v1/v2 mimarisi ve sürüm izolasyonu

Yeni modül: [sduConservativeDecisionGuardV2.ts](../../tests/audit/sduConservativeDecisionGuardV2.ts).
Selector `runSduVersionedConservativePilot` varsayılan olarak v1'e delege eder; yalnız `version: "v2-experimental", enabled: true` v2'yi çalıştırır.
Policy version `sdu-conservative-decision/v2-experimental`. Disabled durumda metadata yoktur. Mevcut v1 guard ve Sprint 36 batch harness değiştirilmedi.
v2 önce v1'in 11 execution ID / contract / provenance / AssessmentReport doğrulamasını kullanır; sonra yalnız SEC-19 ve iki margin kararını yeniden sınırlar.
Original AssessmentReport v1 ve kararları değiştirilmez. Guard metadata ayrı, JSON round-trip uyumlu ve immutable snapshot olarak taşınır.
Sprint 37 senaryo üreticileri export edildi; CLI audit çıktısı ve dokümanı aynı kaldı. Aynı corpus kopyalanmadan iki sürümde çalıştırılır.

## SEC-19 candidate confusion matrix

Controlled relevance etiketleri Sprint 37'den alınmıştır. Bunlar alias veya gerçek belge ground truth'u değildir; sayım paragraf bazındadır.

| Sürüm | TP | FP | FN | TN |
| --- | ---: | ---: | ---: | ---: |
| v1 | 24 | 9 | 0 | 5 |
| v2 | 24 | 0 | 0 | 14 |

v2 generic A/Değer/Etki'yi tek başına tam bileşen saymaz. Table/TOC/caption, current-revision veya body provenance eksikliği heading adaylığını kurmaz.
Tam bileşenler token sınırlarıyla değerlendirilir. Joined-component ve adjacent/reliable heading token split'i yalnız belirsizlik adayıdır; yeni occurrence veya akademik kimlik oluşturulmaz.
Tam adın non-heading görünümü unresolved identity olarak korunabilir; bu confirmed heading veya compliant sayılmaz. Style/outline belirsiz partial başlık da U kalır.
C yalnız original C + exact NFC raw text + mevcut confirmed occurrence/observation + closed coverage ile korunur. Onaysız case/diacritic/slash/whitespace değişiklikleri U kalır.

| Senaryo | v1 | v2 | Seçilen v2 raw adaylar | Değişiklik/koruma gerekçesi |
| --- | --- | --- | --- | --- |
| exact | compliant | compliant | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| NFC | compliant | compliant | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| NFD | compliant | compliant | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| uppercase | undetermined | undetermined | ["YAYGIN ETKİ/KATMA DEĞER/KULLANILABİLİRLİK"] | identity-equivalence-unapproved |
| lowercase | undetermined | undetermined | ["yaygın etki/katma değer/kullanılabilirlik"] | identity-equivalence-unapproved |
| diacritics | undetermined | undetermined | ["Yaygin Etki/Katma Deger/Kullanilabilirlik"] | identity-equivalence-unapproved |
| slash-hyphen | undetermined | undetermined | ["Yaygın Etki-Katma Değer-Kullanılabilirlik"] | identity-equivalence-unapproved |
| slash-fullwidth | undetermined | undetermined | ["Yaygın Etki／Katma Değer／Kullanılabilirlik"] | identity-equivalence-unapproved |
| slash-space | undetermined | undetermined | ["Yaygın Etki Katma Değer Kullanılabilirlik"] | identity-equivalence-unapproved |
| whitespace | undetermined | undetermined | ["  Yaygın  Etki / Katma Değer / Kullanılabilirlik  "] | identity-equivalence-unapproved |
| NBSP | undetermined | undetermined | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | identity-equivalence-unapproved |
| word-boundary-deletion | undetermined | undetermined | ["YaygınEtkiKatmaDeğerKullanılabilirlik"] | identity-equivalence-unapproved |
| malformed-punctuation | undetermined | undetermined | ["Ya!ygın Etki/Katma Değer/Kullanılabilirlik"] | identity-equivalence-unapproved |
| partial-impact | undetermined | undetermined | ["Yaygın Etki"] | partial-identity-unresolved |
| partial-value | undetermined | undetermined | ["Katma Değer"] | partial-identity-unresolved |
| partial-usability | undetermined | undetermined | ["Kullanılabilirlik"] | partial-identity-unresolved |
| split | undetermined | undetermined | ["Yaygın Etki","Katma Değer","Kullanılabilirlik"] | partial-identity-unresolved |
| generic-Değer | undetermined | violation | [] | candidate-noise-filtered |
| generic-Etki | undetermined | violation | [] | candidate-noise-filtered |
| generic-A | undetermined | violation | [] | candidate-noise-filtered |
| generic-Y | undetermined | violation | [] | candidate-noise-filtered |
| generic-K | undetermined | violation | [] | candidate-noise-filtered |
| unrelated-Z | violation | violation | [] | decision-preserved |
| unrelated-Q | violation | violation | [] | decision-preserved |
| unrelated-Sonuçlar | violation | violation | [] | decision-preserved |
| unrelated-body | violation | violation | [] | decision-preserved |
| name-only | undetermined | undetermined | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| misleading-style | undetermined | undetermined | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| nested-heading | undetermined | undetermined | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| open-exact | undetermined | undetermined | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | decision-preserved |
| open-generic-A | undetermined | undetermined | [] | candidate-noise-filtered |
| open-unrelated | undetermined | undetermined | [] | decision-preserved |
| exact-plus-generic | undetermined | compliant | ["Yaygın Etki/Katma Değer/Kullanılabilirlik"] | candidate-noise-filtered |
| table-generic | undetermined | violation | [] | candidate-noise-filtered |
| body-generic | undetermined | violation | [] | candidate-noise-filtered |
| empty-with-terminal-section | undetermined | undetermined | [] | decision-preserved |
| open-empty | undetermined | undetermined | [] | decision-preserved |

## Margin interval modeli ve dayanak sınırı

Integer raw değer, lexical geçerlilik ve safe-integer sınırı korunarak okunur. Parser'ın mevcut iki ondalık cm sözleşmesi değiştirilmez.
Deneysel temsil envelope'u raw merkez etrafında ±1 twip + ±0.005 cm'dir. Bir twip=254/144000 cm; parser yarım adımı=720/144000 cm; toplam half-width=974/144000 cm.
n integer için interval `[(254n−974)/144000, (254n+974)/144000]`; target `360000/144000` ile BigInt kullanılarak karşılaştırılır.
Bu envelope akademik tolerans veya kabul bandı değildir: overlap yalnız U üretir, asla C üretmez. Yakın raw temsilin C sayılması yetkilendirilmez.
±1 twip floor/ceil/nearest için konservatif bir deneysel üst sınır varsayımıdır; tüm editörlerin veya fiziksel çıktının evrensel hata garantisi değildir. Parser rounding payı raw merkezde ayrıca eklenerek bilerek geniş tutulur.
Model ayrı opt-in teknik kalibrasyondur; native belge/ölçüm kanıtı ve normatif precision incelemesi tamamlanmış sayılmaz.
Bu prototip definite margin incelemesini integer twips ve explicit cm ile sınırlar; diğer unitler bu v2 dalında U kalır.
V korunması için original V, güvenilir raw/projection/provenance, closed margin ve extraction coverage, bütün section ölçümlerinin lexical/parsed geçerliliği ve interval dışı counterexample gerekir.
Eksik/malformed ölçüm veya open coverage varsa explicit 3cm dahil U döner. Bu, v1'in bir counterexample ile V koruyan politikasından bilinçli olarak daha sıkıdır.

## Margin karar matrisi

Her satır üst/alt pilotlarda ayrı doğrulanmıştır; sonuçları aynıdır. Tam evidence/interval rational değerleri regresyon JSON çıktısındadır.

| Senaryo | Raw section ölçümleri | Closed margin+extraction | v1 | v2 | Gerekçe |
| --- | --- | --- | --- | --- | --- |
| exact-cm | ["2.5cm"] | true | compliant | compliant | decision-preserved |
| 2.499cm | ["2.499cm"] | true | undetermined | undetermined | precision-unapproved |
| 2.501cm | ["2.501cm"] | true | undetermined | undetermined | precision-unapproved |
| 1414 | ["1414"] | true | undetermined | undetermined | precision-unapproved |
| 1415 | ["1415"] | true | undetermined | undetermined | precision-unapproved |
| 1416 | ["1416"] | true | undetermined | undetermined | precision-unapproved |
| 1417 | ["1417"] | true | undetermined | undetermined | precision-unapproved |
| 1418 | ["1418"] | true | undetermined | undetermined | precision-unapproved |
| 1419 | ["1419"] | true | undetermined | undetermined | precision-unapproved |
| 1420 | ["1420"] | true | undetermined | undetermined | precision-unapproved |
| 1421 | ["1421"] | true | undetermined | undetermined | precision-unapproved |
| 1701 | ["1701"] | true | undetermined | violation | integer-violation-preserved |
| 3cm | ["3cm"] | true | violation | violation | decision-preserved |
| missing | [null] | true | undetermined | undetermined | evidence-unavailable |
| malformed | ["0x589"] | true | undetermined | undetermined | evidence-unavailable |
| multi-exact | ["2.5cm","2.5cm"] | true | compliant | compliant | decision-preserved |
| multi-integer | ["2.5cm","1417"] | true | undetermined | undetermined | precision-unapproved |
| multi-missing | ["2.5cm",null] | true | undetermined | undetermined | evidence-unavailable |
| multi-confirmed-missing | ["3cm",null] | true | violation | undetermined | evidence-unavailable |
| multi-1701-missing | ["1701",null] | true | undetermined | undetermined | evidence-unavailable |
| multi-1701-exact | ["1701","2.5cm"] | true | undetermined | violation | integer-violation-preserved |
| open-exact | ["2.5cm","2.5cm"] | false | undetermined | undetermined | coverage-incomplete |
| open-integer | ["1421","1417"] | false | undetermined | undetermined | coverage-incomplete |
| open-confirmed | ["3cm","2.5cm"] | false | violation | undetermined | coverage-incomplete |
| open-1701 | ["1701","2.5cm"] | false | undetermined | undetermined | coverage-incomplete |
| open-extraction | ["2.5cm"] | false | undetermined | undetermined | evidence-unavailable |
| multi-confirmed-integer | ["3cm","1701"] | true | violation | violation | decision-preserved |

1701 twips = 3.000375 cm; interval `[431080/144000, 433028/144000]` ≈ `[2.993611…, 3.007139…]` cm. Hedef tamamen dışarıda: tam/closed kanıtta original V korunur.
1417 twips için interval `[358944/144000, 360892/144000]` hedefi içerir: U. 1414–1421 bandının tamamı da U kalır.
2.499cm ve 2.501cm, parser 2.50 üretse de U kalır. Multi-1701+missing veya open-1701 U kalır; herhangi bir section'daki yakın değer tüm belgeyi C yapmaz.

## Karar değişiklikleri ve risk

Kontrollü corpus: 91 değerlendirme. v1→v2 değişen 16; U'dan çıkış 12, U'ya giriş 4; net U azalması 8.
v1'e göre C restorasyonu 1; V restorasyonu 11. Original kararına göre yeni akademik C=0, yeni akademik V=0.
Original confirmed V korunması: v1 12, v2 19. Daha sıkı coverage/section şartları nedeniyle v1 V→v2 U sayısı 4.
Bu dört downgrade explicit 3cm+missing ve open-confirmed kontrollerinin iki side'ıdır; kazanımlar raporlanırken saklanmaz. Eksik kanıtta counterexample semantiğine geri dönmek ayrı policy kararı olur.
Candidate specificity, provenance yetersiz gerçek partial/split'i kaçırabilir. Bu yüzden full unresolved identity, missing-style partial ve adjacent reliable split U kontrolleri korunur; sentetik FN=0 gerçek belgede sıfır hata garantisi değildir.
Margin interval varsayımı farklı editor quantization davranışlarında yetersiz kalabilir. Native kanıt olmadan production'a taşınmaz; intervalin akademik tolerans sayılması false C/V riski doğurur.

## Mevcut iki DOCX — ayrı 22 pilot karşılaştırması

Bu 22 değerlendirme kontrollü 91'lik toplamdan ayrıdır; değişen 4. Aşağıda yalnız değişen satırlar vardır. Diğer pilotlarda original/v1/v2 korunmuştur.

| DOCX | Execution ID | Original | v1 | v2 | Gerekçe |
| --- | --- | --- | --- | --- | --- |
| full-correct.docx | pilot.sdu.2026.section.impact-value-usability.presence | violation | undetermined | violation | candidate-noise-filtered |
| full-correct.docx | pilot.sdu.2026.margin.top | violation | undetermined | violation | integer-violation-preserved |
| automatic-heading-numbering-synthetic.docx | pilot.sdu.2026.section.impact-value-usability.presence | violation | undetermined | violation | candidate-noise-filtered |
| automatic-heading-numbering-synthetic.docx | pilot.sdu.2026.margin.top | violation | undetermined | violation | integer-violation-preserved |

## Safety invariant sonuçları

- Default selector v1 çıktısıyla birebir eşit; disabled durumda metadata yok. Bilinmeyen version reddedilir.
- Unknown/duplicate ID, changed contract, missing/forged provenance, invalid decision/applicability metadata reddedilir; admission reddi violation değildir.
- Raw evidence eksikliği veya raw/paragraph structural projection uyuşmazlığı U'dur; source provenance eksikliği batch rejection olabilir.
- Exact heading + unrelated body/table text C'yi gereksiz düşürmez; genuine partial/split ve unresolved heading U'dur. Eski yokluk raporu mevcut exact heading üzerine V'yi koruyamaz.
- Ortak v1 doğrulama hatası exception ile reddedilir; v2 refinement hatası ilgili metadata'da v2-runtime-error/U olur. Her iki yol da fail-closed'dur.
- AssessmentReport v1, immutable metadata, evidence/provenance ve JSON round-trip korunur. Legacy PASSED/FAILED/NOT_APPLICABLE dönüşümü yapılmaz.
- Gerçek scope admission default-deny, authorization not-granted. COMÜ 46/47 kurallı iki bölümün skorları iki fixture üzerinde aynı kalır.

## Remaining P0/P1 blockers ve Sprint 39

P0 SEC-19 akademik identity/eşdeğerlik ve P0 margin precision onayı açık. v2 teknik deneyi yeni alias/tolerans onayı değildir.
P1 source/scope reconciliation ve native/gerçek öğrenci belgesi kanıtı açık; bu sprint yeni PDF doğrulaması veya gerçek scope yetkisi üretmedi.
Sprint 39: **GO**, yalnız bağımsız pilot kalibrasyon incelemesi, native temsil kanıtı ve interval varsayımlarının doğrulanması için. Production onboarding: **NO-GO**.

## QA ve yeniden üretim

Yeni v2 regresyonu 75 senaryo grubu; 91 kontrollü + 22 ayrı fixture pilot karşılaştırması. Korunan dosyalar/DOCX'ler SHA-256 ile denetlenir.
Bu sprintte Sprint 35 48/48, Sprint 36 63/63 ve Sprint 37 91 kontrollü + 22 baseline karşılaştırması PASS kaldı. Sprint 37 raporunun normal read-only eşleşmesi değişmedi.
Golden 46/46, corpus 31 regresyon + 11 exploratory fixture, typecheck, lint, build ve diff whitespace kontrolleri PASS. Build 500 kB chunk uyarısı verdi. Yeni TS modülü ayrıca strict TypeScript ve ESLint kontrolünden geçti.
İlk runtime fault-injection v1 doğrulayıcısını tetikledi; test ortak v1 rejection ve v2 refinement U yollarını ayrı doğrulayacak şekilde düzeltildi. Son koşular başarılıdır.
npm.cmd run test çalıştırılmadı; production/DOCX değişikliği ve add/commit/push yok. Status önceki untracked dosyalar ile Sprint 38 dosyalarını gösterir.

```powershell
node tests/audit/sduConservativeDecisionGuardV2Regression.cjs
node tests/audit/sduConservativeDecisionGuardRegression.cjs
node tests/audit/sduGuardedAssessmentBatchRegression.cjs
node tests/audit/sduGuardCalibrationAuditRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Normal regresyon raporla birebir eşleşmeyi kontrol eder; yalnız açık --write-report seçeneği bu dokümanı yeniler.
Dayanaklar: [Sprint 37 audit](SDU_SPRINT_37_GUARD_CALIBRATION_AUDIT.md), [numeric contract](../MARGIN_NUMERIC_AND_PRECISION_CONTRACT.md), [Sprint 33 policy gate](SDU_SPRINT_33_POLICY_APPROVAL_PREPARATION.md).
