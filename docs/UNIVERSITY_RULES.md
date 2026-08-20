# Üniversite Kural Veri Modeli

## Hiyerarşi

ThesisGuard kural verisi uzun vadede aşağıdaki hiyerarşiyi temsil eder:

```text
Üniversite
├── Genel kurallar
├── Fakülte
│   └── Bölüm / Program
└── Enstitü
    └── Bölüm / Program
        └── Tez türü
            └── Kural seti
```

`University`, `Faculty`, `Institute`, `Department`, `Program` ve `ThesisType`
tanımları `id`, `name` ve `slug` alanlarını taşır. Kural seti metadata'sında
üniversite, tez türü ve sürüm bulunur. Fakülte/enstitü ile bölüm/program
alanları opsiyoneldir; böylece üniversite genelindeki kurallar da aynı modelle
temsil edilebilir.

## Scope

Bir kuralın `scope` alanı kuralın geçerli olduğu seviyeyi ve hedef birimin
`id`/`slug` değerlerini belirtir. Desteklenen seviyeler `university`, `faculty`,
`institute`, `department` ve `program` değerleridir. `scope` mevcut kurallarda
opsiyoneldir; bu sayede eski kural dosyaları değişmeden çalışır.

## Rule ID namespace standardı

Yeni rule ID'leri küçük harfli slug bileşenlerinden oluşur. Önerilen biçimler:

```text
<university>.<thesis-type>.general.<rule-name>
<university>.<faculty-or-institute>.<department-or-program>.<thesis-type>.<rule-name>
```

Örnekler:

```text
comu.bachelor.general.font-family
comu.engineering.computer-engineering.bachelor.page-number
comu.applied-sciences.food-technology.bachelor.page-number
```

TypeScript'teki `UniversityGeneralRuleId`, `OrganizationalRuleId` ve
`NamespacedRuleId` tipleri yeni namespace biçimlerini ifade eder. Mevcut rule
ID'leri migration sırasında değiştirilmez.

## Kalıtım ve override hazırlığı

Gelecekteki çözümleyici kural setlerini şu sırayla ele alacaktır:

1. Üniversite genel kuralları
2. Fakülte veya enstitü kuralları
3. Bölüm veya program kuralları
4. Tez türüne ait en spesifik kurallar

`UniversityRuleSet.extends`, daha genel kural setlerinin kimlik ve kapsam
referanslarını tutar. Bir kuralın opsiyonel `overrides` alanı ise hangi genel
rule ID'lerinin yerine geçtiğini açıkça belirtir. Böylece ileride en spesifik
kuralın genel kuralı ezmesi belirsiz ID eşleştirmelerine ihtiyaç duymadan
uygulanabilir. Bu sprintte merge veya override algoritması yoktur ve mevcut
RuleEngine davranışı değişmez.

## Neden tek bachelor.json yeterli değil?

Bir üniversitenin fakülteleri, enstitüleri ve programları farklı tez yazım
kuralları uygulayabilir. Üniversite seviyesindeki tek bir `bachelor.json`, bu
farklı kapsamların kaynağını ve önceliğini güvenli biçimde ifade edemez; zamanla
çakışan veya doğrulanması zor kurallar üretir. Hiyerarşik yapı her kural setinin
kurumsal kaynağını, tez türünü ve sürümünü ayrı ayrı tanımlamayı sağlar.

## Geriye uyumluluk

`src/data/universities/comu/bachelor.json` geçici geriye uyumluluk amacıyla
yerinde korunur. Mevcut `RuleLoader` bu dosyayı aynı şekilde yüklemeye devam
eder. Yeni metadata, scope, `extends` ve `overrides` alanları mevcut kurallar
için zorunlu değildir. Yeni hiyerarşik dosyalara yalnızca kaynağı doğrulanmış
kurallar eklenir.

## İlk department-level kural seti

İlk gerçek hiyerarşik kural seti şu kapsamı temsil eder:

```text
ÇOMÜ
└── Uygulamalı Bilimler Fakültesi
    └── Gıda Teknolojisi
        └── Bachelor
            ├── Page Number
            ├── Table of Contents section
            ├── References section
            ├── Özet section
            ├── Abstract section
            ├── İntihal (Aşırma) Beyan Sayfası
            ├── Kabul ve Onay Sayfası
            ├── Teşekkür
            ├── Giriş
            ├── Sonuç
            └── Özgeçmiş
```

Kural seti `comu.bachelor` genel setini `extends` ile referanslar. Bölüme ait
JSON dosyası genel kuralları tekrar etmez. `RuleResolver`, genel ÇOMÜ bachelor
kurallarını önce; Gıda Teknolojisi sayfa numarası, İçindekiler, Kaynaklar,
Özet, Abstract ve ortak zorunlu yapısal bölüm kurallarını sonra çözerek tek bir
nihai kural listesi üretir.

Gıda Teknolojisi kılavuzunun 4.1 maddesindeki 3 cm üst margin ve 4.2
maddesindeki tüm metin için 12 punto şartları, daha genel setteki 2,5 cm üst
margin ile 14 punto Heading1 değerlerinden farklıdır. Bu iki genel rule yalnız
Gıda Teknolojisi department kapsamında sırasıyla 3 cm ve 12 punto değerleriyle
override edilir. Heading2 ve Heading3 zaten 12 punto olduğundan korunur.

Kılavuz, deneysel ve kaynak araştırması çalışma türlerinin ikisinde de `KABUL
VE ONAY SAYFASI`nı ortak zorunlu bölüm olarak gösterir. Ek-4 ile iki resmi Word
şablonundaki görünür heading `KABUL VE ONAY` olduğundan canonical section
`Kabul ve Onay Sayfası`, kaynak destekli tek alias `Kabul ve Onay` olarak
modellenir. `experimental.section-order` ve `source-research.section-order`
aynı canonical/alias çiftini kullanarak bulunan bölümlerde İntihal → Kabul ve
Onay → Teşekkür relative sırasını doğrular. Presence kuralı bölümün yokluğunu,
order kuralı ise yalnız bulunan bölümlerin sırasını raporlar. Rule yalnız
bağımsız section heading varlığını kontrol eder; jüri,
danışman, imza, tarih, öğrenci bilgisi, Turnitin sonucu veya görsel şablon
uygunluğunu doğrulamaz.

Sayfa numarası kuralının kaynağı: **Çanakkale Onsekiz Mart Üniversitesi Gıda
Teknolojisi Bitirme Tezi Hazırlama Kılavuzu**. Kural setinde sayfa numarasının
zorunlu, footer konumunda ve center hizalamasında olması ile İçindekiler
bölümünün bulunması doğrulanır. Word TOC field kullanımı kılavuzda zorunlu
olmadığından bölüm kuralı yalnızca görünür section varlığını değerlendirir.
Kaynaklar kuralı da yalnızca bağımsız Kaynaklar bölümünün bulunmasını doğrular;
APA biçimi, kaynak kayıtlarının yapısı veya metin içi atıflar değerlendirilmez.

Kılavuz, Türkçe özet sayfasını `ÖZET`, İngilizce özet sayfasını
`ABSTRACT` başlığıyla gösterir. Department rule setindeki `summary-tr` ve
`summary-en` kuralları yalnızca bu bağımsız bölümlerin varlığını kontrol eder.
Özet uzunluğu, kelime sayısı, anahtar kelimeler, dilsel içerik doğruluğu,
başlık fontu veya özet biçimlendirmesi bu kuralların kapsamında değildir.

Kılavuz, deneysel ve teorik/kaynak araştırması çalışmalarının her ikisinde de
`İNTİHAL (AŞIRMA) BEYAN SAYFASI`, `TEŞEKKÜR`, `GİRİŞ`, `SONUÇ` ve `ÖZGEÇMİŞ`
bölümlerini zorunlu tez yapısında gösterir. Bu kurallar yalnızca ilgili bağımsız
bölüm başlığının varlığını kontrol eder; bölüm sırası, içeriği veya biçimi
değerlendirilmez. İntihal beyanı kuralı intihal oranını, Turnitin sonucunu,
imzayı ya da beyan metninin doğruluğunu kontrol etmez. Özgeçmiş kuralı da
özgeçmiş içeriğinin veya şablonunun uygunluğunu doğrulamaz.

Kılavuz iki çalışma türü için de `TABLOLAR LİSTESİ` bölümünü bitirme ödevinde
tablo varsa, `ŞEKİLLER LİSTESİ` bölümünü ise bitirme ödevinde şekil varsa
eklenmesi gereken bölüm olarak tanımlar. Bu nedenle bu iki başlık ortak Gıda
Teknolojisi Lisans kural setinde `CONDITIONAL_REQUIRED_SECTION` olarak
modellenir. Tablolar Listesi koşulu normalize edilmiş DOCX body
`word/document.xml` içindeki gerçek `w:tbl` varlığına, Şekiller Listesi koşulu
ise gerçek `w:drawing` varlığına dayanır. Metindeki `Tablo` veya `Şekil`
ifadeleri tek başına koşul oluşturmaz.

Bu conditional kurallar liste içeriğinin doğruluğunu, listedeki sayfa
numaralarını, caption yapılarını, tablo/şekil numaralandırmasını veya görsel
içeriğini kontrol etmez. Koşul false olduğunda sonuç `NOT_APPLICABLE` durumuyla
ve `Uygulanmadı` actual değeriyle temsil edilir. `NOT_APPLICABLE` ne PASS ne de
FAIL'dir ve skor paydasına dahil edilmez.

Kılavuzdaki `SİMGELER VE KISALTMALAR LİSTESİ`, tezde kısaltma kullanımı tespit
edildiğinde ortak Gıda Teknolojisi bachelor setindeki
`comu.applied-sciences.food-technology.bachelor.list-of-abbreviations`
`CONDITIONAL_REQUIRED_SECTION` kuralıyla aranır. Koşul heuristic
`hasAbbreviations` document fact'ine dayanır. Bu fact kesin akademik veya
dilbilimsel karar değildir.

Rule yalnız bölüm varlığını doğrular; listedeki kısaltmaların eksiksizliğini,
açıklamaların doğruluğunu, alfabetik sırayı, metin ve liste arasındaki birebir
eşleşmeyi, sembollerin semantik doğruluğunu veya ilk kullanımda açılım verilmesini
kontrol etmez. Kural conditional olduğu için mevcut SECTION_ORDER listelerine
eklenmemiştir.

Generic `ABBREVIATION_LIST_CONSISTENCY` altyapısı mevcuttur ancak akademik rule
olarak etkinleştirilmemiştir. Kılavuzun bölüm yapısı tablosu yalnız kısaltma
kullanılıyorsa listenin hazırlanmasını ister; metinde tespit edilen bütün
kısaltmaların bu listede bulunmasını ayrıca ve yeterince açık biçimde zorunlu
kılmaz. Kılavuzun 4.7 Kısaltmalar bölümü de ilk kullanımda açıklama verilmesini
düzenler, body-to-list coverage şartı getirmez. Bu nedenle mevcut
`list-of-abbreviations` presence kuralının kapsamı genişletilmemiştir.

## Akademik seçim akışı

```text
AcademicCatalog
↓
AcademicSelection
↓
RuleSetSelector
↓
RuleResolver
↓
RuleEngine
```

`AcademicCatalog`, kullanıcıya sunulabilecek doğrulanmış üniversite, fakülte
veya enstitü, bölüm veya program ve tez türü kombinasyonlarını tanımlar.
`AcademicSelection`, bu seçeneklerden yapılan tek bir seçimi taşır.
`RuleSetSelector` seçimin geçerliliğini katalog üzerinden denetler ve yalnızca
gerekli rule setleri belirler. Kuralları birleştirmez veya override uygulamaz;
bu sorumluluk `RuleResolver` katmanında kalır. `RuleEngine` ise resolver'ın
ürettiği nihai kuralları çalıştırır.

Katalog verisi rule JSON dosyalarından ayrı tutulur. Rule JSON'ları analiz ve
kalıtım yapılandırmasıdır; katalog ise UI seçeneklerinin açık, kontrollü ve
doğrulanmış listesidir. Bu ayrım, kural dosyalarının UI veri kaynağına
dönüşmesini ve henüz kullanıcıya açılmaması gereken yapıların yanlışlıkla
seçilebilir olmasını önler.

## Çalışma türü hiyerarşisi

`bachelor`, akademik tez düzeyidir. `experimental` ve `source-research` çalışma
metodolojisini belirtir; bu iki kavram aynı şey değildir. `AcademicSelection`
tez düzeyini `thesisTypeId`, metodolojiyi ayrı ve opsiyonel `studyTypeId` ile
taşır. Katalog bir tez türü için çalışma türleri tanımlıyorsa seçim zorunludur;
tanımlamıyorsa mevcut akış değişmeden çalışır.

Ortak Gıda Teknolojisi Lisans kuralları `food-technology/bachelor.json`
dosyasında kalır. Experimental child seti ortak seti `extends` eder ve yalnız
Deneysel Çalışma için doğrulanan şu `REQUIRED_SECTION` kurallarını içerir:

- Genel Bilgiler ve Literatür Çalışması
- Materyal ve Metot
- Bulgular ve Tartışma

Bu kurallar Teorik / Kaynak Araştırması tezlerine uygulanmaz; source-research
child setine yalnız bu çalışma türü için zorunlu `Genel Bilgiler` bölümü
eklenmiştir. Bu kural Deneysel Çalışma tezlerine uygulanmaz. Kontrol yalnız
bağımsız section varlığına odaklanır; içerik kalitesi, bölüm sırası ve bilimsel
uygunluk doğrulanmaz.

Kılavuzdaki “Ana ve Alt Bölümler” ifadesi sabit bir görünür tez başlığı değil,
konuya göre kurulacak bölüm yapısının tarifidir. Bu nedenle sabit bir
`REQUIRED_SECTION` olarak modellenmemiştir.

## Gıda Teknolojisi bölüm sırası kuralları

Experimental ve Teorik / Kaynak Araştırması ana metin yapıları farklı olduğu
için her child rule set kendi `SECTION_ORDER` kuralını taşır. Kurallar,
kılavuzdaki örnek içindekiler yapısında doğrulanabilen zorunlu bölümlerin
relative sırasını kontrol eder.

Eksik bölüm kontrolü `REQUIRED_SECTION` sorumluluğunda kalır. `SECTION_ORDER`
yalnız belgede bulunan expected bölümlerin kendi aralarındaki sırasını
değerlendirir. Simgeler ve Kısaltmalar, Tablolar, Şekiller ve Ekler gibi koşullu
bölümlerin yokluğu hata değildir; araya girmeleri de relative sırayı bozmaz.
Dış/İç Kapak order listelerine dahil edilmemiştir. Kabul ve Onay ise canonical
ad ve resmi alias ile order listelerindedir. “Ana ve Alt Bölümler” sabit bir
başlık olmadığı için source-research listesinde yoktur.

Validator içerik kalitesini, bilimsel uygunluğu veya bölüm numaralandırmasını
kontrol etmez.

## Özet kelime sınırları

Gıda Teknolojisi kılavuzu hem deneysel hem kaynak araştırması tezlerinde Türkçe
Özet için en fazla 200 kelime sınırı koyar. İngilizce Özet bölümünde de Türkçe
Özet kurallarının geçerli olduğunu açıkça belirttiği için `Özet` ve `Abstract`
için ayrı `SECTION_WORD_COUNT` kuralları ortak `bachelor.json` setinde bulunur.

Her kontrol yalnız ilgili heading'den sonraki görünür section içeriğini sayar.
Heading sayılmaz ve bir sonraki güvenilir section heading'i sınırdır. Böylece
Türkçe Özet hesabına Abstract heading'i/içeriği, Abstract hesabına da sonraki
bölüm dahil edilmez. Kelime sayımı içeriğin kalitesini, doğruluğunu, dilini,
anahtar kelime sayısını veya bilimsel uygunluğunu değerlendirmez. Section
eksikliği ayrı `REQUIRED_SECTION` kuralının sorumluluğundadır.

## Özet ve Abstract anahtar kelimeleri

Kılavuz Özet sonunda en az üç, en fazla beş anahtar sözcük ister ve Türkçe Özet
kurallarının İngilizce Özet için de geçerli olduğunu belirtir. Resmi şablonlara
uygun olarak Türkçe label yalnız `Anahtar Kelimeler:`, İngilizce label yalnız
`Keyword:` kabul edilir. İki ortak `SECTION_KEYWORDS` kuralı değerleri aynı
paragrafta virgülle ayırır ve label paragrafından sonra section içinde yalnız
boş paragraflar bulunmasına izin verir.

Kontrol keyword'lerin bilimsel kalitesini, birbirinden farklı olmasını veya
Türkçe/İngilizce değerlerin semantik çeviri eşdeğerliğini değerlendirmez.
Duplicate görünür değerler ayrı entry olarak sayılır; kaynak bunu ayrıca bir
akademik hata olarak tanımlamaz. Mevcut `SECTION_WORD_COUNT` davranışı
değişmemiştir ve keyword satırı section içeriğinin parçası olarak sayılmaya
devam eder.

```text
comu.bachelor
→ comu.applied-sciences.food-technology.bachelor
→ comu.applied-sciences.food-technology.bachelor.experimental

comu.bachelor
→ comu.applied-sciences.food-technology.bachelor
→ comu.applied-sciences.food-technology.bachelor.source-research
```

Selector eksik veya bilinmeyen çalışma türünde sessiz fallback yapmaz ve
`AcademicSelectionError` üretir. Bir child seçildiğinde diğer çalışma türünün
seti seçilen zincire dahil edilmez.

## Gıda Teknolojisi ana bölüm numaralandırması

Resmî kılavuzun 4.6 başlık örnekleri ve uyulması istenen Ek-7 içindekiler yapısı,
akademik ana metin bölümlerini ana bölüm düzeyinde numaralı gösterir. Çalışma
türlerinin body section setleri farklı olduğundan iki child production kuralı
tanımlanır:

- `comu.applied-sciences.food-technology.bachelor.experimental.heading-numbering`
- `comu.applied-sciences.food-technology.bachelor.source-research.heading-numbering`

Experimental kuralı Giriş, Genel Bilgiler ve Literatür Çalışması, Materyal ve
Metot, Bulgular ve Tartışma ve Sonuç bölümlerini; Source Research kuralı Giriş,
Genel Bilgiler ve Sonuç bölümlerini level 0 numbered heading olarak doğrular.
Konuya göre değişen source-research ana/alt bölümleri sabit isimli production
expectation değildir.

Manuel text prefix ile Word automatic numbering eşdeğerdir. Word `numId` ve level
metadata'sı güvenilir olduğunda görünür label'ın çözülememesi failure değildir.
Exact noktalama, sequential numbering, skipped number, parent-child hierarchy,
maximum depth ve Heading2/Heading3 numbering kaynak gücü yetersiz olduğu için bu
production kurallarının kapsamında değildir.

İntihal Beyanı, Kabul ve Onay, Teşekkür, Özet, Abstract, İçindekiler, listeler,
Kaynaklar, Ekler ve Özgeçmiş numbering expected listelerinde bulunmaz. Missing
section hataları REQUIRED_SECTION sorumluluğundadır; hiçbir target bulunmazsa
HEADING_NUMBERING `NOT_APPLICABLE` olur. Duplicate target ise güvenli ve
deterministik failure üretir. TOC cached entries ile arbitrary numbered list/body
paragrafları gerçek section occurrence olmadıkça değerlendirilmez.

## Gıda Teknolojisi sayfa numarası sırası

Kılavuzun 4.3 maddesi ön sayfalarda küçük Romen, ana metin ve kalan sayfalarda
ardışık normal rakam ister. İki resmî DOCX şablonu da Giriş geçişinde
`w:pgNumType w:start="1"` kullanır; önceki bölümlerde `lowerRoman` tanımlıdır.
Bu ortak davranış
`comu.applied-sciences.food-technology.bachelor.page-number-sequence` ID'li
`PAGE_NUMBER_SEQUENCE` kuralıyla modellenir.

Kural mevcut `PAGE_NUMBER` kontrolünü tekrarlamaz: PAGE alanının alt bilgi/orta
konumunu değil, Word section metadata'sındaki biçim geçişini ve başlangıç
değerini doğrular. Eksik Giriş `NOT_APPLICABLE`, duplicate Giriş `FAILED` olur.

## Gıda Teknolojisi tablo ve şekil başlıkları

Kılavuz tablo başlıklarının tablonun üstünde, şekil başlıklarının şeklin altında
olmasını; her iki başlık türünün sola yaslı ve tek satır aralığında yazılmasını
açıkça ister. Ortak bachelor setinde iki generic davranışla dört production rule
bulunur: table/figure placement ve table/figure format.

Placement yalnız güvenilir occurrence'ları değerlendirir. Nested table doğrudan
body block'u olmadığı için, anchored figure ise render edilmiş konumu OOXML
sırasından kesin belirlenemediği için kapsam dışıdır. Yalnız bunlardan oluşan
belgede sonuç `NOT_APPLICABLE` olur. Güvenilir occurrence'ta missing veya
ambiguous caption placement failure'dır.

Format kuralı yalnız caption association kurulmuş occurrence'ları değerlendirir
ve effective style inheritance üzerinden alignment ile line spacing değerlerini
çözer. Caption eksikliği placement tarafından raporlandığında format
`NOT_APPLICABLE` olur; aynı eksiklik score'u iki kez düşürmez. Font, punto,
bold/italic ve `ResimYazs` style ID'si production şartı değildir.

## Gıda Teknolojisi metin içi tablo ve şekil atıfları

Kılavuz tablo ve şekillere metin içinde atıf yapılmasını açıkça zorunlu tutar.
Ortak bachelor setindeki iki `OBJECT_IN_TEXT_REFERENCE` kuralı, güvenilir caption
numarası bulunan her top-level table ve inline figure için caption dışındaki tez
metninde en az bir aynı kind/number referansı arar.

Atfın nesneden önce gelmesi, exact cümle biçimi, birden fazla atıf, numbering
sequence ve ekler için özel semantik kaynak tarafından zorunlu tutulmadığından
kontrol edilmez. Caption, table/figure listesi, TOC ve heading metinleri reference
sayılmaz. Missing/ambiguous caption placement hatasını tekrar cezalandırmaz;
güvenilir identity yoksa `NOT_APPLICABLE` olur. Duplicate caption number güvenli
eşleştirme yapılamadığı için açık failure üretir.
## GÄ±da Teknolojisi tablo ve ÅŸekil nesne hizalamasÄ±

GÄ±da Teknolojisi Bitirme Tezi HazÄ±rlama KÄ±lavuzu 4.4 maddesi tablo ve
ÅŸekillerin ortalanarak yerleÅŸtirilmesini ister. Bu requirement caption
hizalamasÄ±ndan ayrÄ±dÄ±r: caption paragraph'Ä± iÃ§in mevcut production beklentisi
sola yaslÄ± ve 1 satÄ±r aralÄ±ÄŸÄ±dÄ±r; object alignment ise tablonun veya inline
ÅŸeklin kendisinin yatay ortalanmasÄ±nÄ± deÄŸerlendirir.

Ortak GÄ±da Teknolojisi bachelor setinde iki generic `OBJECT_ALIGNMENT` production
rule'u bulunur:

- `comu.applied-sciences.food-technology.bachelor.table-object-alignment`
- `comu.applied-sciences.food-technology.bachelor.figure-object-alignment`

Tablo alignment'Ä± top-level `w:tbl` occurrence'larÄ± iÃ§in Ã¶lÃ§Ã¼lÃ¼r. Direct
`w:tblPr/w:jc` deÄŸeri `center`, `left`, `right`, `start` veya `end` ise normalize
edilir. Direct deÄŸer yoksa `w:tblPr/w:tblStyle` ile baÄŸlanan table style
zincirindeki `w:tblPr/w:jc` kullanÄ±lÄ±r. Direct deÄŸer style'dan Ã¶nceliklidir.
Width, autofit, indentation, cell margin veya rendered sayfa koordinatÄ± iÃ§in Word
layout engine yazÄ±lmaz; gÃ¼venilir alignment yoksa deÄŸer `unknown` kalÄ±r.

Åekil alignment'Ä± yalnÄ±z gÃ¼venilir inline drawing yapÄ±sÄ±nda Ã¶lÃ§Ã¼lÃ¼r: drawing'i
taÅŸÄ±yan paragraph tek inline drawing iÃ§ermeli ve gÃ¶rÃ¼nÃ¼r text iÃ§ermemelidir. Bu
durumda direct veya style inheritance ile Ã§Ã¶zÃ¼len paragraph alignment `center`,
`left` veya `right` olarak object alignment'a aktarÄ±lÄ±r. `wp:anchor`, unknown
drawing type, aynÄ± paragraph'ta birden fazla drawing veya drawing ile gÃ¶rÃ¼nÃ¼r
text/tabs/spaces bulunan paragraph gÃ¼venilir bireysel object center Ã¶lÃ§Ã¼mÃ¼
saÄŸlamadÄ±ÄŸÄ± iÃ§in `unknown` kabul edilir.

Rule caption varlÄ±ÄŸÄ±na baÄŸlÄ± deÄŸildir. Caption eksik olsa bile top-level table
veya gÃ¼venilir inline figure alignment'Ä± Ã¶lÃ§Ã¼lebiliyorsa object alignment ayrÄ±
deÄŸerlendirilir; caption eksikliÄŸi mevcut `OBJECT_CAPTION_PLACEMENT`
sorumluluÄŸunda kalÄ±r. Nested table'lar mevcut academic object yaklaÅŸÄ±mÄ±nÄ± korumak
iÃ§in production object alignment kapsamÄ±na alÄ±nmaz. Orphan caption, body
reference, Tablolar/Åekiller Listesi, TOC ve section heading object occurrence
deÄŸildir.

Bilinen tÃ¼m object'ler center ise rule `PASSED` olur. DeÄŸerlendirilebilir object
left veya right ise `FAILED` olur. TÃ¼m occurrence'lar `unknown` ise teknik olarak
uygulanamadÄ±ÄŸÄ± iÃ§in `NOT_APPLICABLE` olur. BazÄ± object'ler center, bazÄ±larÄ±
unknown ise false PASS vermemek iÃ§in rule `FAILED` olur ve mesaj unknown
occurrence'larÄ± akademik yanlÄ±ÅŸ gibi deÄŸil, teknik olarak belirlenemedi diye
raporlar.

## Tablo ve ÅŸekil baÅŸlÄ±ÄŸÄ± metin yapÄ±sÄ± kaynak kararÄ±

KÄ±lavuz ve resmi Word ÅŸablonlarÄ± tablo/ÅŸekil baÅŸlÄ±klarÄ±nÄ± `Tablo 1. ...` ve
`Åekil 1. ...` benzeri gÃ¶rÃ¼nÃ¼r yapÄ±larla Ã¶rneklendirir. Bu Ã¶rnekler mevcut
caption parser'Ä±n desteklediÄŸi label + decimal number + nokta biÃ§iminin gÃ¼venli
bir detection formatÄ± olduÄŸunu destekler. Ancak kaynaklar exact label,
label-number order, nokta separator, baÅŸlÄ±k/title presence, tek paragraph,
capitalization, alias yasaÄŸÄ±, source suffix veya title uzunluÄŸÃ¼ iÃ§in ayrÄ± ve
STRONG production requirement kurmaz.

Bu nedenle ortak GÄ±da Teknolojisi bachelor setine `OBJECT_CAPTION_STRUCTURE`
production rule'u eklenmemiÅŸtir. Caption tamamen yoksa mevcut
`OBJECT_CAPTION_PLACEMENT` failure Ã¼retir. Caption iliÅŸkisi varsa mevcut
`OBJECT_CAPTION_FORMAT`, `OBJECT_IN_TEXT_REFERENCE` ve `OBJECT_ALIGNMENT`
kurallarÄ± kendi sorumluluklarÄ±nÄ± deÄŸerlendirir. Structure rule eklenmediÄŸi iÃ§in
missing caption, punctuation veya title eksikliÄŸi ikinci kez cezalandÄ±rÄ±lmaz.

Mevcut `DocumentCaption` modeli raw gÃ¶rÃ¼nÃ¼r `text`, `kind`, canonical `label`,
normalize `number`, `paragraphId`, `paragraphIndex` ve `blockIndex` alanlarÄ±nÄ±
taÅŸÄ±r. Title metni ayrÄ± metadata olarak tutulmaz; gerekirse raw `text` Ã¼zerinden
gelecekte generic candidate/structure modeli tasarlanabilir. Bu sprintte parser
false-positive korumasÄ±nÄ± gevÅŸetecek candidate detection geniÅŸletmesi
yapÄ±lmamÄ±ÅŸtÄ±r.

Body reference cÃ¼mleleri, Tablolar/Åekiller Listesi, TOC cached entry'leri,
section heading'leri, orphan caption'lar, nested table'lar ve anchored figure'lar
object-specific caption structure production sonucuna dÃ¶nÃ¼ÅŸmez. Ã‡ok seviyeli
numaralar metadata olarak korunur; sequence, 1'den baÅŸlama, skipped number ve
document-order numbering kararlarÄ± Ã¶nceki source audit gereÄŸi production kapsamÄ±
dÄ±ÅŸÄ±nda kalmaya devam eder.

## Tablo ve ÅŸekil baÅŸlÄ±ÄŸÄ± numaralandÄ±rmasÄ± kaynak kararÄ±

GÄ±da Teknolojisi Bitirme Tezi HazÄ±rlama KÄ±lavuzu 4.4 maddesi tablo ve ÅŸekil
baÅŸlÄ±klarÄ±nÄ±n konumunu, hizalamasÄ±nÄ±, satÄ±r aralÄ±ÄŸÄ±nÄ± ve metin iÃ§i atÄ±f
zorunluluÄŸunu aÃ§Ä±kÃ§a tanÄ±mlar. AynÄ± maddede verilen Ã¶rneklerde `Åekil 2.` ve
`Tablo 2.` biÃ§imi kullanÄ±lÄ±r. Resmi literatÃ¼r ve laboratuvar ÅŸablonlarÄ± da
`Tablo 1.` ve `Åekil 1.` Ã¶rneklerini iÃ§erir. Bu kaynaklar tablo/ÅŸekil
baÅŸlÄ±klarÄ±nÄ±n numaralÄ± gÃ¶sterildiÄŸini destekler; ancak `Tablo ve ÅŸekiller
numaralandÄ±rÄ±lmalÄ±dÄ±r` gibi ayrÄ± ve aÃ§Ä±k bir presence cÃ¼mlesi iÃ§ermez.

Bu nedenle bu sprintte ayrÄ± `OBJECT_CAPTION_NUMBERING` production kuralÄ±
eklenmemiÅŸtir. Mevcut caption normalizer yalnÄ±z paragraf baÅŸÄ±ndaki `Tablo
<decimal>.` ve `Åekil <decimal>.` biÃ§imlerini caption olarak normalize eder;
gÃ¼venilir top-level tablo veya inline ÅŸekil iÃ§in bu caption bulunmazsa mevcut
`OBJECT_CAPTION_PLACEMENT` kuralÄ± zaten baÅŸlÄ±k tespit edilemedi failure'Ä±
Ã¼retir. AyrÄ± number-presence rule'u aynÄ± eksikliÄŸi tekrar raporlama riski
taÅŸÄ±dÄ±ÄŸÄ±ndan production'a baÄŸlanmamÄ±ÅŸtÄ±r.

KÄ±lavuz veya ÅŸablonlar tablo/ÅŸekil numaralarÄ±nÄ±n 1'den baÅŸlamasÄ±nÄ±, ardÄ±ÅŸÄ±k
ilerlemesini, atlama yapmamasÄ±nÄ±, duplicate numara kullanmamasÄ±nÄ±, belge
sÄ±rasÄ±yla aynÄ± olmasÄ±nÄ±, bÃ¶lÃ¼m numarasÄ±na baÄŸlÄ± Ã§ok seviyeli sequence'i, eklerde
restart davranÄ±ÅŸÄ±nÄ± veya `Tablo A.1` gibi appendix/harfli/roman semantiklerini
aÃ§Ä±kÃ§a tanÄ±mlamaz. Bunlar production failure sebebi deÄŸildir.

Caption number metadata'sÄ± yine de generic altyapÄ± iÃ§in yeterlidir: her
`DocumentCaption` raw gÃ¶rÃ¼nÃ¼r metni, canonical label'Ä±, normalize `number`
deÄŸerini, paragraph order'Ä±nÄ± ve block order'Ä±nÄ± taÅŸÄ±r; tablo/ÅŸekil occurrence
association ise `captionId` Ã¼zerinden kurulur. Validatorlar raw XML okumamalÄ± ve
caption regex'ini kopyalamamalÄ±dÄ±r.

Duplicate caption number ownership mevcut `OBJECT_IN_TEXT_REFERENCE` kuralÄ±nda
kalÄ±r. AynÄ± tÃ¼r ve numaraya sahip birden fazla gÃ¼venilir nesne varsa reference
coverage gÃ¼venilir belirlenemez ve validator false PASS yerine ambiguity failure
Ã¼retir. AyrÄ± numbering kuralÄ± eklenmediÄŸi iÃ§in aynÄ± akademik problem ikinci kez
raporlanmaz.
## Table/Figure List Content Consistency Source Decision

Resmi bölüm sayfasında yayımlanan Gıda Teknolojisi Bitirme Tezi Hazırlama
Kılavuzu ve iki resmi Word şablonu bu sprintte yeniden incelendi. Kaynaklar,
bitirme ödevinde tablo varsa `TABLOLAR LİSTESİ`, şekil varsa `ŞEKİLLER LİSTESİ`
bölümünün bulunmasını destekler. Bu gereklilik mevcut
`CONDITIONAL_REQUIRED_SECTION` kurallarıyla zaten modellenmiştir:

- `comu.applied-sciences.food-technology.bachelor.list-of-tables`
- `comu.applied-sciences.food-technology.bachelor.list-of-figures`

Aynı kaynaklar listelerdeki her girdinin gerçek object/caption ile birebir
eşleşmesini, belgedeki her tablo/şeklin listede bulunmasını, fazladan entry
yasağını, exact caption title eşitliğini, liste sırasını, duplicate entry
yasağını, noktalı leader kullanımını veya sayfa numarası doğruluğunu ayrı ve
yeterince güçlü bir production requirement olarak tanımlamaz. Bu nedenle ortak
Gıda Teknolojisi bachelor setine `OBJECT_LIST_CONSISTENCY` rule type'ı veya şu
production ID'ler eklenmemiştir:

- `comu.applied-sciences.food-technology.bachelor.table-list-consistency`
- `comu.applied-sciences.food-technology.bachelor.figure-list-consistency`

İki resmi DOCX şablonunun OOXML yapısı ayrıca kontrol edildi. Literatür
şablonunda `TABLOLAR LİSTESİ` paragraph 145, `ŞEKİLLER LİSTESİ` paragraph 147;
laboratuvar şablonunda sırasıyla paragraph 146 ve 148 olarak bulunur. Bu
paragraph'lar `GiriBalklar` stilindedir ve Word field içerir:
`TOC \h \z \c "Tablo"` ile `TOC \h \z \c "Şekil"`. Field result cache'inde görünür
liste entry'si yoktur; sonraki field-end paragraph boş, ardından `1.GİRİŞ`
heading'i gelir. Şablonlarda bu alanların otomatik field olarak bulunması
teknik bir örnektir; kılavuz manuel doğru listeyi reddeden veya Word field
kullanımını başarı koşulu yapan açık bir akademik şart kurmaz.

Gelecekte başka bir kaynak full coverage'i STRONG desteklerse generic model
`DocumentObjectListEntry` benzeri ayrı bir normalize nesneyle tasarlanmalıdır.
Entry identity yalnız `kind + number` üzerinden kurulmalı, list entry gerçek
caption olarak `document.captions` içine eklenmemeli ve parser yalnız ilgili
`Tablolar Listesi` / `Şekiller Listesi` section content'i içinde çalışmalıdır.
Missing list section failure'ı conditional presence kuralında kalmalı; content
validator aynı yokluğu ikinci kez raporlamamalıdır. Sayfa numarası doğruluğu Word
layout engine olmadan güvenilir hesaplanamayacağı için production kapsamına
alınmamalıdır; cached page text yalnız metadata olabilir.

## Table/Figure Source Attribution Source Decision

Bu sprintte Gıda Teknolojisi Bitirme Tezi Hazırlama Kılavuzu 4.4 maddesi ve iki
resmi Word şablonu tablo/şekil kaynak gösterimi açısından incelendi. Kılavuz,
şekil bir kaynaktan alındıysa kaynağın şekil isminin sonuna, tablo ve şekiller bir
kaynaktan alındıysa kaynağın tablo isminin sonuna yerleştirilmesini açıkça söyler
ve örnekleri `(Pomeranz, 1987)` biçiminde caption sonu citation olarak verir. Bu
akademik gereklilik yalnız dış kaynaktan alınan veya uyarlanan nesneler için
geçerlidir; öğrencinin kendi ürettiği her tablo/şekil için kaynak yazılması
gerektiğini söylemez.

İki resmi DOCX şablonunda örnek tablo başlığı `Tablo 1. Sağlıklı bir insanın
gastrointestinal kanal mikroflorası`, örnek şekil başlığı ise `Şekil 1.Bağırsak
Mikroflorasına Etki Eden Faktörler (Örnek Şekil Gösterimi)` olarak bulunur. Bu
caption'larda `(Kaynak: ...)` veya bibliyografik citation suffix yoktur. Şekilden
sonra ayrı source paragraph yoktur. Tablodan sonra gelen `*kob/ml: Koloni
oluşturan birim/ml` paragrafı tablo içi kısaltma/footnote açıklamasıdır; object
source attribution örneği değildir. Şablonlardaki parantezli şekil açıklaması da
source değil, örnek kullanım notudur.

Bu nedenle `OBJECT_SOURCE_ATTRIBUTION` veya table/figure source-note production
rule'u eklenmedi. Sebep akademik requirement'ın zayıf olması değil, applicability
bilgisinin DOCX/OOXML'de güvenilir olmamasıdır. `w:tbl`, `w:drawing`, `wp:inline`
ve `wp:anchor` nesnenin dış kaynaktan mı, öğrenci tarafından mı üretildiğini
belirleyen güvenilir provenance metadata'sı sağlamaz. Her nesnede citation arayan
bir validator, özgün öğrenci tabloları/şekilleri için false failure üretebilir.
Caption içinde yıl, parantez veya `Kaynak` kelimesi arayan heuristic'ler de normal
açıklamaları source sanabilir veya geçerli citation'ları kaçırabilir.

Kaynak gösteriminin formatına ilişkin production davranışı da genişletilmedi.
Kılavuz örneği `(Yazar, yıl)` biçimini destekler; `(Kaynak: ...)` exact syntax'ını,
ayrı source paragraph'ı, font/punto/alignment/spacing değerlerini veya tablo ile
şekil arasında farklı bir source-note davranışını zorunlu kılmaz. Missing caption,
caption konumu, caption formatı, object hizalaması ve metin içi atıf sorumlulukları
mevcut validatorlarda kalır; source attribution yokluğu bu sprintte production
failure değildir.
## References / Bibliography / In-Text Citation Source Decision

Bu sprintte Gıda Teknolojisi Bitirme Tezi Hazırlama Kılavuzu ve iki resmi Word
şablonu akademik kaynak gösterme sistemi açısından incelendi. Kılavuz tez
yapısında `KAYNAKLAR` bölümünü gösterir ve metin içinde atıf yapılan kaynakların
tez sonunda bu başlık altında listelenmesini ister. Bu presence requirement'ı
mevcut `comu.applied-sciences.food-technology.bachelor.references`
`REQUIRED_SECTION` kuralıyla zaten production'dadır. Bölüm sırası da experimental
ve source-research `SECTION_ORDER` listelerinde `Sonuç -> Kaynaklar -> Özgeçmiş`
relative sırasıyla zaten kapsanır; Ekler varsa Kaynaklar'dan sonra gelebilir.

Resmi kaynaklarda normatif başlık `KAYNAKLAR`/`Kaynaklar` olarak kullanılır.
`Kaynakça` veya `Referanslar` için resmi alias desteği bulunmadığından yeni alias
eklenmedi. Mevcut section matcher case/diacritic normalization ve manuel numbering
prefix desteğiyle bağımsız `Kaynaklar` heading'ini bulur; TOC cached entry'sindeki
`KAYNAKLAR` gerçek section occurrence sayılmaz.

Kılavuz ve şablonlar bibliography entry formatı için makale, kitap, kitap bölümü,
çevrimiçi erişim ve tez örnekleri verir. Örneklerde soyad ve isim baş harfi, yıl,
başlık, dergi/kitap adı, cilt/sayı/sayfa, DOI varsa DOI, çevrimiçi kaynaklarda
erişim adresi ve örnek erişim tarihi bulunur. Dergi adı, dergi cildi ve kitap adı
italic örneklenir. Kaynaklar için alfabetik/harf sırasına göre sıralama açıkça
desteklenir. Ancak bu örnekler her entry türünü güvenilir biçimde parse edecek
tek ve kapalı grammar oluşturmaz; DOI için `varsa` denir, URL ve erişim tarihi
yalnız çevrimiçi kaynak örneğinde yer alır.

Metin içi citation sistemi author-year biçimindedir: parantez içi
`(Yazar, yıl)`, anlatısal `Yazar (yıl)`, `vd.` / `ve ark.` örnekleri ve aynı
parantezde birden fazla kaynak kullanımına rastlanır. Numeric `[1]` sistemi resmi
kaynaklarda desteklenmez. Buna rağmen `IN_TEXT_CITATION_FORMAT` veya
`CITATION_BIBLIOGRAPHY_CONSISTENCY` production rule'u eklenmedi. Sebep akademik
requirement'ın zayıf olması değil, DOCX'teki raw paragraph text'ten citation ve
bibliography identity'sini false-positive/false-negative üretmeden normalize
etmenin bu sprintte production-safe olmamasıdır.

Bibliography/citation matching için önce ayrı normalize modeller gerekir; validator
global regex ile çalışmamalıdır. Gelecekte kaynakla ve fixture'larla güvenli hale
gelirse `DocumentCitation` ve `DocumentBibliographyEntry` benzeri modeller section
boundary, paragraph ID, raw text, authors, year ve title metadata'sını taşımalı;
entry extraction yalnız gerçek `Kaynaklar` section content'i içinde çalışmalı ve
`Ekler`/`Özgeçmiş` gibi sonraki section'da durmalıdır. Body citation extraction ise
caption, TOC, Tablolar Listesi, Şekiller Listesi, bibliography entry, object
reference, heading number, tek yıl `(2024)`, yüzde, tablo/şekil numarası ve normal
parantezleri citation saymamalıdır.

Bu sprintte `BIBLIOGRAPHY_ORDER`, `BIBLIOGRAPHY_FORMAT`,
`IN_TEXT_CITATION_FORMAT` ve `CITATION_BIBLIOGRAPHY_CONSISTENCY` rule type'ları
eklenmedi. Existing production ownership korunur: Kaynaklar yoksa
`REQUIRED_SECTION`, Kaynaklar yanlış relative sıradaysa `SECTION_ORDER` raporlar.
Entry formatı, alfabetik sıralama, hanging indent, paragraph spacing, DOI/URL,
italic kullanımı, yazar gösterimi, metin içi citation formatı ve iki yönlü
citation-bibliography coverage bu rule setinde production failure değildir.
## Hierarchical Heading Formatting Source Decision

Gıda Teknolojisi kılavuzunun 4.2 maddesi metnin tamamı için Times New Roman 12
puntoyu; ana ve alt başlıklar için kalın yazımı destekler. 4.6 başlık örnekleri
ve Ek-7 içindekiler yapısı akademik ana bölümlerin `1.`, alt bölümlerin `1.1.`,
alt-alt bölümlerin `1.1.1.` benzeri hiyerarşik numbering ile yazılabileceğini
gösterir. Bu kaynaklar heading font family, font size ve bold için güçlü destek
sağlar; uppercase, alignment, spacing before/after, heading line spacing,
indentation, keep-next, keep-lines, page-break-before, başlık sonu nokta ve
numbering-text arası boşluk için ayrı production requirement gücüne ulaşmaz.

Bu sprintte generic `HEADING_LEVEL_FORMAT` rule type'ı eklendi, fakat yalnız
production-safe identity kurulabilen akademik ana body heading'leri için
etkinleştirildi. Ortak Gıda Teknolojisi bachelor setindeki
`comu.applied-sciences.food-technology.bachelor.body-level-0-heading-format`
rule'u level 0 olarak güvenilir tanınan `Giriş`, `Genel Bilgiler ve Literatür
Çalışması`, `Materyal ve Metot`, `Bulgular ve Tartışma`, `Genel Bilgiler` ve
`Sonuç` heading occurrence'larında Times New Roman, 12 punto ve kalın yazımı
doğrular.

Validator style ID'yi akademik doğruluk kabul etmez. Her bulunan paragraph için
run direct formatting, paragraph style, basedOn chain ve document defaults
üzerinden mevcut `EffectiveFormattingResolver` ile effective font family, font
size ve bold değerlerini çözer. Bir heading'de birden fazla görünür run varsa
hepsi değerlendirilir; tek yanlış run aggregate rule sonucunu `FAILED` yapar.
Direct font family veya font size style'dan önceliklidir. Mevcut run modeli direct
`bold=false` ile bold bilgisinin hiç yazılmaması arasındaki tüm OOXML varyantlarını
ayırmaz; ancak style/default zincirinde bold yoksa bold eksikliği failure üretir.

Alt ve alt-alt başlıklar için ayrı production rule eklenmedi. Resmi DOCX
şablonlarında `2.1.`, `2.2.1.` gibi örnekler bulunur; ancak konuya özgü child
heading adları university JSON'da önceden bilinemez ve yalnız numbering level
metadata'sına dayanmak normal numbered list, body paragraph prefix'i, bibliography
entry veya başka non-heading içerikleri academic heading sanma riski taşır. Bu
false-positive problemi çözülmeden level 1/2 formatting production'a alınmadı.

Missing section, duplicate section veya yanlış numbering level bu rule'un
sorumluluğu değildir. Section yoksa `REQUIRED_SECTION`, yanlış sıradaysa
`SECTION_ORDER`, numbering yoksa veya yanlış level ise `HEADING_NUMBERING` raporlar.
`HEADING_LEVEL_FORMAT` yalnız tekil bulunan, güvenilir biçimde beklenen level'da
numaralandırılmış heading occurrence'larını değerlendirir; hiç böyle heading yoksa
`NOT_APPLICABLE` olur.

## Section Start / Page Break Source Decision

Gıda Teknolojisi kılavuzu ön sayfalar, `Giriş`, akademik ana bölümler,
`Kaynaklar`, varsa `Ekler` ve `Özgeçmiş` başlıklarını tez yapısında ve Ek-7
içindekiler örneğinde gösterir. Ancak kılavuz bu başlıkların her birinin veya
tüm ana bölümlerin açıkça "yeni sayfadan başlaması" gerektiğini söylemez; tek/çift
sayfa, recto/right-hand page, section break zorunluluğu veya explicit page break
zorunluluğu da tanımlamaz.

Resmi literatür ve laboratuvar DOCX şablonları OOXML seviyesinde incelendiğinde
çok sayıda bölüm geçişinin önceki paragrafın `w:pPr/w:sectPr` yapısıyla ve
`w:type` yazılmadığı için OpenXML varsayılanı olan `nextPage` section break ile
kurulduğu görülür. Örnekler arasında `Kabul ve Onay`, `Teşekkür`, listeler,
`Giriş`, bazı body ana bölümleri ve `Kaynaklar` bulunur. Buna karşılık
`pageBreakBefore` veya önceki run içinde `w:br w:type="page"` şablonlarda
gözlenmedi; bazı başlıklar yalnız boş paragraflar veya doğal akışla ayrılmıştır.

Bu nedenle bu sprintte `SECTION_PAGE_START`, `SECTION_START` veya benzeri bir
production rule type eklenmedi. Karar akademik requirement'ın imkansız olması
değil, source strength ve teknik gözlemlenebilirliğin production-safe failure için
birlikte yeterli olmamasıdır. Şablondaki `sectPr` uygulama detayı akademik
zorunluluk kabul edilmez; ayrıca explicit OOXML boundary yoksa Word layout motoru
olmadan heading'in doğal sayfa taşmasıyla yeni sayfaya gelmediği güvenilir biçimde
bilinemez.

Gelecekte kaynak açık "yeni sayfa" hükmü veya kurum tarafından onaylı fixture
beklentisi sağlanırsa page-boundary bilgisi validator içinde raw XML aranarak
değil, paragraph/body seviyesinde normalize edilen generic metadata üzerinden
değerlendirilmelidir. `w:pageBreakBefore`, önceki paragraftaki
`w:br w:type="page"` ve önceki paragraph `sectPr` türleri tek source of truth ile
çözülmeli; `continuous` section break yeni sayfa kabul edilmemeli, `oddPage` ve
`evenPage` ise explicit boundary ama ayrıca tek/çift sayfa semantiği olarak
korunmalıdır. Missing, duplicate, numbering ve heading-format failure ownership'i
mevcut rule'larda kalmalıdır.
