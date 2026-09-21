# Phase 4E-18A — Object Representation & Caption Semantic Foundation (Shadow Model)

## Sonuç

Phase 4E-18’de önerilen factual/semantic ayrım, gerçek DOCX normalizasyonuna shadow data olarak eklenmiştir. Teknik temsil, caption beyanı, nesne–caption ilişkisi ve akademik çözüm ayrı tiplerdir.

> **THE SHADOW MODEL DOES NOT YET CONTROL RULE RESULTS.**

Mevcut `DocumentFigureOccurrence`, `DocumentTableOccurrence`, caption association, validator girdileri, skor ve rapor UI aynen korunmuştur.

## Mimari

```text
semantic OOXML tree
  ├─ legacy pipeline
  │    └─ tables / figures / captions → existing validators
  └─ shadow pipeline
       ├─ ObjectRepresentationOccurrence
       ├─ CaptionOccurrence + CaptionSemantic
       ├─ ObjectCaptionAssociation
       └─ AcademicObjectResolution
```

`parseDocumentXml()` çıktısındaki `NormalizedDocument.objectSemantics`, shadow modelin entegrasyon noktasıdır. `documentCaptionsNormalizer` ortak body block ve paragraph olgularını kurduktan sonra `normalizeObjectSemantics()` çağrılır. Böylece ikinci bir metin modeli kurulmaz; teknik payload ayrımı için gerekli semantic OOXML traversal yapılır.

## Tipler ve sınırlar

- `ObjectRepresentationOccurrence`: teknik OOXML nesnesi, kararlı analiz-içi ID, XML sırası, body block/paragraph konumu, scope, drawing mode ve tespit kanıtı.
- `CaptionOccurrence`: nesneden bağımsız caption adayı; ham/normalize metin, konum, field instruction kanıtı ve orphan durumu.
- `CaptionSemantic`: yalnız desteklenen caption söz diziminin ne beyan ettiğini söyler.
- `ObjectCaptionAssociation`: object/caption ID’leri arasındaki deterministik ilişkiyi veya belirsizliği açıklar.
- `AcademicObjectResolution`: caption beyanı ile güvenli ilişkinin birleşimini `declared`, `unresolved`, `ambiguous` veya `excluded` olarak ifade eder.

Temsil sınıflandırması akademik kimlik üretmez. Özellikle `picture`, `chart` ve generic `w:drawing`, kendi başına `figure` değildir.

## Uygulanan representation taxonomy

| Kind | Teknik kanıt |
|---|---|
| `picture` | semantic `w:drawing` altında `pic:pic` |
| `chart` | `c:chart` veya chart ile biten `a:graphicData@uri` |
| `diagram` | `dgm:relIds` veya diagram ile biten URI |
| `group` | `wpg:wgp` veya WordprocessingGroup URI |
| `textbox` | DrawingML `wps:txbx`/`w:txbxContent` ya da VML `w:pict` içinde textbox content |
| `vml-image` | OLE dışında `w:pict` altında `v:imagedata` |
| `ole` | `w:object` altında `o:OLEObject` |
| `equation` | üst düzey `m:oMathPara` veya bir math paragraph’a ait olmayan `m:oMath` |
| `table` | semantic `w:tbl` |
| `unknown-drawing` | tanınan payload kanıtı olmayan semantic `w:drawing` |

Sınıflandırma dosya adına dayanmaz. `mc:AlternateContent` için yalnız ortak resolver’ın seçtiği dal; revision için yalnız güncel belgede görünür oluşumlar kullanılır.

## Konum ve scope

Minimal scope modeli `body | table-cell | textbox` değerlerini taşır. Kaynak part bu fazda dürüstçe yalnız `word/document.xml` değeridir; header/footer/note part’ları taranıyormuş gibi gösterilmez. Textbox-owned içerik body’ye düzleştirilmez. Direct body nesneleri block index alır; nested veya görsel sırası güvenle belirlenemeyen nesnelerde konum `null` kalabilir.

## Caption occurrence ve semantics

Legacy ile aynı kaynak-destekli söz dizimi korunur:

```text
Tablo|Şekil + çok seviyeli sayısal numara + nokta + açıklama
```

Türkçe case normalizasyonu, split-run görünür metni ve cached field result davranışı ortak paragraph normalizasyonundan gelir. `w:instrText` mevcutsa ayrıca `fieldEvidence` olarak saklanır; field instruction tek başına akademik kimlik üretmez.

Üretilen caption semantic durumları:

- `declared`: geçerli `Şekil n.` veya `Tablo n.`
- `unnumbered`: bilinen label var, numara yok
- `malformed`: bilinen label var, desteklenmeyen söz dizimi
- `unknown`: tip sisteminde gelecekteki dürüst fallback; mevcut classifier alakasız paragrafları caption occurrence yapmaz

Caption kimliği beklenen placement’ı içermez. Yanlış taraftaki geçerli caption yine beyan olabilir; placement uygunluğu legacy validator/policy sorumluluğunda kalır.

## Association strategy

Association, direct body block akışında nesnenin önce/sonrasındaki bitişik caption adaylarını inceler. Boş paragraflar atlanır; görünür caption olmayan paragraf veya başka block sınırdır.

Durumlar:

- `matched`: tek, geçerli, beklenen semantic türde aday
- `missing`: komşu caption adayı yok
- `ambiguous`: çoklu/kullanılamayan aday, paylaşılan caption veya deterministik olmayan anchored/nested konum
- `conflicting`: yalnız karşı türü beyan eden caption kanıtı
- `not-attempted`: textbox scope

Sonuç candidate IDs, before/after yönü, block mesafesi ve deterministik reason code taşır. Sayısal confidence üretilmez.

## Academic resolution

- Tek ve deterministik ilişkili `Şekil n.` → `declared/figure`.
- Tek ve deterministik ilişkili teknik table + `Tablo n.` → `declared/table`.
- Caption’sız picture/chart/diagram/group/OLE/table → temsil korunur, akademik durum `unresolved`.
- Ambiguous/conflicting association → `ambiguous`.
- Textbox veya textbox-owned temsil → factual scope nedeniyle `excluded`; dekoratif içerik varsayımı yapılmaz.
- Orphan caption → caption olgusu olarak kalır, nesne veya resolution üretmez.

`declared` sözcüğü, belgenin güçlü caption beyanını ifade eder; yazar niyetinin dışsal olarak “kanıtlandığı” iddiası değildir.

## Legacy coexistence

Shadow model paralel bir alandır. Legacy `tables`, `figures` ve `captions` aynı fonksiyonlarla ve aynı association davranışıyla üretilmeye devam eder. Hiçbir validator `objectSemantics` okumaz. Unresolved nesneler mevcut skora warning, failure veya `N/A` eklemez.

Bu fazda RuleResult parity, golden ve corpus testleriyle korunur. Shadow model ileride validator migration için veri sağlar; migration yetkisi vermez.

## Test kapsamı

`tests/audit/objectSemanticShadowRegression.cjs` şu invariant’ları denetler:

- representation tek başına figure değildir;
- deterministik `Şekil` ve `Tablo` caption’ları uygun nesneyi resolve eder;
- caption’sız temsiller unresolved kalır;
- çoklu caption adayı ambiguous kalır;
- orphan caption nesne üretmez;
- DrawingML/VML textbox figure olmaz;
- AlternateContent inactive dalı occurrence çoğaltmaz;
- deleted/moveFrom oluşumları geri gelmez;
- baseline ve keşif fixture’larının legacy RuleResult’ları korunur.

Mevcut fixture gözlemleri: captioned baseline picture/table `declared`; caption’sız chart/diagram/group/OLE `unresolved`; `Şekil 99.` caption’lı diagram `declared/figure`; textbox’lar `excluded`.

## Bilinen sınırlamalar

- Yalnız `word/document.xml` taranır; header/footer, footnote ve endnote nesneleri bu fazda temsil edilmez.
- Block dışı anchored/nested nesne–caption görsel sırası çözülemez; ambiguity korunur.
- VML image ve equation için özel corpus fixture’ı henüz yoktur.
- Paragraph style veya özel/localized caption label’ları semantik beyan sayılmaz.
- Field instruction saklanır fakat field result ile tutarlılık çözümlemesi yapılmaz.
- Front matter/body akademik rol ayrımı henüz yoktur; başlıksız resim dekoratif sayılmaz.
- Group içindeki alt şekiller ayrı akademik nesneler olarak genişletilmez.

## Migration boundary

Sonraki faz, shadow/legacy farklarını görünür ve fixture bazında inceleyip validator applicability sözleşmesini hazırlamalıdır. Validator’ların doğrudan taşınması, kullanıcı-visible uncertainty veya skor değişikliği bu foundation fazının dışında kalır.
