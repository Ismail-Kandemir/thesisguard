# Sprint 47 — Evidence Integrity & Package Binding

Tarih: 3 Kasım 2026. **Sprint 47 GO (test-only); production onboarding NO-GO.**

Yeni paket bağlı pilotta aynı okumanın raw XML, normalized document ve evidence
bütünlüğü korunuyor. Production kodu değiştirilmedi; production false-PASS yolu
bu sprintte kapanmadı. Sprint 43 güvenlik testi hâlâ kırmızı.

İncelenen kaynaklar: [Sprint 43](SPRINT_43_MARGIN_FALSE_PASS_SAFETY.md),
[44](SPRINT_44_ANALYSIS_READINESS_GATE.md), [45](SPRINT_45_SECTION_EVIDENCE_CLASSIFICATION.md),
[46](SPRINT_46_PRODUCTION_READINESS_DECISION.md), mevcut gate/classifier/regresyonlar
ve production package reader/normalization fonksiyonları.

## 1. Evidence integrity tasarımı

Yeni giriş: tests/audit/packageBoundReadinessPilot.ts.
Yeni regresyon: tests/audit/evidenceIntegrityRegression.cjs.

```text
File / Uint8Array
  → caller'dan bağımsız sahip olunan byte snapshot'ı
  → mevcut readDocxAnalysisXmlParts: tek ZIP okuması
  → aynı parts snapshot'ından normalization + section classifier
  → deep-frozen private context
  → package token + evidence token
  → aynı-context kontrolü + zorunlu raw ile mevcut readiness
       DEFER  → engine/builder/score/report yok
       ACCEPT → mevcut margin RuleEngine/ReportBuilder
```

Raw XML caller tarafından alınan opsiyonel parametre değil; yalnız package
reader'ın aynı okumasından gelir. Raw bulunmaz/boş/bozuk olursa context unavailable
veya readiness deferred olur. New entry'de raw-undefined fallback yok.

Section classifier duplicate pgMar ve çelişkili/eksik yerleşimi, mevcut parser
finite margin kanıtını ve aktif carrier kapsamını denetler. Genel text extraction
open, equation için otomatik margin engeli değildir. Equation + altChunk
ertelenmeye devam eder. Gerçekten farklı fakat tam çoklu section margin'leri
yapısal belirsizlik sayılmaz: ACCEPT sonrası akademik sol-margin FAILED korunur.

Private context, document/evidence dahil derin dondurulur. Audit inspection yalnız
defensive structuredClone verir; bu kopya üzerinde margin değiştirmek gerçek
context'i değiştirmez ve kopya evidence token yerine kullanılamaz. Caller'ın
Uint8Array byte'larını asenkron okuma sürerken değiştirmesi de snapshot'ı değiştirmez.

## 2. Package binding yöntemi ve güven sınırı

readBoundPackage() her çağrıda iki frozen opaque token üretir. Module-private
WeakMap'ler bu token'ları **aynı context nesnesine** bağlar. Gate iki token'ın
kayıtlı kimliğini ve aynı context'e ait olduğunu doğrular.

- Başka belge okumasından evidence → package-binding-mismatch.
- Aynı byte'ların ayrı okumasından evidence dahi → package-binding-mismatch.
  Bu bir false-defer değil, aynı-okuma sözleşmesinin beklenen reddidir.
- Kopyalanan/JSON'lanan token, sahte hash/provenance veya XML string'i → kayıtlı
  token değildir, DEFER. Dosya adı eşitliği veya metadata güven kökü değildir.
- Caller'ın input'a documentXml/hash/provenance eklemesi parsing kaynağını
  değiştirmez; içerik yeniden aynı byte snapshot'ından okunur.
- Gate bağımsız raw + document argümanları veya hash override kabul etmez.
  Bağlam yalnız gerçek byte okumasından üretilir; parts için caller injection
  hook'u yoktur.
- File adaptöründe arrayBuffer bir kez; candidate başına JSZip.loadAsync bir kez
  çağrıldığı ölçüldü. Reader'ın mevcut paket boyut/part/XML kontrolleri korunur.
  ZIP açma sayımı normalization oracle okumasından ayrı yapılır.

Normalization için üretimdeki aynı pure parser/format/numbering/cover fonksiyonları
aynı parts üzerinde compose edildi. createNormalizedDocumentFromDocx burada
çağrılmaz; ikinci ZIP okuması olurdu. QA'da bu public helper ayrı oracle olarak
çağrılır; 44/44 normalized document deep-equal çıktı.

Bu bir test-only **margin** pilotudur: enabled margin kurallarıyla çalışır,
tam 46 kural analysisService/UI entegrasyonu değildir. ACCEPT raporu dört margin
sonucudur; bütün belge veya akademik uygunluk onayı değildir.

Önceki raw/document alabilen classifier/gate helper'ları tarihsel regresyonlar
için korundu. Bunlar package binding güvenlik giriş noktası sayılmaz; yeni bound
API bu helper'ları yalnız kendi private bağlamındaki zorunlu XML ile çağırır.
Production'a eski opsiyonel raw yolu bağlanmamalıdır.

Guarantee kapsamı: güvenilen module/runtime ve mevcut reader'dan elde edilen tek
snapshot'ın işlem içi bütünlüğü. Aynı process'te reader/DOM/engine'i kötü niyetle
monkey-patch eden kod için sandbox veya kimlik doğrulama sistemi değildir.
Token'ların kaybolması/serialize edilmesi fail-closed olur; kalıcı transferable
sertifika değildir. Başka işlemin iki token'ını bütünüyle kullanmak o işlemin
kendi artifact'ını analiz eder; UI'nın doğru isteğe bağlanması ayrıca gerekir.
Bu mekanizma Word-native provenance, tam schema/CRC veya akademik source onayı
garantisi vermez.

## 3. Negatif testler ve gerekçeleri

37 negatif/kontrol denemesi: 31 DEFER, 6 ACCEPT. Hepsinde karar,
reason ve engine/builder çağrı sayıları doğrulandı. Üçü temel olumlu belge
kontrolü; diğer ACCEPT kontrolleri private context/byte ownership ve File adaptörünü sınar.

| Senaryo | Beklenen/gerçek | Reason / gerekçe | Engine / builder |
| --- | --- | --- | --- |
| complete | ACCEPT | Güvenilir, aynı okumadan türetilmiş complete evidence | 1/1 |
| multiple-sections-different-margins | ACCEPT | Güvenilir, aynı okumadan türetilmiş complete evidence | 1/1 |
| equation | ACCEPT | Güvenilir, aynı okumadan türetilmiş complete evidence | 1/1 |
| equation-altChunk | DEFER | section-evidence-unverified, unsupported-section-carrier | 0/0 |
| duplicate-pgMar | DEFER | section-evidence-unverified, margin-element-unverified, margin-value-unavailable | 0/0 |
| conflicting-pgMar | DEFER | section-evidence-unverified, margin-element-unverified, margin-value-unavailable | 0/0 |
| conflicting-top-attributes | DEFER | DOCX_INVALID_XML | 0/0 |
| duplicate-identical-attribute | DEFER | DOCX_INVALID_XML | 0/0 |
| namespace-alias-attribute-conflict | DEFER | DOCX_INVALID_XML | 0/0 |
| missing-terminal | DEFER | section-evidence-unverified, margin-coverage-open, margin-evidence-unavailable, terminal-section-unverified | 0/0 |
| missing-pgMar | DEFER | section-evidence-unverified, margin-evidence-unavailable, margin-element-unverified, margin-value-unavailable | 0/0 |
| missing-top | DEFER | section-evidence-unverified, margin-evidence-unavailable, margin-value-unavailable | 0/0 |
| malformed-margin | DEFER | section-evidence-unverified, margin-evidence-unavailable, margin-value-unavailable | 0/0 |
| duplicate-terminal | DEFER | section-evidence-unverified, section-mapping-mismatch, section-placement-unverified, margin-value-unavailable, terminal-section-unverified | 0/0 |
| table-cell-section | DEFER | section-evidence-unverified, section-placement-unverified | 0/0 |
| unsupported-subDoc | DEFER | section-evidence-unverified, unsupported-section-carrier | 0/0 |
| wrong-OOXML-root | DEFER | section-evidence-unverified, margin-coverage-open, margin-evidence-unavailable, body-unavailable | 0/0 |
| mismatched-XML-close | DEFER | DOCX_INVALID_XML | 0/0 |
| unclosed-XML | DEFER | DOCX_INVALID_XML | 0/0 |
| empty-raw-XML | DEFER | DOCX_MALFORMED_PACKAGE | 0/0 |
| missing-document-part | DEFER | raw-evidence-unavailable | 0/0 |
| invalid-ZIP | DEFER | DOCX_MALFORMED_PACKAGE | 0/0 |
| raw-evidence-token-absent | DEFER | unregistered-evidence | 0/0 |
| null-evidence-token | DEFER | unregistered-evidence | 0/0 |
| foreign-raw-XML-instead-of-evidence | DEFER | unregistered-evidence | 0/0 |
| foreign-clean-evidence-for-dirty-package | DEFER | package-binding-mismatch | 0/0 |
| foreign-dirty-evidence-for-clean-package | DEFER | package-binding-mismatch | 0/0 |
| same-bytes-separate-package-read | DEFER | package-binding-mismatch | 0/0 |
| copied-token-metadata | DEFER | unregistered-evidence | 0/0 |
| serialized-token-metadata | DEFER | unregistered-evidence | 0/0 |
| forged-hash-provenance | DEFER | unregistered-evidence | 0/0 |
| forged-package-token | DEFER | unregistered-package-read | 0/0 |
| same-name-forged-hash-different-content | DEFER | section-evidence-unverified, unsupported-section-carrier | 0/0 |
| mutated-inspection-copy-cannot-replace-evidence | DEFER | unregistered-evidence | 0/0 |
| owned-document-unchanged-by-inspection | ACCEPT | Güvenilir, aynı okumadan türetilmiş complete evidence | 1/1 |
| caller-byte-mutation-after-snapshot | ACCEPT | Güvenilir, aynı okumadan türetilmiş complete evidence | 1/1 |
| File-input-one-byte-read-one-ZIP-read | ACCEPT | Güvenilir, aynı okumadan türetilmiş complete evidence | 1/1 |

Çelişkili aynı pgMar attribute'ları, namespace alias ile yinelenen attribute ve
aynı değerin duplicate attribute olarak yazılması da geçersiz XML sayılır.
Duplicate iki pgMar ise well-formed XML olabilir; classifier tarafından ayrıca
ertelenir. Sayısal validator gevşetilmedi.

DEFER sonuçlarında report, score, status ve passed alanları yok; RuleEngine.run
ve ReportBuilder.build çağrı sayıları **0/0**. Belirsizlik FAILED/N/A'ya eşlenmez;
score=0 gibi sahte bir başarı sonucu üretilmez. ACCEPT yalnız doğrulanmış context
ile mevcut engine/builder'ı 1/1 çalıştırır.

### Test harness düzeltmesi

tests/golden/experimentalGoldenRegression.cjs içindeki minimal Node XML DOM
harness'ı daha önce kapanış etiketlerini eşleştirmiyor ve duplicate attribute'ları
kabul edebiliyordu. Yeni negatifleri yanlış biçimde geçerli saymamak için yalnız
test harness'ında kapanış QName eşleşmesi, EOF'ta açık eleman ve expanded-name
duplicate attribute denetimleri eklendi. Production parser/reader değişmedi.

Bu minimal harness tam XML/OOXML schema validator'a dönüştürülmedi. Native browser
DOMParser parity ve daha geniş syntax/schema kapsamı halen ayrı kabul işidir.

## 4. Mevcut 44 fixture kabul/ertele sonucu

| Grup | Önceki classifier bağlı pilot ACCEPT/DEFER | Paket bağlı pilot ACCEPT/DEFER |
| --- | --- | --- |
| 31 regression | 31/0 | 31/0 |
| 11 exploratory | 11/0 | 11/0 |
| 2 manual fixture | 2/0 | 2/0 |
| Toplam | 44/0 | 44/0 |

Equation fixture ACCEPT kaldı. Mevcut farklı margin içeren fixture'larda akademik
margin PASSED/FAILED kararları ve margin-only skorları oracle raporuyla birebir
korundu. Her fixture için tek candidate ZIP okuması, tam normalization parity
ve mevcut margin raporuyla deep-equal karşılaştırması yapıldı.

42 manifest sentetiği ve 2 unknown/unverified manual belge yeniden native
sınıflandırılmadı. DOCX dosyaları yazılmadı; varyantlar yalnız bellekte üretildi.

## 5. False-accept / false-defer

Ölçülen toplam 81 karar: **50 ACCEPT / 31 DEFER**.
Beklenen sonuca göre **false-accept=0, false-defer=0**.
Bunun 44'ü mevcut fixture, 37'si negatif/kontrol denemesidir.
Bu sayılar yalnız test population'ına aittir; keyfi bilinmeyen DOCX'ler için
evrensel güvenlik/uyumluluk garantisi değildir.

Sprint 46'da gösterilen iki açık yeni bound girişte kapandı:
opsiyonel/raw'sız kullanım registered evidence gerektiriyor; cross-artifact XML
ve evidence kendi package read token'ıyla uyuşmadığında DEFER oluyor.
Eski helper API'lerin historical davranışları veya production analyzeDocx yolu
bu sonuçla çözülmüş sayılmaz.

## 6. QA ve geliştirme sırasında giderilen hatalar

Package.json gerçek script'leri kullanıldı; npm.cmd run test çalıştırılmadı.

| Komut / kontrol | Sonuç |
| --- | --- |
| node tests/audit/evidenceIntegrityRegression.cjs | PASS; 37 negatif/kontrol + 44 fixture, tek candidate ZIP okuması ve 44/44 normalization parity |
| node tests/audit/docxMarginComparisonRegression.cjs | PASS; Sprint 41 |
| node tests/audit/docxCompatibilityRegression.cjs | PASS; Sprint 42, 44 fixture + 37 senaryo; historical safety bulgusu sürer |
| node tests/audit/marginFalsePassSafetyRegression.cjs | **FAIL**, exit 1; Sprint 43 production safety sorunu, 12 assertion |
| node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract | PASS; productionSafety FAIL olarak korunur |
| node tests/audit/analysisReadinessGateRegression.cjs | PASS; Sprint 44 historical raw'sız baseline, historical compatibilityAcceptance FAIL korunur |
| node tests/audit/sectionEvidenceClassificationRegression.cjs | PASS; Sprint 45, 27 senaryo + 3 bütünlük kontrolü + 44 fixture |
| Sprint 46 mimari denemeleri | Ayrı Sprint 46 script'i yok; raw-absence, foreign raw/evidence, duplicate pgMar ve forged metadata negatifleri Sprint 47'de kalıcılaştırıldı |
| npm.cmd run test:golden | PASS; 46/46 |
| npm.cmd run test:corpus | PASS; 31 regression + 11 exploratory |
| npm.cmd run typecheck | PASS |
| Yeni/ilgili test-only TS modülleri için strict tsc --noEmit | PASS |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS; mevcut 726,54 kB JS chunk / 500 kB boyut uyarısı |
| git diff --check | PASS; golden harness için LF/CRLF uyarısı var; yeni untracked dosyaların içeriğini kapsamaz |
| node --check: yeni regresyon ve mevcut golden harness | PASS |
| QA öncesi/sonrası hash kontrolü | PASS; golden harness dışındaki korunan 341 mevcut source/test/rapor dosyası ve 44 DOCX değişmedi |
| git status --short | Başlangıçtaki 11 untracked dosya korundu; 3 yeni Sprint 47 dosyası ve test-only golden harness değişikliği var |

İlk focused koşu empty-raw-XML reason beklentisinde başarısız oldu. Araştırmada
mevcut reader boş ZIP part'ının boyut metadata'sını okuyamadığından
DOCX_MALFORMED_PACKAGE verdiği doğrulandı. DEFER beklentisi değiştirilmedi; yalnız
reason mevcut reader sözleşmesine düzeltildi. Reader gevşetilmedi/değiştirilmedi.

İlk strict tsc koşusu readonly RuleDefinition dizisinin mutable engine parametresine
aktarılmasında TS2345 verdi. Caller dizisinin sahip olunan mutable tipli kopyası
oluşturulup runtime freeze uygulandı; typecheck geçti. any veya cast ile bu
readonly hatası gizlenmedi. Reader için kullanılan Uint8Array→File runtime adapter
cast'i mevcut Node golden harness yaklaşımını izler; normalization oracle parity
ile ayrıca doğrulandı.

Manuel tekrar:

```powershell
node tests/audit/evidenceIntegrityRegression.cjs
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract
node tests/audit/analysisReadinessGateRegression.cjs
node tests/audit/sectionEvidenceClassificationRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
.\node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable --strict --skipLibCheck --types vite/client tests/audit/packageBoundReadinessPilot.ts tests/audit/analysisReadinessGatePilot.ts tests/audit/sectionEvidenceClassifier.ts
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Sprint 43 default güvenlik komutunun exit 1 sonucu beklenen mevcut engeldir;
başarılı production safety doğrulaması gibi raporlanmaz.

## 7. Production entegrasyonuna hazır mı?

**Henüz hayır.** Tek-okuma ve package/evidence bağlama prototipi test-only
sınırında doğrulandı. Gerçek analysisService aynı bağlamı kullanmıyor, UI erteleme
mapping'i aktif değil ve production güvenlik testi kırmızı.

Production entegrasyonu öncesinde mevcut private normalization kompozisyonu
merkezi production helper ile paylaşılmalı; test kopyasının sürüklenmesi engellenmeli.
Gerçek browser XML davranışı, native/unknown belgeler, runtime failure reason'ları,
tüm analysisService tüketicileri ve stale UI report/score yarışları ayrıca sınanmalı.
Yeni API yalnız margin-only test raporu üretir; 46 kural servisinin tamamında gate
çalıştığını kanıtlamaz. Existing ZIP limitleri ve SDÜ admission default-deny aynı kalmalı.

## 8–9. Karar ve değişen dosyalar

**Sprint 47 GO:** istenen test-only evidence integrity, tek-read package binding,
negatif senaryolar ve 44 fixture parity tamamlandı. Ölçülen kapsamda yeni
false-accept/false-defer görülmedi.

**Production onboarding NO-GO:** production false-PASS hâlen açık; önceki
native/source/admission engelleri sürüyor. SDÜ guard/admission mantığı değişmedi.

Eklenenler: packageBoundReadinessPilot.ts, evidenceIntegrityRegression.cjs ve bu rapor.
Değiştirilen mevcut dosya: yalnız tests/golden/experimentalGoldenRegression.cjs
(Node XML harness kontrolleri). Production kodu ve önceki audit rapor/regresyonları
korundu. Git add, commit veya push yapılmadı.
