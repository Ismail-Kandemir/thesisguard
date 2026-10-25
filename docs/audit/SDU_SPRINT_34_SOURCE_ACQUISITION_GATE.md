# Sprint 34 — Yerel kaynak keşfi ve karar kapısı

Tarih: 25 Ekim 2026. Sonuç: **SOURCE_UNAVAILABLE** — istenen iki resmî PDF
doğrulanmış kaynak olarak elde edilmedi. Bir yerel PDF adayı bulundu; bu adayın
dosya adından SDÜ aidiyeti çıkarılmadı. Production onboarding **NO-GO**.

## Yerel arama sınırı ve bulgular

- `C:\Users\ismail\tez-sorgu` içinde proje dosyaları tarandı. Bağımlılıklar,
  `.git`, build çıktıları ve araç/özel klasörler dışarıda bırakıldı. PDF bulunmadı.
- `docs/`, `docs/sources/`, `tests/`, `tests/fixtures/`, `public/` ve
  `sample-documents/` bu taramaya dahildir. Proje kökünde `fixtures/`, `downloads/`,
  `source-artifacts/`, `artifacts/` klasörleri mevcut değil.
- Projedeki source/corpus manifestleri ve önceki audit kayıtları incelendi.
  SDÜ için yerel PDF artifact yolu kayıtlı değil; yalnız URL/frozen hash var.
- COMÜ source manifestinin işaret ettiği
  `C:\Users\ismail\tez-sorgu\docs\sources\comu\applied-sciences\food-technology\bachelor\original\102-bitirme-tezi-hazirlama-kilavuzu.pdf`
  mevcut değil. Bu kayıt başka üniversiteye aittir; SDÜ kaynağı olarak kullanılmadı.
- Kullanıcı kök dizinini listeleme ilk denemede `WinError 5` ile engellendi;
  tüm kullanıcı dizininin tarandığı iddia edilmez. Doğrudan erişilebilen
  `C:\Users\ismail\Downloads` listelendi; yalnız SDÜ/bitirme/kılavuz ile ilgili
  PDF adaylarının içeriği incelendi. İlgili isimli alt kaynak klasörü bulunmadı.
  İlgisiz kişisel dosyaların içerikleri açılmadı.

## Bulunan PDF adayı

| Alan | Gözlem |
| --- | --- |
| Absolute path | `C:\Users\ismail\Downloads\78-bitirme-tezi-kilavuzu.pdf` |
| Byte size | 128837 |
| Gerçek byte'lardan SHA-256 | `0816f0ffe92d830ccffea48a15c952517df62a59c6a424a2606d815b84a99fd0` |
| PDF imzası | `%PDF-1.4`; PDF format sürümüdür, kılavuz revizyonu değildir |
| Page count | 1; catalog nesnesinin `/Pages` ağacı `/Count 1`, tek `/Kids` referansı ve tek çözülmüş `/Page` nesnesi ile kontrol edildi |
| Document title | Doğrulanamadı; kullanılabilir Title metadata'sı elde edilmedi |
| Document version/date | Doğrulanamadı |
| Extractable text status | Metin operatörleri var; sıkıştırılmış stream'lerden yalnız parçalı, font kodlaması çözümlenmemiş metin elde edildi. Güvenilir tam metin/normatif transkripsiyon yok |
| Kullanılan yöntem | Python standart kütüphanesiyle read-only byte/hash ve sınırlı PDF nesne/stream incelemesi; yeni dependency kurulmadı |
| Frozen P hash eşleşmesi | **Hayır**; kayıtlı frozen byte kimliğiyle aynı dosya değil |
| Department D ile eşleşme | **Unresolved**; D byte'ları/hash'i ve adayın resmî kaynak ilişkisi yok |
| Kaynak olarak kabul | Hayır; provenance/title/scope/normatif metin doğrulanmadı |

PDF kopyalanmadı, değiştirilmedi veya fixture'a eklenmedi. Hash farkı bu dosyanın
kayıtlı frozen byte kimliği olmadığını gösterir; aynı akademik gereklilikleri
taşıyıp taşımadığını ya da D olup olmadığını tek başına göstermez.

## İki istenen kaynak ve acquisition boundary

**P:** https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf

**D:** https://muhendislik.sdu.edu.tr/assets/uploads/sites/147/files/bitirme_tasarim-2026-kilavuz-03032026.pdf

P için kayıtlı frozen SHA-256:
`f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44`.
Bu sprintte yeniden indirilmiş P hash'i değildir. D hash'i bilinmiyor.

| Kaynak | Sonuç | Yerel doğrulanmış kopya | Boyut/hash/sayfa/metin |
| --- | --- | --- | --- |
| P | SOURCE_UNAVAILABLE | Yok | Yeni ölçüm/doğrulama yok |
| D | SOURCE_UNAVAILABLE | Yok | Yeni ölçüm/doğrulama yok |

[Sprint 33 erişim kaydı](SDU_SPRINT_33_POLICY_APPROVAL_PREPARATION.md) web aracı,
Python, .NET ve izin denetimli GET denemelerini içeriyor. Bu sprintte **sıfır yeni
ağ denemesi** yapıldı; aynı timeout yolları tekrarlanmadı. Önceki erişim sonuçları
bugün yeniden yapılmış denemeler veya bugünkü sunucu durumu gibi sunulmaz.

## Conditional reconciliation — çalıştırılmadı

İki resmî PDF birlikte elde edilmedi. Byte-level P/D karşılaştırması, sayfa ve
normatif metin karşılaştırması yapılmadı. Sonuçların tamamı **Unresolved**;
Equivalent veya Different kararı yok. P maddeleri kayıtlı pilot provenance'ıdır,
yeni PDF okuması değildir. Scope için önceki resmî web bağlantı kaydı mevcut;
P–D uygulanabilirlik ve sürüm bağı tamamlanmış değildir.

| Inventory ID | Execution ID | Frozen clause | Department clause | Sonuç | Evidence | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| SDU-INV-SEC-13 | pilot.sdu.2026.section.introduction.presence | §1 s.3 sıra 13; §4.2 s.16 | Bilinmiyor | Unresolved | Kayıtlı P mapping | İki resmî PDF ve madde incelemesi gelene kadar mapping'i koru |
| SDU-INV-SEC-07 | pilot.sdu.2026.section.summary.presence | §1 s.3 sıra 7; §4.1 s.16 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |
| SDU-INV-SEC-08 | pilot.sdu.2026.section.abstract.presence | §1 s.3 sıra 8; §4.1 s.16 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |
| SDU-INV-SEC-03 | pilot.sdu.2026.section.thesis-approval.presence | §1 s.3 sıra 3 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |
| SDU-INV-SEC-05 | pilot.sdu.2026.section.undertaking.presence | §1 s.3 sıra 5 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |
| SDU-INV-SEC-09 | pilot.sdu.2026.section.acknowledgements.presence | §1 s.3 sıra 9 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |
| SDU-INV-SEC-14 | pilot.sdu.2026.section.literature-summaries.presence | §1 s.3 sıra 14; §4.3 s.16 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |
| SDU-INV-SEC-19 | pilot.sdu.2026.section.impact-value-usability.presence | §1 s.3 sıra 19; §4.8 s.17–18 | Bilinmiyor | Unresolved | Kayıtlı P mapping | Birleşik exact ad ve varyant politikasını ayrıca doğrula |
| SDU-INV-SEC-22 | pilot.sdu.2026.section.curriculum-vitae.presence | §1 s.3 sıra 22; §4.11 s.19 | Bilinmiyor | Unresolved | Kayıtlı P mapping | İki resmî PDF ve madde incelemesi gelene kadar mapping'i koru |
| SDU-INV-LAY-05 | pilot.sdu.2026.margin.top | §2.2 s.4; 2.5 cm | Bilinmiyor | Unresolved | Kayıtlı P mapping | Ölçü ve temsil hassasiyeti onayını ayrıca doğrula |
| SDU-INV-LAY-06 | pilot.sdu.2026.margin.bottom | §2.2 s.4; 2.5 cm | Bilinmiyor | Unresolved | Kayıtlı P mapping | Aynı |

## Somut kaynak temini yolu

1. [SOURCE_REQUEST.md](SOURCE_REQUEST.md) gönderime hazır taslaktır. Üniversiteye
   e-posta/mesaj gönderilmedi; gönderim yetkilendirilmiş değildir.
2. Talep resmî akademik iletişim kanalı üzerinden insan tarafından iletilebilir;
   iki özgün PDF, sürüm/yürürlük ve geçerli kapsam açıklaması istenir.
3. Dosyalar sonradan sağlanırsa yeniden kaydetmeden read-only byte size/SHA-256,
   PDF title/date/version/page count ve güvenilir text extraction kaydedilir.
   P hash'i kayıtlı hash ile karşılaştırılır; uyuşmazlık sessizce düzeltilmez.
4. Tek PDF gelirse yalnız o dosya incelenir; iki belge eşdeğer ilan edilmez.
   İkisi gelirse ancak o zaman yukarıdaki 11 satır clause-by-clause doldurulur.
5. Kaynak ve kapsam incelemesi ayrı karar girdisidir; dosya temini/hash eşleşmesi
   production authorization veya akademik tolerans/alias onayı sağlamaz.

## Policy gate ve corpus

- **P0 margin precision:** Açık. 1415–1420 kabul bandı akademik tolerans değildir;
  parser/validator karşılaştırması değiştirilmedi.
- **P0 SEC-19 identity:** Açık. Normalizer ve alias'lar değiştirilmedi;
  `Yaygın Etki/Katma Değer/Kullanılabilirlik` exact adı korunuyor.
- **P1 kaynak/scope:** Açık. Gerçek akademik scope admission default-deny;
  registered-hash-only ve production authorization `not-granted` korundu.
- **P1 native/gerçek belge:** Açık. tests/sample-documents/public/docs disk
  envanterinde 42 DOCX; manifest eşlemesi 42 synthetic-ooxml, kayıtsız dosya yok.
  Word-native, LibreOffice-native veya gerçek öğrenci kanıtı eklenmedi.
  Kişisel belge içerikleri fixture'a alınmadı.

Yeni normatif kanıt veya onay yok: bu sprintte hiçbir P0/P1 kapanmadı. Gelecekte
doğrulanmış byte/hash yalnız source-verification eksikliğini kısmen kapatabilir;
normatif eşdeğerlik, scope, precision/identity ve native evidence ayrı kalır.

## QA

Production kodu ve testler değiştirilmedi; yeni başarısız indirme testi üretilmedi.
Çalıştırılan focused regresyonlar:

| Regresyon | Sonuç |
| --- | --- |
| Conservative simulation | 43 PASS |
| Normalization policy boundary | 29 PASS |
| Numeric lexical | 21 PASS |
| Evidence boundary | 64 PASS |
| Pipeline parity | 15 PASS |
| Admission | 14 PASS |
| AssessmentReport | 20 PASS |
| Integrated | 24 PASS |
| Section presence | 130 PASS |
| Margin pilot | 19 PASS |
| Section calibration | 171 PASS; 169 geçici kopya temizlendi |

`npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`: PASS.
Build mevcut >500 kB bundle uyarısını verdi. `npm.cmd run test` çalıştırılmadı.
Golden/corpus tam suite bu sprintin QA listesinde istenmediği için ayrıca
çalıştırılmadı; önceki sprintin sonucu bugünkü çalıştırma olarak sunulmaz.
`git diff --check`: temiz. `git status --short` incelendi; bu sprint yalnız
SOURCE_REQUEST.md ve bu raporu ekledi, önceki modified/untracked dosyalar korundu.
Fixture hash kontrolleri geçti. Downloads PDF adayının SHA-256'sı inceleme sonunda
yeniden aynı bulundu; dosya değiştirilmedi. İlk kullanıcı-kökü listeleme hatası
sonrası doğrudan erişilebilir Downloads üzerinden sınırlı arama tamamlandı.

## Sprint 35 yönü

**GO:** Mevcut konservatif simülasyondan hareketle, onaysız identity ve precision
durumlarında belirsizliği koruyan kontrollü assessment karar politikasının teknik
tasarımı/uygulama kapsamını hazırlamak; ya da doğrulanabilir editör provenance'ı
olan privacy-safe Word-native belge kanıtını hazırlamak. Akademik alias/tolerans
icat edilmez; gerçek scope açılmaz. Bu rapor gelecek kod değişikliğine otomatik
yetki vermez; o sprintin açık kapsamı gerekir.

**Tekrar PDF araştırması önerilmiyor.** Kaynak talebi hazırdır; doğrulanabilir
belge sonradan sağlanırsa conditional reconciliation ayrı olarak açılabilir.
**Production onboarding NO-GO.** Git add/commit/push yapılmadı.
