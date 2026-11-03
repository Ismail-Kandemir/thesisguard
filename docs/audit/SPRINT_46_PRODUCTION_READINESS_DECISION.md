# Sprint 46 — Production Readiness Decision

Tarih: 3 Kasım 2026. **Karar/mimari doğrulama sprinti GO; production entegrasyonuna geçiş ve production onboarding NO-GO.**

Production entegrasyonu teknik olarak mümkün. Mevcut test-only modüller doğrudan
production'a taşınmaya hazır değil. Public analiz hattındaki false-PASS sürüyor;
Sprint 43 güvenlik testi bu koşuda da başarısız. Bu sprintte yalnız bu karar
raporu oluşturuldu; production, test kodu ve DOCX dosyaları değiştirilmedi.

İncelenen dayanaklar: [Sprint 42](SPRINT_42_DOCX_COMPATIBILITY.md),
[43](SPRINT_43_MARGIN_FALSE_PASS_SAFETY.md),
[44](SPRINT_44_ANALYSIS_READINESS_GATE.md),
[45](SPRINT_45_SECTION_EVIDENCE_CLASSIFICATION.md), sectionEvidenceClassifier.ts,
analysisReadinessGatePilot.ts ve gerçek parser/service/engine/report/UI akışı.

## 1. Production entegrasyonu teknik olarak mümkün mü?

**Evet, ayrı bir teknik erteleme sınırıyla; belirsizliği RuleResult'a eşlemeden.**

Mevcut akış:

```text
DOCX → readDocxAnalysisXmlParts → parseDocumentXml / normalization
     → rules selection/resolution → academic normalizers
     → RuleEngine.validate → ReportBuilder / score → UploadPage / ReportPage
```

Önerilen sınır:

```text
Tek paket okumasından raw XML + normalized document
     → seçili enabled kuralların çözümü
     → zorunlu section/margin readiness
          deferred → typed teknik hata → UI uyarısı; rapor/skor yok
          ready    → mevcut normalizer/RuleEngine/ReportBuilder → mevcut rapor
```

Gate, analysisService.ts içinde rule resolution'dan hemen sonra ve ilk
RuleEngine.run çağrısından önce çalışmalı. Böylece rule kapsamı bellidir;
academic normalizer ve scoring işleri ertelenen istek için başlatılmak zorunda kalmaz.
Bugün analyzeDocx normalize edilmiş belgeyi alıyor fakat raw XML bağlamını
korumuyor. Bu bağlam aynı paket okumasından taşınmadan classifier çağrılmamalı.

| Soru | Mevcut kanıt | Production kararı |
| --- | --- | --- |
| Engine öncesi eksik kanıt durdurulabilir mi? | Pilot callback deferred durumda 0 engine çağrısı gösteriyor | Teknik olarak evet; gerçek analyzeDocx entegrasyon testi gerekli |
| ReportBuilder/scoring tamamen atlanabilir mi? | Pilot deferred durumda 0 builder çağrısı ve hiç score/report göstermiyor | Evet; score=0 gibi sahte sonuç dönülmemeli |
| UI anlaşılır hata gösterebilir mi? | UploadPage catch ve UploadDropzone role=alert alanı mevcut | Evet; readiness hatası için özel mapping henüz yok |
| Üç durumlu sonuç sözleşmesi korunabilir mi? | Gate RuleResult değil teknik readiness/error üretiyor | Evet; enum ve aritmetik değişmemeli |
| Geçerli belgeler korunabilir mi? | Classifier bağlı pilot 44/44 ready; equation düzeldi | Bu corpus için evet; bilinmeyen/native belgeler için genel garanti yok |

Production kaynak taramasında analyzeDocx çağıran UI tüketicisi UploadPage;
RuleEngine ve ReportBuilder production kullanımı analysisService içinde.
Doğrudan validate()/RuleEngine.run çağrıları kendi başına güvenilir coverage
sözleşmesi kazanmış olmaz. Gelecekteki production rapor tüketicileri merkezi
analiz sınırını kullanmalı; doğrudan engine'den skor yayımlayan bypass açılmamalı.

## 2. Risk analizi ve Sprint 46 mimari ölçümleri

| Durum | Güvenli hedef davranış | Kanıt / kalan risk |
| --- | --- | --- |
| Eksik terminal section | Teknik erteleme | Margin inventory open; legacy hâlen PASSED üretebiliyor |
| Çoklu section | Her section için kanıt; tam ise analize devam | Son uygun section önceki eksik değeri gizlememeli |
| Eksik/bozuk margin | Teknik erteleme | Legacy'nin mevcut FAILED davranışı belirsizliği temsil etmek için kullanılmamalı |
| Tam fakat kurala aykırı margin | Analiz çalışır; gerçek FAILED korunur | Ready, akademik PASSED anlamına gelmez |
| Equation | Section/margin tam ise kabul | Genel text extraction open, layout coverage open yerine kullanılamaz |
| Equation + altChunk | Teknik erteleme | Equation whitelist'i yasak; aktif okunamayan taşıyıcı ayrı engel |
| altChunk/subDoc/contentPart | Teknik erteleme | Dış/okunamayan bölüm section completeness'ı kanıtlamaz |
| Desteklenmeyen OOXML / unresolved MCE | Teknik erteleme; current branch sözleşmesini koru | Tüm OOXML kombinasyonları test edilmiş değil |
| 44 mevcut fixture | Hazır layout kanıtını gereksiz engelleme | Sprint 45 sınıflandırmalı yol 44 ready; eski raw'sız baseline 43 ready/1 deferred |
| Bilinmeyen kaynaklı DOCX | Aynı teknik kanıt ve paket güvenlik denetimi | Kaynak bilinmezliği tek başına akademik FAILED veya Word-native kanıtı değildir |

Mevcut provenance: 42 manifestte programmatic/synthetic, 2 manual dosyada
oluşturma zinciri unknown/unverified. Doğrulanmış Word-native/LibreOffice veya
gerçek öğrenci uyumluluğu bu sprintte eklenmedi. 44 dosya üzerinde başarı, keyfi
belgelerde sıfır false-accept/false-defer garantisi değildir.

### Ek read-only mimari ölçümler

Bu sprintte dosya yazmadan, full-correct.docx tabanında bellekte iki adversarial
bağlam deneyi yapıldı; test modülleri veya fixture byte'ları değiştirilmedi.

| Girdi / kullanım | Pilot sonucu |
| --- | --- |
| Duplicate pgMar, raw argümanı verilmeden | **ready** |
| Aynı duplicate pgMar, eşleşen raw XML ile | deferred |
| altChunk içeren normalized belge, kendi raw XML'i ile | deferred |
| Aynı normalized belge, başka temiz varyantın raw XML'i ile | **ready** |

İlk risk test-only API'deki historical raw-undefined fallback'ten geliyor.
İkincisi classifier'ın pageSections eşitliği kontrolünün tam artifact kimliği
bağı olmadığını gösteriyor: iki belgenin aynı margin ve paragraph section
projeksiyonu olabilir, fakat okunamayan taşıyıcıları farklı olabilir.

Bu sonuçlar eşleşen paketle yapılan Sprint 45 testlerini geçersiz kılmaz;
production tüketicisinin ham kanıtı nasıl elde edeceğine ilişkin zorunlu güven
sınırını gösterir. Production gate'e caller tarafından bağımsız raw/document
çifti verilmemeli, raw parametresi optional olmamalı ve legacy fallback
bulunmamalı. Mevcut public API'nin File girdisi bu iç bağlamı kurmaya uygundur.

Classifier'ın geniş catch bloğu runtime hatasını da invalid-document-xml diye
sınıflandırabiliyor. Production incelemesinde teknik classifier hatası ile gerçek
XML bozukluğu ayrılmalı; ikisi de skor üretmeden durmalı. Mevcut ZIP güvenlik
limitleri korunmalı; browser XML davranışı ve boyut/derinlik maliyeti ayrıca
ölçülmeli. Yeni bir akademik kural veya tolerans çıkarılmamalı.

## 3. Değişmesi gereken production dosyaları ve entegrasyon planı

Aşağıdakiler **gelecek uygulama önerisidir**, bu sprintte uygulanmadı.

| Dosya | Önerilen dar değişiklik |
| --- | --- |
| src/features/analysis/analysisService.ts | Aynı readDocxAnalysisXmlParts çağrısından raw/document bağlamı oluştur; rule resolution sonrası gate'i zorunlu çağır; deferred durumda engine/builder'a geçme |
| src/features/analysis/parsers/sectionEvidenceClassifier.ts (önerilen yeni production modülü) | Test-only classifier'ı gözden geçirerek parser-side structural evidence producer olarak sahiplen; mevcut parser, MCE ve revision kaynaklarını kullan |
| src/features/analysis/analysisReadiness.ts (önerilen yeni production modülü) | Gate, reason/issue sözleşmesi ve typed readiness error; raw-undefined baseline bulunmasın |
| src/pages/UploadPage.tsx | Yeni readiness error için açık mesaj mapping'i; eski raporu/score'u temizle ve yeniden deneme akışını koru |

Yeni klasör, dependency veya ekran gerekmiyor. Production kodu tests/audit
modüllerini import etmemeli. İkinci numeric parser veya paralel current-document
MCE/revision resolver yazılmamalı; page section/margin gerçekleri mevcut semantic
kaynaktan gelmeli. Genel academic extraction coverage'ın anlamı değiştirilmemeli.

Önerilen service düzeni:

1. Private read/normalize helper, tek paket okumasının parts snapshot'ından
   normalized document ve documentXml üretir. Raw bağlam çağırana açılmaz,
   başka istekten cache/context ile karıştırılmaz.
2. Public createNormalizedDocumentFromDocx(file) aynı Promise<NormalizedDocument>
   dönüşünü koruyarak bu helper'ın document kısmını döndürür. Salt normalization
   akademik analiz sayılmaz ve kendiliğinden skor üretmez.
3. analyzeDocx aynı private bağlamı kullanır; kuralları mevcut seçimle çözer,
   zorunlu raw + document kanıtıyla readiness denetler, yalnız ready yolunda
   mevcut engine/report zincirine devam eder. İkinci bağımsız ZIP okumasından
   raw eşleştirmek veya caller'ın raw sağlamasına güvenmek önerilmez.
4. Evidence/normalization aynı section snapshot'ına bağlı kalır. Ready ile engine
   çağrısı arasında margin/section mutation olmaması test edilir. Teknik hata,
   eksik evidence veya bağlam uyuşmazlığında fallback rapor üretilmez.

RuleEngine, ReportBuilder, MarginValidator.validate, RuleResult enum'u, score
formülü, UI rapor ekranı ve üniversite JSON'ları bu plan için değişmemeli.
Salt metadata/uyarı ekleyip legacy PASSED bırakmak düzeltme değildir.
SDÜ guard v1/v2, source/admission gate'leri ve gerçek scope default-deny aynı kalır;
genel teknik readiness SDÜ akademik onboarding yetkisi vermez.

## 4. Yeni hata sözleşmesi gerekiyor mu?

**Evet, açık bir teknik rejection sözleşmesi gerekiyor; yeni RuleResult durumu gerekmiyor.**

Öneri: AnalysisReadinessDeferredError extends Error ve sabit
code=ANALYSIS_READINESS_DEFERRED; readonly issues içinde teknik reason ve varsa
ruleId. Public başarı imzası analyzeDocx(file, selection?): Promise<AnalysisReport>
kalır. Promise reject dalında yeni belgelenmiş hata tipi/code oluşur.

Bu hata DocxPackageError olarak etiketlenmemeli; teknik evidence belirsizliği
paketin kesin bozuk olduğu anlamına gelmez. Error içinde sahte report/status/
passed/score alanları bulunmamalı. Caller hatayı yakalayıp boş rapora, sıfır
puana, FAILED'e veya NOT_APPLICABLE'a çevirmemeli.

TypeScript dönüş imzasının aynı kalması davranışın tamamen geriye uyumlu
olduğu anlamına gelmez: önceden rapor alan eksik belgeler artık reject olur.
UI ve otomasyon tüketicileri yeni hata sözleşmesiyle birlikte güncellenmeli.

## 5. Kullanıcı deneyimi

UploadPage handleAnalyzeClick bugün analiz başında ve catch içinde
setAnalysisReport(null) çağırıyor. UploadDropzone mevcut role=alert ve
aria-live=assertive alanıyla mesaj sunabiliyor. Yeni ekran gerekmiyor.

Özel readiness mapping'i generic error ve paket bozukluğu mesajından önce
çalışmalı. Önerilen kullanıcı metni:

> Belgenin sayfa düzeni bilgileri güvenilir biçimde doğrulanamadığı için analiz tamamlanamadı. Lütfen DOCX dosyasını yeniden kaydedip tekrar deneyin.

Ertelemede önceki başarı raporu/skoru gösterilmez; dosya değiştirme ve yeniden
deneme kullanılabilir kalır. Yanıtların farklı sırada gelmesi veya analiz sürerken
dosya değiştirilmesiyle eski bir ready cevabının yeni deferred durumu ezmemesi
browser kabul testine dahil edilmeli; gerekiyorsa mevcut component içinde istek
kimliği kontrolü eklenmeli. Bu davranış bu sprintte browser'da doğrulanmadı.

Mesaj teknik ertelemeyi açıklar; akademik uygunsuzluk veya Word-native doğrulama
iddiası taşımaz. Yeniden kaydetmenin her sorunu kesin çözeceği vaat edilmez.

## 6. Scoring ve backward compatibility riskleri

- Ready belgelerde aynı 46 kural, aynı status ve aynı aritmetik korunmalı.
  Gerçek margin farkı FAILED kalır. Rule ID ve grounding değiştirilmez.
- Deferred belgede scorer çalışmaz; score=0 dahil hiçbir başarı puanı üretilmez.
  Belirsizlik FAILED/N/A yapılmaz, kural sayısı/payda sessizce değiştirilmez.
- Mevcut dört margin kuralını atlamak ya da PASSED'e warning eklemek false-PASS'i
  önlemez. Validasyon metadata baseline'ı 45 COMPLETE/HIGH + 1 PARTIAL/MEDIUM
  ve page-number istisnası korunmalı.
- 44 fixture'ın tamamı layout-ready olduğu için corpus sayıları korunabilir;
  bu bilinmeyen kaynaklı tüm DOCX'lerin engellenmeyeceği kanıtı değildir.
- Genel text extraction belirsizliğini layout gate'e bağlamak equation gibi
  belgeleri gereksiz durdurur; matematik whitelist'i ise carrier riskini gizler.
- Raw/document kimliği, current revision/MCE seçimi ve parser/classifier
  uyumluluğu bozulursa false-accept veya gereksiz defer oluşabilir.
- Yeni consumer, doğrudan RuleEngine/ReportBuilder ile teknik sınırı atlamamalı.
  Source/üniversite onboarding'in kapsamı teknik readiness'den bağımsızdır.

## 7. Rollback planı

Geri alma, korumasız legacy skor yolunu yeniden açmamalı.

1. Release öncesi değişiklikler ayrı tutulmalı: evidence producer + zorunlu
   service boundary + typed UI mapping bir güvenlik birimi olarak doğrulanmalı.
2. Yanlış erteleme veya classifier/runtime uyumsuzluğu görülürse analizi etkilenen
   girişler için teknik ertelemeye alan güvenli mod kullanılmalı; güvenilir bir
   ayrım yoksa tüm margin analizi ertelemede kalmalı. UI açık erteleme göstermeli.
3. Yalnız gate'i kapatıp eski RuleEngine'e devam eden flag/fallback olmamalı.
   Mevcut gate'siz sürüme kör rollback güvenli rollback sayılmaz.
4. Önceden doğrulanmış güvenli gate sürümü varsa producer/gate o sürüme
   döndürülebilir; aynı-paket bağlamı ve before-engine teknik durdurma korunmalı.
   Bugünkü production sürümü böyle bir güvenli gate sürümü değildir.
5. Yeniden açılışta negatif evidence testleri, 44 fixture, gerçek service
   instrumentation ve UI erteleme kontrolleri yeniden geçmeli. Eski rapor/skor
   yeni analiz başarılıymış gibi geri yüklenmemeli.

Bu sprintte flag, deployment veya rollback işlemi yapılmadı; plan gelecekteki
uygulamanın güvenlik koşuludur.

## 8. Kabul kriterleri ve uygulama sırası

| ID | Kabul kriteri |
| --- | --- |
| A1 | Eksik terminal, boş/açık section kapsamı, null/bozuk/duplicate margin, unsupported carrier ve unresolved MCE gerçek analyzeDocx üzerinden typed readiness rejection üretir |
| A2 | Deferred isteklerde gerçek RuleEngine.run ve ReportBuilder.build çağrısı 0; hiçbir AnalysisReport veya skor dönmez |
| A3 | Ready kontrolünde aynı production service sonuçları korunur; dört margin farkı gerçek akademik sonuç olarak değerlendirilir |
| A4 | Public API raw evidence kabul etmez; aynı parts okuması bağlanır. Raw-undefined fallback, çapraz artifact raw/document, tampering ve mutation negatifleri reddedilir |
| A5 | Equation kabul edilir; equation+altChunk, table/math içine yerleştirilmiş sectPr ve gerçek eksik evidence hâlâ ertelenir |
| A6 | 44 fixture gereksiz engellenmez; golden 46/46 ve corpus 31 regression + 11 exploratory aynen korunur |
| A7 | Browser DOM/MCE/revision davranışı Node harness ile karşılaştırılır; bilinmeyen/native belge kapsamı ve sınırlar açıkça raporlanır |
| A8 | UI doğru mesajı gösterir, eski rapor/score görünmez; yeniden deneme, dosya değiştirme ve out-of-order cevaplar güvenli davranır |
| A9 | RuleResult üç durumu, score formülü, kural/source grounding, mevcut section/Figure Level 3/table/bibliography semantiği değişmez; SDÜ default-deny korunur |
| A10 | Teknik classifier hatası başarıya düşmez; güvenli rollback/erteleme yolu test edilir ve gating başarısızlığında legacy rapor yayımlanmaz |

Uygulama sırası: aynı-paket iç bağlam ve evidence producer → zorunlu service
gate/typed hata → UI mapping → actual-service negatif/pozitif testleri → browser
ve corpus kabulü. Production'a tests/audit modülü import etmek bir entegrasyon
planı olarak kabul edilmez.

Mevcut Sprint 43 testi legacy rapor bekleyen adımlar içeriyor. Gerçek entegrasyon
sonrası yalnız exception nedeniyle kırmızı kalması veya her exception'ı yutup
PASS olması doğru doğrulama olmaz. Test, production analyzeDocx için tam typed
rejection + 0 engine/builder çağrısını assert edecek şekilde evrilmeli; eski
validate false-PASS kanıtı ayrı historical/direct-engine baseline olarak korunmalı.
Güvenlik testinin yeşili, yalnız bu gerçek yol kapandığında geçerli sayılmalı.

Golden/corpus harness'ları bugün doğrudan engine/builder çağırabiliyor. Onların
PASS sonucu service gate entegrasyonunun kanıtı değildir; aynı fixture sonuçları
gerçek analyzeDocx üzerinden de karşılaştırılmalı. Mevcut browser report visual
runner'ın bulunması da yeni upload/readiness hata etkileşiminin test edildiği
anlamına gelmez; o kabul ayrıca yazılıp çalıştırılmalı.

## 9. Bu sprintin QA sonuçları

Package.json gerçek script adları doğrulandı. npm.cmd run test kullanılmadı.
Tüm aşağıdaki sonuçlar bu sprintte yeniden çalıştırıldı.

| Komut / kontrol | Sonuç |
| --- | --- |
| node tests/audit/docxMarginComparisonRegression.cjs | PASS; Sprint 41 iki belge |
| node tests/audit/docxCompatibilityRegression.cjs | PASS; Sprint 42, 44 fixture + 37 senaryo; eski safety bulgusu sürüyor |
| node tests/audit/marginFalsePassSafetyRegression.cjs | **FAIL**, exit 1; production false-PASS çözülmedi, 12 safety assertion |
| node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract | PASS; productionSafety FAIL olarak korunur |
| node tests/audit/analysisReadinessGateRegression.cjs | PASS; Sprint 44 historical raw'sız baseline, compatibilityAcceptance FAIL korunur |
| node tests/audit/sectionEvidenceClassificationRegression.cjs | PASS; Sprint 45, 27 senaryo + 3 bütünlük kontrolü + 44 fixture; classifier bağlı pilot 44 ready |
| Sprint 46 read-only bağlam ölçümleri | PASS mekanizma gözlemi; raw-undefined ve çapraz artifact entegrasyon riskleri doğrulandı |
| npm.cmd run test:golden | PASS; 46/46 |
| npm.cmd run test:corpus | PASS; 31 regression + 11 exploratory |
| npm.cmd run typecheck | PASS |
| Classifier/pilot için ek strict tsc --noEmit | PASS; test-only TS dosyaları ayrıca kontrol edildi |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS; mevcut JS chunk 726,54 kB / 500 kB boyut uyarısı |
| git diff --check | PASS; yeni untracked raporun içeriğini kapsamaz |
| QA öncesi/sonrası hash kontrolü | PASS; src ve tests ağaçları, 44 DOCX ve Sprint 42–45 raporları değişmedi |
| git status --short | Başlangıçtaki 10 untracked dosya korunuyor; yalnız Sprint 46 raporu eklendi |

Sprint 43'teki 12 assertion, iki açık margin inventory senaryosunda 8 PASSED ve
unsupported-carrier senaryosunda 4 konservatif readiness itirazıdır. Kanıtlanmış
matematiksel margin hatası sayısı olarak yorumlanmamalı. Production güvenlik
kabulü **FAIL**; diğer testlerin PASS olması bunu gizlemez.

Manuel tekrar:

```powershell
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs --audit-contract
node tests/audit/analysisReadinessGateRegression.cjs
node tests/audit/sectionEvidenceClassificationRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
.\node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable --strict --skipLibCheck --types vite/client tests/audit/sectionEvidenceClassifier.ts tests/audit/analysisReadinessGatePilot.ts
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Sprint 43 default güvenlik komutunun exit 1 sonucu mevcut engeldir; başarılı QA
gibi raporlanmamalıdır. Bu sprintte browser/native entegrasyon testi yapılmadı.

## 10. Karar ve teslim kapsamı

**Sprint 46 GO:** karar ve mimari doğrulama görevi tamamlandı; uygulanabilir dar
plan, hata sözleşmesi, riskler, güvenli rollback ve ölçülebilir kabul kriterleri
teslim edildi. Bu karar bir production release onayı değildir.

**Production entegrasyonuna bugün NO-GO:** optional raw baseline ve aynı-artifact
bağı giderilmedi; service/UI entegrasyonu ve browser kabulü henüz yok; production
false-PASS testi kırmızı. Teknik olanak, hazır/kanıtlanmış entegrasyon demek değil.

**Production onboarding NO-GO:** önceki bağımsız native/source/admission engelleri
ve production safety sorunu devam ediyor. SDÜ admission default-deny kalıyor.

Tek yeni dosya bu rapor. Başlangıçtaki untracked Sprint 42–45 dosyaları korundu.
Git add, commit veya push yapılmadı.
