# Sprint 44 — Analysis Readiness Gate

Tarih: 3 Kasım 2026. **Sprint 44 NO-GO; production onboarding NO-GO.**

Merkezi test-only gate adayı oluşturuldu ve ölçüldü. Production entegrasyonu
yapılmadı: gereksiz belge engellememe koşulu mevcut corpus üzerinde sağlanamadı.
Production false-PASS yolu halen açık; prototip PASS sonucu düzeltme olarak sunulmuyor.

## 1. İncelenen akış ve gate mimarisi

[Sprint 42](SPRINT_42_DOCX_COMPATIBILITY.md),
[Sprint 43](SPRINT_43_MARGIN_FALSE_PASS_SAFETY.md), readinessPrototype,
analysisService, MarginValidator, RuleEngine, ReportBuilder, UploadPage hata
akışı ve UploadDropzone hata bileşeni incelendi.

Yeni test-only modül: `tests/audit/analysisReadinessGatePilot.ts`.

- `evaluateAnalysisReadiness(document, rules)` yalnız enabled margin kurallarını
  mevcut ValidatorRegistry → assess() semantic üreticisiyle değerlendirir.
  Yeni section/numeric detector veya akademik gereklilik oluşturmaz.
- Mevcut margin assessment coverage open, assessment/observation eksik veya
  undetermined ise teknik `deferred` üretir. Hiç margin kuralı istenmiyorsa ready.
- `sectionExtractionCoverage` closed değilse konservatif olarak deferred kalır.
  Bunun margin'e özel coverage olmadığının doğurduğu engel aşağıda belgelidir.
- `runReadinessGatePilot()` ertelemede `AnalysisReadinessDeferredError` fırlatır;
  engine ve report/scoring callback'ine girmez. Ready ise aynı callback çalışır.
- Bu ready/deferred ayrımı RuleResultStatus değildir. PASSED/FAILED/
  NOT_APPLICABLE sözleşmesine dördüncü durum eklenmedi; belirsizlik bir
  akademik FAILED veya NOT_APPLICABLE sonucuna çevrilmedi.

Hedef production sıralaması: DOCX read/normalization → rule resolution →
readiness → mevcut normalizer/RuleEngine/ReportBuilder. Bu sprintte yalnız
test-only orchestration sınırı çalıştırıldı; analyzeDocx bu gate'i çağırmıyor.

Sprint 43 prototipine ek kontrol: bir section'da doğrulanmış violation varken
diğer section'da eksik evidence bulunması overall assessment'ı violation yapabilir.
Yeni aday her observation'ı kontrol eder; overall violation eksik gözlemi gizleyemez.
Bu durum production validator veya SDÜ guard mantığını değiştirmez.

## 2. Test önceliği ve senaryolar

Önce Sprint 43 `--audit-contract` prototip/sözleşme koşusu doğrulandı. Ardından
yeni adayın senaryo ve corpus testleri production değişikliği olmadan çalıştırıldı.
Yeni regresyon: `tests/audit/analysisReadinessGateRegression.cjs`.

15 yeni in-memory senaryo, full-correct.docx tabanından kontrollü OOXML body
mutation ile üretildi; DOCX dosyası yazılmadı. Gerçek kullanıcı veya native editör
uyumluluğu kanıtı değiller.

| Senaryo | Gate adayı | Değerlendirme |
| --- | --- | --- |
| Terminal section eksik | deferred | Pilot teknik erteleme doğru |
| Birden çok paragraph section, terminal yok | deferred | Açık margin inventory korunuyor |
| Section envanteri yok | deferred | Aggregate fallback uygunluk sayılmıyor |
| pgMar eksik | deferred | Akademik FAILED üretmeden erteleme |
| Üst attribute eksik | deferred | Eksik kenar kanıtı yakalanıyor |
| Üst attribute NaN | deferred | Güvenilir olmayan sayısal kanıt yakalanıyor |
| Eksik section + doğrulanmış ihlal | deferred | Overall violation eksik evidence'ı gizlemiyor |
| Tam tek section | ready | Mevcut margin raporu/score aynı |
| Tam çoklu section | ready | Mevcut margin raporu/score aynı |
| Çoklu section, sol 3,2/3 cm | ready | Gerçek sol margin ihlali FAILED kalıyor |
| altChunk | deferred | Unsupported carrier konservatif erteleme |
| subDoc | deferred | Unsupported carrier konservatif erteleme |
| contentPart | deferred | Unsupported carrier konservatif erteleme |
| Yalnız equation içeren kontrol | deferred | **Uyumluluk kabulü FAIL: gereksiz erteleme** |
| Equation + altChunk | deferred | Equation istisnasıyla atlanmaması gereken kontrol |

Pilot deferred isteklerde engine ve builder çağrı sayıları **0/0**; callback
dönüşü yok, score/report/status/passed yok. Ready isteklerde çağrı sayıları 1/1,
üretilen dört margin'lik rapor gate'siz engine/builder sonucuyla deep-equal.
Belgeye mutation yapılmadığı ayrıca assert edilir. Bu callback kanıtı bütün
production API tüketicilerine entegre edilmiş bir gate kanıtı değildir.

## 3. Geçerli belge engelleme ve entegrasyon kararı

Mevcut 44 DOCX'in hepsinde margin assessment inventory closed ve margin
observations confirmed. Buna rağmen konservatif gate adayı:

| Grup | Ready | Deferred |
| --- | ---: | ---: |
| 31 regression fixture | 31 | 0 |
| 11 exploratory fixture | 10 | 1 |
| Sprint 41'in iki manual fixture'ı | 2 | 0 |
| Toplam | 43 | 1 |

Gereksiz ertelenen dosya:
`tests/fixtures/comu/food-technology/experimental/equation-object-synthetic.docx`.
Production corpus koşusunda bu fixture **46/46** sonuç veriyor. Margin verileri
tam; parser'ın academic section extraction sınırı, Word paragraph dışındaki
matematik metni nedeniyle open. Margin inventory coverage ise closed.

Bu sonuç tam OOXML schema veya gerçek kullanıcı geçerliliği iddiası değildir;
mevcut desteklenen corpus belgesinin salt margin gate'i nedeniyle reddedileceğini
gösteren somut geriye dönük uyumluluk engelidir.

Equation-only ve equation+altChunk kontrollerinde gate'in tükettiği normalized
pageSections, sectionExtractionCoverage ve margin assessment projeksiyonları
deep-equal çıktı. Mevcut coverage reason'ı generic ve unresolved subject document
düzeyindedir; nedenin yalnız matematik metni olduğunu ayıramaz.

Bu nedenle iki kısa yol da uygun değil:

- Academic extraction open'ı her durumda engellemek equation fixture'ını reddeder.
- “Equation var” istisnası veya open'ı bütünüyle yok saymak, equation+altChunk
  içindeki okunamayan section/margin kapsamını güvenilir kabul edebilir.

Production entegrasyon koşullarının değerlendirmesi:

| Koşul | Kanıt / karar |
| --- | --- |
| Üç durumlu RuleResult ve başarılı API dönüşü korunmalı | Pilot bunu modelleyebiliyor; production API değişmedi |
| Belirsizlikte rapor/skor üretilmemeli | Pilot callback sınırında kanıtlandı; production'da aktif değil |
| Kullanıcı doğru mesajı görmeli | Mevcut UI yolu incelendi; aktif mapping yapılmadı |
| Geçerli/supported belge gereksiz engellenmemeli | **FAIL**, equation fixture |
| Golden/corpus production sonuçları korunmalı | Mevcut kod PASS; aday 11 exploratory içinden birini engellerdi |

Kullanıcının koşullu entegrasyon talimatı gereği **production entegrasyonu
yapılmadı**. Parser, normalized document sözleşmesi, analysisService, RuleEngine,
ReportBuilder, scoring, üniversite JSON ve UI değiştirilmedi.

## 4. False-PASS yolu kapandı mı?

**Production'da hayır.** Yeni test aynı in-memory DOCX'leri gerçek analyzeDocx
hattından ayrıca geçiriyor; terminal eksik belgenin legacy margin sonuçları
halen PASSED. Test-only gate'in callback'i durdurması production API'nin
durdurulduğu anlamına gelmiyor.

Sprint 43 güvenlik regresyonu exit 1 ve 12 assertion ihlaliyle kırmızı kaldı
(8 açık margin inventory PASSED + 4 konservatif extraction-readiness itirazı).
Sprint 44 `--require-integration` kabul koşusu da gereksiz corpus ertelemesi
nedeniyle exit 1 veriyor. Hiçbir kabul assertion'ı kaldırılmadı veya gevşetilmedi.
Normal Sprint 44 mekanizma koşusu exit 0 verse de JSON çıktısında açıkça
`productionIntegrated:false`, `productionFalsePassClosed:false`,
`compatibilityAcceptance:FAIL` yazıyor.

## 5. UI ve scoring etkileri

UploadPage analiz başında/esnasında eski raporu temizliyor; catch içinde raporu
null tutup mevcut UploadDropzone `role=alert`, `aria-live=assertive` alanına hata
mesajı gönderiyor. Yeni ekran gerekmiyor. Bugünkü generic hata mapper'ı
readiness ertelemesini özel olarak tanımıyor.

Test-only error'ın mesajı kullanıcı önerisiyle aynı:

> Belgenin sayfa düzeni bilgileri güvenilir biçimde doğrulanamadığı için analiz tamamlanamadı. Lütfen DOCX dosyasını yeniden kaydedip tekrar deneyin.

Production entegrasyonu uygun hale geldiğinde ayrı readiness error için mapper
dalı eklenmeli; DocxPackageError kullanılmamalı. Şu anda bu mesaj UI'ya bağlanmadı;
kullanıcının bu mesajı gördüğü veya browser etkileşiminin doğrulandığı iddia edilmez.

Mevcut production skorları değişmedi. Pilot ertelemede score=0 üretmiyor;
hiç rapor/skor üretmiyor. Kanıtlanmış gerçek margin farkı pilot ready yolunda
mevcut FAILED sonucunu ve score aritmetiğini koruyor. Kural atlama veya N/A'ya
çevirerek evaluatedRules/payda değiştirme yapılmadı.

## 6. Kalan iş ve riskler

- Merkezi parser extraction kaynağında margin envanterine özel, kaynak taşıyıcısını
  ayıran semantic provenance/coverage gerekiyor. Academic extraction alanını
  yeniden yorumlamak yerine aynı kaynak traversal'ından ayrıştırılmış margin
  kanıtı üretilmeli; yeni paralel XML detector veya equation whitelist eklenmemeli.
- Sonraki gate, matematik/diğer içerik belirsizliğini gerçek okunamayan section
  taşıyıcısından ayırabilmeli; equation+altChunk birleşik negatif kontrol kalmalı.
- Yapısal raw section mapping, unsupported AlternateContent ve native editor
  round-trip kapsamı ayrıca doğrulanmalı. Bu sprint tüm OOXML yapılarını kapsamaz.
- Düzenlenmiş semantic kaynak sonrası önce 44 corpus uyumluluğu, sonra gerçek
  analyzeDocx üzerinden blocked istekte engine/builder 0 çağrı ve UI erteleme
  mesajı doğrulanmalı. O aşamada Sprint 43 güvenlik testi gerçekten yeşil olmalı.
- Mevcut akademik kurallar, hassasiyet sözleşmesi, RuleResult enum'u ve skor
  formülü değişmeden kalmalı. SDÜ default-deny ve test-only guard sınırı korundu.
- Word-native/LibreOffice/gerçek kullanıcı validation tamamlanmadı.

## 7. QA

Package.json gerçek script'leri doğrulandı; npm.cmd run test kullanılmadı.

| Komut / kontrol | Sonuç |
| --- | --- |
| Sprint 43 --audit-contract (ilk prototip doğrulaması) | PASS; productionSafety FAIL olarak korunur |
| node tests/audit/analysisReadinessGateRegression.cjs | PASS mekanizma kontrolleri; 15 senaryo + 44 DOCX, uyumluluk kabulü FAIL |
| node tests/audit/analysisReadinessGateRegression.cjs --require-integration | **FAIL**, exit 1; gereksiz equation ertelemesi |
| node tests/audit/docxMarginComparisonRegression.cjs | PASS; Sprint 41 |
| node tests/audit/docxCompatibilityRegression.cjs | PASS; Sprint 42, 44 DOCX + 37 senaryo, mevcut safety bulgusu sürer |
| node tests/audit/marginFalsePassSafetyRegression.cjs | **FAIL**, exit 1; Sprint 43 production safety açığı sürüyor |
| npm.cmd run test:golden | PASS; 46/46 |
| npm.cmd run test:corpus | PASS; 31 regression + 11 exploratory |
| npm.cmd run typecheck | PASS |
| Pilot modül için ayrıca strict tsc --noEmit | PASS; tests app tsconfig kapsamı dışında olduğundan ayrıca çalıştırıldı |
| npm.cmd run lint | PASS |
| npm.cmd run build | PASS; mevcut 726,54 kB JS chunk boyut uyarısı |
| git diff --check | PASS; yeni untracked dosyaların içeriğini kapsamaz |
| git status --short | Başlangıçtaki dört untracked Sprint 42/43 dosyası ve yeni üç Sprint 44 dosyası |
| QA öncesi/sonrası hash kontrolü | PASS; src ağacı, 44 DOCX ve korunan 9 test/guard/rapor değişmedi |

Focused pilot tip kontrolü komutu:

```powershell
.\node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable --strict --skipLibCheck --types vite/client tests/audit/analysisReadinessGatePilot.ts
```

Manuel tekrar:

```powershell
node tests/audit/analysisReadinessGateRegression.cjs
node tests/audit/analysisReadinessGateRegression.cjs --require-integration
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Entegrasyon ve Sprint 43 safety komutları sorun çözülene kadar exit 1 vermelidir.

## 8–9. Karar ve dosyalar

**Sprint 44 NO-GO:** merkezi gate adayı mekanik olarak çalışıyor fakat gereksiz
corpus ertelemesi var; production false-PASS yolu kapatılmadı.
**Production onboarding NO-GO:** güvenlik kabulü ve native/source engelleri sürüyor.

Eklenen dosyalar: test-only analysisReadinessGatePilot.ts,
analysisReadinessGateRegression.cjs ve bu rapor. Başlangıçtaki untracked
Sprint 42/43 dosyaları korunuyor. Git add, commit veya push yapılmadı.
