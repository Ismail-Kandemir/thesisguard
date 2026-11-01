# SDÜ Sprint 40 — Native Evidence Acquisition & Acceptance Gate

Tarih: 1 Kasım 2026. Kapsam yalnız test/pilot evidence intake'tır. **Native validation BLOCKED; production onboarding NO-GO.** Yeni guard, akademik kural, alias veya margin toleransı geliştirilmedi.

## Mevcut native evidence durumu

Sprint 39 envanteri: 42 mevcut DOCX, tamamı fixture manifestinde `synthetic-ooxml`. Doğrulanmış Word-native 0, LibreOffice-native 0, manifest dışı mevcut DOCX 0. Bu 42 belge yeniden sınıflandırılmadı. Kaynak manifestindeki üç ayrı COMÜ DOCX referansının dosyaları mevcut değil; native kanıt sayılmazlar.

Yeni dokuz senaryo için planlanan teslim kayıtlarının güncel gate çıktısı:

| State | Kayıt sayısı |
| --- | ---: |
| MISSING | 9 |
| RECEIVED_UNVERIFIED | 0 |
| PROVENANCE_VERIFIED | 0 |
| REJECTED | 0 |
| ACCEPTED_FOR_NATIVE_TEST | 0 |

Bu sayım dokuz **planlanan teslim kaydıdır**, mevcut 42 sentetik dosyanın veya regresyondaki negatif denemelerin sayımı değildir. Gerçek native belge başvurusu/kabulü yok. Bir gerçek belge birden çok senaryoyu kapsayabilir; senaryo kapsamı ile belge sayısı ayrı sayılmalıdır.

## Acceptance contract

Modül: [sduNativeEvidenceIntake.cjs](../../tests/audit/sduNativeEvidenceIntake.cjs). Factory `createNativeEvidenceGate`, açık bir intake root'u ve operatörün bağımsız kürasyonundan gelen `provenanceReviews` / `privacyReviews` alır. Review girdileri varsayılan boştur; başvurunun içine eklenen review veya “verified” iddiası bu güven sınırını geçmez.

`evaluateBatch(submissions)` yeni bir immutable snapshot döndürür. İşlev DOCX'i değiştirmez, guard/parser/RuleEngine çalıştırmaz, scoring veya akademik C/V/N/A kararı üretmez. `nativeValidationPerformed: false` kabul çıktısında dahi korunur: test için kabul, native testin yapıldığı anlamına gelmez.

### Başvuru alanları — beyan edilmiş provenance

| Alan | Sözleşme |
| --- | --- |
| evidenceId | Açık, boş olmayan ve batch içinde benzersiz ID |
| fileName | Gerçek path basename'iyle eşleşen `.docx` dosya adı |
| filePath | Intake root'una göre açık relative path; traversal ve root dışına çıkan symlink reddedilir |
| sha256 | Teslim edilen son byte'lardan 64 hex SHA-256 |
| byteSize | Pozitif safe integer; okunan byte sayısıyla eşit |
| scenarioIds | Aşağıdaki katalogdan en az bir benzersiz ID |
| declaredProvenance.origin | Native pilot için `word-created`; sentetik rehearsal için `programmatic` |
| application | Native pilot için `Microsoft Word`; bu metin tek başına native kanıtı değildir |
| applicationVersion | Açık sürüm/build beyanı |
| operatingSystem | Açık işletim sistemi/sürüm beyanı |
| creatorId | Kişisel veri içermeyen sabit creator referansı; reviewer ile aynı olamaz |
| createdAt | Canonical UTC ISO timestamp, örneğin `2026-11-01T10:00:00.000Z`; eksik tarih uydurulmaz |
| wordUiSettings | Her scenarioId için `scenarioId`, açık `settings` metni ve `evidenceReferenceId` |
| saveMethod | Bu pilotta `manual-word-save-as-docx` |
| postCreationEdits | Açık işlem zinciri veya açık “none” beyanı; sessiz varsayım yok |
| privacyCleanup | `status: performed / not-needed / pending` ve açıklama; bağımsız privacy review yerine geçmez |
| verificationClaim | Başvuranın provenance doğrulama iddiası; gate için otorite değildir |

Son bloktaki bütün alanlar `declaredProvenance` altında taşınır. Factory'nin planlanan istek üreticisi yalnız ID, dosya adı/path'i ve scenarioIds oluşturur; hash, boyut, uygulama, UI veya doğrulama alanlarını doldurmaz. Gerçek dosyadan hesaplanan hash/boyut `observedArtifact` altında ayrıca saklanır; eksik beyana kopyalanmaz.

Bu dar pilot manuel Word-created akışı içindir. Word COM/API, conversion veya programatik başlangıçtan yalnız yeniden kaydedilen belgeler otomatik olarak bu sınıfa alınmaz; ayrı işlem geçmişi ve kapsam incelemesi gerekir. Bu sınır akademik bir tez gerekliliği değildir.

### Bağımsız provenance review

Trusted kayıt; evidenceId, dosya SHA-256/boyutu, `declarationSha256`, reviewerId, reviewedAt, status, evidenceKind, basis, findings ve supportingEvidence içerir.

- `declarationSha256`, `fingerprintDeclaration(submission)` ile alan sırasından bağımsız hesaplanır. Böylece UI ayarı, save method veya sonradan düzenleme beyanı değişirse review eskir.
- Native review `status: verified`, `evidenceKind: word-native`, `basis: independent-creation-and-save-chain-review` ister. Reviewer creator'dan farklı olmalı; review tarihi creation tarihinden önce olamaz.
- `creation-session`, `word-ui` ve `save-chain` destek kayıtları bulunmalı. Her kaydın id, filePath, sha256, byteSize alanları gerçek supporting artifact byte'larıyla doğrulanır. UI beyanları bir `word-ui` destek ID'sine bağlı olmalıdır.
- Dosya adı, ZIP timestamp, Application etiketi, OOXML biçimi veya hash eşitliği editör kökenini tek başına kanıtlamaz. DOCX container kontrolü yalnız paket okunabilirliği/temel part varlığıdır; native veya tam schema doğrulaması değildir.
- **Trust boundary:** Gate bir insanın beyanının doğruluğunu veya reviewer kimliğini otomatik/kriptografik olarak kanıtlamaz. Supporting kayıtların gerçekten o Word oturumunu ve kaydetme zincirini gösterdiği, operatör tarafından bağımsız incelemeyle doğrulanıp trusted context'e alınmalıdır. Başvuranın kendi review nesnesini vermesi yeterli değildir.
- Bilinen sentetik corpus'un mevcut path ve içerik SHA-256'ları ayrıca dışlanır. Yeniden adlandırılmış aynı-byte kopyalar da native olamaz. Değiştirilmiş bilinmeyen bir dosya bu negatif listeyle otomatik tanınmış sayılmaz; bağımsız creation/save zinciri yine zorunludur.

### Privacy review

Ayrı `privacyReviews` kaydı evidenceId, dosya hash/boyutu, declarationSha256, reviewerId, reviewedAt, `status: approved` ve gerçek `reviewReference` artifact'ına bağlıdır. Reviewer creator'dan farklı olmalıdır. Pending cleanup veya eksik/eski privacy kaydı kabulü engeller. Rejected provenance/privacy kaydı `REJECTED` üretir.

Kişisel verisiz sıfırdan test metni tercih edilir. Gerçek öğrenci belgesi gerekirse paylaşım yetkisi, comments/tracked changes/deleted text, properties, headers/footers, hidden text, embedded/custom XML ve dış bağlantılar ayrıca incelenir. Temizleme veya Save As sonrası son artifact ve inceleme kayıtları yeniden hash'lenir. Ekran/oturum kayıtları da privacy incelemesine dahildir. Hassas ham belge kalıcı fixture'a alınmaz.

## Acceptance states ve geçişler

| State | Koşul | Native test readiness |
| --- | --- | --- |
| MISSING | Planlanan artifact yok; tam metadata ve review iddiası bulunsa bile | BLOCKED |
| RECEIVED_UNVERIFIED | Dosya mevcut; beyan/bağımsız provenance review eksik, yetersiz veya eski | BLOCKED |
| PROVENANCE_VERIFIED | Native bağlamda file/hash/package/declaration/provenance koşulları geçti; privacy/cleanup henüz tamam değil | BLOCKED |
| REJECTED | Hash/boyut uyuşmazlığı, geçersiz scenario/path/package/creation chain, bilinen sentetik dosya veya explicit review reddi | BLOCKED |
| ACCEPTED_FOR_NATIVE_TEST | Dosya gerçekten mevcut, hash/boyut bağlı, provenance ve privacy review yeterli, senaryo açık | READY_FOR_NATIVE_TEST |

Değerlendirme tekrar çalıştırıldığında mevcut artifact ve review bağları yeniden kontrol edilir; state kalıcı/geri alınamaz yetki değildir. Asenkron ZIP incelemesinden sonra kabul öncesinde dosya varlığı/hash'i tekrar kontrol edilir; arada silinen dosya MISSING, değişen dosya REJECTED olur. Native test runner kabul sonrasında da çalıştırmadan önce exact byte hash'ini doğrulamalıdır.

Batch duplicate/missing evidence ID ve çelişkili trusted review ID'leri contract error olarak reddedilir; sessiz dedup yapılmaz. Geçersiz senaryo erken reddedilir; geçerli senaryo ve mevcut olmayan dosya `MISSING` olur. Mevcut dosyada eksik hash/boyut/provenance `RECEIVED_UNVERIFIED`; verilmiş ama yanlış hash/boyut `REJECTED` olur. Hiçbiri akademik violation değildir.

Boş batch `BLOCKED` kalır. Batch readiness yalnız bütün sunulan kayıtlar kabul edilmişse READY olabilir; bu tüm katalog senaryolarının kapsandığını söylemez. Kapsam aşağıdaki matrise göre ayrıca değerlendirilir.

## Required evidence matrix ve missing evidence list

Her satır ortak olarak gerçek dosya, exact hash/boyut, bağımsız creation/UI/save-chain review ve privacy review ister. UI değerleri test girdisidir; akademik uygunluk sonucu veya Word'ün yazacağı raw twips önceden varsayılmaz.

| Evidence ID | Scenario ID | Gerekli Word/provenance kaydı | İncelenecek teknik evidence | Güncel durum |
| --- | --- | --- | --- | --- |
| SDU-NATIVE-40-01 | margin-25cm | Top/bottom 2.5 cm UI, uygulanan section ve save zinciri | sectPr/pgMar, unit, raw top/bottom, parser sonucu | MISSING |
| SDU-NATIVE-40-02 | margin-3cm | Top/bottom 3 cm UI, uygulanan section ve save zinciri | Ayrı 3 cm kontrolü; raw değer tahmin edilmez | MISSING |
| SDU-NATIVE-40-03 | multiple-sections | Section break ve her section'ın ayarı | Bütün paragraph/body sectPr sınırları/ölçümleri | MISSING |
| SDU-NATIVE-40-04 | sec19-exact | Exact başlık, Heading 1/outline UI | pPr/pStyle/outlineLvl, styles.xml ve mevcut occurrence identity | MISSING |
| SDU-NATIVE-40-05 | table-body-distractor | Exact heading ve normal A/Değer/Etki body/table metinleri | Current body/table ayrımı ve heading provenance | MISSING |
| SDU-NATIVE-40-06 | partial-heading | Partial bileşen, gerçek style/outline ayarı | Raw partial metin ve unresolved identity | MISSING |
| SDU-NATIVE-40-07 | split-heading | Ayrı heading paragrafları, kaydetme kaydı | Adjacency, block/style/outline; numbering.xml varsa numbering | MISSING |
| SDU-NATIVE-40-08 | multiple-runs | Kelime içinde formatting değişimi ve Word save kaydı | w:r/w:t segmentasyonu, paragraph reconstruction | MISSING |
| SDU-NATIVE-40-09 | unicode-nfc-nfd | NFC/NFD giriş yöntemi ve öncesi/sonrası kaydı | Raw code points ve kaydetme etkisi | MISSING |

Planlanan path'ler `tests/fixtures/native-pending/<önerilen-dosya-adı>.docx`; klasör/dosyalar oluşturulmadı. Exact SEC-19 metni: **Yaygın Etki/Katma Değer/Kullanılabilirlik**. Bu matrix yeni alias veya margin toleransı tanımlamaz.

Yeni gerçek artifact gelince Sprint 39'un 42 dosyalık census'u bilinçli inceleme ister. Mevcut sentetikleri relabel etmeden, yeni provenance ve ayrı intake kayıtlarıyla inventory/native regresyon kapsamı güncellenmelidir.

## Controlled rehearsal ve regresyon sınırı

[sduNativeEvidenceIntakeRegression.cjs](../../tests/audit/sduNativeEvidenceIntakeRegression.cjs) geçici dizinde açıkça programatik bir DOCX ve “NO WORD SESSION” açıklamalı destek dosyaları kullanır. Bu gerçek Word oturumu veya native provenance kanıtı değildir. Geçici dizin doğrulanmış absolute sınır kontrolüyle temizlenir; corpus DOCX'leri ve guard'lar hash ile korunur.

Rehearsal için factory'de açık `purpose: synthetic-intake-rehearsal`, programmatic origin ve aynı amaçla etiketli review gerekir. Mekanizma kontrolleri PASS olabilir; state `RECEIVED_UNVERIFIED`, native readiness `BLOCKED`, `acceptedForNativeTest: false`, `nativeValidationPerformed: false` kalır. Rehearsal review native gate'e taşınamaz.

Gerçek bir Word-native artifact bulunmadığından gerçek `PROVENANCE_VERIFIED` / `ACCEPTED_FOR_NATIVE_TEST` pozitif native örneği bu sprintte doğrulanmış değildir. Olumlu test sonucu yalnız intake mekanizmasına aittir; gerçek native test başarısı raporlanmaz.

Focused kapsam: missing/unavailable file, invalid hash/size, missing provenance, metadata-only iddia, invalid/duplicate scenario, duplicate evidence/review ID, missing privacy review, sentetik dosyanın native etiketiyle başvurusu ve renamed kopyası, 42 sentetiğin reddi, valid controlled rehearsal, missing/tampered support, self-review, stale declaration/date, post-save mutation, invalid package/path ve explicit review rejection.

## SDÜ source gate independence

Native gate yalnız teknik test girdisi kabul eder. Her çıktıda `productionAuthorization: not-granted`, `academicApproval: not-granted`, `sourceGate.status: BLOCKED` korunur; native acceptance bu değerleri yükseltmez. SDÜ PDF doğrulaması bu gate'in parametresi veya görevi değildir.

İki SDÜ PDF'si için mevcut durum [Sprint 34 kaynak kapısındaki](SDU_SPRINT_34_SOURCE_ACQUISITION_GATE.md) unresolved/source-unavailable kaydıdır. Bu sprintte indirme denenmedi; yeni PDF byte/hash/scope doğrulaması yapılmadı. [SOURCE_REQUEST.md](SOURCE_REQUEST.md) gönderilmemiş temin taslağıdır; dış mesaj gönderilmedi.

Gerçek kaynaklar elde edilip bağımsız madde/sürüm/kapsam incelemesi yapılmadan normatif alias, precision/rounding toleransı veya akademik approval verilemez. Word-native test başarısı da kaynak gate'ini kapatmaz.

## Remaining blockers ve Sprint 41

- P1 native artifact/provenance: açık; kabul edilmiş native DOCX 0, scenario coverage 0/9.
- P1 SDÜ source/scope reconciliation: açık; native intake bundan bağımsız.
- P0 SEC-19 akademik identity/eşdeğerlik ve margin precision kabul kararları: açık. Yeni guard veya akademik kural yok.
- Gerçek kabul yolunun pozitif native artifact ile çalıştırılması ve sonrasında ayrı native validation regresyonu bekleniyor.

**Sprint 41: GO**, yalnız gerçek Word örneklerinin temini, bağımsız provenance/privacy incelemesi ve bu gate'e sunulması için. **Native validation: NO-GO/BLOCKED**, gerçek kabul edilmiş kanıt gelene kadar. **Production onboarding: NO-GO**.

## QA ve yeniden çalıştırma

```powershell
node tests/audit/sduNativeEvidenceIntakeRegression.cjs
node tests/audit/sduNativeEvidenceInventoryRegression.cjs
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
```

Intake regresyonu 19 focused test grubu içerir. Sprint 39 inventory/provenance regresyonu ayrıca çalıştırılır; onun PASS sonucu native validation PASS anlamına gelmez. `npm.cmd run test`, add, commit veya push çalıştırılmaz.

Bu sprintte son koşu: intake **19/19 PASS**, Sprint 39 envanter **7/7 PASS**; typecheck, lint, build ve diff whitespace kontrolleri **PASS**. Build 500 kB chunk uyarısı verdi. Native kabul ve native validation sayısı hâlâ 0; production, guard ve mevcut DOCX byte'ları değişmedi.
