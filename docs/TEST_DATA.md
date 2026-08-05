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

Bu tablo planlanan testlerin beklenen sonuçlarını gösterir. Gerçek çalıştırma sonuçları DOCX dosyaları hazırlandıktan sonra ayrıca kaydedilecektir.

| Test Dosyası | Beklenen Geçen Kurallar | Beklenen Başarısız Kurallar |
| --- | --- | --- |
| `correct-thesis.docx` | Font Family, Font Size, Line Spacing, Paragraph Alignment | Yok |
| `wrong-font.docx` | Font Size, Line Spacing, Paragraph Alignment | Font Family |
| `wrong-font-size.docx` | Font Family, Line Spacing, Paragraph Alignment | Font Size |
| `wrong-line-spacing.docx` | Font Family, Font Size, Paragraph Alignment | Line Spacing |
| `wrong-alignment.docx` | Font Family, Font Size, Line Spacing | Paragraph Alignment |

## Hazırlama İlkeleri

- Tüm dosyalar aynı kısa ve kontrollü temel içerikten türetilmelidir.
- Olumsuz örneklerde yalnızca hedeflenen biçimlendirme özelliği değiştirilmelidir.
- Dosyalar gerçek DOCX biçiminde kaydedilmeli ve analiz öncesinde kelime işlemciyle açılabildiği doğrulanmalıdır.
- Beklenen değerler güncel üniversite kural dosyasıyla uyumlu tutulmalıdır.
