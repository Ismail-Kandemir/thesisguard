# Sprint 50 — Turkish Encoding Fix & Real DOCX Readiness

Tarih: 8 Kasım 2026. Başlangıç: `eb0667bb542000c4586f8874843a47669d352d70`;
working tree temizdi. Sprint 48 ve 49 raporları incelendi.

**Sprint 50 GO:** encoding düzeltmesi ve test-only gerçek DOCX hazırlığı tamamlandı.
**Gerçek Word/LibreOffice uyumluluğu BLOCKED; SDÜ onboarding NO-GO.**

## 1. Encoding probleminin kök nedeni

Hata ekranda oluşan bir font sorunu veya React dönüşümü değildir. Engineering
rule JSON'undaki `DIRECT_QUOTATION_PAGE_LOCATOR` kaydının başlığı zaten
`DoÄŸrudan AlÄ±ntÄ± Sayfa LokatÃ¶rÃ¼` olarak saklanmıştı. Aynı kaydın description,
message, solution ve validationEvidence.note alanları da bozuktu.
`BibliographyReferencesValidator.ts` içinde ayrıca 14 bozuk string/template
parçası bulundu; bunlar expected/actual/message/evidence açıklamaları ve iki
teknik hata mesajıydı.

Kanıtlar:

- 162 production TS/TSX/JSON/CSS dosyasının byte'ları strict UTF-8 decode oluyor.
  Yani sorun bugün okuma sırasında yanlış encoding seçilmesi değil, yanlış
  karakterlerin geçerli UTF-8 olarak kaynakta kalıcı saklanmasıdır.
- Başlığın bozuk başlangıcı UTF-8 byte olarak `44 6f c3 84 c5 b8`;
  beklenen `Doğ` başlangıcı `44 6f c4 9f` olmalıdır.
- Doğrulanmış bozuk değerlerin Windows-1252/Latin-1 byte karşılığı yeniden UTF-8
  çözüldüğünde beklenen Türkçe metinler birebir elde ediliyor. Bu, yanlış codepage
  çözümlemesiyle uyumlu bir mojibake izi olduğunu gösterir. Geçmişte hangi araç
  veya yazma adımının hatayı oluşturduğu ayrıca kanıtlanmış değildir.
- RuleLoader eager JSON import ve clone yapıyor; validator `rule.title` değerini
  `ruleName` olarak taşıyor. RuleEngine enrichment, ReportBuilder ve React
  `result.ruleName`/message render'ı yeniden encoding uygulamıyor. `index.html`
  zaten `lang="tr"` ve `charset="UTF-8"` içeriyor.
- Yeni focused test düzeltmeden önce exact source-title assertion'ında exit 1
  verdi. Böylece screenshot'taki metin kaynak JSON'dan yeniden üretildi.
  Düzeltme sonrası aynı assertion ve gerçek Chrome rapor ekranı PASS oldu.

Runtime'a otomatik mojibake düzeltici, genel decode fallback veya React özel
normalizer eklenmedi. Yalnız kaynakta doğrulanmış metinler düzeltildi. Mevcut
doğru UTF-8 değerler korundu. İki eski README'de de bozuk metin blokları görüldü;
UI runtime kaynağı olmadıkları için bu dar düzeltmeye katılmadılar.

## 2. Değiştirilen dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `src/data/universities/comu/faculties/engineering/departments/computer-engineering/bachelor.json` | Tek direct-quotation kuralında beş metin alanı |
| `src/features/analysis/rules/validators/BibliographyReferencesValidator.ts` | 14 doğrulanmış bozuk string/template parçasının yazımı |
| `tests/audit/realWorldDocxValidation.cjs` | Sprint 49 harness'ında açık Desktop/Online/LibreOffice kaynak kimliği ve native uygunluk ayrımı |
| `tests/audit/realWorldDocxValidationRegression.cjs` | Kaynak karıştırma/ambiguous Word negatifleri; 29 → 33 kontrol |
| `tests/audit/turkishEncodingRegression.cjs` | Kaynak, loader, gerçek production raporu, yedi metin ve sekiz mojibake kontrolü |
| `tests/browser/turkishEncodingRegression.cjs` | Chrome'da gerçek engineering upload/analiz ekranı ve yedi metnin report presentation kontrolü |
| Bu rapor | Kök neden, kabul sözleşmesi, QA ve kararlar |

Production RuleLoader, RuleEngine, ReportBuilder, readiness gate, analiz akışı,
React bileşenleri ve skor kodu değişmedi. Yeni dependency veya üniversite yok.
Sprint 49 envanter JSON'u ve mevcut DOCX fixture'ları değiştirilmedi.

## 3. Düzeltilen ve korunan metinler

Tek JSON kuralının düzeltilen alanları:

- title: **Doğrudan Alıntı Sayfa Lokatörü**
- description: “2007 Bilgisayar Mühendisliği bitirme projesi kılavuzunda doğrudan
  alıntılarda kaynak gösteriminde sayfa numarası verilmesini doğrular.”
- message: “Doğrudan alıntı atfında desteklenen sayfa lokatörü güvenilir biçimde
  doğrulanamadı.”
- solution: “Doğrudan alıntı atfında açık sayfa lokatörünü s. veya ss. gösterimiyle
  belirtin.”
- validationEvidence.note: mevcut kapsam notunun `Yalnız güvenilir…`,
  `ilişkilendirilen…`, `kapsam dışıdır` ifadelerindeki karakterler düzeltildi;
  kapsam veya akademik dayanak değişmedi.

Validator düzeltmeleri `bölümü`, `bulunmalı`, `eşleşme`, `güvenle doğrulanamadı`,
`görünür`, `Bölüm boş`, `zorunlu değil`, `yalnızca`, `kurallarını çalıştırır`
ve `değerlerini içermelidir` gibi aynı anlamdaki metinlerle sınırlıdır.
Kontrol akışı, karşılaştırmalar, sayı/boolean değerler veya section semantiği
değişmedi.

Ek bütünlük kanıtı: eski/yeni JSON parse edilip yalnız bu beş alanın doğru
karşılıkları normalize edildiğinde tüm JSON deep-equal. Validator'ın parse edilmiş
TypeScript ağacında bütün yapı/token türleri aynı; yalnız 14 string/template
yaprağı tersine çevrilebilir codepage dönüşümüyle değişmiş durumda.
Rule ID/type/code, expected akademik değer, score, severity, enabled, override,
source grounding ve coverage/trust değerleri korunuyor.

Regresyon örnekleri: **Doğrudan Alıntı Sayfa Lokatörü, İçindekiler, Özet,
Teşekkür, Şekiller, Çizelgeler, Kaynakça**. Çizelgeler dışındaki altı metin üretim
kaynakları ve source/loader/report üzerinden kontrol edildi. `Çizelgeler` mevcut bir
production rule/section alias'ı değildir; bu metin ve diğer altı örnek aynı gerçek
React rapor bileşenine ayrı **presentation-only** test girdisi olarak verildi.
Bu kontrol yeni akademik kural veya alias eklemez.

## 4. QA sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Encoding regresyonu, düzeltme öncesi | FAIL; kaynak başlık beklenen Türkçe metin değil |
| Yeni encoding focused regresyonu, düzeltme sonrası | PASS; 162 runtime kaynak, source/loader/production report, 7 metin, 8 mojibake negatif kontrolü |
| Chrome encoding regresyonu | PASS; gerçek engineering rapor başlığı ve yedi presentation metni doğru; document.characterSet=UTF-8 |
| Sprint 43 production safety | PASS; falsePasses=0, remediatedAssertions=12 |
| Sprint 48 production safety | PASS; 22 senaryo + 44 fixture; normalization/margin parity 44/44 |
| Sprint 48 Chrome readiness | PASS; eksik terminal/duplicate margin/equation+altChunk erteleme, equation kabul; stale-success yarışı korunuyor |
| Sprint 49 real-world regression | PASS; genişletilmiş 33 mekanizma kontrolü; nativeValidation=BLOCKED |
| Golden | PASS; 46/46 |
| Corpus | PASS; 31 regression + 11 exploratory |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS; mevcut yaklaşık 734 kB JS chunk / 500 kB uyarısı sürer |
| git diff --check ve syntax/whitespace kontrolleri | PASS |
| Korunan kaynaklar ve DOCX'ler | Diğer 432 eski tracked dosya byte-identical; 44 DOCX değişmedi |

Ek audit denemesinde standalone TypeScript scanner'ın template ifadelerini parser
bağlamı olmadan taraması token sayısı farkı verdi. Bu ad-hoc audit helper'ı gerçek
parse ağacı üzerinden düzeltildi; yalnız 14 string/template değiştiği doğrulandı.
Bu, production veya uygulama regresyon hatası değildir; assertion gevşetilmedi.

## 5. Production güvenlik durumu

Sprint 48 same-package readiness sınırı byte-identical kaldı. Production testleri
eksik terminal/margin, duplicate/çelişkili pgMar, başka belgenin temiz XML'ini
metadata'dan enjekte etme, equation+altChunk ve geçersiz DOCX senaryolarını yeniden
doğruladı. Ertelenen analizde RuleEngine/ReportBuilder çağrısı **0**, rapor ve skor
yok. Güvenilir fixture'lar gereksiz engellenmedi.

PASSED/FAILED/NOT_APPLICABLE sözleşmesi ve skor aritmetiği değişmedi.
ÇOMÜ eşikleri, Figure Level 3, mevcut section/bibliography/table/abbreviation
semantiği ve SDÜ guard v1/v2/admission default-deny korunuyor. Page-number
PARTIAL/MEDIUM sınırı ve 46 kurallık coverage/trust baseline'ı değişmedi.

## 6. Gerçek DOCX hazırlığı ve kanıt durumu

Yeni gerçek belge veya yeni sentetik DOCX üretilmedi. Testler mevcut fixture
byte'larını okur; intake mekanizma testi mevcut fixture'ın geçici kopyasını
kullanır ve bunu gerçek uygulama kanıtına terfi ettirmez.

Sprint 49 harness'ının kaynak sözleşmesi aşağıdaki gibi açıklaştırıldı:

| Kaynak | `source.origin` | `source.application` | Native uygunluğu |
| --- | --- | --- | --- |
| Word Desktop | word-native | Microsoft Word Desktop | Ancak bağımsız provenance/privacy/ground-truth review ve başarılı scoped karşılaştırma sonrası |
| Word Online | word-online | Microsoft Word Online | Desktop-native değildir; nativeCompatibilityVerified olamaz |
| LibreOffice | libreoffice-generated | LibreOffice | Ancak kendi doğrulanmış artifact ve review'leriyle |
| Programatik DOCX | programmatic | Kullanılan doğrulanmış editör varsa açık Desktop/Online/LibreOffice adı | Native olamaz; varsa controlled-application-automation-only karşılaştırması |
| Kaynağı doğrulanmamış DOCX | unknown/eksik/çelişkili kimlik | Belirsiz olabilir | Kabul/uyumluluk kararı verilmez |

Yalnız **Microsoft Word** yazan eski belirsiz uygulama etiketi artık Desktop'a
otomatik eşlenmez; yeni başvuruda editör açık belirtilmelidir. Word Online ile
word-native eşleştirmesi ve Desktop ile word-online eşleştirmesi reddedilir.
Programatik kaynak, editörü bilinmese de programmatic sınıfını korur; uygulama
kanıtı yoksa doğrulanmış uygulama karşılaştırmasına kabul edilmez.

`sourceIdentity` yalnız beyan edilmiş editör kimliğini sınıflandırır; provenance
doğrulaması değildir. Sprint 49'un bağımsız reviewer, declaration/artifact hash,
supporting evidence, privacy ve snapshot kontrolleri hâlâ zorunludur. Bir başvuranın
Desktop yazması tek başına native kanıt sağlamaz. Review'in gerçek içeriğini
operatörün bağımsız incelemesi gerekir.

Word Online karşılaştırması ileride gerçek kanıtla yapılırsa yalnız `word-online`
kapsamı taşır. `--require-native` bunun Desktop-native diye geçmesini engeller.
Her batch'te `realWorldValidation=NOT_ESTABLISHED_BY_BATCH` kalır; eksik/rehearsal
kanıtla uyumluluk PASS ilan edilmez.

Mevcut envanter değişmedi: **42 programmatic/synthetic + 2 unknown/unverified**.
Doğrulanmış Desktop-native **0**, Word Online **0**, LibreOffice **0**, gerçek
kullanıcı artifact'ı **0**. Uygulamadan doğrulanmış ground truth veya kabul edilmiş
bağımsız review yok. Sprint 49'daki Word sürüm sorgusu ve tamamlanamayan SaveAs2
denemesi uyumluluk kanıtı değildir. Bu sprintte yeni editör otomasyonu denenmedi.

## 7. Sprint 50 kararı

**GO — yalnız encoding düzeltmesi ve gerçek DOCX hazırlığı kapsamında.**
Kaynak başlık/mesajlar düzeldi, Chrome doğrulandı, editör kaynakları ayrıldı ve
production güvenliği korundu. **Gerçek dünya uyumluluğu BLOCKED/NOT_RUN** kalır;
bu sprint o eksik kanıtı tamamlamış değildir. Gerekli sonraki girdiler: özel intake
alanında final editor-saved DOCX, editör/sürüm/save-chain kanıtı, uygulama değerleri
ve bağımsız provenance/privacy review.

## 8. SDÜ onboarding ve manuel tekrar

**SDÜ production onboarding NO-GO.** Kaynak/native/scope engelleri kapanmadı;
default-deny korunuyor. Git add, commit veya push yapılmadı.

```powershell
node tests/audit/turkishEncodingRegression.cjs
node tests/browser/turkishEncodingRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs
node tests/audit/productionFalsePassRegression.cjs
node tests/audit/realWorldDocxValidationRegression.cjs
node tests/browser/productionReadinessRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Browser kontrolleri yerel Chrome/Edge gerektirir. Gerçek artifact geldikten sonra
Sprint 49 komutu, açık Desktop/Online/LibreOffice kimliği içeren ayrı submission
ve trusted review JSON'larıyla özel intake dizininde çalıştırılabilir. Hassas DOCX
ve supporting evidence açık izin olmadan Git'e eklenmemelidir.
