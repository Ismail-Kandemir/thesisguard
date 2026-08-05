# ThesisGuard Test Data

Bu doküman, manuel doğrulamada kullanılmak üzere ileride hazırlanacak örnek DOCX dosyalarını tanımlar. Bu aşamada gerçek DOCX dosyası oluşturulmamıştır.

## Test Dosyaları

| Dosya Adı | Konum | Amaç | Test Edilen Validatorlar | Beklenen Sonuç |
| --- | --- | --- | --- | --- |
| `correct-thesis.docx` | `sample-documents/correct/` | Üniversite kurallarına uygun temel tez örneğini doğrulamak. | Font Family, Font Size, Line Spacing, Paragraph Alignment | Validatorların tamamı başarılı olmalıdır. |
| `wrong-font.docx` | `sample-documents/incorrect/font-family/` | Yalnızca hatalı yazı tipinin tespit edildiğini doğrulamak. | Font Family; diğer validatorlar regresyon kontrolü için çalışır. | Font Family başarısız, diğer validatorlar başarılı olmalıdır. |
| `wrong-font-size.docx` | `sample-documents/incorrect/font-size/` | Yalnızca hatalı yazı boyutunun tespit edildiğini doğrulamak. | Font Size; diğer validatorlar regresyon kontrolü için çalışır. | Font Size başarısız, diğer validatorlar başarılı olmalıdır. |
| `wrong-line-spacing.docx` | `sample-documents/incorrect/line-spacing/` | Yalnızca hatalı satır aralığının tespit edildiğini doğrulamak. | Line Spacing; diğer validatorlar regresyon kontrolü için çalışır. | Line Spacing başarısız, diğer validatorlar başarılı olmalıdır. |
| `wrong-alignment.docx` | `sample-documents/incorrect/alignment/` | Yalnızca hatalı paragraf hizalamasının tespit edildiğini doğrulamak. | Paragraph Alignment; diğer validatorlar regresyon kontrolü için çalışır. | Paragraph Alignment başarısız, diğer validatorlar başarılı olmalıdır. |

## Validator Sonuç Matrisi

| Dosya Adı | Font Family | Font Size | Line Spacing | Paragraph Alignment |
| --- | --- | --- | --- | --- |
| `correct-thesis.docx` | Başarılı | Başarılı | Başarılı | Başarılı |
| `wrong-font.docx` | Başarısız | Başarılı | Başarılı | Başarılı |
| `wrong-font-size.docx` | Başarılı | Başarısız | Başarılı | Başarılı |
| `wrong-line-spacing.docx` | Başarılı | Başarılı | Başarısız | Başarılı |
| `wrong-alignment.docx` | Başarılı | Başarılı | Başarılı | Başarısız |

## Test Execution

Bu tablo kullanıcı tarafından sağlanan gerçek DOCX dosyalarıyla yapılan testlerde doldurulacaktır. Henüz gerçek test sonucu kaydedilmemiştir.

| Test tarihi | Kullanılan dosya | Beklenen sonuç | Gerçek sonuç | Durum | Notlar |
| --- | --- | --- | --- | --- | --- |
| — | `correct-thesis.docx` | Sekiz kuralın tamamı başarılı | — | Çalıştırılmadı | — |
| — | `wrong-font.docx` | Font Family başarısız; diğer yedi kural başarılı | — | Çalıştırılmadı | — |
| — | `wrong-font-size.docx` | Font Size başarısız; diğer yedi kural başarılı | — | Çalıştırılmadı | — |
| — | `wrong-line-spacing.docx` | Line Spacing başarısız; diğer yedi kural başarılı | — | Çalıştırılmadı | — |
| — | `wrong-alignment.docx` | Paragraph Alignment başarısız; diğer yedi kural başarılı | — | Çalıştırılmadı | — |

### Gerçek DOCX Test Adımları

1. Kullanıcı tarafından sağlanan DOCX dosyasını Word ile açın ve dosyanın bozuk olmadığını doğrulayın.
2. Word içinde ana metnin yazı tipi, yazı boyutu, satır aralığı ve paragraf hizalamasını kaydedin.
3. Düzen ayarlarından sol, sağ, üst ve alt kenar boşluklarını kaydedin; birden fazla section varsa her section'ı ayrı kontrol edin.
4. Dosyayı mevcut Upload ekranından seçip analiz işlemini çalıştırın.
5. Raporda Font Family, Font Size, Line Spacing, Paragraph Alignment, Left Margin, Right Margin, Top Margin ve Bottom Margin sonuçlarını kontrol edin.
6. Her kural için beklenen ve gerçek değerleri Word'de görülen etkin biçimlendirmeyle karşılaştırın.
7. Özet kural sayıları ve skorun satır sonuçlarıyla tutarlı olduğunu doğrulayın.
8. Test tarihini, gerçek sonucu, durumu ve varsa farkın ayrıntılarını Test Execution tablosuna yazın.

## Teknik Risk Analizi

| Alan | Risk | Olası Etki | Öncelik |
| --- | --- | --- | --- |
| Direct formatting ve style inheritance | Run ve paragraf parserları doğrudan özellikleri okuyor; `basedOn`, varsayılan stil ve `docDefaults` zinciri etkin değere dönüştürülmüyor. | Word'de doğru görünen metin `null` veya hatalı raporlanabilir. | Kritik |
| Eksik run fontu veya puntosu | `w:rFonts` ya da `w:sz` bulunmayan run değerleri `null` oluyor. Validatorlar bu değerleri miras alınmış biçimlendirme olarak çözmüyor. | Doğru belge Font Family veya Font Size kontrolünden kalabilir. | Kritik |
| Paragraf stilinden miras | `styleId` okunuyor ancak hizalama, font, punto ve satır aralığı için ilgili stile bağlanmıyor. | Stil tabanlı standart Word belgelerinde yanlış negatif sonuç oluşabilir. | Kritik |
| Birden fazla section | Margin parserı yalnızca son `sectPr` değerini kullanıyor. | Önceki section'lardaki farklı kenar boşlukları gözden kaçar. | Yüksek |
| Birden fazla font veya punto | Validatorlar belgedeki bütün run'ları tek kurala göre karşılaştırıyor; başlık, dipnot veya özel alan ayrımı yok. | İzin verilen farklı biçimler de ihlal sayılabilir. | Yüksek |
| Boş paragraflar | Alignment kontrolü boş paragrafları da değerlendiriyor; boş run'lar font ve punto listesine dahil olabilir. | Görsel içeriği etkilemeyen boş öğeler kuralları başarısız yapabilir. | Yüksek |
| Eksik `styles.xml` | Analiz devam eder ancak stil listesi boş kalır. Line Spacing başarısız olur ve miras alınan diğer özellikler çözülemez. | Sonuç eksik veya yanıltıcı olabilir. | Yüksek |
| `w:lineRule` | Parser yalnızca `w:line` değerini okuyor ve her durumda 240'a bölüyor; `auto`, `exact` ve `atLeast` anlamları ayrıştırılmıyor. | Sabit veya minimum satır aralıkları yanlış hesaplanabilir. | Kritik |
| Theme fontları | `asciiTheme`, `hAnsiTheme`, `eastAsiaTheme` ve tema ilişkileri çözülmüyor. | Word'de Times New Roman görünen theme tabanlı metin `null` raporlanabilir. | Kritik |
| OOXML varyasyonları | Strict OOXML namespace'i, `w:szCs`, bidi fontları, alternatif hizalama değerleri ve farklı üreticilerin XML yapıları tam desteklenmiyor. | Bazı Word veya üçüncü taraf üretimli DOCX dosyalarında değerler okunamayabilir. | Yüksek |
| Margin ayrıntıları | Mirror margins, gutter ve section bazlı ayarlar değerlendirilmez; santimetre karşılaştırması iki ondalığa yuvarlanır. | Karmaşık sayfa düzenlerinde eksik doğrulama oluşabilir. | Orta |

## Öncelikli Düzeltme Önerileri

1. Run ve paragraf için etkin biçimlendirmeyi `direct formatting → paragraph/run style → basedOn → docDefaults` sırasıyla çözen tek bir katman oluşturun.
2. `w:lineRule` değerini saklayın ve `auto`, `exact`, `atLeast` türlerini birimlerine göre ayrı değerlendirin.
3. Tüm section'ları normalize edip margin validatorlarını her section üzerinde çalıştırın.
4. Theme font ilişkilerini okuyup theme adlarını gerçek font adlarına çözümleyin.
5. Boş paragrafları ve metin içermeyen run'ları tipografi/hizalama kontrollerinin kapsamından çıkarma kuralını netleştirin.
6. Ana metin, başlık ve diğer içerik türlerinin hangi kurallara tabi olduğunu tanımlayın.

## MVP İçin Bloklayıcı Konular

- Stil mirası ve `docDefaults` çözülmeden standart Word dosyalarında font, punto ve hizalama sonuçları güvenilir değildir.
- `w:lineRule` dikkate alınmadan 1.5 satır aralığı doğrulaması yanlış sonuç verebilir.
- Theme fontları çözülmeden yaygın Word şablonlarında Font Family sonucu güvenilir değildir.
- Birden fazla section değerlendirilmeden margin doğrulaması belgenin tamamını temsil etmez.

## Önerilen Sonraki Teknik Sprint

Sonraki sprint, yeni validator eklemek yerine **Effective Formatting Resolution** kapsamına ayrılmalıdır. Sprint; stil mirası ve `docDefaults` çözümlemesi, theme font desteği, `w:lineRule` semantiği, boş içerik filtreleme ve çoklu section normalizasyonunu gerçek kullanıcı DOCX dosyalarıyla doğrulamalıdır.

## Hazırlama İlkeleri

- Tüm dosyalar aynı kısa ve kontrollü temel içerikten türetilmelidir.
- Olumsuz örneklerde yalnızca hedeflenen biçimlendirme özelliği değiştirilmelidir.
- Dosyalar gerçek DOCX biçiminde kaydedilmeli ve analiz öncesinde kelime işlemciyle açılabildiği doğrulanmalıdır.
- Beklenen değerler güncel üniversite kural dosyasıyla uyumlu tutulmalıdır.
