# Sprint 49 — Real-World DOCX Validation

Tarih: 8 Kasım 2026. Başlangıç: `d6d0d90`; çalışma ağacı temizdi.
**Sprint 49 gerçek dünya doğrulaması NO-GO/BLOCKED. Production onboarding NO-GO.**
Test-only envanter, kabul/karşılaştırma harness'ı ve test planı tamamlandı;
gerçek Word/LibreOffice/kullanıcı belgeleriyle doğruluk ölçümü tamamlanmadı.

Sprint 39'un `SDU_NATIVE_EVIDENCE_REQUEST.md` raporu, Sprint 40 native acceptance
raporu, Sprint 41–48 raporları, fixture manifesti ve aktif production readiness
gate incelendi. Önceki eksik native kanıtlar yeni etiketlerle kapatılmadı.

## 1. Mevcut belge envanteri

| Kaynak sınıfı | Belge sayısı | Dayanak |
| --- | ---: | --- |
| Microsoft Word-native verified | 0 | Bağımsız incelenmiş oluşturma/kaydetme zinciri yok |
| LibreOffice-generated verified | 0 | Doğrulanmış LibreOffice oturumu ve artifact yok |
| Programmatic/synthetic | 42 | Mevcut manifestin `synthetic-ooxml` ve `createdWith` kayıtları |
| Unknown/unverified | 2 | İki manual fixture için uygulama/sürüm/save-chain doğrulanmamış |
| Toplam | 44 | Workspace'te mevcut DOCX byte'ları |

Tam, belge bazlı kayıt:
[SPRINT_49_DOCX_INVENTORY.json](SPRINT_49_DOCX_INVENTORY.json).
Her kayıt relative path, SHA-256, boyut, sınıf, oluşturma yöntemi/kaynak referansı,
uygulama/sürüm, application-verified değerler, ThesisGuard section/margin değerleri,
table count/TOC gözlemi, dört margin kuralının gerçek kararı ve tam rapor sayımlarını
tutar. Uygulamadan doğrulanmamış alanlar **null**; ground-truth karşılaştırması
**NOT_RUN** ve nedeni açıktır. Manifestin sentetik beklenen sonuçları ayrı
`syntheticRegressionOracle` alanındadır; uygulama ground truth'u değildir.

Unknown iki dosya:

| Dosya | SHA-256 |
| --- | --- |
| `tests/audit/manual-fixtures/ThesisGuard_3cm_YENI_TEST.docx` | `8c39e1c67a23701410dadba7105d2b12055052fccd68048a5de66d79101ebda5` |
| `tests/audit/manual-fixtures/ThesisGuard_margin_2_5cm_synthetic.docx` | `74a16a551ded44192127ec8ca2cc9178c74f0f7e564cf76b603c065173071732` |

Dosya adı, docProps/Application etiketi, ZIP timestamp veya parser başarısı native
köken kanıtı sayılmadı. Workspace taraması hidden girdileri kapsar; `.git`,
`node_modules`, `dist`, `.codex`, `.agents`, `.aws` ve symlink hedefleri dışarıdadır.
Kişisel belge klasörleri taranmadı. Kaynak manifestlerinde anılan fakat diskte
olmayan DOCX'ler envantere veya native sayısına eklenmedi.

## 2. Gerçek Word/LibreOffice belgeleri bulundu mu?

**Hayır.** Mevcut 44 belge arasında doğrulanmış manuel Word-native,
LibreOffice-generated veya gerçek kullanıcı belgesi yoktur.

Makinede Word executable'ı bulundu. Ayrı, gizli ve başlangıçta sıfır açık belge
bulunan COM örneğinde uygulama **Version 16.0 / Build 16.0.20527** bildirdi.
İlk sandbox denemesi `0x80070520` COM oturum hatası verdi; izinli ayrı oturumda
sürüm sorgusu başarılı oldu. Bu yalnız uygulamanın kullanılabilirlik gözlemidir;
DOCX doğrulama veya native belge kanıtı değildir.

Kişisel veri içermeyen geçici belgelerle otomasyon denendi. Built-in property
erişiminde null-reference oluştu; bu opsiyonel adımlar çıkarıldıktan sonra
`SaveAs2` aşaması tamamlanmadı. Kabul edilebilir final DOCX/readback kanıtı
üretilemedi. Yalnız bu denemelerin exact PID/komut satırı doğrulanmış otomasyon
süreçleri kapatıldı; kullanıcının açık belgeleri/terminali hedeflenmedi.
Başarısız otomasyon helper'ı teslimata dahil edilmedi.

LibreOffice PATH, standart kurulum yolları ve App Paths kontrolünde bulunamadı.
Bu, makinenin bütün disklerinde LibreOffice bulunmadığının kanıtı değildir;
bu oturumda kullanılabilir/doğrulanmış LibreOffice sürümü yoktur.
Yeni uygulama kurulmadı; internette bulunan rastgele DOCX'ler native kanıt diye
alınmadı. Otomasyonla başarılı bir Word örneği oluşsaydı dahi programmatic sınıfı
ve otomasyon kapsamı ayrı tutulacak, manuel-native veya gerçek kullanıcı diye
etiketlenmeyecekti.

## 3. Ground truth kapsamı ve fixture kabul süreci

**Uygulamadan doğrulanmış belge: 0/44; gerçek ground-truth karşılaştırması: 0.**
Word/LibreOffice UI/uygulama oturumu üzerinden görülmeyen değer ground truth
değildir. Parser/XML'den geri hesaplanan margin, manifest beklentisi veya mevcut
PASSED sonucu bu boşluğu doldurmaz. Fiziksel/footer yerleşimi statik XML'den
doğrulanmış sayılmaz.

Yeni test-only harness:
[realWorldDocxValidation.cjs](../../tests/audit/realWorldDocxValidation.cjs).
Production servisinin mevcut API'sini kullanır; production gate/scorer/validator
yerine yeni akademik detector veya akademik eşik tanımlamaz. Varsayılan komut
yalnız mevcut envanterin gözlemini üretir; native uyumluluk yetkisi vermez.

Gerçek belge kabul sırası:

1. Kişisel verisiz sıfırdan içerik tercih edilir. Ham kullanıcı tezi repository
   dışındaki özel intake dizininde tutulur; kullanım/paylaşım yetkisi kaydedilir.
2. Uygulama adı, tam sürüm/build, oluşturma yöntemi, son kaydetme ve dönüşüm zinciri
   kaydedilir. Manuel oluşturma, otomasyon ve başka uygulamada yeniden kaydetme
   ayrı örneklerdir. UI'da her section'ın gerçek margin ayarı ve section seçimi,
   ilgili stil/field/nesne ayarları gözlenir. Beklenen değerler gözlemden önce
   ThesisGuard çıktısından doldurulmaz.
3. Son kapatılmış DOCX'in hash/boyutu hesaplanır. Anonimleştirme veya yeniden
   kaydetme sonrası yeni artifact/hash ve yeni inceleme gerekir.
4. Başvurudan ayrı güvenilen operatör provenance, uygulama-ground-truth ve privacy
   kayıtlarını inceler. Destek belgeleri de kişisel veri bakımından incelenir.
   Başvurunun içine gömülmüş kendi `verified`/review iddiası kabul edilmez.
5. Harness aynı dosya ve declaration fingerprint'ine bağlı bağımsız review'i,
   destek artifact hash'lerini, sürümü, privacy onayını ve root içi gerçek yolları
   doğrular. Bilinen sentetik corpus'un yeniden adlandırılmış aynı-byte kopyası
   native sınıfa alınmaz. Eksik/çelişkili kanıt kabulü engeller.
6. Kabul edilen exact byte snapshot'ıyla production gözlemi yapılır. Section
   değerleri ve seçilen akademik kararlar bağımsız oracle'la karşılaştırılır;
   field/rule uyuşmazlıkları beklenen/gerçek değerleriyle tutulur. Analiz hatası,
   DEFER veya boş batch uyumluluk başarısı değildir. Asenkron analiz sonrasında
   DOCX ve supporting evidence hash'leri yeniden kontrol edilir.
7. Test için kabul veya scoped MATCH, Git'e alma izni değildir. Gerçek içerik,
   kişisel bilgi veya hassas supporting artifact açık onay olmadan Git'e eklenmez.
   Bu sprintte yeni DOCX veya kullanıcı içeriği Git'e kopyalanmadı.

### Test-only kayıt sözleşmesi

| Girdi | Gerekli alanlar |
| --- | --- |
| Submission | Benzersiz pseudonymous `id`, root-relative `file`, son byte `sha256`/`byteSize` |
| `source` | `origin`: word-native / libreoffice-generated / programmatic; `application`: Microsoft Word / LibreOffice; `version`, `creationMethod`, `creatorId` |
| `expected.fields` | Uygulamadan doğrulanan `pageSections` (her section için dört finite cm değeri), isteğe bağlı `tableCount`, `tocPresent`; en az bir alan |
| `expected.rules` | Mevcut ÇOMÜ experimental selection içindeki rule ID ve bağımsız, kaynakla sınırlı PASSED/FAILED/NOT_APPLICABLE beklentisi; en az bir benzersiz kural |
| Bağımsız review | `id`, DOCX `sha256`, `declarationSha256`, creator'dan farklı `reviewerId`, `reviewedAt`, `status: approved`, `privacyApproved: true` |
| Review amacı | `real-application-validation` veya yalnız mekanizma için `mechanism-rehearsal` |
| Review desteği | Üç ayrı purpose: provenance / ground-truth / privacy; her biri root-relative artifact path ve exact SHA-256; bir kanıt paketi birden çok ekran kaydı içerebilir |

Declaration fingerprint'i mevcut Sprint 40 `fingerprintDeclaration` fonksiyonuyla
üretilir. Review JSON'u başvuranın beyanı değil, operatör tarafından bağımsız
kürasyonla sağlanan ayrı girdidir. Hash'ler byte bağını kanıtlar; bir ekran
kaydının gerçekten o uygulamayı gösterdiğini veya reviewer kimliğini kriptografik
olarak ispatlamaz. Bu içerik incelemesi operatörün güven sınırıdır. Mekanizma
testlerindeki hayali destek kayıtları gerçek uygulama kanıtı sayılmaz.

İlk harness doğrudan margin/section sayısı, tablo sayısı ve TOC field varlığını
karşılaştırır; akademik karar karşılaştırması mevcut 46 kuraldan seçilebilir.
Diğer UI/stil/nesne ayrıntıları supporting evidence içinde tutulmalıdır; bunların
ham parser değerleri için ek test-only alanlar gerekebilir. Bu sınır yeni native
kanıt gelmeden tamamlanmış rich-document doğrulaması gibi sunulmaz.

`verifiedCompatibility`, yalnız kabul edilmiş, gerçek inceleme amaçlı, tamamlanmış
analizin karşılaştırılan alan/kural alt kümesi eşitse true olabilir. Programmatic
belgede kapsam `controlled-application-automation-only` kalır; native olmaz.
Her batch'in `realWorldValidation` alanı `NOT_ESTABLISHED_BY_BATCH` kalır: tek
belgenin veya bir alt kümenin MATCH olması bütün sürüm/matris kapsamını kanıtlamaz.
`--require-native`, otomasyon-only ve eksik native girdilerin CLI başarısını engeller.

## 4. Gerçek belge doğrulama matrisi ve test edilen türler

Aşağıdaki her satır hem Word hem LibreOffice için bağımsız oluşturma/kaydetme
zinciriyle çalıştırılmalı. Her uygulama için en az iki ayrı, exact build'i kaydedilen
sürüm; ayrıca varsa gerçek kullanıcıdan son hali uygulamada açılıp incelenen
anonimleştirilmiş örnek planlanır. Sürümün adı veya dosyanın kökeni varsayılmaz.
Cross-editor Save As/round-trip, özgün native örnekten ayrı lineage'dır.

| Durum | Uygulamada ground truth | ThesisGuard / akademik karşılaştırma | Native sonuç |
| --- | --- | --- | --- |
| Tek section, standart margin | Her dört kenar ve hangi section'a uygulandığı | pageSections ve dört mevcut margin kararı | NOT_RUN |
| Çoklu section, farklı margin | Her section ayrı; önceki section ihlal, son section uygun kontrolü | Tam envanter, önceki ihlalin korunması | NOT_RUN |
| Sayfa sonu ve section break | Görünür biçim işaretleri; page break/next-page/continuous section ayrımı | Page break'in section sanılmaması; section population | NOT_RUN |
| Başlık stilleri | Heading/outline; aynı metinle Normal-style distractor | Mevcut semantic heading kimliği ve ilgili kurallar | NOT_RUN |
| İçindekiler | Gerçek TOC field; ayrı düz metin kontrolü ve field update zinciri | tocPresent ve ilgili mevcut akademik kararlar | NOT_RUN |
| Tablo ve şekiller | Uygulamada gerçek tablo/nesne; caption ve konum | Tablo sayısı ve mevcut object/caption kuralları; generic drawing şekil kanıtı değildir | NOT_RUN |
| Denklem | Equation nesnesi; düz metin kontrolü; tam section/margin | Gereksiz DEFER olmaması; equation+unsupported-carrier ayrı güvenlik kontrolü | NOT_RUN |
| Dipnot ve sonnot | Note türü ve belge akışından ayrımı | Mevcut body/section semantiği ve ilgili kural kararları | NOT_RUN |
| Üstbilgi ve altbilgi | Section linkleri, first/even varyantları, PAGE field ve ekran yerleşimi | Mevcut numbering kararları; fiziksel yerleşim kanıtı ayrıca tutulur | NOT_RUN |
| Uygulama/sürüm farkları | Aynı içerikle iki ayrı Word build ve iki LibreOffice build; exact save format | Karar/value diff'i, version bazlı kapsam; round-trip ayrı tutulur | NOT_RUN |

Mevcut sentetik kapsam çoklu section, stiller, TOC, tablo/nesneler, equation,
dipnot/sonnot ve numbering gibi parser temsillerini içerir. Golden/corpus ve
focused regresyonları bunları sentetik olarak sınar; bu tabloya native PASS
olarak aktarılmaz. Gerçek kullanıcı doğruluğu ölçülmedi.

## 5. Uyumluluk ve güvenlik bulguları

- Aktif production gate `readReadyDocxDocument` içindeki aynı paket/raw bağından
  çalışıyor. Gate, RuleEngine, ReportBuilder, scoring ve UI byte'ları değişmedi.
- Mevcut 44 belge analizi tamamladı; bu sayım provenance/uyumluluk onayı değildir.
  Application-verified değer ve beklenen akademik karar bilinmediğinden native
  uyuşmazlık oranı, false-accept veya false-defer oranı **hesaplanamaz**.
- Sprint 43: 12 eski false-PASS kontrolü production'da sıfır false-PASS ile geçti.
  Sprint 48: 22 negatif/kontrol + 44 fixture geçti; eksik kanıtta sıfır
  RuleEngine/ReportBuilder çağrısı ve rapor/skor yokluğu doğrulandı.
- Equation kontrolü kabul, equation+altChunk erteleme kaldı. Chrome'da hata mesajı
  ve eski başarılı isteğin yeni DEFER ekranını ezmemesi yeniden PASS.
- Yeni 29 mekanizma kontrolü; unknown kaynak, sürüm/hash/path eksikliği,
  native etiketli sentetik kopya, self/stale review, eksik privacy/support,
  ambiguous support, hatalı ground truth, invalid DOCX ve boş batch'i sınadı.
  Bu başarı gerçek/native karşılaştırma başarısı değildir.

## 6. QA sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Başlangıç working tree / commit | Temiz; d6d0d90 |
| Sprint 43 güvenlik regresyonu | PASS; 12/12 remediation, falsePasses=0 |
| Sprint 48 production regresyonu | PASS; 22 senaryo + 44 fixture; normalization/margin parity 44/44 |
| Sprint 48 Chrome UI regresyonu | PASS; dört UI senaryosu + stale-success yarışı |
| Sprint 41 margin comparison | PASS; iki manual fixture |
| Sprint 42 compatibility regression | PASS; 44 fixture + 37 senaryo; SDÜ default/real-scope admission reddi korundu |
| Sprint 44 readiness pilot | PASS; historical raw'sız equation false-defer bulgusu korunur |
| Sprint 45 classifier | PASS; 27 + 3 kontrol, 44 fixture |
| Sprint 46 | Ayrı executable yok; mimari negatifler Sprint 47/48 kapsamında |
| Sprint 47 integrity | PASS; 37 kontrol + 44 fixture |
| Sprint 49 mekanizma regresyonu | PASS; 29 kontrol + envanter snapshot karşılaştırması |
| Golden | PASS; 46/46 |
| Corpus | PASS; 31 regression + 11 exploratory |
| Typecheck / lint / build | PASS; mevcut yaklaşık 734 kB JS chunk uyarısı sürer |
| Syntax / git diff --check / yeni dosya whitespace | PASS |
| Production ve mevcut fixture bütünlüğü | Başlangıçtaki 432 tracked dosya byte-identical; 44 DOCX değişmedi |
| Gerçek Word/LibreOffice karşılaştırması | BLOCKED / NOT_RUN |

İlk mekanizma pozitif denemesinde `full-correct.docx` için tek section varsayımı
yanlıştı. Mevcut fixture iki section içeriyor; test oracle'ı iki section olarak
düzeltildi. Production veya validation gevşetilmedi. Word oturum/property/save
başarısızlıkları yukarıda ayrıca kaydedildi; başarılı QA gibi sunulmadı.
Historical test çıktılarındaki productionIntegrated:false veya compatibility
FAIL alanları o eski pilotlara aittir; aktif Sprint 48 production sonucu değildir.

## 7. Eksik kanıtlar

Manuel Word oluşturma/UI/save zinciri, LibreOffice artifact ve sürüm kayıtları,
yetkili gerçek kullanıcı örneği, final hash'e bağlı uygulama değerleri, bağımsız
provenance/privacy review ve sürüm matrisinin bütün native karşılaştırmaları
eksiktir. Aynı uygulamanın kurulu olması veya COM Version yanıtı bu kanıtların
yerini almaz. Yeni native ölçüm yapılmadan SDÜ margin precision/identity/source
konuları hakkında kabul kararı verilmez.

## 8. Sprint 49 kararı

**NO-GO/BLOCKED — gerçek dünya doğruluğunu ölçme amacı tamamlanmadı.**
Envanter ve test-only hazırlık teslim edildi; native/gerçek kullanıcı ölçümü için
kabul edilmiş artifact ve bağımsız uygulama ground truth'u bekleniyor.
Bu eksikliği sentetik PASS sayılarıyla kapatmak uygun değildir.

Değişiklikler yalnız dört yeni test/audit dosyasıdır: bu rapor, JSON envanteri,
`realWorldDocxValidation.cjs` ve `realWorldDocxValidationRegression.cjs`.
Production, eski testler, manifest, üniversite/rule dosyaları ve DOCX'ler korundu.

## 9. Production onboarding kararı ve manuel komutlar

**NO-GO.** SDÜ admission default-deny, guard v1/v2 ve kaynak/native/onboarding
engelleri korunur. Yeni üniversite veya production davranışı eklenmedi.
46 kuralın coverage/trust baseline'ı ve page-number PARTIAL/MEDIUM sınırı değişmedi.

```powershell
node tests/audit/realWorldDocxValidationRegression.cjs
node tests/audit/realWorldDocxValidation.cjs --output docs/audit/SPRINT_49_DOCX_INVENTORY.json
node tests/audit/marginFalsePassSafetyRegression.cjs
node tests/audit/productionFalsePassRegression.cjs
node tests/browser/productionReadinessRegression.cjs
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
node tests/audit/analysisReadinessGateRegression.cjs
node tests/audit/sectionEvidenceClassificationRegression.cjs
node tests/audit/evidenceIntegrityRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Gerçek belge ve bağımsız inceleme geldikten sonra, placeholder yolları değiştirerek:

```text
node tests/audit/realWorldDocxValidation.cjs --root <private-root> --intake <submissions.json> --reviews <trusted-reviews.json> --require-native --output <private-results.json>
```

İntake CLI eksik/uyuşmaz/boş/rehearsal batch'te exit 1 verir. Exit 0 yalnız sunulan
scoped karşılaştırmadır; bütün uygulama/sürüm matrisi için otomatik GO değildir.
Özel sonuç dosyaları ve supporting evidence Git dışında tutulmalıdır.
Git add, commit veya push yapılmadı.
