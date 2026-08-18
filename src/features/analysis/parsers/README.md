Okunan belge iceriginin analiz edilebilir yapilara donusturulecegi klasordur.
# Kısaltma normalizasyonu

`documentAbbreviationsNormalizer`, daha önce parse edilmiş görünür body paragraph
metnini tarar; `document.xml` veya header/footer parçalarını yeniden parse etmez.
Heading1–Heading3 paragrafları ile resolved REQUIRED_SECTION ve
CONDITIONAL_REQUIRED_SECTION heading paragrafları tarama dışında bırakılır.

Heuristic yalnız en az iki Unicode uppercase harf taşıyan, uppercase harf/rakam
bileşenlerinden oluşan ve parçalar arasında hyphen kullanabilen tokenları kabul
eder. Dış punctuation tokenizasyon sırasında atılır. Bu yaklaşım `TÜBİTAK`,
`UV-VIS`, `CO2` ve `H2O` örneklerini desteklerken lowercase, Title Case, saf sayı
ve tek harfli tokenları reddeder.

`hasAbbreviations=true`, bir tezin kesinlikle Simgeler ve Kısaltmalar Listesi
gerektirdiği anlamına gelmez. Bu yalnız gelecekteki conditional akademik
kuralların kullanabileceği heuristic bir document fact'tir. Tamamen uppercase
body ifadeleri gibi bağlama bağlı false-positive olasılıkları devam eder.

Generic `ABBREVIATION_LIST_CONSISTENCY` altyapısı aynı exported token heuristic'ini
kullanır. Liste satırı parser'ı yalnız geçerli abbreviation key'inden sonra tab,
çoklu whitespace, boşluklu ` - ` veya `:` separator bulunan satırları kabul eder.
Validator ham XML taramaz; mevcut section content sınırını ve normalize paragraph
metinlerini kullanır. Registry kaydı ve university rule tanımı bu generic
altyapının kapsamında değildir.

# DOCX numbering normalizasyonu

`docxPackageReader`, varsa `word/numbering.xml` parçasını analiz akışına taşır;
parçanın bulunmaması geçerli bir DOCX'i hatalı yapmaz. `numberingXmlParser` yalnız
`numId`, `abstractNumId`, `level`, `numFmt`, `lvlText` ve `start` alanlarını
normalize eder. Validatorlar ham numbering XML'i okumaz.

Her paragraph `source`, `numId`, `level` ve `visibleLabel` içeren immutable
numbering metadata'sı taşır. Direct `w:numPr` style numbering'den önceliklidir;
direct değer yoksa mevcut style inheritance zincirindeki ilk numbering referansı
kullanılır. Decimal ve deterministik çözülebilen `lvlText` label'ları üretilir.
Desteklenmeyen format, eksik parent counter veya karmaşık override durumunda
tahmin yapılmaz ve `visibleLabel` null kalır.

Manuel `1.`, `1.1.` ve `1.1.1.` prefix'leri `sectionNameMatcher` tarafından ayrılır.
Bu helper paragraph'ı section'a dönüştürmez; yalnız rule-defined beklenen ad ile
tam remainder eşleşmesi yapar. REQUIRED_SECTION, CONDITIONAL_REQUIRED_SECTION,
SECTION_ORDER, SECTION_WORD_COUNT, SECTION_KEYWORDS, abbreviation-list section
lookup ve rule-defined heading marking aynı matcher'ı kullanır. Automatic Word
numbering paragraph metninin parçası sayılmaz.

TOC cached paragraph'ları, OOXML content-control gallery veya TOC style ID/adı
üzerinden güvenle tanınabildiğinde section occurrence listesinden çıkarılır.
Belirsiz bir TOC yapısı için metin tabanlı tahmin yapılmaz.

# DOCX sayfa numarası bölüm sırası

`documentXmlParser`, gövde içindeki paragraf sonu ve final `w:sectPr`
öğelerinden `w:pgNumType/@w:fmt` ile `@w:start` değerlerini belge sırasıyla
`pageNumbering.sections` alanına normalize eder. Her kayıt, ait olduğu Word
bölümünün son paragraf indeksini taşır. Header/footer parser yalnızca görünür
`PAGE` alanlarını çözer; analiz servisi bu sonucu document.xml'den gelen bölüm
metadata'sıyla birleştirir.

Eksik `fmt`, `start` varsa OOXML varsayılanı olan `decimal`; ikisi de yoksa önceki
bölüm biçiminin devamı olarak yorumlanır. Validator raw XML okumaz.

# Table, figure ve caption normalizasyonu

`documentCaptionsNormalizer`, `w:body` altındaki doğrudan `w:p` ve `w:tbl`
çocuklarının sırasını `blocks` alanında korur. Drawing occurrence'ları onları
taşıyan paragraph'a bağlanır; table occurrence'ları doğrudan table block'unu
taşır. Nested table'lar mevcut count davranışını korumak için ayrı occurrence
olarak sayılır, fakat doğrudan body block'u olmadığından caption association'ı
kurulmaz.

Caption tespiti yalnız paragraf başındaki Türkçe `Tablo <n>.` ve `Şekil <n>.`
biçimlerini kabul eder. `<n>` tek veya çok seviyeli decimal değerdir. `Tablo
1’de...`, `Şekil 2 incelendiğinde...`, liste başlıkları, substring eşleşmeleri ve
TOC cached paragrafları caption değildir. Caption paragraph ID'si üzerinden
alignment, line spacing, style ve run-level font/bold/italic metadata'sına
erişilebilir.

Association OOXML document order'a dayanır. Nesnenin iki yönünde yalnız boş
paragraflar aşılır; görünür caption dışı içerik veya başka block sınırı aramayı
durdurur. Tek aday `before` veya `after`, aday yokluğu `none`, çoklu aday veya
aynı caption'ı isteyen çoklu nesne `ambiguous` olur. Caption benzeri metin nesne
yoksa orphan olarak korunur ve `hasTables`/`hasFigures` değerini değiştirmez.

`wp:inline` document-order association'a katılabilir. `wp:anchor` görsel konumu
Word layout motoru olmadan güvenle bilinemediği için `ambiguous` bırakılır.
Altyapı placement'ı yalnız raporlar; table-before veya figure-after henüz
akademik production rule değildir.

# Metin içi tablo/şekil atfı normalizasyonu

`documentObjectReferencesNormalizer`, doğrudan body paragraph'larında Unicode
güvenli `Tablo <decimal>` ve `Şekil <decimal>` token'larını normalize eder.
Caption paragraph'ları, TOC cached entry'leri, rule-defined heading'ler ve
`hasTables`/`hasFigures` koşullu liste section içerikleri kapsam dışıdır.
Türkçe ekler ve apostrof varyantları token sınırından sonra serbesttir; detector
exact cümle kalıbı veya referansın nesneden önce gelmesini zorlamaz.

Object identity mevcut caption association ve caption number metadata'sından
gelir. Nested table, anchored figure ve caption identity bulunmayan occurrence
reference coverage'a girmez. Aynı kind/number birden çok güvenilir nesnede
kullanılırsa validator false PASS vermek yerine identity ambiguity failure
üretir.
