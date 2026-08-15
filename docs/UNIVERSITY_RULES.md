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
Dış/İç Kapak ve Kabul ve Onay mevcut section-presence modeliyle güvenilir
biçimde temsil edilmediğinden order listelerine dahil edilmemiştir. “Ana ve Alt
Bölümler” de sabit bir başlık olmadığı için source-research listesinde yoktur.

Validator içerik kalitesini, bilimsel uygunluğu veya bölüm numaralandırmasını
kontrol etmez.

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
