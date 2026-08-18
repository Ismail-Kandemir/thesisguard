# Gıda Teknolojisi

Bu klasörde Uygulamalı Bilimler Fakültesi Gıda Teknolojisi bölümünün doğrulanmış
kural setleri tutulur.

Kaynak: Çanakkale Onsekiz Mart Üniversitesi, Gıda Teknolojisi Bitirme Tezi
Hazırlama Kılavuzu.

Kılavuzun 4.1 maddesi üst ve sol kenar boşluğunu 3 cm, sağ ve alt kenar
boşluğunu 2,5 cm olarak tanımlar. Genel ÇOMÜ setindeki 2,5 cm üst margin değeri
bu department kapsamında 3 cm ile override edilir. 4.2 maddesi bitirme projesi
metninin tamamını Times New Roman 12 punto tanımlar ve ana/alt başlıklar için
yalnız kalın yazım şartı getirir. Bu nedenle genel setteki 14 punto Heading1
değeri burada 12 punto, kalın olarak override edilir. Heading2 ve Heading3
zaten 12 punto olduğundan değiştirilmez.

Kılavuzun iki çalışma türü için verdiği yapıda `KABUL VE ONAY SAYFASI` ortak ve
zorunludur. Ek-4 ile resmi literatür ve laboratuvar şablonlarında görünür heading
`KABUL VE ONAY` olduğundan rule canonical `Kabul ve Onay Sayfası` ve alias
`Kabul ve Onay` kullanır. Kontrol yalnız bağımsız heading presence'ını doğrular;
jüri üyeleri, danışman, imza veya imza gerçekliği, tarih, öğrenci bilgileri,
Turnitin sonucu/oranı, sayfa içeriğinin eksiksizliği ve görsel şablona birebir
uygunluk kapsam dışıdır.

Deneysel ve kaynak araştırması SECTION_ORDER kuralları aynı canonical/alias
çiftini kullanarak bulunan bölümlerde `İntihal (Aşırma) Beyan Sayfası` → `Kabul
ve Onay Sayfası` → `Teşekkür` relative sırasını denetler. Kabul ve Onay yoksa
order kuralı ayrıca hata üretmez; yokluk ortak `acceptance-approval`
REQUIRED_SECTION kuralının, yanlış ya da belirsiz sıra SECTION_ORDER kuralının
sorumluluğudur.

bachelor.json, kılavuzda doğrulanan sayfa numarasının zorunlu, alt bilgide ve
ortalanmış olması kuralıyla İçindekiler bölümünün bulunması kuralını içerir.
Kılavuz Word TOC field kullanımını zorunlu tutmadığından bu teknik yapı
üniversite kuralının başarı koşulu değildir.

Aynı rule set, kılavuzda tez yapısının parçası olan Kaynaklar bölümünün
bulunmasını da doğrular. Bu kural APA uygunluğunu, kaynakların biçimini veya
metin içi atıfları kontrol etmez.

Kılavuzdaki `ÖZET` ve `ABSTRACT` başlıklarına dayanarak Türkçe ve İngilizce
özet bölümlerinin varlığı da ayrı required-section kurallarıyla doğrulanır.
Bu kurallar özet uzunluğunu, kelime sayısını, anahtar kelimeleri, içerik
doğruluğunu, başlık fontunu veya özet biçimlendirmesini kontrol etmez.

Deneysel ve teorik/kaynak araştırması çalışmalarının ikisinde de ortak ve
zorunlu olan `İNTİHAL (AŞIRMA) BEYAN SAYFASI`, `TEŞEKKÜR`, `GİRİŞ`, `SONUÇ` ve
`ÖZGEÇMİŞ` başlıkları da ayrı required-section kurallarıyla doğrulanır. Bu
kurallar yalnızca bağımsız bölüm başlığının varlığını kontrol eder; bölüm
içeriğini, sırasını veya biçimini değerlendirmez.

İntihal beyanı kontrolü gerçek intihal oranını, Turnitin sonucunu, imzayı veya
beyan içeriğinin doğruluğunu değerlendirmez. Özgeçmiş kontrolü de yalnızca
bölüm varlığını doğrular; özgeçmiş içeriğini ya da şablon uygunluğunu incelemez.

Kılavuz, deneysel ve teorik/kaynak araştırması çalışmalarının ikisinde de
`TABLOLAR LİSTESİ` bölümünü bitirme ödevinde tablo varsa, `ŞEKİLLER LİSTESİ`
bölümünü ise bitirme ödevinde şekil varsa eklenmesi gereken bölüm olarak
tanımlar. Bu nedenle ortak `bachelor.json` setinde iki
`CONDITIONAL_REQUIRED_SECTION` kuralı bulunur:

- `comu.applied-sciences.food-technology.bachelor.list-of-tables`
- `comu.applied-sciences.food-technology.bachelor.list-of-figures`

Koşullar normalize edilmiş DOCX OOXML yapısına dayanır: tablo için body
`word/document.xml` içindeki gerçek `w:tbl`, şekil için gerçek `w:drawing`
varlığı kullanılır. Normal metinde geçen `Tablo` veya `Şekil` ifadeleri koşulu
tetiklemez. Bu kurallar liste içeriğinin doğruluğunu, sayfa numaralarını,
caption yapılarını, tablo/şekil numaralandırmasını veya görsel içeriğini
kontrol etmez.

Kılavuzdaki `SİMGELER VE KISALTMALAR LİSTESİ` bölümü de tezde kısaltma kullanımı
tespit edildiğinde ortak `bachelor.json` setindeki
`comu.applied-sciences.food-technology.bachelor.list-of-abbreviations`
conditional kuralıyla aranır. Koşul, normalize edilmiş belgenin heuristic
`hasAbbreviations` fact'ine dayanır; rule'a kaynakla desteklenmeyen alias
eklenmemiştir.

Bu rule yalnız bağımsız bölüm başlığının varlığını doğrular. Listedeki tüm
kısaltmaların eksiksizliğini veya açıklamalarını, alfabetik sırayı, metin ile
listenin birebir eşleşmesini, sembollerin semantik doğruluğunu ya da ilk
kullanımda açılım verilmesini değerlendirmez. Heuristic fact kesin ve eksiksiz
bir dilbilimsel kısaltma analizi değildir.

Generic `ABBREVIATION_LIST_CONSISTENCY` validator altyapısı hazırdır fakat bu
rule setinde etkin değildir. Resmi kılavuz “Eğer kısaltmalar kullanılıyorsa
listesi yapılmalıdır” diyerek section presence şartını destekler; body'deki tüm
kısaltmaların listede eksiksiz bulunmasını ayrı bir akademik gereklilik olarak
yeterince açık tanımlamaz. 4.7 Kısaltmalar bölümü ilk kullanımda açılım verme
kuralıdır ve liste coverage şartı değildir.

Koşulu karşılanmayan conditional sonuçlar `NOT_APPLICABLE` olur; PASS veya FAIL
sayılmaz ve score denominator'a dahil edilmez.

## Tez düzeyi ve çalışma türü

`bachelor`, akademik tez düzeyidir. `experimental` (Deneysel Çalışma) ve
`source-research` (Teorik / Kaynak Araştırması) çalışma metodolojisidir; tez
düzeyi ile çalışma metodolojisi aynı kavram değildir.

İki metodolojinin ortak kuralları `bachelor.json` dosyasında kalır.
`bachelor/experimental.json` ve `bachelor/source-research.json` bu ortak seti
`extends` eden child rule setlerdir. Experimental child seti yalnız Deneysel
Çalışma için zorunlu olan Genel Bilgiler ve Literatür Çalışması, Materyal ve
Metot, Bulgular ve Tartışma bölümlerini doğrular. Bu üç kural Teorik / Kaynak
Araştırması tezlerine uygulanmaz ve source-research child setinde yer almaz.

Kontrol yalnız bağımsız section başlığının varlığını değerlendirir; içerik
kalitesi, bölümlerin sırası veya bilimsel uygunluk doğrulanmaz.

Source-research child setindeki `Genel Bilgiler` bölümü yalnız Teorik / Kaynak
Araştırması için zorunludur ve Deneysel Çalışma analizine uygulanmaz. Bu kontrol
de yalnız section varlığını değerlendirir. Kılavuzdaki “Ana ve Alt Bölümler”
ifadesi konuya göre oluşturulacak yapıyı tarif ettiğinden sabit bir
`REQUIRED_SECTION` olarak modellenmemiştir.

## Bölüm sırası

Experimental ve Source Research child setleri farklı `SECTION_ORDER` kuralları
kullanır. Her kural yalnız seçilen çalışma türüne ait, kılavuzdan doğrulanan
zorunlu bölümlerin relative sırasını denetler. Missing section kontrolü
`REQUIRED_SECTION` kurallarına aittir; order validator yalnız bulunan expected
bölümleri karşılaştırır.

Simgeler ve Kısaltmalar, Tablolar, Şekiller ve Ekler gibi koşullu bölümlerin
yokluğu order hatası değildir. Dış Kapak ve İç Kapak listelere alınmaz; Kabul
ve Onay canonical ad ve resmi alias ile order listelerinde yer alır.
“Ana ve Alt Bölümler” sabit görünür bir başlık değildir. Bu doğrulama içerik
kalitesini, bilimsel uygunluğu veya bölüm numaralandırmasını değerlendirmez.

## Özet kelime sayısı

Kılavuz Türkçe Özet için en fazla 200 kelime sınırı tanımlar ve Türkçe Özet
kurallarının İngilizce Özette de geçerli olduğunu belirtir. Bu nedenle ortak
`bachelor.json` seti hem `Özet` hem `Abstract` için ayrı
`SECTION_WORD_COUNT` kuralları içerir; iki çalışma türü de bu kuralları alır.

Kelime sayımı yalnız heading'den sonraki görünür section içeriğine uygulanır.
Heading ve sonraki section'ın heading/içeriği sayıma dahil edilmez. Kontrol
içerik kalitesini, bilimsel uygunluğu, dili veya anahtar kelimeleri doğrulamaz.

## Özet ve Abstract anahtar kelimeleri

Ortak `bachelor.json` setindeki iki `SECTION_KEYWORDS` kuralı Özet sonunda
`Anahtar Kelimeler:`, Abstract sonunda `Keyword:` label'ını ve aynı paragrafta
virgülle ayrılmış 3–5 görünür entry'yi doğrular. Label paragrafından sonraki boş
paragraflar kabul edilir; aynı section içindeki görünür devam metni placement
hatasıdır.

Duplicate keyword değerleri kaynakta ayrı bir akademik hata olarak
tanımlanmadığından görünür entry olarak sayılır. Keyword'lerin bilimsel
kalitesi, anlamı ve Türkçe/İngilizce semantik çeviri eşdeğerliği kontrol
edilmez. Mevcut 200 kelimelik `SECTION_WORD_COUNT` davranışı değiştirilmemiştir;
keyword satırı mevcut section kelime hesabına dahil olmaya devam eder.

## Ana bölüm numaralandırması

Çalışma türü child setleri kendi `HEADING_NUMBERING` kuralını taşır. Experimental
kural Giriş, Genel Bilgiler ve Literatür Çalışması, Materyal ve Metot, Bulgular ve
Tartışma ve Sonuç; Source Research kuralı Giriş, Genel Bilgiler ve Sonuç
başlıklarını level 0 numbered section olarak doğrular.

Kontrol manuel (`1. GİRİŞ`) ve Word automatic numbering'i aynı kabul eder.
Automatic numbering'de güvenilir `numId` ve level metadata'sı yeterlidir;
`visibleLabel=null` tek başına hata değildir. Missing bölüm varlık kurallarına
bırakılır, duplicate section güvenle doğrulanamadığı için failure olur.

Ön/arka bölüm başlıkları ve Kaynaklar numbering kapsamı dışındadır. Heading2 ve
Heading3 örnekleri, exact noktalama, sequence, skipped number, parent-child
hiyerarşisi ve maksimum depth production requirement'a dönüştürülmemiştir. TOC
cached entry'leri, normal numbered listeler ve body cümleleri academic heading
olarak değerlendirilmez.

## Sayfa numarası biçim sırası

Ortak `bachelor.json` setindeki `PAGE_NUMBER_SEQUENCE` kuralı, ön sayfalarda
küçük Romen rakamı kullanılmasını ve `Giriş` bölümünün bulunduğu Word bölümünde
Arap rakamlarına geçilerek numaranın 1'den yeniden başlatılmasını doğrular.
Kural hem Experimental hem Source Research seçimlerine miras kalır.

`Giriş` bulunmazsa eksik bölüm hatası tekrarlanmaz ve sonuç `NOT_APPLICABLE`
olur. Birden fazla Giriş occurrence'ı güvenli geçiş seçilemediği için `FAILED`
olur. Manuel `1. GİRİŞ` prefix'i ile prefix'siz/Word automatic heading aynı ortak
section matcher üzerinden eşleşir; TOC cached entry'leri occurrence değildir.

## Tablo ve şekil başlığı production kuralları

Ortak bachelor seti dört caption rule'u taşır:

- `table-caption-placement`: tablo başlığı üstte.
- `figure-caption-placement`: şekil başlığı altta.
- `table-caption-format`: sola yaslı, 1 satır.
- `figure-caption-format`: sola yaslı, 1 satır.

Placement document-order association sonucunu kullanır; validator raw XML veya
caption regex'i çalıştırmaz. Nested table ve anchored figure teknik olarak
güvenilir placement sunmadığından akademik violation olarak raporlanmaz. Missing
ve ambiguous caption güvenilir inline/top-level occurrence için placement
failure'dır.

Format validator yalnız ilişkilendirilmiş caption paragraph'larını effective
style inheritance ile değerlendirir. Caption yokluğu placement failure'ı iken
format sonucu `NOT_APPLICABLE` olur. Caption style ID, font, punto, bold ve italic
bu kuralların kapsamında değildir.

## Metin içi tablo ve şekil atıfları

`table-in-text-reference` ve `figure-in-text-reference` kuralları güvenilir
caption identity bulunan her nesne için caption/list/TOC/heading dışındaki metin
paragraflarında aynı tür ve numarayı arar. `Tablo 1`, `Tablo 2.1’de`, `Şekil 1`
ve `Şekil 3.2'de` gibi doğal Türkçe kullanımlar desteklenir.

Reference konumu ve tekrar sayısı değerlendirilmez. Missing caption ayrı
placement sorumluluğudur; nested table ve anchored figure reference kapsamına
alınmaz. Duplicate aynı tür caption numarası false PASS yerine ambiguity failure
üretir.
