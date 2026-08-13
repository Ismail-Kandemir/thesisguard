# ThesisGuard Test Plan

## 1. Amaç

Bu dokümanın amacı, ThesisGuard analiz akışının gerçek DOCX dosyaları kullanılarak manuel olarak doğrulanması için ortak bir test planı tanımlamaktır. Plan; mevcut validator sonuçlarının tutarlılığını, raporlanan değerlerin doğruluğunu ve üniversite kurallarına uygunluk değerlendirmesini kapsar.

## 2. Test Stratejisi

- Testler manuel olarak yürütülür.
- Kontrollü içerik ve biçimlendirmeye sahip gerçek DOCX dosyaları kullanılır.
- Sonuçlar, seçili üniversitenin JSON tabanlı kuralları üzerinden doğrulanır.
- Her dosya analiz edildikten sonra özet değerleri ve validator sonuçları beklenen sonuçlarla karşılaştırılır.

## 3. Test Senaryoları

| Validator | Test Senaryosu | Beklenen Sonuç |
| --- | --- | --- |
| Font Family | Tüm metin beklenen yazı tipiyle biçimlendirilmiştir. | Validator başarılı olmalıdır. |
| Font Family | En az bir metin bölümü farklı bir yazı tipi kullanır. | Validator başarısız olmalı ve gerçek yazı tiplerini raporlamalıdır. |
| Font Size | Tüm metin beklenen punto değerindedir. | Validator başarılı olmalıdır. |
| Font Size | En az bir metin bölümü farklı punto değerindedir. | Validator başarısız olmalı ve bulunan punto değerlerini raporlamalıdır. |
| Line Spacing | Tanımlı stil satır aralıkları beklenen değerle aynıdır. | Validator başarılı olmalıdır. |
| Line Spacing | En az bir tanımlı stil farklı satır aralığı kullanır. | Validator başarısız olmalı ve bulunan satır aralıklarını raporlamalıdır. |
| Paragraph Alignment | Tüm paragraflar beklenen biçimde iki yana yaslıdır. | Validator başarılı olmalıdır. |
| Paragraph Alignment | En az bir paragraf farklı hizalanmış veya hizalaması belirtilmemiştir. | Validator başarısız olmalı ve bulunan hizalamaları raporlamalıdır. |

## 4. Test Dosyaları

### Klasör Yapısı

| Klasör | Amaç |
| --- | --- |
| `sample-documents/correct/` | Mevcut validatorların tamamından başarılı geçmesi beklenen tezleri içerir. |
| `sample-documents/incorrect/` | Bilinçli olarak tek bir doğrulama hatası içeren tez gruplarını barındırır. |
| `sample-documents/incorrect/font-family/` | Yalnızca yazı tipi hatası içeren tezleri barındırır. |
| `sample-documents/incorrect/font-size/` | Yalnızca yazı boyutu hatası içeren tezleri barındırır. |
| `sample-documents/incorrect/line-spacing/` | Yalnızca satır aralığı hatası içeren tezleri barındırır. |
| `sample-documents/incorrect/alignment/` | Yalnızca paragraf hizalama hatası içeren tezleri barındırır. |

### Planlanan Dosyalar

| Dosya | Amaç |
| --- | --- |
| `sample-documents/correct/correct-thesis.docx` | Mevcut tüm kurallara uygun bir dokümanda bütün validatorların başarılı olduğunu doğrulamak. |
| `sample-documents/incorrect/font-family/wrong-font.docx` | Yalnızca yazı tipi uyumsuzluğunun doğru tespit edildiğini doğrulamak. |
| `sample-documents/incorrect/font-size/wrong-font-size.docx` | Yalnızca yazı boyutu uyumsuzluğunun doğru tespit edildiğini doğrulamak. |
| `sample-documents/incorrect/line-spacing/wrong-line-spacing.docx` | Yalnızca satır aralığı uyumsuzluğunun doğru tespit edildiğini doğrulamak. |
| `sample-documents/incorrect/alignment/wrong-alignment.docx` | Yalnızca paragraf hizalama uyumsuzluğunun doğru tespit edildiğini doğrulamak. |

Test dosyaları aynı temel içerikten türetilmeli; her olumsuz dosyada yalnızca hedeflenen biçimlendirme özelliği değiştirilmelidir.

## 5. Beklenen Sonuçlar

| Test Dosyası | Font Family | Font Size | Line Spacing | Paragraph Alignment |
| --- | --- | --- | --- | --- |
| `correct-thesis.docx` | Başarılı | Başarılı | Başarılı | Başarılı |
| `wrong-font.docx` | Başarısız | Başarılı | Başarılı | Başarılı |
| `wrong-font-size.docx` | Başarılı | Başarısız | Başarılı | Başarılı |
| `wrong-line-spacing.docx` | Başarılı | Başarılı | Başarısız | Başarılı |
| `wrong-alignment.docx` | Başarılı | Başarılı | Başarılı | Başarısız |

Her testte rapordaki toplam, başarılı ve başarısız kural sayıları ile uyumluluk skoru da validator sonuçlarıyla tutarlı olmalıdır.

## 6. Gelecek Testler

Aşağıdaki alanlar ilgili validatorlar geliştirildikten sonra ayrı olumlu ve olumsuz DOCX senaryolarıyla plana eklenecektir:

- Margin
- Heading
- Table Of Contents
- Bibliography
- Page Number
- References
- Caption
- Table Formatting

## 7. Test Süreci

Her sprint sonunda aşağıdaki kontrol listesi uygulanır:

- [ ] Typecheck başarıyla tamamlandı.
- [ ] Lint başarıyla tamamlandı.
- [ ] Production build başarıyla tamamlandı.
- [ ] Tanımlı gerçek DOCX dosyalarıyla manuel testler uygulandı.
- [ ] Gerçek ve beklenen validator sonuçları karşılaştırıldı.
- [ ] Git status kontrol edildi; kapsam dışı değişiklik bulunmadığı doğrulandı.
- [ ] Değişiklikler açıklayıcı bir mesajla commit edildi.
- [ ] Commit uzak depoya push edildi.

## 8. RuleResolver Test Senaryoları

Projede otomatik unit test altyapısı kurulana kadar aşağıdaki saf veri
senaryoları manuel olarak doğrulanacaktır:

| Senaryo | Beklenen sonuç |
| --- | --- |
| Sadece general rules | Genel kurallar aynı sırada ve yeni nesneler olarak döner. |
| General + faculty | Genel kurallar fakülte kurallarından önce çözülür. |
| General + department | Genel kurallar bölüm kurallarından önce çözülür. |
| General rule override | Spesifik kuralın `overrides` ile işaretlediği genel kural sonuçtan çıkarılır. |
| Birden fazla override | Spesifik kuralın işaretlediği tüm genel kurallar sonuçtan çıkarılır. |
| Duplicate rule ID | `RuleResolutionError` ile açık configuration error üretilir. |
| Missing parent | Bulunamayan extends referansı `RuleResolutionError` üretir. |
| Extends cycle | Döngünün yolunu içeren `RuleResolutionError` üretilir. |
| Aynı input → aynı output | Tekrarlanan çözümlemeler aynı rule ID sırasını üretir. |
| Input immutability | Rule set, rule, expected, scope ve overrides nesneleri değişmez. |

## 9. Akademik seçim test senaryoları

| Senaryo | Beklenen sonuç |
| --- | --- |
| ÇOMÜ + Uygulamalı Bilimler + Gıda Teknolojisi + Bachelor | Selector, `comu.bachelor` ve `comu.applied-sciences.food-technology.bachelor` setlerini sağlar; resolver genel kurallara PAGE_NUMBER kuralını ekler. |
| Bilinmeyen university | Açık bir `AcademicSelectionError` üretilir; fallback yapılmaz. |
| Bilinmeyen faculty | Faculty kimliğini içeren açık bir `AcademicSelectionError` üretilir. |
| Bilinmeyen department | Department kimliğini içeren açık bir `AcademicSelectionError` üretilir. |
| Desteklenmeyen thesis type | Thesis type kimliğini içeren açık bir `AcademicSelectionError` üretilir. |
| Selection verilmemesi | AnalysisService yalnızca mevcut legacy/default ÇOMÜ bachelor setini kullanır. |
| Selector ve resolver sorumluluk ayrımı | Selector rule içeriklerini merge veya override etmeden gerekli rule setleri döndürür; nihai kural listesi yalnızca RuleResolver çağrısından sonra oluşur. |

## 10. Table of Contents detection test senaryoları

| Senaryo | Beklenen sonuç |
| --- | --- |
| `fldSimple` TOC | `w:instr` değeri TOC komutuysa field, `fldSimple` yapısıyla normalize edilir. |
| Complex field TOC | Tamamlanmış begin/instrText/separate/end alanı TOC olarak normalize edilir. |
| Birden fazla `instrText` düğümüne bölünmüş TOC | Aynı field kapsamındaki parçalar birleştirilir ve TOC komutu tespit edilir. |
| TOC olmayan normal metin | Metinde “TOC” bulunması field üretmez. |
| “İçindekiler” başlığı var fakat TOC field yok | Başlık tek başına TOC olarak kabul edilmez. |
| PAGE field var fakat TOC yok | `tableOfContents.hasField` false ve fields boş olur. |
| TOC ve PAGE birlikte | TOC document.xml'den, PAGE header/footer parçalarından birbirini etkilemeden tespit edilir. |
| Bozuk veya eksik field yapısı | Eksik begin/end, instrText olmayan veya boş instruction içeren field parser'ı çökertmez ve TOC üretmez. |
| TOC bulunmayan normal DOCX | Analiz devam eder; `tableOfContents` içinde `hasSection` ve `hasField` false, fields boş olur. |

## 11. Table of Contents validator test senaryoları

| Senaryo | Beklenen sonuç |
| --- | --- |
| `required: true` ve TOC var | Validator başarılı sonuç üretir; actual “Bulundu” olur. |
| `required: true` ve TOC yok | Validator başarısız olur ve “İçindekiler alanı tespit edilemedi.” mesajını üretir. |
| `required: false` ve TOC yok | TOC opsiyonel olduğu için validator başarılı sonuç üretir. |
| Yalnız “İçindekiler” metni var | Parser gerçek TOC field üretmediği için `required: true` kuralı başarısız olur. |
| TOC ve PAGE birlikte | TOC validator yalnızca `tableOfContents` verisini kullanarak doğru sonucu üretir; PAGE sonucu davranışı etkilemez. |

## 12. İçindekiler bölümü ve Word TOC field ayrımı

| Senaryo | Beklenen sonuç |
| --- | --- |
| İçindekiler bölümü ve TOC field var | `hasSection: true`, `hasField: true`; TABLE_OF_CONTENTS validator başarılı olur. |
| İçindekiler bölümü var, TOC field yok | `hasSection: true`, `hasField: false`; validator bölüm varlığı üzerinden başarılı olur. |
| İçindekiler bölümü ve TOC field yok | `hasSection: false`, `hasField: false`; validator başarısız olur. |
| Body cümlesinde yalnız “İçindekiler” kelimesi geçiyor | Paragraf başlığı tam eşleşmediği için section kabul edilmez. |
| Bağımsız “İÇİNDEKİLER” başlığı var, Heading stili yok | Başlık metni tam eşleştiği için `hasSection: true` olur. |
| TOC field var, görünür İçindekiler başlığı yok | `hasField: true`; `hasSection` section tespitine göre false kalır ve university rule başarısız olur. |
| PAGE ve TOC aynı belgede | PAGE ve TOC normalizasyonları birbirini etkilemeden kendi sonuçlarını üretir. |
