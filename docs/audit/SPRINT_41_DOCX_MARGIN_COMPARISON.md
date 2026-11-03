# Sprint 41 — DOCX Margin Comparison / Package Input Debug

Tarih: 3 Kasım 2026. **Sprint 41 GO; production onboarding NO-GO.**
Önceki eksik dosya engeli giderildi; sonuçlar iki gerçek dosyada yeniden çalıştırıldı.

## Kesin kök neden ve düzeltme

Eski harness ile DOCX_MALFORMED_PACKAGE hatası yeniden üretildi.
Harness analiz servisine name/size/type ve arrayBuffer() içeren düz JavaScript
nesnesi gönderiyordu. Reader girdiyi doğrudan JSZip.loadAsync(file)'a iletiyor.
JSZip düz nesnenin arrayBuffer() metodunu çağırmıyor; nesneyi desteklenen ZIP
veri tipi olarak tanımıyor. Buffer ile aynı ZIP okunabiliyor. Dosya bozukluğu yok.

Yalnız harness düzeltildi: golden harness yaklaşımıyla tam byte aralığından
Uint8Array oluşturuluyor, upload doğrulaması için name/size/type ekleniyor.
Aynı girdi checkCRC32: true ile denetleniyor; iki gerekli parça assert ediliyor.
Production parser/reader/engine/scoring/guard/UI/university JSON değiştirilmedi.

## Dosyalar ve ZIP kontrolü

Konum: tests/audit/manual-fixtures/. Her iki dosya mevcut.
İkisinde de CRC32 PASS, 17 ZIP entry, [Content_Types].xml ve word/document.xml var.

| Dosya | Byte | SHA-256 |
| --- | ---: | --- |
| ThesisGuard_margin_2_5cm_synthetic.docx | 36859 | 74a16a551ded44192127ec8ca2cc9178c74f0f7e564cf76b603c065173071732 |
| ThesisGuard_3cm_YENI_TEST.docx | 36747 | 8c39e1c67a23701410dadba7105d2b12055052fccd68048a5de66d79101ebda5 |

Word-native sınıflandırması yapılmadı. Fixture yazılmadı.

## Ham OOXML / parser

İki belgede de 1 section, terminal body w:sectPr ve tek w:pgMar var.
Dört kenarda eksik/bozuk değer yok. Ham değerler tam sayı twips.

| Dosya | Kenar | Raw twips | Ham cm | Parser cm | Parser − ham cm |
| --- | --- | ---: | ---: | ---: | ---: |
| 2,5 cm | Üst | 1417 | 2,4994305556 | 2,50 | +0,0005694444 |
| 2,5 cm | Alt | 1417 | 2,4994305556 | 2,50 | +0,0005694444 |
| 2,5 cm | Sol | 1800 | 3,175 | 3,18 | +0,005 |
| 2,5 cm | Sağ | 1800 | 3,175 | 3,18 | +0,005 |
| 3 cm | Üst | 1701 | 3,000375 | 3,00 | −0,000375 |
| 3 cm | Alt | 1701 | 3,000375 | 3,00 | −0,000375 |
| 3 cm | Sol | 1701 | 3,000375 | 3,00 | −0,000375 |
| 3 cm | Sağ | 1701 | 3,000375 | 3,00 | −0,000375 |

Dönüşüm twips / 1440 * 2.54; parser iki ondalık cm'ye yuvarlıyor.
Tüm değerler mevcut sözleşmeyle uyumlu. Production hassasiyet bug'ı saptanmadı.
2,5 cm dosya adı dört kenarın da 2,5 cm olduğunu göstermiyor.

## ÇOMÜ legacy karşılaştırması

Gıda Teknolojisi / Lisans / Deneysel Çalışma, mevcut 46 kural.
Üst kenar bölüm override'ı 3 cm; sol 3 cm; alt/sağ 2,5 cm.

| Dosya | Kenar | Beklenen cm | Okunan cm | Sonuç | Gerekçe |
| --- | --- | ---: | ---: | --- | --- |
| 2,5 cm | Üst | 3 | 2,5 | FAILED | Farklı |
| 2,5 cm | Alt | 2,5 | 2,5 | PASSED | Eşit |
| 2,5 cm | Sol | 3 | 3,18 | FAILED | Farklı |
| 2,5 cm | Sağ | 2,5 | 3,18 | FAILED | Farklı |
| 3 cm | Üst | 3 | 3 | PASSED | Eşit |
| 3 cm | Alt | 2,5 | 3 | FAILED | Farklı |
| 3 cm | Sol | 3 | 3 | PASSED | Eşit |
| 3 cm | Sağ | 2,5 | 3 | FAILED | Farklı |

Margin kararlarında NOT_APPLICABLE yok.

Arayüz karşılaştırması (toplam/PASSED/FAILED/NOT_APPLICABLE):
2,5 cm = 46/3/26/17; 3 cm = 46/4/24/18.
Her iki gözlem ve başarılı margin'ler tam uyumlu.
Gözlem sayıları assertion beklentisi yapılmadı; fark yok.

## SDÜ guard v1/v2

Mevcut 11 pilot iki belgede çalıştı. Yalnız synthetic-pilot admission,
synthetic-department kullanıldı. Original report v1/v2 arasında aynı ve unscored.
Production authorization not-granted; gerçek scope admission açılmadı.

| Dosya | Margin | Original | v1 | v1 reason | v2 | v2 reason | Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2,5 cm | top | compliant | undetermined | precision-unapproved | undetermined | precision-unapproved | closed |
| 2,5 cm | bottom | compliant | undetermined | precision-unapproved | undetermined | precision-unapproved | closed |
| 3 cm | top | violation | undetermined | precision-unapproved | violation | integer-violation-preserved | closed |
| 3 cm | bottom | violation | undetermined | precision-unapproved | violation | integer-violation-preserved | closed |

Provenance: word/document.xml, section index 0, raw 1417 veya 1701.
Inventory top SDU-INV-LAY-05, bottom SDU-INV-LAY-06.
Frozen source SDÜ 2026 kılavuzu §2.2, basılı sayfa 4;
SHA-256 f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44.
Source verification registered-hash-only; kaynak yeniden indirilmedi.
v1/v2 provenance eşitliği regresyonda kontrol edildi.

v2 temsil aralıkları, hedef 360000/144000 = 2,5 cm:

- 1417: [358944/144000, 360892/144000]; hedefle örtüşüyor, compliant yetkisi vermiyor.
- 1701: [431080/144000, 433028/144000]; hedefi dışlıyor, mevcut violation korunuyor.

## Testler

| Kontrol | Sonuç |
| --- | --- |
| Eski harness ile focused regresyon | Hata yeniden üretildi: DOCX_MALFORMED_PACKAGE |
| Düzeltme sonrası focused regresyon | PASS; iki belge, parser/ÇOMÜ/SDÜ karşılaştırması |
| npm.cmd run test:golden | PASS; 46/46 |
| npm.cmd run test:corpus | PASS; 31 regression + 11 exploratory fixture |
| 44 DOCX için golden/corpus öncesi-sonrası SHA-256 | PASS; hiçbir fixture değişmedi |
| git diff --check | PASS; mevcut experimental.json için LF/CRLF uyarısı |
| git status --short | Yalnız untracked audit raporu, regresyon ve kullanıcı DOCX klasörü; production değişikliği yok |

İlk inline node -e ZIP kontrolü PowerShell tırnak aktarımında ReferenceError verdi;
here-string ile tekrarlandığında iki dosyanın CRC32 kontrolü geçti.

Değiştirilen dosyalar: tests/audit/docxMarginComparisonRegression.cjs ve bu rapor.
npm.cmd run test çalıştırılmadı. Bu debug adımında typecheck/lint/build tekrarlanmadı.
Git add, commit veya push yapılmadı.

Manuel tekrar:

```powershell
node tests/audit/docxMarginComparisonRegression.cjs
npm.cmd run test:golden
npm.cmd run test:corpus
git diff --check
git status --short
```

**Sprint 41 GO:** harness hatası giderildi; belge karşılaştırmaları ve istenen testler geçti.
**Production onboarding NO-GO:** sentetik pilot sınırları ve production yetkileri değişmedi.
