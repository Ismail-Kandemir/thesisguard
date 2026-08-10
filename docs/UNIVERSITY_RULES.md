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
için zorunlu değildir. Yeni klasör iskeleti doğrulanmamış JSON kuralı içermez.
