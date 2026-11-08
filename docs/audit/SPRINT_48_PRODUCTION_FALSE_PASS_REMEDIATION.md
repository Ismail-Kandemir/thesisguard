# Sprint 48 — Production False-PASS Remediation

Tarih: 8 Kasım 2026. Başlangıç: `e275433`; çalışma ağacı temizdi.
**Sprint 48 GO. Production onboarding NO-GO.**

## 1. Kök neden ve düzeltme

Sprint 43–47 raporları, gate/classifier/package-binding prototipleri ve gerçek
reader → normalizer → RuleEngine → ReportBuilder → UploadPage akışı incelendi.
Değişiklikten önce Sprint 43 default güvenlik testi çalıştırıldı: exit 1,
**12 başarısız assertion**. İki eksik-terminal senaryosu ve altChunk senaryosunda
dört margin kuralı yanlış PASSED ve rapor/skor üretiyordu.

Kök neden: legacy `validate()` okunabilen uygun margin alt kümesini yeterli
sayıyordu. `assess()` içindeki açık envanter/belirsiz gözlem bilgisi production
rapor hattını durdurmuyordu. RuleResult'a dördüncü durum eklemek veya belirsizliği
FAILED/NOT_APPLICABLE yapmak yerine, akademik sonuçlardan önce teknik sınır eklendi.

Yeni akış:

```text
analyzeDocx(File, selection) → mevcut rule resolution
  → readReadyDocxDocument(File, rules)
      → bir DOCX paket okuması → ortak normalization + aynı paketin raw XML'i
      → private section/margin readiness kontrolü
          eksik/çelişkili kanıt → AnalysisReadinessDeferredError
          güvenilir kanıt → mevcut akademik normalizer'lar → RuleEngine → ReportBuilder
```

Raw/document çiftini kabul eden public gate yoktur. Private gate'e iki girdi
aynı edinim fonksiyonunun yerel değişkenlerinden gelir; dışarıdan XML, kanıt,
hash, provenance veya ayrı paket token'ı alınmaz. Aynı isimli başka belgenin
temiz XML'ini File metadata'sına eklemek üretim kararını değiştirmez. Gerçek
browser File girdisi değişmezdir; aynı JavaScript runtime'ında reader/parser
monkey-patching yapan saldırgan modüllere karşı sandbox iddiası yoktur.

Sprint 44'ün raw'sız/general-extraction gate'i equation fixture'ını gereksiz
erteliyordu; production'a alınmadı. Sprint 45 classifier'ı production'a taşındı;
eski test yolu onu yeniden export eder. Numeric margin/section gerçekleri mevcut
parser'dan, akademik değerlendirme mevcut registry/assessment kararından gelir.
MCE ve revision semantiği mevcut yardımcıları kullanır. Duplicate/çelişkili pgMar,
eksik terminal ve unsupported carrier ayrı yapısal engellerdir. Equation sayısı
bir izin veya ret istisnası değildir.

Sprint 47 token API'si margin-only test pilotu olarak korundu. Production'da
ayrı kanıt değişimi API'sine ihtiyaç bırakmayan File tabanlı kapalı edinim
kullanıldı. Pilotun normalizer kopyası bağımsız karşılaştırma oracle'ı olarak
kaldı; production'ın iki edinim yolu aynı `normalizeDocxParts` fonksiyonunu kullanır.

## 2. Değişen production dosyaları

| Dosya | Değişiklik |
| --- | --- |
| `src/features/analysis/analysisService.ts` | Gate başarıyla dönmeden akademik engine/report hattına geçmez |
| `src/features/analysis/normalizeDocxParts.ts` | Mevcut normalizer kompozisyonu davranış değiştirmeden ortak fonksiyona taşındı |
| `src/features/analysis/engine/AnalysisReadinessGate.ts` | Tek paket edinimi, private zorunlu raw gate ve typed erteleme hatası |
| `src/features/analysis/engine/sectionEvidenceClassifier.ts` | Sprint 45 yapısal classifier'ının ortak production kaynağı |
| `src/pages/UploadPage.tsx` | Özel hata mesajı; eski isteğin yeni dosya/erteleme durumunu ezmesini önleyen istek kimliği |

Yeni testler: `tests/audit/productionFalsePassRegression.cjs` ve
`tests/browser/productionReadinessRegression.cjs`.
Sprint 42/43/44 testlerinin eski koşulsuz production-report beklentileri gerçek
erteleme sözleşmesine güncellendi. Eski numeric/status oracle'ları doğrudan legacy
engine ile korunur; production erteleme ve sıfır engine/builder çağrısı ayrıca
assert edilir. Sprint 43'te 12 eski false-PASS kontrolünün tamamı sayılarak sınanır;
güvenlik beklentileri gevşetilmedi. Browser runner mevcut CDP yardımcılarını export
eder; mevcut CLI davranışı korunur. Historical pilot çıktılarındaki
`productionIntegrated:false` ve Sprint 44 `compatibilityAcceptance:FAIL` alanları
o pilotların sınırını anlatır; yeni production kabul sonucu yerine kullanılmaz.

## 3. Önce / sonra kararları

P/F sırası üst/alt/sol/sağdır. DEFER bir RuleResult değildir.

| Senaryo | Önce | Production sonra |
| --- | --- | --- |
| Terminal section eksik | P/P/P/P | DEFER; rapor/skor yok |
| İki paragraph section, terminal eksik | P/P/P/P | DEFER; rapor/skor yok |
| altChunk; terminal mevcut | P/P/P/P | DEFER; rapor/skor yok |
| pgMar yok | F/F/F/F | DEFER; rapor/skor yok |
| Üst margin kanıtı eksik | F/P/P/P | DEFER; rapor/skor yok |
| Önceki section margin kanıtı eksik | F/F/F/F | DEFER; rapor/skor yok |
| Duplicate veya çelişkili pgMar | İlk okunabilen kayda güvenebilirdi | DEFER |
| Başka belgenin temiz raw XML'i | Eski bağımsız raw pilot API'si ACCEPT olabiliyordu | Production API'si bağımsız raw kabul etmez; metadata sahteciliği etkisiz |
| Tam tek/çoklu section | Mevcut akademik sonuç | Aynı sonuç |
| Önceki section sol margin ihlali | P/P/F/P | P/P/F/P |
| Equation; tam layout kanıtı | Analiz | Analiz |
| Equation + altChunk | Analiz | DEFER |
| Geçersiz DOCX/XML | Package error | Mevcut package error; rapor/skor yok |

## 4. Sprint 43 güvenlik testi

Önce: **FAIL, exit 1, 12 assertion**. Sonra: **PASS, exit 0,
falsePasses=0, remediatedAssertions=12**. Dokuz senaryonun altısı production'da
typed hatayla durur; her birinde RuleEngine ve ReportBuilder çağrıları sıfırdır.
Üç güvenilir senaryoda ikisi de birer kez çalışır ve margin kararları korunur.
Legacy düşük seviyeli engine doğrudan çağrıldığında tarihsel davranışını korur;
production rapor edinim sınırı `analyzeDocx`'tir. Yeni bir production tüketicisi bu
sınırı kullanmalıdır; tek başına `RuleEngine.run()` güvenilir edinim API'si değildir.

## 5. False-accept / false-defer ve fixture karşılaştırması

Yeni production regresyonu **22 negatif/kontrol senaryosu + 44 fixture** üzerinde
47 ACCEPT / 19 durdurma doğruladı: **false-accept=0, false-defer=0**.
Geçersiz paketlerin durdurulması mevcut package-error yoludur; bütün durdurmalar
typed layout ertelemesi olarak sunulmaz.

44 fixture için Sprint 47'nin bağımsız normalization kompozisyonuyla tam belge
deep-equal karşılaştırması **44/44**; production raporundaki dört margin RuleResult
ile bağımsız legacy oracle karşılaştırması **44/44**. Her production denemesinde
tek ZIP okuması assert edildi. 31 regression, 11 exploratory ve 2 manual fixture'ın
tamamı analize devam etti; equation fixture'ı engellenmedi. Fixture hash'leri
test öncesi/sonrası eşit; Git'te DOCX değişikliği yok. Hiçbir fixture yeniden yazılmadı.

Bu oranlar ölçülen population içindir. 42 fixture programmatic/synthetic,
2 manual fixture unknown/unverified; Word-native veya LibreOffice round-trip
uyumluluğu kanıtlandığı iddia edilmez.

## 6. UI ve scoring

Readiness hatası RuleResult'a çevrilmez. Rapor Promise'i sonuç vermeden reject olur;
engine/builder çalışmaz, başarı skoru veya sıfır skorlu sahte rapor üretilmez.
Legacy PASSED/FAILED/NOT_APPLICABLE sözleşmesi ve skor aritmetiği korunur.

UploadPage mevcut catch/alert mekanizmasında şu mesajı gösterir:

> Belgenin sayfa düzeni bilgileri güvenilir biçimde doğrulanamadığı için analiz tamamlanamadı. Lütfen DOCX dosyasını yeniden kaydedip tekrar deneyin.

Gerçek Chrome + native DOMParser testi: eksik terminal, duplicate pgMar ve
equation+altChunk için mesaj birebir doğrulandı; rapor görünmedi. Tam equation
belgesi rapor ekranını açtı. Önceki başarılı dosyanın okuması bekletilip yeni dosya
DEFER olduktan sonra serbest bırakıldı: eski başarı yeni hata ekranını ezmedi.
Geçersiz ZIP/XML mevcut package-error mesajını kullanmayı sürdürür.

## 7. QA ve golden/corpus

| Kontrol | Sonuç |
| --- | --- |
| Sprint 41 `docxMarginComparisonRegression.cjs` | PASS |
| Sprint 42 `docxCompatibilityRegression.cjs` | PASS; 44 fixture + 37 senaryo; SDÜ default/real-scope admission reddi korundu |
| Sprint 43 `marginFalsePassSafetyRegression.cjs` | PASS; 12/12 false-PASS düzeltildi |
| Sprint 44 `analysisReadinessGateRegression.cjs` | PASS; historical raw'sız pilotun equation false-defer bulgusu korunur |
| Sprint 45 `sectionEvidenceClassificationRegression.cjs` | PASS; 27 + 3 kontrol, 44 fixture |
| Sprint 46 | Ayrı executable yok; mimari negatifler Sprint 47/48 testleriyle kapsandı |
| Sprint 47 `evidenceIntegrityRegression.cjs` | PASS; 37 kontrol + 44 fixture |
| Sprint 48 `productionFalsePassRegression.cjs` | PASS; 22 kontrol + 44 fixture |
| Sprint 48 `productionReadinessRegression.cjs` | PASS; gerçek Chrome, dört UI senaryosu + stale-success yarışı |
| `npm.cmd run test:golden` | PASS; 46/46 |
| `npm.cmd run test:corpus` | PASS; 31 regression + 11 exploratory |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS; yaklaşık 734 kB JS chunk için mevcut 500 kB uyarısı |
| `git diff --check` | PASS |
| DOCX bütünlüğü | 44/44 hash eşit; Git diff boş |

İlk lint koşusu taşınan normalizer'daki dokuz kullanılmayan import nedeniyle
başarısız oldu; importlar temizlendi ve tekrar PASS alındı. İlk browser başlatma
sandbox içinde başarısız oldu; izinli çalıştırmada doğrulandı. Browser testindeki
yanlış DOM seçicisi ve PowerShell pipe yazımında bozulan beklenen Türkçe sabit
düzeltildi; production mesajı doğruydu. Build/corpus için ilk PowerShell birleşik
log yönlendirmesinin çıkış raporu güvenilir değildi; iki komut doğrudan yeniden
çalıştırıldı ve exit 0 doğrulandı. Başarısız koşular gizlenmedi.

## 8. Kalan riskler

- Statik OOXML fiziksel/rendered footer yerleşimini tam kanıtlamaz.
  Page-number PARTIAL/MEDIUM; page-number-sequence COMPLETE/HIGH kaldı.
  Toplam 46 kural, coverage 45 COMPLETE/1 PARTIAL ve trust 45 HIGH/1 MEDIUM değişmedi.
- Tüm OOXML kombinasyonları ve gerçek öğrenci belgeleri kapsanmış değildir.
  Desteklenmeyen aktif section taşıyıcıları bilinçli teknik erteleme nedenidir.
- Classifier ek XML parse/karşılaştırma işi yapar; mevcut reader ZIP limitleri
  korunur. Aynı runtime içindeki kötü niyetli modül değişimi tehdit modeli dışıdır.
- Doğrudan düşük seviyeli engine kullanımı edinim gate'ini sağlamaz; rapor
  tüketicileri merkezi production analiz servisini kullanmalıdır.
- SDÜ kaynak/native kanıt ve admission engelleri sürer. Guard v1/v2, default-deny,
  ÇOMÜ eşikleri, rule ID'leri, kaynak dayanakları ve semantic mimari değiştirilmedi.

## 9. Sprint 48 kararı

**GO:** istenen production false-PASS düzeltmesi ölçülen güvenlik/regresyon
population'ında tamamlandı. Eksik kanıtta skor/rapor yok, güvenilir 44 fixture
gereksiz engellenmiyor, UI mesajı gerçek browser'da doğrulandı. Sprint 48 için
kalan kritik uygulama veya QA engeli yoktur.

## 10. Production onboarding kararı ve manuel tekrar

**NO-GO:** bu sprint yeni üniversite/program admission yetkisi vermez. Önceki
SDÜ source/native/onboarding engelleri kapanmadı; default-deny devam eder.
Sprint 48 entegrasyon GO kararı, yeni production onboarding izni değildir.

```powershell
node tests/audit/docxMarginComparisonRegression.cjs
node tests/audit/docxCompatibilityRegression.cjs
node tests/audit/marginFalsePassSafetyRegression.cjs
node tests/audit/analysisReadinessGateRegression.cjs
node tests/audit/sectionEvidenceClassificationRegression.cjs
node tests/audit/evidenceIntegrityRegression.cjs
node tests/audit/productionFalsePassRegression.cjs
node tests/browser/productionReadinessRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git diff --exit-code -- '*.docx'
git status --short
```

Browser kontrolü yerel Chrome/Edge gerektirir. İlk uygulama/QA aşamasında Git add,
commit veya push yapılmadı.

## Final review ve push öncesi doğrulama

Kullanıcının final review/commit/push talebi üzerine Sprint 48 diff'i yeniden
incelendi. Production kapsamı yukarıdaki beş dosyayla sınırlıdır; kurallar,
eşikler, skor aritmetiği, SDÜ guard/admission ve bağımlılıklar değişmedi.
Classifier taşımasının önceki kaynakla mantıksal/içerik eşitliği doğrulandı.

Sprint 43 güvenlik regresyonu (12/12), Sprint 48 production regresyonu
(22 senaryo + 44 fixture), gerçek Chrome UI/yarış testi, golden 46/46,
corpus 31+11, typecheck, lint, build ve diff/whitespace kontrolleri yeniden PASS.
Eksik kanıtta engine/builder çağrıları sıfır, rapor/skor yoktur.
44 DOCX hem QA öncesi/sonrası hash'leriyle hem HEAD içeriğiyle birebir aynıdır.
Build'in mevcut büyük chunk uyarısı sürer. Sprint 48 GO ve SDÜ onboarding
NO-GO kararları korunur. Yalnız incelenen Sprint 48 dosyaları commit kapsamındadır.
