# Sprint 43 — Margin False-PASS Safety

Tarih: 3 Kasım 2026. **Sprint 43 NO-GO; production onboarding NO-GO.**

False-PASS yeniden üretildi. Production düzeltmesi yapılmadı: mevcut üç durumlu
RuleResult sözleşmesi belirsizliği semantik olarak doğru temsil edemiyor.
Kullanıcının izin verdiği test-only kanıt ve uygulanabilir tasarım önerisi yolu izlendi.
Bu rapor bir production fix veya güvenlik kabul başarısı değildir.

## 1. Kesin kök neden ve akış

[Sprint 41](SPRINT_41_DOCX_MARGIN_COMPARISON.md),
[Sprint 42](SPRINT_42_DOCX_COMPATIBILITY.md), mevcut margin assessment,
package comparison ve compatibility regression'ları incelendi.

1. `documentXmlParser.parseSectionProperties()` paragraph `pPr/sectPr` kayıtlarını
   `source: paragraph` olarak çıkarır; body'nin doğrudan `sectPr` çocuğu varsa
   son kaydı `source: body` yapar. Terminal kayıt yokken onu uydurmaz.
2. `pageSections` bu source ve margin bilgilerini korur. Aggregate `pageMargins`
   son okunabilen section'dan gelir. Son section'ın uygun olması önceki kayıtların
   uygunluğunu kanıtlamaz; mevcut validator section'ların tümünü karşılaştırır.
3. **Margin inventory coverage=open parser'da üretilmez.**
   `MarginValidator.assess()` son section source'u body değilse bunu üretir.
   `decideRuleAssessment()` kapalı population olmadan compliant üretmez;
   doğrulanmış bir counterexample varsa açık coverage'da da violation korunabilir.
4. Parser'ın `getSectionExtractionCoverage()` çıktısı ayrı bir kanıttır:
   `sectionExtractionCoverage.population`. Örneğin altChunk/subDoc/contentPart
   taşıyıcıları veya okunamayan body bu kapsamı open yapabilir. Terminal section
   eksik, fakat normal paragraph body okunabilir ise extraction coverage closed,
   margin inventory coverage open olabilir. İki alan birbirinin yerine geçmez.
5. `createNormalizedDocumentFromDocx()` ve `analyzeDocx()` normalizer'ları bu
   section bilgisini taşır. Yeni test raw parse ile normalized pageSections ve
   extraction coverage eşitliğini ayrıca kontrol eder.
6. `RuleEngine.run()` yalnız `validator.validate()` çağırır. `assess()` opt-in ve
   unscored'dur; production legacy engine bu kararı veya coverage'ı kullanmaz.
7. `MarginValidator.validate()` bütün okunan değerler beklenene eşitse PASSED
   döndürür. Terminal source, kapsamın kapanması veya okunamayan carrier için
   bir readiness şartı yoktur. Dolayısıyla eksik inventory'nin okunabilen uygun
   alt kümesi bütün belge adına PASSED olur.
8. `ReportBuilder.build()` gelen RuleResult'ları sayar; kapsamı yeniden incelemez.
   PASSED/FAILED sayıları evaluatedRules ve skora girer. Mesaj veya coverage
   metadata'sı eklemek bu yanlış sonucu veya puanı kendiliğinden düzeltmez.

## 2. Etkilenen kurallar

ÇOMÜ Gıda Teknolojisi / Lisans / Deneysel Çalışma seçiminde:

| Kenar | Rule ID | Beklenen cm |
| --- | --- | ---: |
| Üst | comu.applied-sciences.food-technology.bachelor.margin.top | 3 |
| Alt | comu.bachelor.margin.bottom | 2,5 |
| Sol | comu.bachelor.margin.left | 3 |
| Sağ | comu.bachelor.margin.right | 2,5 |

Problem üniversiteye özel bir detector'dan değil ortak MarginValidator'dan geliyor.
Ek sentetik kanıt koşuları:

- Base `comu.bachelor.margin.left/right/top/bottom`: dört false-PASS yeniden
  üretildi. Base set `loadRules()` ile yüklendi; catalog'da bağımsız bir program
  seçimi olduğu iddia edilmedi. Food Technology üst kuralı base üstü override eder.
- `comu.engineering.computer-engineering.bachelor.margin.left/right/top/bottom`:
  gerçek mevcut engineering scope çözümlemesiyle dört false-PASS yeniden üretildi.
- Başka üniversite için aktif production margin rule set bulunmadı. ÇOMÜ master
  ve doctorate JSON dosyaları boş placeholder; bunlar için çalışmış kural veya
  compatibility sonucu uydurulmadı. İleride aynı validator'a yönlendirilen
  MARGIN_TOP/BOTTOM/LEFT/RIGHT tipleri aynı riski taşır.
- SDÜ pilot top/bottom assessment ve guard v1/v2 ayrı test yoludur. Bu sprintte
  mantıkları veya production admission politikası değiştirilmedi.

## 3. Önce başarısız regresyon ve önce/sonra karar tablosu

Yeni dosya: `tests/audit/marginFalsePassSafetyRegression.cjs`.
Dokuz senaryo, full-correct.docx üzerinden yalnız bellekte OOXML body mutation
ile üretildi; fixture yazılmadı. Word-native/gerçek kullanıcı belgesi değiller.

Sıra üst/alt/sol/sağ; P=PASSED, F=FAILED, U=undetermined, C=compliant,
V=violation. Son sütun **yalnız test-only tasarım prototipidir**.
Production önce/sonra aynı kaldı; prototip sonucu production sonucu yerine sunulmuyor.

| Senaryo | Margin / extraction coverage | Assessment | Önce legacy | Sonra production | Prototip |
| --- | --- | --- | --- | --- | --- |
| Terminal section eksik | open / closed | U/U/U/U | P/P/P/P | P/P/P/P | blocked, rapor/skor yok |
| İki paragraph section, terminal yok | open / closed | U/U/U/U | P/P/P/P | P/P/P/P | blocked, rapor/skor yok |
| altChunk, terminal mevcut | closed / open | C/C/C/C | P/P/P/P | P/P/P/P | blocked, rapor/skor yok |
| pgMar eksik | closed / closed | U/U/U/U | F/F/F/F | F/F/F/F | blocked, rapor/skor yok |
| Üst attribute eksik | closed / closed | U/C/C/C | F/P/P/P | F/P/P/P | blocked, rapor/skor yok |
| Tam tek section | closed / closed | C/C/C/C | P/P/P/P | P/P/P/P | ready, aynı rapor |
| Tam iki section | closed / closed | C/C/C/C | P/P/P/P | P/P/P/P | ready, aynı rapor |
| Önceki section sol 3,2 cm, son section sol 3 cm | closed / closed | C/C/V/C | P/P/F/P | P/P/F/P | ready, aynı rapor |
| Önceki section pgMar eksik, son uygun | closed / closed | U/U/U/U | F/F/F/F | F/F/F/F | blocked, rapor/skor yok |

Default koşu eksik kanıtın PASSED olmamasını assert eder ve **exit 1** verir:
ilk iki durumda 8 doğrudan açık-margin-coverage PASSED; altChunk senaryosunda
4 konservatif readiness itirazı, toplam 12 assertion ihlali.
altChunk'ın akademik extraction kapsamını açması, her margin'in gerçekten yanlış
olduğunu kanıtlamaz. Üçüncü senaryo güvenilir acquisition için konservatif teknik
erteleme kontrolüdür; margin'e yeni akademik şart ekleme gerekçesi değildir.

`--audit-contract` modu mevcut davranışın kanıtını ve prototipin sözleşmesini
assert eder; exit 0 verir ama aynı `productionSafety: FAIL` bulgusunu açıkça
yazdırır. Default güvenlik testi yeşile çevrilmedi, assertion gevşetilmedi.

İlk geliştirme denemesi ek scope testinde `AcademicSelectionError: Çalışma türü
seçimi zorunludur` verdi. Test geçersiz broad bachelor seçimi yerine base
`loadRules()` ve mevcut engineering seçimine düzeltildi; production selector
gevşetilmedi. Ardından güvenlik testi gerçek false-PASS nedenleriyle kırmızı kaldı.

## 4. Üç durumlu sözleşme ve production değişiklikleri

**Yapılan production değişikliği: yok.** Dördüncü RuleResult durumu eklenmedi.

`RuleResultStatus` yalnız PASSED / FAILED / NOT_APPLICABLE içeriyor.
Belirsiz kanıt için bu sözleşmede doğru bir akademik sonuç yok:

- PASSED: yeterli kanıt olmadan uygunluk iddiası olur.
- FAILED: kanıt eksikliğini doğrulanmış akademik ihlal gibi skorlar.
  Legacy eksik pgMar yolunun zaten F olması bu eşlemeyi genişletmek için
  semantik yetki vermez; mevcut sorun olarak ayrıca kaydedildi.
- NOT_APPLICABLE: margin kuralı belgeye uygulanıyor; uygulanamazlık koşulu yok.
- Kuralı sonuçlardan çıkarmak toplamı/paydayı değiştirir; sessiz bir çözüm değildir.
- Uyarı/evidence ekleyip status PASSED bırakmak false-PASS'i gidermez.

`RuleResult.coverage` mevcut object evaluation sayımı içindir; reason enum'u
margin inventory belirsizliğini kapsamaz. Metadata'yı eklemek mevcut status ve
ReportBuilder aritmetiğine etki etmez. AssessmentReport'taki undetermined kararı
unscored ayrı sözleşmedir; legacy rapora sessizce bağlanamaz.

## 5. En küçük uygulanabilir tasarım önerisi ve skorlama

Öneri: **RuleResult dönüşümünden önce açık teknik report-readiness sınırı.**

1. Mevcut registry'nin margin `assess()` üreticisini ve
   `decideRuleAssessment()` kararını kullan; ikinci section/numeric detector yazma.
2. Seçili enabled margin kurallarında açık inventory veya belirsiz sayısal kanıt
   varsa engine/scorer çalıştırmadan analizi teknik olarak ertele.
3. Teknik erteleme akademik RuleResult değildir. Rule ID, scope, kaynak veya
   akademik değer değişmez; FAILED/NOT_APPLICABLE/score üretilmez.
4. Bütün margin kanıtı güvenilir ise mevcut RuleEngine ve ReportBuilder'ı aynen
   çağır. Kanıtlanmış gerçek margin farkı FAILED kalır.
5. Entegrasyon için `analyzeDocx()` sınırında açık bir teknik readiness hatası ve
   çağıranın bunu işleyebilmesi gerekir. UploadPage bugün generic hatayı
   “geçerli DOCX ile tekrar deneyin” olarak gösteriyor; bunu belirsizlik yerine
   yeni bir package bozukluğu gibi sunmak doğru olmaz. Mevcut DocxPackageError
   da bu amaçla yeniden kullanılmamalı. Açık hata sözleşmesi, UI mesajı ve tüm
   tüketiciler için uyumluluk kararı gerekir.

Test-only `readinessPrototype()` bu öneriyi mekanik olarak sınar: yalnız mevcut
semantic kanıtı okur; blocked durumda callback 0 kez çağrılır, report null ve
status/passed/score alanları yoktur. Ready durumda callback bir kez çalışır ve
sonuç mevcut raporla deep-equal olur. Prototip document'ı değiştirmez.

Prototip extraction coverage belirsizliğini de konservatif erteleme nedeni sayar.
Bu academic-section extraction alanı margin envanterinin birebir otoritesi
değildir; native/unsupported-carrier incelemesi olmadan bütün production
belgelerine böyle bir gate uygulamak gereksiz redlere yol açabilir.
Bu nedenle prototip production güvenliği kanıtlanmış bir drop-in fix değildir.

Mevcut tüm skorlar değişmedi. Dokuz senaryonun yalnız dört margin'lik alt
raporunda: tam uygun 100, tek doğrulanmış sol ihlali 75, bütün kanıt eksik 0.
Bu margin-only skorlar tam 46 kural raporunun skoru değildir.
Prototip blocked durumda skor 0 değil **skor yok** verir.

Skor riski somut örnek: terminal eksik sentetik tam rapor 46 toplam / 8 P / 15 F /
23 N/A, evaluated=23 ve mevcut formülle yaklaşık 35 puan. Dört P'yi F yapmak
aynı belgeyi 4/23 ile 17 puana, N/A yapmak 4/19 ile 21 puana taşır. İkisi de
kanıt belirsizliğini sessizce farklı bir akademik sonuca/puana dönüştürür.

Bu önerinin production kapsamı yeni teknik readiness/error boundary ve kullanıcı
mesajıyla sınırlanabilir; parser, RuleResult enum'u, rule ID'leri, score formülü,
SDÜ guard'ları veya onboarding değişmemeli. Yine de önceden rapor alan eksik
belgelerin artık rapor alamaması davranış değişikliğidir; otomasyonlar ve gerçek
belge uyumluluğu ayrıca doğrulanmalıdır. Bu sprintte böyle bir entegrasyon yapılmadı.

## 6. Kalan riskler ve karar

- Production false-PASS halen var; yeni kırmızı test bunu görünür tutar.
- Legacy eksik sayısal kanıt halen FAILED üretiyor; bunu U olarak yorumlamıyoruz.
- Terminal section varlığı tam fiziksel/rendered margin kanıtı değildir.
- İki ondalık cm hassasiyet sözleşmesi ve SDÜ kaynak/native kanıt engelleri sürer.
- Gerçek kullanıcı, Word-native veya LibreOffice round-trip uyumluluğu doğrulanmadı.
- SDÜ guard v1/v2, frozen source ve admission mantığı değişmedi; Sprint 42 default
  admission ve gerçek industrial-engineering scope reddini yeniden doğruladı.

**Sprint 43 NO-GO:** güvenlik kabul testi kırmızı; production false-PASS düzeltilmedi.
Test-only kanıt ve entegrasyon önerisi teslim edildi.
**Production onboarding NO-GO:** mevcut bağımsız engeller ve false-PASS devam ediyor.

## 7. QA ve manuel tekrar

Package.json gerçek script'leri doğrulandı. `npm.cmd run test` kullanılmadı.

| Komut | Sonuç |
| --- | --- |
| node tests/audit/marginFalsePassSafetyRegression.cjs | **FAIL**, exit 1; 12 safety assertion; production sorunu açık |
| node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract | PASS, exit 0; 9 senaryo/prototip; productionSafety FAIL olarak korunur |
| node tests/audit/docxMarginComparisonRegression.cjs | PASS; Sprint 41 iki belge |
| node tests/audit/docxCompatibilityRegression.cjs | PASS; Sprint 42, 44 DOCX + 37 senaryo; mevcut safety bulgusu sürer |
| npm.cmd run test:golden | PASS; 46/46 |
| npm.cmd run test:corpus | PASS; 31 regression + 11 exploratory |
| npm.cmd run typecheck | PASS |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS; JS chunk 726,54 kB, 500 kB boyut uyarısı |
| git diff --check | PASS; yeni untracked dosyaların içeriğini kapsamaz |
| node --check tests/audit/marginFalsePassSafetyRegression.cjs | PASS |
| QA öncesi/sonrası hash kontrolü | PASS; src ağacı, 44 DOCX ve korunan 7 test/guard/rapor değişmedi |
| git status --short | Yalnız başlangıçtaki iki Sprint 42 dosyası ve yeni iki Sprint 43 dosyası untracked |

QA sonuçları default kırmızı testi gizlemez. Genel güvenlik kabulü başarısızdır.
Mevcut Sprint 41/42 testleri ve raporları yeniden yazılmadı. Sprint 42 test/raporu
çalışma başlangıcında zaten untracked idi; kullanıcının dosyaları korundu.
Yeni Sprint 43 dosyaları yalnız bu rapor ve test-only regresyondur.

```powershell
node tests/audit/marginFalsePassSafetyRegression.cjs
# Yukarıdaki komut production false-PASS sürerken exit 1 vermelidir.
node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Git add, commit veya push yapılmadı.
