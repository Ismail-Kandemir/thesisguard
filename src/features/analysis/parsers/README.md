# Occurrence-aware heading numbering

`DocumentHeadingOccurrence.level` akademik heading role/scope seviyesini,
`numberingLevel` ise paragraph'tan normalize edilen gerçek manual/Word numbering
seviyesini taşır. Bilinen unnumbered section heading occurrence olarak korunur:
`numberingSource="none"`, `numberingLevel=null`. Böylece validator unnumbered ile
identity-unknown durumlarını karıştırmaz.

`HeadingNumberingValidator` section, paragraph veya regex üzerinden heading keşfetmez.
Yalnız `document.headings` içindeki canonical `sectionName`, `numberingSource`,
`numberingLevel`, `visibleLabel` ve `numId` metadata'sını kullanır. Manual dotted
depth ile Word `ilvl` aynı zero-based seviyeye normalize edilir.

# Heading occurrence normalizasyonu

`normalizeDocumentHeadings`, numbering ve rule-defined section işaretleme tamamlandıktan
sonra `document.headings` kaynağını üretir. Bilinen akademik ana başlıklar
`HEADING_NUMBERING` section beklentilerinden gelir. Dinamik alt başlıklar yalnız
akademik ana gövde aralığında hem heading-style inheritance zinciri hem güvenilir
manual/Word numbering taşıyorsa kabul edilir. Number prefix veya style tek başına
academic heading identity oluşturmaz.

TOC metadata, normalized caption `paragraphId`, table-cell ownership ve boş paragraph
tek source-of-truth olarak exclusion sağlar. Manual `2.1. Başlık` ile Word `ilvl=1`
aynı zero-based semantic level `1` olur. Normalizer paragraph, section, caption,
numbering, block ve style koleksiyonlarını mutate etmez; paragraph/block ID ve
indekslerini değiştirmez.

Occurrence formatting consumer'ları mevcut `EffectiveFormattingResolver` üzerinden
direct → style → basedOn → docDefaults zincirini kullanır. Paragraph alignment ve
before/after spacing consumer'a hazırdır. Run toggle alanlarında missing ile explicit
false ayrıdır; böylece style bold + direct `w:b w:val="0"` doğru biçimde false olur.

# Paragraph indentation ve spacing normalizasyonu

`documentXmlParser`, direct `w:ind` ve `w:spacing` değerlerini ham OOXML ölçüleriyle
normalize eder. `start/end`, legacy `left/right` adlarından önceliklidir; `firstLine`,
`hanging` ve karakter tabanlı karşılıklar ayrı tutulur. Tablo hücresi sahipliği
`isInTableCell` ile taşınır. `EffectiveFormattingResolver` direct → style → basedOn
→ docDefaults önceliğini uygular; direct sıfır inheritance'ı geçersiz kılar.
Girinti ve before/after değerleri twip olarak saklanır; line spacing ayrı semantiktir.

## Table/Figure List Entry Infrastructure Decision

Bu sprintte object-list entry normalizer eklenmedi. Resmi ÇOMÜ kaynakları liste
section presence gerekliliğini destekler, ancak içerik coverage'i için production
rule gücü yeterli değildir. Bu nedenle `NormalizedDocument` içinde
`objectLists`/`DocumentObjectListEntry` benzeri yeni metadata yoktur.

Gelecekte kaynakla desteklenen generic `OBJECT_LIST_CONSISTENCY` gerekirse list
entry'leri gerçek caption'lardan ayrı normalize edilmelidir. Parser yalnız
`Tablolar Listesi` veya `Şekiller Listesi` section content'i içinde paragraf
başındaki güvenilir `Tablo <decimal>` / `Şekil <decimal>` yapısını entry adayı
saymalı; TOC, body reference, actual caption ve section heading paragraflarını
entry olarak kullanmamalıdır. Identity namespace'i `table:<number>` ve
`figure:<number>` ayrımını korumalıdır.

Word field cache metadata olarak okunabilir, fakat field update yapılmamalı ve
cached page text gerçek rendered page konumu varsayılmamalıdır. Missing list
section `CONDITIONAL_REQUIRED_SECTION` sorumluluğunda kalmalı; future consistency
validator aynı yokluğu ikinci kez failure yapmamalıdır.

Okunan belge iceriginin analiz edilebilir yapilara donusturulecegi klasordur.

# Table/figure caption number metadata

`documentCaptionsNormalizer`, `Tablo 1.`, `Tablo 2.1.`, `Åekil 1.` ve
`Åekil 3.2.` gibi caption prefix'lerinden normalize `number` metadata'sÄ± Ã¼retir.
Bu metadata raw caption text, label, paragraph order, block order ve object
association (`captionId`) ile birlikte generic numbering consistency altyapÄ±sÄ± iÃ§in
yeterli modeldir. Yeni validatorlar raw XML okumamalÄ± ve caption regex'ini
kopyalamamalÄ±dÄ±r.

NumarasÄ±z `Tablo. ...` veya `Åekil. ...` paragraflarÄ± bu sÃ¼rÃ¼mde caption olarak
normalize edilmez. GÃ¼venilir top-level table veya inline figure iÃ§in bu durum
mevcut placement validator tarafÄ±ndan baÅŸlÄ±k tespit edilemedi olarak
raporlanabilir; ayrÄ± caption-numbering production rule'u yoktur.

Parser ile akademik caption-structure validation ayrÄ± tutulur. Mevcut strict
detection yalnÄ±z paragraph baÅŸÄ±ndaki `Tablo <decimal>.` ve `Åekil <decimal>.`
yapÄ±sÄ±nÄ± caption kabul eder; title metnini ayrÄ± alan olarak normalize etmez, raw
caption `text` iÃ§inde korur. `Tablo 1.` ve `Åekil 1.` boÅŸ title ile de caption
metadata'sÄ± Ã¼retebilir. `Tablo 1:`, `Tablo 1`, `1. Tablo`, `Ã‡izelge 1.` ve
`Figure 1.` bu sÃ¼rÃ¼mde caption deÄŸildir.

Gelecekte kaynakla desteklenen bir `OBJECT_CAPTION_STRUCTURE` rule'u gerekirse
candidate detection ile valid caption validation ayrÄ± tasarlanmalÄ±dÄ±r. Bu sprintte
source gÃ¼cÃ¼ yeterli olmadÄ±ÄŸÄ± iÃ§in parser regex'i geniÅŸletilmedi; body reference,
TOC, liste entry ve normal cÃ¼mle false-positive korumasÄ± korunur.

# Table/figure object alignment metadata

`documentCaptionsNormalizer`, gerçek object occurrence'larÄ± iÃ§in caption'dan
baÄŸÄ±msÄ±z yatay hizalama metadata'sÄ± Ã¼retir. Top-level table direct
`w:tblPr/w:jc` deÄŸeri `left`, `center`, `right`, `start` veya `end` ise
`alignment` alanÄ±na normalize edilir; `w:tblPr/w:tblStyle` ise style inheritance
iÃ§in `tableStyleId` olarak korunur. Style Ã§Ã¶zÃ¼mÃ¼ validator tarafÄ±nda mevcut
`document.styles` Ã¼zerinden yapÄ±lÄ±r.

Inline figure iÃ§in yalnÄ±z tek drawing iÃ§eren ve gÃ¶rÃ¼nÃ¼r text iÃ§ermeyen taÅŸÄ±yÄ±cÄ±
paragraph gÃ¼venilir kabul edilir. Direct paragraph alignment varsa object
alignment olarak normalize edilir; style-inherited paragraph alignment validator
tarafÄ±nda Ã§Ã¶zÃ¼lÃ¼r. `wp:anchor`, unknown drawing type, aynÄ± paragraph'ta birden
fazla drawing veya drawing ile gÃ¶rÃ¼nÃ¼r text/tabs/spaces birlikteyse alignment
`unknown` kalÄ±r.

Validatorlar rendered page coordinate, vertical centering, indentation/autofit
layout simulation veya floating object position tahmini yapmaz. Caption paragraph
alignment'Ä± object alignment kararÄ±na, object alignment metadata'sÄ± da caption
format kararÄ±na karÄ±ÅŸmaz.
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
## Heading spacing audit boundary

Paragraph formatting preserves `before`/`after` twips and
`beforeLines`/`afterLines` hundredths-of-a-line as separate nullable fields.
Direct explicit zero is distinct from absence and overrides the style chain;
`StyleInheritanceResolver` is cycle-safe. These values remain separate from
`lineSpacing`.

This metadata does not by itself provide a rendered heading gap. Word uses the
adjacent paragraphs' spacing and inter-line contributions, and empty paragraphs
or page boundaries can change the visible layout. Automatic spacing attributes
also override numeric before/after alternatives and are not currently modeled.
Until a consumer needs a complete rendered-gap model, no additional auto/unknown
types or dead-code validator are introduced. Heading identity remains exclusively
`NormalizedDocument.headings` if a future safe validator is implemented.
## Character-style typography resolution

Runs retain their `w:rStyle` ID. Effective run formatting is resolved per
property in this order: direct run formatting, character-style basedOn chain,
paragraph-style basedOn chain, document defaults. Explicit false values remain
overrides, and both inheritance chains are cycle-safe.

Font-family and font-size validators evaluate only runs containing visible
trimmed `w:t` text. Empty runs, field instructions without visible `w:t`, and
drawing-only carriers cannot create typography failures.

## Theme font resolution

The package reader locates the theme part through the document relationship and
uses `word/theme/theme1.xml` only as a conventional fallback. The theme parser
normalizes major/minor Latin, East Asia, complex-script, and script-override
font metadata. Runs, character styles, paragraph styles, and document defaults
retain their `w:rFonts` slot references.

Effective font resolution is property-local and layer-local: direct run,
character-style chain, paragraph-style chain, then document defaults. Within a
single `w:rFonts` element, the corresponding theme attribute overrides its
explicit counterpart. ASCII characters use the ASCII slot; Turkish and other
non-ASCII Latin text uses High ANSI. If visible text resolves to multiple font
families, the validator keeps that ambiguity and does not produce a false pass.
Unknown tokens or missing theme values resolve to unknown rather than guessing.
