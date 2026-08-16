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

### Çalışma türü seçim altyapısı

| Senaryo | Beklenen sonuç |
| --- | --- |
| Gıda Teknolojisi Bachelor seçenekleri | Katalog `experimental` ve `source-research` çalışma türlerini sunar. |
| Experimental seçimi | Seçim geçerlidir ve experimental child rule set seçilir. |
| Source research seçimi | Seçim geçerlidir ve source-research child rule set seçilir. |
| Zorunlu çalışma türü seçilmemiş | UI analiz butonunu etkinleştirmez; doğrudan selector kullanımı `AcademicSelectionError` üretir. |
| Bilinmeyen çalışma türü | Açık bir `AcademicSelectionError` üretilir; fallback yapılmaz. |
| Experimental izolasyonu | Dönen zincirde source-research seti bulunmaz. |
| Source research izolasyonu | Dönen zincirde experimental seti bulunmaz. |
| Ortak department seti | `comu.applied-sciences.food-technology.bachelor` iki seçimde de gelir. |
| Ortak university seti | `comu.bachelor` iki seçimde de parent olarak gelir. |
| Üst seçim değişikliği | University, organization, unit veya thesis type değiştiğinde study type temizlenir. |
| Study type tanımlamayan katalog kaydı | `studyTypeId` olmadan mevcut akademik seçim akışı çalışabilir. |
| Selection verilmeden `analyzeDocx(file)` | Legacy/default davranış korunur; çalışma türü otomatik seçilmez. |

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
| TOC bulunmayan normal DOCX | Analiz devam eder; `tableOfContents.hasField` false ve fields boş olur. |

## 11. Generic RequiredSection test senaryoları

| Senaryo | Beklenen sonuç |
| --- | --- |
| Rule'da tanımlı section mevcut | Normalize edilmiş tam isim eşleşir ve validator başarılı olur. |
| Rule'da tanımlı section yok | Required rule başarısız olur. |
| Türkçe karakter ve case varyasyonu | `İÇİNDEKİLER`, `İçindekiler` ve `icindekiler` aynı normalized name ile eşleşir. |
| Heading stili olmayan bağımsız başlık | Paragraf metni tam eşleştiği için section bulunur. |
| Section kelimesini içeren body cümlesi | Normalize edilmiş tam isim eşleşmediği için false-positive oluşmaz. |
| İki required section aynı belgede | Her iki rule da aynı immutable sections listesi üzerinden başarılı olur. |
| Bir section var, diğeri yok | Yalnız bulunan section'ın rule'u başarılı olur. |
| İçindekiler section var, TOC field yok | Required section başarılı; `tableOfContents.hasField` false olur. |
| TOC field var, İçindekiler heading yok | `hasField` true kalır; İçindekiler required section başarısız olur. |
| PAGE, sections ve TOC field birlikte | Üç normalization/validation davranışı birbirini etkilemez. |

## 12. Türkçe ve İngilizce özet bölümleri

| Senaryo | Beklenen sonuç |
| --- | --- |
| Türkçe Özet mevcut | `summary-tr` rule başarılı olur. |
| Türkçe Özet yok | Yalnız `summary-tr` rule başarısız olur. |
| Abstract mevcut | `summary-en` rule başarılı olur. |
| Abstract yok | Yalnız `summary-en` rule başarısız olur. |
| Özet ve Abstract birlikte | İki required-section rule da başarılı olur. |
| Yalnız Özet var | Türkçe rule başarılı, İngilizce rule başarısız olur. |
| Yalnız Abstract var | İngilizce rule başarılı, Türkçe rule başarısız olur. |
| Body cümlesinde “Bu çalışmanın özeti...” yazıyor | Tam normalized-name eşleşmesi olmadığı için Özet section sayılmaz. |
| `ÖZET`/`Özet` ve `ABSTRACT`/`Abstract` varyasyonları | Case normalizasyonuyla ilgili section rule başarılı olur. |
| Özet, Abstract, İçindekiler ve Kaynaklar birlikte | Dört required-section rule birbirinden bağımsız şekilde başarılı olur. |

## 13. Gıda Teknolojisi ortak zorunlu bölümleri

Bu senaryolar deneysel ve teorik/kaynak araştırması çalışmalarının ikisi için
ortak olan İntihal (Aşırma) Beyan Sayfası, Teşekkür, Giriş, Sonuç ve Özgeçmiş
bölümlerine ayrı ayrı uygulanır.

| Senaryo | Beklenen sonuç |
| --- | --- |
| Her bölüm ayrı ayrı mevcut | Yalnız ilgili required-section rule başarılı olur. |
| Her bölüm ayrı ayrı yok | Yalnız ilgili required-section rule başarısız olur. |
| Heading style olmadan bağımsız başlık | Paragraf metni tam eşleştiği için ilgili rule başarılı olur. |
| Body cümlesinde bölüm adı geçiyor | Tam normalized-name eşleşmesi olmadığı için false-positive oluşmaz. |
| Türkçe case/karakter varyasyonu | Büyük/küçük harf ve desteklenen Türkçe karakter normalizasyonuyla ilgili rule başarılı olur. |
| Beş ortak bölüm birlikte mevcut | Beş required-section rule da birbirinden bağımsız şekilde başarılı olur. |
| Mevcut Özet, Abstract, İçindekiler ve Kaynaklar bölümleri mevcut | Önceki dört required-section rule aynı davranışı korur. |

## 14. Section heading body kapsamı regresyonu

| Senaryo | Beklenen sonuç |
| --- | --- |
| Center section heading + justify body | Section heading body kapsamından çıkarılır; alignment rule başarılı olur. |
| Left section heading + justify body | Section heading body kapsamından çıkarılır; alignment rule başarılı olur. |
| Section heading farklı font size + doğru body font size | Body font-size rule başarılı olur. |
| Section heading farklı font + doğru body font | Body font-family rule başarılı olur. |
| Section heading farklı line spacing + doğru body spacing | Body line-spacing rule başarılı olur. |
| Heading1–Heading3 paragrafları | Mevcut style tabanlı body exclusion davranışı korunur. |
| Boş paragraf | Mevcut empty-paragraph exclusion davranışı korunur. |
| Body cümlesinde “kaynaklar” geçiyor | Tam section adı olmadığı için rule-defined heading olarak işaretlenmez ve body kapsamında kalır. |
| Required section başlığı mevcut/yok | `RequiredSectionValidator` sonuçları değişmeden korunur. |

## 15. Deneysel çalışma zorunlu bölümleri

| Senaryo | Beklenen sonuç |
| --- | --- |
| Experimental seçimi | Üç experimental required-section rule ortak 21 kurala eklenir; toplam 24 kural çözülür. |
| Source research seçimi | Experimental rule'lar dahil edilmez; ortak 21 kural korunur. |
| Üç experimental section mevcut | Üç rule da başarılı olur. |
| Bölümlerden her biri ayrı ayrı eksik | Yalnız eksik bölümün rule'u başarısız olur. |
| Türkçe karakter ve case varyasyonu | Normalize edilmiş tam section adı eşleşir. |
| Heading style olmayan bağımsız section | Tam section adı eşleştiği için rule başarılı olur. |
| Bölüm adı body cümlesinde geçiyor | Tam isim eşleşmediğinden false-positive oluşmaz. |
| Experimental section headinglerinde farklı body formatı | Başlıklar alignment, font-family, font-size ve line-spacing body kapsamından çıkarılır. |
| Ortak kurallar | Ortak 21 kural experimental ve source-research seçimlerinde korunur. |

## 16. Teorik / kaynak araştırması zorunlu bölümü

| Senaryo | Beklenen sonuç |
| --- | --- |
| Source research seçimi | Genel Bilgiler rule'u ortak 21 kurala eklenir; toplam 22 kural çözülür. |
| Experimental seçimi | Source-research Genel Bilgiler rule'u dahil edilmez; toplam 24 kural korunur. |
| Genel Bilgiler mevcut | Required-section rule başarılı olur. |
| Genel Bilgiler yok | Required-section rule başarısız olur. |
| Türkçe karakter ve case varyasyonu | Normalize edilmiş tam `Genel Bilgiler` section adı eşleşir. |
| Heading style olmayan bağımsız Genel Bilgiler | Tam section adı eşleştiği için rule başarılı olur. |
| Body cümlesinde “genel bilgiler” geçiyor | Tam isim eşleşmediğinden false-positive oluşmaz. |
| Genel Bilgiler headinginde farklı body formatı | Başlık alignment, font-family, font-size ve line-spacing body kapsamından çıkarılır. |
| Ortak kurallar | Ortak 21 kural iki çalışma türünde de korunur. |
| Experimental kurallar | Üç experimental rule değişmeden ve yalnız experimental seçiminde korunur. |

## 17. Generic bölüm sırası doğrulaması

| Senaryo | Beklenen sonuç |
| --- | --- |
| Expected A → B → C / document A → B → C | SECTION_ORDER başarılı olur. |
| Expected A → B → C / document A → C → B | SECTION_ORDER başarısız olur ve ters ilişki mesajda belirtilir. |
| Expected section eksik, kalan relative order doğru | Eksiklik REQUIRED_SECTION'a bırakılır; SECTION_ORDER başarılı olur. |
| Expected section eksik, kalan relative order yanlış | SECTION_ORDER başarısız olur. |
| Unknown section expected bölümler arasına giriyor | Unknown section yok sayılır ve SECTION_ORDER başarılı olur. |
| Türkçe case/karakter varyasyonu | Ortak section normalization ile eşleşir ve doğru sırada geçer. |
| Alias document section ile eşleşiyor | Alias, canonical section adına ait occurrence olarak değerlendirilir. |
| Heading style olmayan bağımsız sectionlar | Parser paragraph konumlarını koruduğu için sıra doğrulanır. |
| Expected section birden fazla occurrence içeriyor | Rastgele occurrence seçilmez; güvenli ve deterministik validation failure üretilir. |
| Empty expected sections | Açık SECTION_ORDER configuration error üretilir. |
| Yanlış expected shape | Açık SECTION_ORDER configuration error üretilir. |
| Validator'a farklı rule type veriliyor | Açık configuration error üretilir. |
| PAGE_NUMBER ve REQUIRED_SECTION | Mevcut validator davranışları korunur. |
| Input immutability | Document sections, expected sections ve alias dizileri mutate edilmez. |

## 18. Gıda Teknolojisi study-type bölüm sırası

| Senaryo | Beklenen sonuç |
| --- | --- |
| Experimental doğru sıra | Experimental SECTION_ORDER başarılı olur. |
| Experimental yanlış sıra | Experimental SECTION_ORDER başarısız olur ve problemli relative ilişkiyi açıklar. |
| Source Research doğru sıra | Source-research SECTION_ORDER başarılı olur. |
| Source Research yanlış sıra | Source-research SECTION_ORDER başarısız olur ve problemli relative ilişkiyi açıklar. |
| Source Research seçimi | Experimental order rule RuleEngine'e ulaşmaz. |
| Experimental seçimi | Source-research order rule RuleEngine'e ulaşmaz. |
| Expected section eksik, kalan sıra doğru | SECTION_ORDER başarılı; eksiklik yalnız REQUIRED_SECTION sonucunu etkiler. |
| Expected section eksik, kalan sıra yanlış | SECTION_ORDER başarısız olur. |
| Koşullu veya unknown section araya giriyor | Relative order bozulmaz. |
| Expected section duplicate occurrence | SECTION_ORDER güvenli ve deterministik failure üretir. |
| İki mevcut section yer değiştiriyor | REQUIRED_SECTION sonuçları başarılı kalırken SECTION_ORDER başarısız olur. |
| Rule sayıları | Experimental 25, source-research 23 rule çözer. |

## 19. Generic section kelime sayısı

| Senaryo | Beklenen sonuç |
| --- | --- |
| Max 200 / actual 199 | SECTION_WORD_COUNT başarılı olur. |
| Max 200 / actual 200 | Üst sınır dahil olduğu için başarılı olur. |
| Max 200 / actual 201 | Başarısız olur ve bulunan kelime sayısını açıklar. |
| Min 100 / actual 100 | Alt sınır dahil olduğu için başarılı olur. |
| Min 100 / actual 99 | Başarısız olur ve minimum değeri açıklar. |
| Min 100, max 200 / actual 150 | Range kontrolü başarılı olur. |
| Section heading | Heading paragrafı kelime sayısına dahil edilmez. |
| Sonraki gerçek section | Sonraki heading ve içeriği hedef section count'una dahil edilmez. |
| Birden fazla içerik paragrafı | Görünür metinler sırayla birleştirilip doğru sayılır. |
| Boş paragraflar | Kelime sayısını etkilemez. |
| Türkçe karakterli kelimeler | Tek kelimeler parçalanmadan sayılır. |
| Punctuation-only tokenlar | `-`, `—` ve `/` kelime sayılmaz. |
| Section bulunamıyor | Presence ile çakışmayan PASS/no-op sonucu üretilir; sıfır kelime uygulanmaz. |
| Duplicate target section | Rastgele occurrence seçilmez; güvenli failure üretilir. |
| Alias eşleşmesi | Alias ile bulunan section içeriği doğrulanır. |
| Invalid min/max | Non-negative integer olmayan değer açık configuration error üretir. |
| Min max değerini aşıyor | Açık configuration error üretilir. |
| Empty section name | Açık configuration error üretilir. |
| Mevcut validatorlar | PAGE_NUMBER, REQUIRED_SECTION ve SECTION_ORDER davranışları korunur. |
| Input immutability | Document, paragraphs, sections, expected ve aliases mutate edilmez. |

## 20. Gıda Teknolojisi Özet kelime sınırları

| Senaryo | Beklenen sonuç |
| --- | --- |
| Türkçe Özet 199 kelime | Türkçe Özet SECTION_WORD_COUNT başarılı olur. |
| Türkçe Özet tam 200 kelime | Üst sınır dahil olduğu için başarılı olur. |
| Türkçe Özet 201 kelime | Yalnız ilgili word-count rule başarısız olur. |
| Türkçe Özet heading | Kelime sayısına dahil edilmez. |
| Abstract heading ve içeriği | Türkçe Özet kelime sayısına dahil edilmez. |
| Çoklu Türkçe Özet paragrafları | Paragraflar birlikte sayılır. |
| Empty paragraph | Kelime sayısını etkilemez. |
| Türkçe karakterli kelimeler | Parçalanmadan sayılır. |
| Türkçe Özet yok | REQUIRED_SECTION eksikliği raporlar; word-count no-op davranışı korunur. |
| İngilizce Özet 200/201 sınırı | PDF'nin Türkçe Özet kurallarını İngilizce Özete de uygulaması nedeniyle sırasıyla pass/fail olur. |
| Experimental seçimi | İki ortak Özet word-count rule'u dahil; toplam 27 rule çözülür. |
| Source Research seçimi | İki ortak Özet word-count rule'u dahil; toplam 25 rule çözülür. |
| 200 ve 201 kelimelik runtime DOCX çifti | Presence ve SECTION_ORDER aynı kalır; yalnız sınırı aşan word-count sonucu değişir. |
| SECTION_ORDER regresyonu | Özet word-count kuralları bölüm sırası sonuçlarını değiştirmez. |

## 21. Tablo ve şekil varlığı normalizasyonu

Bu senaryolar yalnız `word/document.xml` body kapsamındaki OOXML yapılarını doğrular.
Header/footer parçalarındaki nesneler body tablo/şekil sayısına dahil edilmez.

| Senaryo | Beklenen sonuç |
| --- | --- |
| Hiç tablo yok | `tables.count` 0 ve `tables.hasTables` false olur. |
| Bir tablo | Body içindeki tek `w:tbl` için `tables.count` 1 ve `tables.hasTables` true olur. |
| Birden fazla tablo | Body içindeki her `w:tbl` ayrı sayılır. |
| Nested table davranışı | İç içe tablo dahil her `w:tbl` ayrı sayılır; dış tablo + iç tablo sonucu 2 olur. |
| Metinde "Tablo 1" yazması | Normal text OOXML tablo yapısı olmadığı için table sayılmaz. |
| Hiç görsel yok | `figures.count` 0 ve `figures.hasFigures` false olur. |
| Bir drawing image | Body içindeki tek `w:drawing` için `figures.count` 1 ve `figures.hasFigures` true olur. |
| Birden fazla image | Body içindeki her `w:drawing` ayrı sayılır. |
| Metinde "Şekil 1" yazması | Normal text OOXML drawing yapısı olmadığı için figure sayılmaz. |
| Table + figure aynı belgede | `tables` ve `figures` alanları birbirinden bağımsız doğru sayıları döner. |
| Header/footer image body count'a dahil değil | Header/footer XML içindeki image, `figures.count` değerini artırmaz. |
| Malformed drawing parser'ı düşürmüyor | Eksik veya beklenmeyen drawing relationship yapısı analiz akışını çökertmez. |

## 22. Generic conditional required-section doğrulaması

Bu senaryolar `CONDITIONAL_REQUIRED_SECTION` altyapısını gerçek üniversite rule
JSON'u eklemeden doğrular.

| Senaryo | Beklenen sonuç |
| --- | --- |
| `hasTables=true` + section var | Condition true olur; bölüm bulunduğu için validator pass döner. |
| `hasTables=true` + section yok | Condition true olur; bölüm bulunmadığı için validator fail döner. |
| `hasTables=false` + section yok | Condition false olur; validator no-op/pass döner ve actual `Uygulanmadı` olur. |
| `hasTables=false` + section var | Condition false olur; validator no-op/pass döner ve actual `Uygulanmadı` olur. |
| `hasFigures=true` + section var | Condition true olur; bölüm bulunduğu için validator pass döner. |
| `hasFigures=true` + section yok | Condition true olur; bölüm bulunmadığı için validator fail döner. |
| `hasFigures=false` + section yok | Condition false olur; validator no-op/pass döner ve actual `Uygulanmadı` olur. |
| `hasFigures=false` + section var | Condition false olur; validator no-op/pass döner ve actual `Uygulanmadı` olur. |
| Türkçe/case normalization | Section adı mevcut `normalizeSectionName()` ile eşleşir. |
| Alias eşleşmesi | Expected `aliases` içindeki geçerli ad section ile eşleşirse validator pass döner. |
| Body cümlesi false-positive üretmez | Bölüm adı yalnız body cümlesinde geçiyorsa tam normalized section eşleşmesi olmadığı için section sayılmaz. |
| Boş section | Açık configuration error üretilir. |
| Boş alias | Açık configuration error üretilir. |
| Unsupported fact | Açık configuration error üretilir. |
| `equals` boolean değil | Açık configuration error üretilir. |
| Yanlış rule type | `ConditionalRequiredSectionValidator` açık configuration error üretir. |
| REQUIRED_SECTION regresyonu | Mevcut `RequiredSectionValidator` davranışı değişmeden korunur. |
| SECTION_ORDER regresyonu | Mevcut `SectionOrderValidator` davranışı değişmeden korunur. |
| SECTION_WORD_COUNT regresyonu | Mevcut `SectionWordCountValidator` davranışı değişmeden korunur. |
| PAGE_NUMBER regresyonu | Mevcut `PageNumberValidator` davranışı değişmeden korunur. |
| Document/rule immutability | Document, sections, rule ve expected nesneleri mutate edilmez. |

## 23. Gıda Teknolojisi koşullu Tablolar/Şekiller Listesi kuralları

Bu senaryolar ÇOMÜ Uygulamalı Bilimler Fakültesi Gıda Teknolojisi Lisans
Bitirme Tezi kural setindeki gerçek `CONDITIONAL_REQUIRED_SECTION` kurallarını
doğrular.

| Senaryo | Beklenen sonuç |
| --- | --- |
| Table yok + liste yok | `hasTables=false`; Tablolar Listesi kuralı `Uygulanmadı` no-op/pass döner. |
| Table var + Tablolar Listesi var | Tablolar Listesi kuralı pass döner. |
| Table var + Tablolar Listesi yok | Tablolar Listesi kuralı fail döner. |
| Yalnız "Tablo 1" text | Gerçek `w:tbl` olmadığı için condition tetiklenmez ve kural `Uygulanmadı` döner. |
| Figure yok + liste yok | `hasFigures=false`; Şekiller Listesi kuralı `Uygulanmadı` no-op/pass döner. |
| Figure var + Şekiller Listesi var | Şekiller Listesi kuralı pass döner. |
| Figure var + Şekiller Listesi yok | Şekiller Listesi kuralı fail döner. |
| Yalnız "Şekil 1" text | Gerçek `w:drawing` olmadığı için condition tetiklenmez ve kural `Uygulanmadı` döner. |
| Table + figure var, iki liste de var | İki conditional rule da pass döner. |
| Table + figure var, iki liste de yok | İki conditional rule da fail döner. |
| Table var/listesi var + figure yok | Tablolar Listesi pass, Şekiller Listesi `Uygulanmadı` döner. |
| Figure var/listesi var + table yok | Şekiller Listesi pass, Tablolar Listesi `Uygulanmadı` döner. |
| Experimental seçimi | Çözülmüş rule listesinde iki conditional rule bulunur; toplam 29 rule/result beklenir. |
| Source Research seçimi | Çözülmüş rule listesinde iki conditional rule bulunur; toplam 27 rule/result beklenir. |
| SECTION_ORDER regresyonu | Conditional listeler mevcut order listelerine eklenmez; mevcut order davranışı korunur. |
| REQUIRED_SECTION regresyonu | Mevcut required-section kuralları değişmeden çalışır. |
| SECTION_WORD_COUNT regresyonu | Mevcut word-count kuralları değişmeden çalışır. |
| PAGE_NUMBER regresyonu | Mevcut page-number kuralları değişmeden çalışır. |
