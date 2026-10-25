# Sprint 33 — SDÜ normatif kanıt ve politika karar hazırlığı

İnceleme tarihi: 25 Ekim 2026. Durum: **karar hazırlığı; akademik onay verilmedi**.
Production onboarding **NO-GO**. Gerçek scope admission kapalı; production authorization
`not-granted`. Bu rapor parser, normalizer, validator veya admission politikası değildir.
Sprint 32 simülasyonu mevcut execution kararlarını değiştirmemiştir.

## 1. Kanıt sınıfları ve kaynak erişimi

- **F**: pilotlarda kayıtlı frozen provenance; bu sprintte PDF byte'larıyla doğrulanmadı.
- **W**: web aracının resmî sayfalardan döndürdüğü metin/bağlantı; önbellekli olabilir.
  Güncel PDF byte'ları veya o PDF'nin içeriği için kanıt değildir.
- **T**: mevcut kod ve çalıştırılan sentetik regresyonların teknik davranış kanıtı.
- **U**: doğrulanamadı. Bilinmeyen değer, farklılık veya eşdeğerlik anlamına gelmez.

Kaynaklar ayrı tutulur:

- **P — frozen pilot guide:** [sites/152 PDF](https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf).
- **D — department-linked guide:** [sites/147 PDF](https://muhendislik.sdu.edu.tr/assets/uploads/sites/147/files/bitirme_tasarim-2026-kilavuz-03032026.pdf).

| Alan | P | D |
| --- | --- | --- |
| PDF byte'ları elde edildi mi? | Hayır | Hayır |
| Byte size | U; sıfır byte iddiası değildir | U |
| Yeni SHA-256 | Hesaplanamadı | Hesaplanamadı |
| Sayfa sayısı | U | U |
| Belge tarihi/sürümü | U; URL'deki 06042026 sürüm kanıtı değildir | U; URL'deki 03032026 sürüm kanıtı değildir |
| İlgili normatif metnin yeni okuması | Yok; yalnız F kayıtları | Yok |
| Bölümün açık yönlendirmesi | İncelenen W zincirinde P'ye yönlendirme saptanmadı | W ders sayfasının kılavuz bağlantısı D'ye gidiyor |
| 11 pilotun türetildiği kaynak | F: 9 section + 2 margin | Pilotların kayıtlı kaynağı değil |
| Byte/metin/gereklilik eşdeğerliği | P–D arasında U | P–D arasında U |

P için korunmuş **kayıtlı** hash:
`f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44`.
Bu değer yeni indirilmiş dosyanın hash'i olarak sunulmaz. Admission doğrulama durumu
`registered-hash-only` kalır. D için kayıtlı hash uydurulmaz.

Bu sprintte denenmiş erişim yolları:

| Yöntem | P sonucu | D sonucu |
| --- | --- | --- |
| Web aracıyla doğrudan PDF açma | Timeout | Erişilemiyor |
| Resmî ders sayfasından PDF bağlantısını izleme | P bağlantısı yok | Timeout |
| Resmî alan adında exact dosya adı araması | Kullanılabilir sonuç yok | Kullanılabilir sonuç yok |
| Python urllib GET, browser User-Agent/Accept başlıkları | Yerel WinError 10013 ağ kısıtı | Aynı |
| .NET HttpClient GET, browser User-Agent | Yerel socket erişim kısıtı | Aynı |
| İzin denetiminden geçen urllib GET, PDF'yi bellekte okuma | 15 saniye timeout | 15 saniye timeout |
| Mevcut docs/public/tests/sample-documents PDF taraması | Yerel kopya bulunmadı | Yerel kopya bulunmadı |

Bu sonuçlar sitenin herkes için erişilemez olduğunu kanıtlamaz; bu ortamın erişim
sonuçlarıdır. PDF dosyası veya geçici indirme dosyası oluşturulmadı. Bir PDF elde
edilse bile diğeri olmadan P–D eşdeğerliği kararı verilemez. Hash eşitliği yalnız
byte kimliği için kanıttır; farklı hash ise akademik farkı tek başına kanıtlamaz.

## 2. Resmî web kapsam zinciri

| Kapsam bileşeni | Açık W kanıtı | PDF içeriğinden kanıt | Sınır |
| --- | --- | --- | --- |
| Süleyman Demirel Üniversitesi | [Bölüm ana sayfası](https://muhendislik.sdu.edu.tr/endustri/tr/) üniversiteyi tanımlıyor | U | Web kimliği doğrulanabilir; admission onayı değildir |
| Mühendislik ve Doğa Bilimleri Fakültesi | Aynı sayfanın bölüm adresi fakülteyi açıkça adlandırıyor | U | Production identity ID eşlemesi yapılmadı |
| Endüstri Mühendisliği | Bölüm ana sayfası ve [ders sayfası](https://muhendislik.sdu.edu.tr/endustri/tr/lisans/bitirme-odevi-tasarim-projesi-dersi-476s.html) açıkça tanımlıyor | U | Başka bölümlere genişletilmez |
| Lisans | [Lisans sayfası](https://muhendislik.sdu.edu.tr/endustri/tr/lisans.html) ilgili ders sayfasına bağlıyor | U | Lisansüstü kapsam çıkarılmaz |
| Bitirme Ödevi / Tasarım Projesi | Ders sayfası bu çalışma türlerini açıkça tanımlıyor | U | Her öğrenci/cohort için sürüm ve yürürlük U |
| Kılavuz uygulanabilirliği | [Bölüm duyurusu](https://muhendislik.sdu.edu.tr/endustri/tr/haber/bitirme-odevi-ve-tasarim-projesi-dersleri-hakkinda-onemli-guncelleme-57745h.html) fakülte kılavuzuna uygunluk istiyor; bağlı ders sayfası D'ye gidiyor | U | D'nin gerçek metni ile P'deki 11 gereklilik arasındaki bağ tamamlanmadı |

Web kapsam kanıtı vardır; bunu “hiç kapsam kanıtı yok” diye raporlamak doğru değildir.
Ancak P'nin bu kapsam ve yürürlükteki sürümle ilişkisi **doğrulanmadı**. Sentetik test
scope'u gerçek scope yerine geçmez; gerçek scope admission bu sprintte açılmadı.

## 3. On bir pilot reconciliation matrisi

Pilot maddeleri [section konfigürasyonundan](../../tests/audit/sduSectionPresenceAssessmentPilot.ts)
ve [margin konfigürasyonundan](../../tests/audit/sduMarginAssessmentPilot.ts) okunmuştur.
Bunlar F kayıtlarıdır; yeni PDF transkripsiyonu veya normatif alıntı değildir.
Section sözleşmesi yalnız `REQUIRED_SECTION / required / exact section identity`;
margin sözleşmesi yalnız OOXML üst/alt ayarıdır. Sıra, içerik kalitesi ve fiziksel
yerleşim gerekliliği eklenmez.

Tüm satırlarda D maddesi **U**, requirement equivalence **U**, farkın varlığı/etkisi
**U**, scope applicability **W var / P–D bağı U** olarak ayrı kaydedilmiştir.
Güven: execution–inventory–F mapping için T ile yüksek; iki PDF'nin normatif
eşdeğerliği için **doğrulanmamış**. Bu ortak durumlar hiçbir satırda onay sayılmaz.

| Inventory ID | Execution ID | Kayıtlı gereklilik | P source clause (F) | D clause | Equivalence | Scope applicability | Fark/etki | Evidence confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SDU-INV-SEC-13 | pilot.sdu.2026.section.introduction.presence | Giriş varlığı | §1 s.3 sıra 13; §4.2 s.16 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-07 | pilot.sdu.2026.section.summary.presence | Özet varlığı | §1 s.3 sıra 7; §4.1 s.16 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-08 | pilot.sdu.2026.section.abstract.presence | Abstract varlığı | §1 s.3 sıra 8; §4.1 s.16 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-03 | pilot.sdu.2026.section.thesis-approval.presence | Tez Onayı varlığı | §1 s.3 sıra 3 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-05 | pilot.sdu.2026.section.undertaking.presence | Taahhütname varlığı | §1 s.3 sıra 5 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-09 | pilot.sdu.2026.section.acknowledgements.presence | Teşekkür varlığı | §1 s.3 sıra 9 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-14 | pilot.sdu.2026.section.literature-summaries.presence | Kaynak Özetleri varlığı | §1 s.3 sıra 14; §4.3 s.16 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-19 | pilot.sdu.2026.section.impact-value-usability.presence | Yaygın Etki/Katma Değer/Kullanılabilirlik varlığı | §1 s.3 sıra 19; §4.8 s.17–18 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-SEC-22 | pilot.sdu.2026.section.curriculum-vitae.presence | Özgeçmiş varlığı | §1 s.3 sıra 22; §4.11 s.19 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-LAY-05 | pilot.sdu.2026.margin.top | Üst margin 2.5 cm | §2.2 s.4 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |
| SDU-INV-LAY-06 | pilot.sdu.2026.margin.bottom | Alt margin 2.5 cm | §2.2 s.4 | U | U | W var; P bağı U | U | T mapping yüksek; normatif U |

PDF'ler elde edilince her satır için gerçek P/D maddesi, basılı ve PDF sayfası,
çalışma türü, zorunluluk ve exact ad ayrı karşılaştırılmalıdır. Değişmeyen bir madde
bile diğer maddelerin eşdeğerliğini kanıtlamaz. Farklı maddeler varsa sürümlü kaynak
bağları ve kapsam kararı gerekir; mevcut hash veya ID sessizce değiştirilmez.

## 4. Margin politika seçenekleri — onay bekliyor

Katmanlar:

1. **Normatif ölçü:** F kaydında 2.5 cm; P/D metni bu sprintte yeniden okunamadı.
2. **OOXML temsil:** integer twips veya şemanın desteklediği birimli ölçü.
   1 twip = 1/1440 inch; 2.5 cm = `180000/127` twips ≈ 1417.32283465.
   Exact integer equality mümkün değildir. Normal temsil hassasiyeti akademik tolerans değildir.
3. **Birimli ölçü:** `2.5cm` ölçüyü doğrudan taşır; `2.499cm` ve `2.501cm` farklı
   raw değerlerdir. Birimin geçerli oluşu akademik kabul onayı değildir.
4. **Parser precision:** iki ondalıklı cm üretir; 1415–1420 twips ve yukarıdaki
   iki yakın cm değeri 2.50 olur. Raw hassasiyet bilgisi normalize değerde kaybolur.
5. **Validator comparison:** normalize cm ile expected cm arasında eşitlik;
   eksik kanıt undetermined, açık coverage compliance'ı kapatır, kesin violation korunur.

Teknik dayanak: [mevcut ölçüm sözleşmesi](../MARGIN_NUMERIC_AND_PRECISION_CONTRACT.md),
[parser](../../src/features/analysis/parsers/documentXmlParser.ts),
[validator](../../src/features/analysis/rules/validators/MarginValidator.ts),
[numeric regresyon](../../tests/audit/marginNumericLexicalRegression.cjs).

| Seçenek | False compliant | False violation | Undetermined etkisi | Öneri / gerekli onay |
| --- | --- | --- | --- | --- |
| A: mevcut rounded-cm equality | Onaysız 1415–1420 kabul bandı ve yakın cm değerlerinde risk sürer | Yuvarlama sınırına/temsil yoluna bağlı risk | Eksik/açık kanıt dışında düşük | Mevcut davranış olarak belgelenir; production politikası diye onaylanmaz |
| B: konservatif undetermined | Onaysız eşitlikten doğan kabul azalır | Yakın integer değerleri otomatik violation yapmayarak azalır | 1414–1421 ve yakın cm örneklerinde artar | Yalnız simülasyon; uygulanması için ayrı karar ve uygulama sprinti gerekir |
| C: kaynak + temsil kanıtına dayalı explicit precision | Kanıtlanmış dönüşüm varsa azaltılabilir; tolerans uydurulursa sürer | Raw tam eşitlik/yanlış quantization seçilirse artar | Kanıtla çözülmüş durumlarda azalabilir | Raw lexical/unit/quantization/rounding provenance, Word-native deney ve yetkili akademik karar olmadan tanımlanamaz |

B simülasyonu: 1414–1421 → U; exact 2.5cm + closed coverage → C;
2.499/2.501cm → U; eksik/malformed → U; açık 3cm kontrolü → V.
Kesin V, diğer bölümdeki eksik kanıttan etkilenmez; closed ve tüm exact C olmadan
toplam C üretilemez. Bunlar F gerekliliği üzerinden test tasarımıdır; gerçek SDÜ
scope yetkilendirmesi veya production sonucu değildir. C için sayısal eşik,
nearest-integer target veya ± tolerans **önerilmiş/onaylanmış değildir**.

## 5. SEC-19 identity seçenekleri — onay bekliyor

F exact ad: **Yaygın Etki/Katma Değer/Kullanılabilirlik**.
Aşağıdaki C/V/U: compliant / violation / undetermined. Normatif durum sütunu
P/D'nin bu sprintte yeniden okunmadığını açıkça korur. C için ayrıca confirmed
structural identity ve closed coverage gerekir.

| Kategori | Mevcut T davranışı | Sprint 32 simülasyonu | Normatif kanıt | Önerilen karar | Gereken onay / teknik gerekçe |
| --- | --- | --- | --- | --- | --- |
| Exact text | C | C | F exact ad; yeni P/D okuması U | Koşullu C | Exact adın ilgili kapsamda zorunlu olduğunun kaynak bağını tamamla |
| Case | C | U | Eşdeğerlik onayı yok | U | Türkçe case politikasının yetkili kabulü; normalizer sonucu tek başına yetmez |
| Unicode canonical NFC/NFD | C | C | Varyant onayı yok; kanonik Unicode temsil gerekçesi mevcut | Koşullu C önerisi | Karakter silmeden aynı Unicode metni temsil ettiği teknik olarak doğrulanmalı; genel NFKC/harf transliterasyonu kapsam dışı |
| Turkish diacritics | C | U | Harf değişimine izin kanıtı yok | U | ı/i, ğ/g gibi değişimleri akademik eşdeğer saymak için açık kabul |
| Whitespace | C | U | İzin verilen dönüşüm tanımı yok | U | Trim/katlama/satır ayrımı sınırının açık onayı; sözcükleri birleştirme yok |
| Slash variants | C | U | Birleşik adın alternatif ayraçlarına izin yok | U | Slash'ın korunması veya hangi dönüşüme izin verildiğinin kararı |
| In-word punctuation (`Ya!ygın…`) | C | U | Noktalama silmeye izin yok | U | Kaynak onayı olmadan otomatik identity kurma; yanlış C riski |
| Word-boundary deletion | C | U | Sözcükleri birleştirmeye izin yok | U | Token sınırlarını koruyan karşılaştırma tasarımı |
| Partial/split headings | Closed coverage altında V | U | Birleşik adın parçalarına izin yok | Aday varsa U | Ne exact bölüm onayı ne de güvenli yokluk kanıtı çıkar; alias yaratma |
| Name-only / yanıltıcı style / yapısal belirsizlik | U | U | Başlık yapısı kanıtlanmıyor | U | Bağımsız heading provenance gerekir |
| Closed coverage ve gerçekten aday yok | V | V | Required sözleşmesi + closed yokluk | V korunur | Metin eşitliği ile coverage'ı karıştırma |

Önerilen sıralama: onaysız dönüşümleri U olarak ele alan B yaklaşımını ayrı
uygulama kararı için hazır tut; exact/NFC koşullarını teknik olarak doğrula;
case/whitespace gibi daha geniş eşdeğerlikleri ancak açık onayla değerlendir.
Her başlığı otomatik V yapmak da, mevcut normalize eşitliği nedeniyle otomatik C
vermek de güvenli çözüm değildir. Bu sprintte yeni alias veya production değişikliği yoktur.

## 6. Decision register

Tüm kayıtlar **OPEN / approval-pending**. “Required approval” alanları önerilen
onay ihtiyacıdır; herhangi bir kişinin onayı alınmış veya alınacağı varsayılmaz.

### SDU-DR-33-01 — P/D kaynak uzlaştırması (P1)

- **Evidence:** F aynı P URL/hash'ine bağlı 11 pilot; W bölüm zinciri D'ye gidiyor; erişim tablosunda byte yok.
- **Source status:** P registered-hash-only; D unverified; normatif eşdeğerlik U.
- **Proposed policy:** Kaynakları ayır; ikisini byte/hash/sürüm ve madde bazında incelemeden birleştirme.
- **Alternatives:** Aynı resmi dosyanın güvenilir arşiv/kopyası veya yetkili kaynaktan sağlanan PDF; yalnız biri varsa kısmi inceleme ve diğerini U tutma.
- **Risk:** Yanlış sürüm/kapsamın 11 gerekliliğe atanması; aynı dosya boyutunu eşdeğerlik sayma.
- **Required approval:** İlgili bölüm/fakültenin uygulanacak kılavuz ve yürürlük kapsamına dair doğrulanabilir kararı; teknik provenance incelemesi.
- **Implementation dependency:** İki gerçek PDF, SHA-256 ve sayfa/sürüm kaydı, 11 ayrı madde karşılaştırması; fark varsa ayrı sürümlü mapping tasarımı.
- **Production gate:** BLOCKED. Byte/hash doğrulaması yalnız kaynak gate'inin bir kısmını kapatır; production authorization sağlamaz.

### SDU-DR-33-02 — Gerçek akademik scope binding (P1)

- **Evidence:** W üniversite/fakülte/bölüm/lisans/çalışma türü zinciri; P'nin bu zincire normatif bağı U.
- **Source status:** W mevcut; PDF applicability/yürürlük/cohort kararı U.
- **Proposed policy:** Gerçek scope default-deny; sentetik scope yalnız testlerde.
- **Alternatives:** Doğrulanmış D kapsamıyla ayrı gelecekteki sözleşme veya P'nin bu kapsamda geçerli olduğuna açık karar; sessiz URL/scope değişikliği yok.
- **Risk:** Genel fakülte belgesini yanlış bölüm/program/döneme uygulamak.
- **Required approval:** İlgili akademik birimin kapsam ve sürüm kararı; uygulama tarafında identity/contract/provenance incelemesi.
- **Implementation dependency:** DR-33-01, explicit university/faculty/department/programLevel/workType mapping ve ayrı admission değişiklik kapsamı.
- **Production gate:** BLOCKED. Kaynak kararı ve assessment-ready durumu production-ready yetkisine dönüştürülemez.

### SDU-DR-33-03 — Margin precision policy (P0)

- **Evidence:** T 1415–1420 twips ve 2.499/2.501cm → 2.50; iki margin pilotu; Sprint 32 downgrade örnekleri.
- **Source status:** F 2.5 cm; akademik tolerans veya integer quantization politikası onaylı değil; P/D yeni metni U.
- **Proposed policy:** B'yi yalnız karar adayı olarak tut; C'nin kanıtını hazırla. Mevcut A bu sprintte değiştirilmez.
- **Alternatives:** A ile mevcut risk; B ile daha fazla U; C ile kanıtlı explicit precision. Raw tam eşitlik normal integer temsilini reddedebileceği için otomatik çözüm değildir.
- **Risk:** A'da yanlış C; gelişigüzel tolerance/nearest-integer veya exact equality'de yanlış C/V; B'de artan U.
- **Required approval:** Yetkili akademik kapsam/ölçüm kabul kararı ve teknik temsil-hassasiyet incelemesi.
- **Implementation dependency:** DR-33-01/02; raw lexical/unit/rounding/quantization metadata tasarımı, Word-native ölçüm kanıtı, legacy etki analizi ve ayrı implementation sprinti.
- **Production gate:** BLOCKED. Tolerans üretilemez; simülasyon gerçek execution yerine raporlanamaz.

### SDU-DR-33-04 — SEC-19 identity policy (P0)

- **Evidence:** T `Ya!ygın…`, slash/harf/kelime sınırı değişiklikleri mevcut normalizer'da C; conservative simulation U.
- **Source status:** F birleşik exact ad; geniş eşdeğerliklerin normatif onayı yok; D exact ad/madde U.
- **Proposed policy:** Yukarıdaki kategori matrisi; exact/canonical koşullu C, onaysız varyant adayı U; gerçek closed yokluk V.
- **Alternatives:** Geniş normalize eşitliğini sürdürmek; tüm varyantları V yapmak; kategori bazlı kanıtla sınırlanmış karşılaştırma. İlk ikisinin riskleri nedeniyle üçüncüsü karar adayıdır.
- **Risk:** Yanlış C, kanıtsız alias, kısmi/split adayı yanlış yokluk sayarak yanlış V.
- **Required approval:** Case/diakritik/whitespace/slash eşdeğerlikleri için akademik kabul; Unicode/structural identity için teknik gerekçe ve inceleme.
- **Implementation dependency:** DR-33-01/02; token sınırlarını koruyan test tasarımı, mevcut semantic source-of-truth üzerinden ayrı değişiklik; scoring/legacy izolasyon kontrolleri.
- **Production gate:** BLOCKED. Global normalizer değişikliği veya yeni alias bu raporla yetkilendirilmez.

### SDU-DR-33-05 — Native ve gerçek belge kanıtı (P1)

- **Evidence:** tests/sample-documents/public/docs disk taramasında 42 DOCX; manifestte 42 synthetic-ooxml, kayıtsız dosya yok.
- **Source status:** Corpus provenance kayıtlı; Word-native, LibreOffice-native ve gerçek öğrenci kanıtı yok.
- **Proposed policy:** Sentetik başarıyı gerçek belge doğrulaması sayma; creation tool/version/platform ve işlem geçmişiyle native provenance topla.
- **Alternatives:** Privacy-safe Word-native sentetik belgeler; anonimleştirilmiş, izinli gerçek öğrenci örnekleri. Script ile yeni ZIP üretmek native kanıt sağlamaz.
- **Risk:** Gerçek editör temsillerindeki parser/coverage sınırlarının görünmemesi; kişisel veri sızıntısı.
- **Required approval:** Öğrenci örnekleri için gerekli kullanım izni/anonimleştirme incelemesi; teknik provenance doğrulaması.
- **Implementation dependency:** Belgelerin temini, doğrulanabilir provenance, kişisel verinin anonimleştirilmesi ve manifest/test incelemesi.
- **Production gate:** BLOCKED. Kişisel veri içeren ham öğrenci dosyası kalıcı fixture'a eklenmez.

## 7. QA ve sonraki sprint

Yeni kaynak karşılaştırma regresyonu eklenmedi: karşılaştırılabilir PDF kanıtı yok;
aynı başarısız indirme senaryosu çoğaltılmadı. Mevcut testler değiştirilmedi.

| Çalıştırılan focused regresyon | Sonuç |
| --- | --- |
| sduConservativePolicySimulationRegression | 43 PASS; 25 C→U, 8 V→U, 27 unchanged değerlendirme; yalnız simülasyon |
| sduNormalizationPolicyBoundaryRegression | 29 PASS |
| marginNumericLexicalRegression | 21 PASS |
| sduEvidenceBoundaryRegression | 64 PASS |
| sduAssessmentPipelineParityRegression | 15 PASS |
| assessmentAdmissionRegression | 14 PASS |
| assessmentReportContractRegression | 20 PASS |
| sduIntegratedAssessmentPilotRegression | 24 PASS; 11 pilot |
| sduSectionPresenceAssessmentPilotRegression | 130 PASS |
| sduMarginAssessmentPilotRegression | 19 PASS |
| sduSectionEvidenceCalibrationRegression | 171 PASS; 169 geçici kopya temizlendi |

`npm.cmd run test:golden`: 46/46 PASS. `npm.cmd run typecheck`, `npm.cmd run lint`,
`npm.cmd run build`: PASS. Build mevcut >500 kB bundle uyarısını verdi.
`npm.cmd run test:corpus`: 31 regresyon + 11 exploratory fixture PASS.
`git diff --check`: temiz. `git status --short`: Sprint 33 yalnız bu yeni raporu
ekledi; önceki modified/untracked dosyalar korundu. `npm.cmd run test`
çalıştırılmadı. Fixture'lar değiştirilmedi; Gıda 46 / Bilgisayar 47 baseline'ları ve
legacy scoring davranışı korunuyor. Git add/commit/push yapılmadı.

**Sprint 34 GO:** önce DR-33-01 için kaynak temini/madde incelemesi; sonra kapsam ve
precision/identity onayları; ardından ayrı sınırlandırılmış implementation ve native
kanıt çalışması. Kaynak elde edilmeden “eşdeğerlik doğrulandı” uygulama sprinti NO-GO.
**Production onboarding NO-GO:** P0'lar production davranışında çözülmedi; P1'ler açık.
Bu rapor hiçbir akademik kuralı, alias'ı, tolerance'ı veya production aktivasyonunu onaylamaz.
