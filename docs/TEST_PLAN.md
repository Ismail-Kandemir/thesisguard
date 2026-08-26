## Occurrence-aware heading numbering

## Experimental 46/46 golden DOCX regression

The COMU / Applied Sciences / Food Technology / Bachelor / Experimental
golden DOCX is the manually verified full-correct fixture for the complete
runtime contract:

- total rules: 46
- passed: 46
- failed: 0
- not applicable: 0
- score: 100

Fixture path:

`tests/fixtures/comu/food-technology/experimental/full-correct.docx`

The verified source file name is
`thesisguard-comu-food-tech-experimental-46-of-46-full-correct.docx`.
Copy that binary to the fixture path as `full-correct.docx`. Do not place
the binary under `src/`, and do not edit it as source code.

Regression command:

`npm run test:golden`

The command runs the real DOCX package through the production-equivalent
analysis pipeline: DOCX package reader, XML parsers, numbering/object/
abbreviation/heading normalization, `RuleSetSelector`, `RuleResolver`,
`RuleEngine`, and `ReportBuilder`. It asserts:

- Experimental resolved rules and engine results are both 46.
- Source Research resolves 44 rules.
- Common Food Technology resolves 41 rules.
- missing validator count is 0.
- duplicate resolved IDs and duplicate result IDs are 0.
- resolved rule IDs and result rule IDs match exactly.
- all 46 results are `PASSED`.
- score is 100.

Critical coverage includes typography, line spacing, paragraph alignment,
paragraph indentation, Heading1/2/3, heading alignment, experimental heading
numbering, all table object/caption/reference/list rules, all figure
object/caption/reference/list rules, and `Simgeler ve Kısaltmalar Listesi`.

Fixture facts are also asserted where the production model exposes them:
tables, figures, abbreviations, `DNA`, Heading2/Heading3 occurrences,
`Tablolar Listesi`, `Şekiller Listesi`, and
`Simgeler ve Kısaltmalar Listesi`.

Golden fixture failing after a production change is evidence to investigate;
the fixture must not be changed merely to make the test green. The fixture
should be intentionally updated only when the academic rule set or production
parser contract changes deliberately, and the new real DOCX runtime has been
manually verified.

The script also runs small deterministic negative regression smoke checks for
wrong table alignment, wrong figure caption side, missing figure reference,
missing abbreviation list with academic `DNA`, wrong Heading2 font, and wrong
paragraph first-line indentation. These smoke checks do not replace the real
DOCX package-level golden test.

---

Senaryo Beklenen

---

Manual main heading level 0 PASSED

Word ilvl 0 main heading PASSED

Manual/Word same level Aynı akademik sonuç

Known heading unnumbered FAILED

Known heading wrong FAILED
`numberingLevel`

Missing configured section Duplicate numbering failure yok

Duplicate configured section Numbering ikinci failure üretmez;
benzersiz diğerleri değerlendirilir

Normal numbered list / numeric Validator input'u değil
prose

TOC / caption / bibliography entry Validator input'u değil

Wrong number + correct Yalnız numbering FAILED
format/alignment

Correct number + wrong format Yalnız format FAILED

Correct number + wrong alignment Yalnız alignment FAILED

Malformed expected config Deterministik configuration error

Immutability Headings/sections/rule expected
değişmez

Exact/skipped/duplicate/hierarchy Production kapsamında değil

---

## Heading occurrence ve alignment

---

Senaryo Beklenen

---

Rule-defined main heading level 0 occurrence

Manual `2.1.` / `2.1.1.` + heading level 1 / 2 occurrence
style

Word numbering ilvl 1 manual ile aynı level 1 semantic

Prefix taşıyan normal prose/list Occurrence değil

Caption / TOC / table-cell Occurrence değil

Unknown unnumbered heading-style Academic occurrence değil
paragraph

Level 0/1/2 left HEADING_ALIGNMENT PASSED

Style left + direct center FAILED

Style center + direct left PASSED

basedOn/default left PASSED

Alignment unresolved FAILED; left varsayılmaz

10 heading, biri center Aggregate FAILED, sınırlı örnek

Front matter center Excluded

Reliable heading yok NOT_APPLICABLE

Mixed visible run, biri 11 pt İlgili HEADING format rule FAILED

Style bold + direct bold false İlgili HEADING format rule FAILED

Immutability Document/rule/expected mutate
edilmez

Paragraph/block index Değişmez

---

## Remaining-rules audit regression

Bu auditte yeni validator eklenmedi. Runtime regression referansı:
`46 total / 44 evaluated / 44 passed / 0 failed / 2 N/A / %100`.

---

Audit senaryosu Beklenen

---

Heading 1/2/3 TNR12 bold Mevcut HEADING kuralları
sahiplenir; duplicate rule yok.

Heading style alignment null, Yeni style-only alignment failure
paragraph direct left üretilmez.

Heading before/after template Production spacing failure
varyasyonu üretilmez.

Body before/after metadata Normalize edilir; akademik rule
yok.

Body left/right metadata First-line rule ile karıştırılmaz;
akademik rule yok.

Table cell farklı alignment/spacing First-line rule'a girmez; mevcut
46-rule regression ayrıca izlenir.

Caption left + 1,0; body justify + Mevcut caption/body ownership
1,5 + 1,5 cm korunur.

Abstract özel görünüm Word count/keywords çalışır;
speculative formatting failure yok.

Bibliography grammar/hanging Speculative failure yok.

Object source suffix yok Nesnenin dış kaynaktan geldiği
gözlenemediğinden failure yok.

Missing optional Ekler Failure yok.

Registry / RuleEngine 46 resolved rule için missing
validator 0.

---

## Paragraph indentation ve spacing

---

Senaryo Beklenen sonuç

---

Direct veya inherited 850/851 twip `PASSED`

Style doğru + direct `0` `FAILED`; direct override korunur.

Missing/hanging/character indent False PASS yok, `FAILED`.

Çoklu body, biri yanlış Aggregate `FAILED`; sınırlı örnek
raporu.

Caption / heading / table cell / list / TOC Kapsam dışı.
/ figure

Özet/Abstract/Teşekkür/Kaynaklar/Özgeçmiş Ana-gövde kapsamı dışı.

Normal body reference Ana section içindeyse
değerlendirilir.

Akademik ana gövde yok `NOT_APPLICABLE`.

before/after direct/style/default Normalize edilir; production rule
yoktur.

Immutability / Registry / RuleEngine Mutation ve missing-validator yok.

---

## Table/Figure List Content Consistency Source-Audit Matrix

Bu sprintte `OBJECT_LIST_CONSISTENCY` production rule'u eklenmedi. Resmi
ÇOMÜ kaynakları tablo varsa `Tablolar Listesi`, şekil varsa
`Şekiller Listesi` section presence şartını destekler; full coverage,
phantom entry, exact title, order, duplicate entry, dot leader ve page
accuracy için STRONG requirement üretmez. Mevcut
`CONDITIONAL_REQUIRED_SECTION`, caption placement/format, object
alignment ve in-text reference davranışları korunur.

---

Kod Senaryo Beklenen sonuç

---

A Table yok Table list consistency
production sonucu yok; liste
presence koşulu
`Uygulanmadı`.

B Figure yok Figure list consistency
production sonucu yok; liste
presence koşulu
`Uygulanmadı`.

C Table var, Tablolar Conditional section
Listesi yok `Başarısız`; content
consistency duplicate
failure yok.

D Figure var, Şekiller Conditional section
Listesi yok `Başarısız`; content
consistency duplicate
failure yok.

E 1 table, actual Yeni production sonucu yok;
`Tablo 1`, list mevcut kurallar etkilenmez.
`Tablo 1`

F 1 figure, actual Yeni production sonucu yok;
`Şekil 1`, list mevcut kurallar etkilenmez.
`Şekil 1`

G Actual table 1,2,3; Full coverage source STRONG
list 1,2 olmadığı için yeni failure
yok.

H Actual figure 1,2,3; Eksik `Şekil 2` production
list 1,3 failure'ı yok.

I Actual table 1,2; list Phantom entry production
1,2,3 failure'ı yok.

J Actual figure 1; list Identity mismatch production
figure 2 failure'ı yok.

K List heading var, entry Presence rule `Başarılı`
yok olabilir; content rule yok.

L Actual caption identity Placement/reference
yok sorumluluğu korunur; list
failure yok.

M Ambiguous caption Placement/reference
ambiguity sahipliği korunur.

N Duplicate actual `OBJECT_IN_TEXT_REFERENCE`
identity false PASS vermemeli; list
rule yok.

O Duplicate list identity Duplicate entry akademik
rule'u yok.

P Multi-level `Tablo 2.1` Caption metadata korunur;
list coverage production
yok.

Q Actual `Tablo 1`, Numbering sequence failure
`Tablo 3`; list aynı yok.

R Caption title farklı, Exact title production
number aynı failure'ı yok.

S Page number yanlış Page accuracy Word layout
olmadan güvenilir değil;
production failure yok.

T Manual list Otomatik field zorunlu
olmadığı için reddedilmez.

U Word-generated field Field cache görünür entry
list olarak incelenebilir;
production rule yok.

V Stale field cache Değerli runtime fixture; bu
sprintte failure üretmez.

W TOC entry Object-list entry veya body
reference sayılmamalı.

X Body reference List entry sayılmamalı.

Y Actual caption List entry gerçek caption
olarak normalize edilmemeli.

Z Orphan caption Object coverage'a
sokulmamalı.

AA Nested table Kaynak/identity belirsizliği
nedeniyle list coverage
failure yok.

AB Anchored figure Association belirsizse
coverage failure yok.

AC Wrong-kind entry Production failure yok;
gelecekteki parser section
içinde kind ayırmalı.

AD Caption placement Mevcut placement sonuçları
regression değişmemeli.

AE Caption format Mevcut format sonuçları
regression değişmemeli.

AF Object alignment `OBJECT_ALIGNMENT` sonuçları
regression değişmemeli.

AG In-text reference List/TOC/caption exclusion
regression korunmalı.

AH Conditional lists Existing presence rules
regression değişmemeli.

AI Section matcher `Tablolar Listesi` /
regression `Şekiller Listesi` heading
detection korunmalı.

AJ Registry Yeni list-consistency
validator kaydı beklenmez.

AK RuleEngine Missing-validator sonucu
yok; çünkü production rule
eklenmedi.

AL RuleResolver Experimental 43, Source
Research 41 kalmalı.

AM RuleSetSelector Child inheritance ve
isolation değişmemeli.

AN Immutability Document/rule inputları
mutate edilmemeli.

---

# ThesisGuard Test Plan

## Table/Figure Caption Structure Source-Audit Matrix

Bu sprintte ayrÄ± `OBJECT_CAPTION_STRUCTURE` production rule'u
eklenmedi. KÄ±lavuz ve resmi ÅŸablonlar `Tablo 1. BaÅŸlÄ±k` /
`Åekil 1. BaÅŸlÄ±k` gÃ¶rÃ¼nÃ¼r yapÄ±sÄ±nÄ± destekleyen Ã¶rnekler verir;
ancak exact label, separator, title presence, single paragraph,
capitalization, alias yasaÄŸÄ± veya title uzunluÄŸu iÃ§in ayrÄ± STRONG
production requirement tanÄ±mlamaz. Mevcut caption parser davranÄ±ÅŸÄ±
korunur.

---

Kod Senaryo Mevcut parser sonucu Production beklentisi

---

A `Tablo 1. SonuÃ§lar` Caption: table, Mevcut
number `1` placement/format/reference
kurallarÄ± deÄŸerlendirir;
ayrÄ± structure failure yok.

B `Åekil 1. Sistem` Caption: figure, AynÄ±.
number `1`

C `Tablo 1.` Caption: table, Title presence STRONG
number `1` olmadÄ±ÄŸÄ± iÃ§in ayrÄ±
structure failure yok.

D `Åekil 1.` Caption: figure, AynÄ±.
number `1`

E `Tablo 1 SonuÃ§lar` Caption deÄŸil Placement missing-caption
failure Ã¼retebilir;
punctuation structure rule
yok.

F `Åekil 1 Sistem` Caption deÄŸil AynÄ±.

G `Tablo 1: SonuÃ§lar` Caption deÄŸil Structure rule yok; parser
davranÄ±ÅŸÄ± deÄŸiÅŸmez.

H `Åekil 1: Sistem` Caption deÄŸil AynÄ±.

I `1. Tablo SonuÃ§lar` Caption deÄŸil Label-number order
production rule yok.

J `1. Åekil Sistem` Caption deÄŸil AynÄ±.

K `TABLO 1. SonuÃ§lar` Caption: table, Case-insensitive parser
number `1` davranÄ±ÅŸÄ± korunur;
capitalization failure yok.

L `tablo 1. SonuÃ§lar` Caption: table, AynÄ±.
number `1`

M `Ã‡izelge 1. SonuÃ§lar` Caption deÄŸil Alias support/yasak
production rule yok.

N `Figure 1. System` Caption deÄŸil AynÄ±.

O `Tablo 2.1. SonuÃ§lar` Caption: table, Multi-level number metadata
number `2.1` korunur; sequence rule yok.

P `Åekil 3.2. Sistem` Caption: figure, AynÄ±.
number `3.2`

Q `Tablo 1'de gÃ¶rÃ¼ldÃ¼ÄŸÃ¼ Ã¼zere...` Caption deÄŸil Body reference caption'a
dÃ¶nÃ¼ÅŸmez.

R `Åekil 1 incelendiÄŸinde...` Caption deÄŸil Body reference caption'a
dÃ¶nÃ¼ÅŸmez.

S Caption missing Caption yok Placement sorumluluÄŸu;
structure `NOT_APPLICABLE`
olmalÄ±ydÄ±, rule yok.

T Caption association ambiguous Ambiguous Placement failure;
association object-specific structure
rule yok.

U Orphan caption Orphan caption GerÃ§ek object yoksa
metadata'sÄ± object-specific rule
tetiklenmez.

V Nested table Count korunur, Akademik caption structure
top-level failure yok.
association yok

W Anchored figure Figure drawing type Association gÃ¼venilir
`anchor` deÄŸil; structure rule yok.

X Caption BEFORE table Placement mevcut KorunmalÄ±.
rule'a gÃ¶re  
 deÄŸerlendirilir

Y Caption AFTER figure Placement mevcut KorunmalÄ±.
rule'a gÃ¶re  
 deÄŸerlendirilir

Z Caption wrong placement Placement `FAILED` KorunmalÄ±.

AA Caption wrong formatting Format `FAILED` KorunmalÄ±.

AB Object alignment `OBJECT_ALIGNMENT` KorunmalÄ±.
ayrÄ± metadata  
 kullanÄ±r

AC In-text reference Caption/list/TOC KorunmalÄ±.
dÄ±ÅŸÄ± reference  
 tokenlarÄ±

AD Duplicate caption number/reference Reference validator KorunmalÄ±.
ambiguity false PASS vermez

AE Full-correct production smoke Yeni structure rule Experimental 43, Source
olmadÄ±ÄŸÄ± iÃ§in Research 41.
rule count  
 deÄŸiÅŸmez

AF Immutability Parser/validator KorunmalÄ±.
input mutate etmez

AG Registry Structure ID Missing-validator yok
kayÄ±tlÄ± deÄŸil Ã§Ã¼nkÃ¼ production rule
yok.

AH RuleEngine Yeni structure Mevcut behavior korunur.
result yok

AI Resolver inheritance Child JSON'larda Experimental 43, Source
duplicate yok Research 41.

---

## Generic OBJECT_ALIGNMENT ve GÄ±da Teknolojisi object centering

Bu matris caption alignment deÄŸil, gerÃ§ek tablo/ÅŸekil nesnesinin
yatay ortalanmasÄ± iÃ§indir. Caption format rule'u caption
paragraph'Ä±nÄ± sola yaslÄ± beklemeye devam eder.

---

Kod Senaryo Beklenen sonuÃ§

---

A Object yok Table/Figure object alignment `NOT_APPLICABLE`.

B Tek top-level table Table object alignment `PASSED`.
center

C Tek table left Table object alignment `FAILED`.

D Tek table right Table object alignment `FAILED`.

E 3 table, hepsi center Table object alignment `PASSED`.

F 3 table, biri left Table object alignment `FAILED`; sorunlu occurrence
mesajda listelenir.

G Table caption LEFT + Caption format `PASSED`; object alignment `PASSED`.
table CENTER

H Table caption CENTER + Object alignment `PASSED`; caption format `FAILED`.
table CENTER

I Table caption LEFT + Caption format `PASSED`; object alignment `FAILED`.
table LEFT

J Inline figure center Figure object alignment `PASSED`.
paragraph

K Inline figure left Figure object alignment `FAILED`.
paragraph

L Inline figure right Figure object alignment `FAILED`.
paragraph

M Figure center + caption Object alignment ve caption format `PASSED`.
LEFT

N Figure center + caption Object alignment `PASSED`; caption format `FAILED`.
CENTER

O Figure left + caption Object alignment `FAILED`; caption format `PASSED`.
LEFT

P Alignment style Table style veya figure paragraph style effective
inheritance center ise `PASSED`.

Q Direct alignment Direct value kullanÄ±lÄ±r.
style'Ä± override  
 ediyor

R Missing table caption + Object alignment caption'dan baÄŸÄ±msÄ±z `PASSED`;
centered table caption placement ayrÄ± deÄŸerlendirir.

S Missing figure Object alignment caption'dan baÄŸÄ±msÄ±z `PASSED`;
caption + centered caption placement ayrÄ± deÄŸerlendirir.
inline figure

T Anchored figure Teknik olarak belirlenemedi; false PASS yok, yalnÄ±z
anchored figure varsa `NOT_APPLICABLE`.

U Unknown drawing type Teknik olarak belirlenemedi; false PASS yok.

V Multiple drawings same Bireysel center gÃ¼venilir belirlenemediÄŸi iÃ§in
paragraph `unknown`; false PASS yok.

W Nested table Production object alignment kapsamÄ±na alÄ±nmaz;
yanlÄ±ÅŸ academic failure yok.

X Orphan caption Object alignment tetiklemez.

Y Body `Tablo 1'de` Object deÄŸildir.

Z Tablolar Listesi Object deÄŸildir.

AA TOC Object deÄŸildir.

AB Caption placement Table caption Ã¼stte, figure caption altta
regression davranÄ±ÅŸÄ± korunur.

AC Caption format Caption sola yaslÄ± + 1 satÄ±r davranÄ±ÅŸÄ± korunur.
regression

AD In-text reference Tablo 2 / Åekil 2 eksik atÄ±f fixture'Ä± yalnÄ±z
regression reference failure Ã¼retir.

AE Numbering audit Caption numbering sequence/start/skip production
regression rule'u eklenmez.

AF Section regression Required/order/word-count/keywords/heading-numbering
davranÄ±ÅŸlarÄ± korunur.

AG Body formatting Figure-only empty centered paragraph body alignment
regression failure Ã¼retmez.

AH Immutability Document, blocks, paragraphs, tables, figures,
captions, references, rule ve expected mutate edilmez.

AI Registry smoke Ä°ki production ID `ObjectAlignmentValidator` ile
kayÄ±tlÄ±dÄ±r.

AJ RuleEngine smoke Missing-validator sonucu yoktur.

AK Resolver Experimental 43, Source Research 41 rule resolve eder;
inheritance/isolation child JSON'larda duplicate yoktur.

AL Full-correct Object'ler gerÃ§ekten center ise 43 total / 42
Experimental fixture evaluated / 42 passed / 0 failed / 1 N/A beklenir.

---

## Table/Figure Caption Numbering Source-Audit Matrix

Bu sprintte ayrÄ± `OBJECT_CAPTION_NUMBERING` production rule'u
eklenmedi. Resmi kÄ±lavuz ve ÅŸablonlar numaralÄ± `Tablo n.` /
`Åekil n.` baÅŸlÄ±k Ã¶rneklerini destekler; fakat sequence, 1'den
baÅŸlama, skipped number, duplicate number, document-order consistency,
bÃ¶lÃ¼m bazlÄ± Ã§ok seviyeli numbering, appendix restart ve harfli/roman
numbering davranÄ±ÅŸlarÄ±nÄ± aÃ§Ä±kÃ§a tanÄ±mlamaz. Bu nedenle
aÅŸaÄŸÄ±daki matris manuel runtime testlerinde mevcut caption
placement/format/reference regression'Ä±nÄ± korumak ve yeni production
failure beklenmediÄŸini doÄŸrulamak iÃ§in kullanÄ±lÄ±r.

---

Kod Senaryo Beklenen sonuÃ§

---

A Object yok Caption
placement/format/reference
ilgili object iÃ§in
`NOT_APPLICABLE`; numbering
production rule yok.

B Tek `Tablo 1.` + Mevcut
gÃ¼venilir top-level placement/format/reference
table semantiÄŸine gÃ¶re
deÄŸerlendirilir; ayrÄ±
numbering failure yok.

C Tek `Åekil 1.` + Mevcut
gÃ¼venilir inline placement/format/reference
figure semantiÄŸine gÃ¶re
deÄŸerlendirilir; ayrÄ±
numbering failure yok.

D `Tablo 1.` -\> Sequence production
`Tablo 2.` kontrolÃ¼ yok; mevcut
kurallar bozulmamalÄ±.

E `Åekil 1.` -\> Sequence production
`Åekil 2.` kontrolÃ¼ yok; mevcut
kurallar bozulmamalÄ±.

F `Tablo 1.` -\> Kaynak sequence'i
`Tablo 3.` desteklemediÄŸi iÃ§in yeni
production failure yok.

G `Åekil 1.` -\> Kaynak sequence'i
`Åekil 3.` desteklemediÄŸi iÃ§in yeni
production failure yok.

H Ä°lk tablo `Tablo 2.` Start-at-1 production
kontrolÃ¼ yok.

I Ä°lk ÅŸekil `Åekil 2.` Start-at-1 production
kontrolÃ¼ yok.

J Duplicate `Tablo 1.` AyrÄ± numbering rule yok;
mevcut in-text reference
validator ambiguity varsa
false PASS vermeden `FAILED`
Ã¼retir.

K Duplicate `Åekil 1.` AyrÄ± numbering rule yok;
mevcut in-text reference
validator ambiguity varsa
false PASS vermeden `FAILED`
Ã¼retir.

L Reverse order Document-order numbering
`Tablo 2.` -\> production kontrolÃ¼ yok.
`Tablo 1.`

M Multi-level Caption normalizer `number`
`Tablo 2.1.` -\> metadata'sÄ±nÄ± korur;
`Tablo 2.2.` sequence inference yok.

N Mixed `Tablo 1.` -\> Integer sequence
`Tablo 2.1.` algoritmasÄ± uygulanmaz;
production failure yok.

O Body `Tablo 1'de` Caption sayÄ±lmaz; object
reference olarak normalize
edilebilir.

P Tablolar Listesi Caption/reference coverage
`Tablo 1` kaynaÄŸÄ± sayÄ±lmaz.

Q TOC cached entry Caption/reference/section
false-positive Ã¼retmemeli.

R Orphan `Tablo 1.` GerÃ§ek object sequence'e
caption girmez; object occurrence
yoksa ilgili kurallar
`NOT_APPLICABLE`.

S Nested table Count korunur; caption
association ve placement
gÃ¼venilir deÄŸilse akademik
numbering failure yok.

T Anchored figure Rendered layout tahmin
edilmez; ayrÄ± numbering
failure yok.

U Caption missing veya Mevcut placement gÃ¼venilir
numarasÄ±z `Tablo. ...` object iÃ§in baÅŸlÄ±k tespit
edilemedi failure'Ä±
Ã¼retebilir; ayrÄ± duplicate
numbering failure yok.

V Ambiguous caption Placement tarafÄ±ndan
association gÃ¼venli failure; numbering
production rule yok.

W Table/Figure sequence AyrÄ± sequence kontrolÃ¼
isolation yok; reference coverage
kind/number izolasyonu
korunur.

X Reference regression Tablo 2 ve Åekil 2 atÄ±fsÄ±z
fixture yalnÄ±z ilgili
reference rule'larÄ±nÄ± fail
etmeli.

Y Caption placement Table Ã¼stte PASS, figure
regression altta PASS;
missing/ambiguous gÃ¼venli
failure.

Z Caption format Sola yaslÄ± + 1 satÄ±r PASS;
regression bilinen fixture dÃ¶rt
caption failure
davranÄ±ÅŸÄ±nÄ± korur.

AA Full-correct Yeni numbering rule
Experimental regression olmadÄ±ÄŸÄ± iÃ§in baseline
toplam 41, deÄŸerlendirilen
40, baÅŸarÄ±lÄ± 40,
baÅŸarÄ±sÄ±z 0, uygulanmayan
1 kalmalÄ±.

AB Immutability Document, captions,
occurrences, references,
paragraphs, blocks, rule ve
expected mutate edilmemeli.

AC Registry smoke Yeni production ID
eklenmediÄŸi iÃ§in registry
mapping eklenmez; mevcut
ID'ler missing-validator
Ã¼retmemeli.

AD RuleEngine smoke Eksik validator davranÄ±ÅŸÄ±
deÄŸiÅŸmez; yeni numbering
result beklenmez.

AE Resolver inheritance Experimental 41, Source
Research 39 resolved rule
olarak kalmalÄ±.

---

## 1. Amaç

Bu dokümanın amacı, ThesisGuard analiz akışının gerçek DOCX dosyaları
kullanılarak manuel olarak doğrulanması için ortak bir test planı
tanımlamaktır. Plan; mevcut validator sonuçlarının tutarlılığını,
raporlanan değerlerin doğruluğunu ve üniversite kurallarına uygunluk
değerlendirmesini kapsar.

## 2. Test Stratejisi

- Testler manuel olarak yürütülür.
- Kontrollü içerik ve biçimlendirmeye sahip gerçek DOCX dosyaları
  kullanılır.
- Sonuçlar, seçili üniversitenin JSON tabanlı kuralları üzerinden
  doğrulanır.
- Her dosya analiz edildikten sonra özet değerleri ve validator
  sonuçları beklenen sonuçlarla karşılaştırılır.

## 3. Test Senaryoları

---

Validator Test Senaryosu Beklenen Sonuç

---

Font Family Tüm metin beklenen yazı Validator başarılı
tipiyle olmalıdır.
biçimlendirilmiştir.

Font Family En az bir metin bölümü Validator başarısız
farklı bir yazı tipi olmalı ve gerçek yazı
kullanır. tiplerini
raporlamalıdır.

Font Size Tüm metin beklenen Validator başarılı
punto değerindedir. olmalıdır.

Font Size En az bir metin bölümü Validator başarısız
farklı punto olmalı ve bulunan punto
değerindedir. değerlerini
raporlamalıdır.

Line Spacing Tanımlı stil satır Validator başarılı
aralıkları beklenen olmalıdır.
değerle aynıdır.

Line Spacing En az bir tanımlı stil Validator başarısız
farklı satır aralığı olmalı ve bulunan satır
kullanır. aralıklarını
raporlamalıdır.

Paragraph Alignment Tüm paragraflar Validator başarılı
beklenen biçimde iki olmalıdır.
yana yaslıdır.

Paragraph Alignment En az bir paragraf Validator başarısız
farklı hizalanmış veya olmalı ve bulunan
hizalaması hizalamaları
belirtilmemiştir. raporlamalıdır.

---

## 4. Test Dosyaları

### Klasör Yapısı

---

Klasör Amaç

---

`sample-documents/correct/` Mevcut validatorların tamamından
başarılı geçmesi beklenen tezleri
içerir.

`sample-documents/incorrect/` Bilinçli olarak tek bir doğrulama
hatası içeren tez gruplarını
barındırır.

`sample-documents/incorrect/font-family/` Yalnızca yazı tipi hatası içeren
tezleri barındırır.

`sample-documents/incorrect/font-size/` Yalnızca yazı boyutu hatası içeren
tezleri barındırır.

`sample-documents/incorrect/line-spacing/` Yalnızca satır aralığı hatası
içeren tezleri barındırır.

`sample-documents/incorrect/alignment/` Yalnızca paragraf hizalama hatası
içeren tezleri barındırır.

---

### Planlanan Dosyalar

---

Dosya Amaç

---

`sample-documents/correct/correct-thesis.docx` Mevcut tüm kurallara uygun bir
dokümanda bütün validatorların
başarılı olduğunu doğrulamak.

`sample-documents/incorrect/font-family/wrong-font.docx` Yalnızca yazı tipi uyumsuzluğunun
doğru tespit edildiğini doğrulamak.

`sample-documents/incorrect/font-size/wrong-font-size.docx` Yalnızca yazı boyutu uyumsuzluğunun
doğru tespit edildiğini doğrulamak.

`sample-documents/incorrect/line-spacing/wrong-line-spacing.docx` Yalnızca satır aralığı
uyumsuzluğunun doğru tespit
edildiğini doğrulamak.

`sample-documents/incorrect/alignment/wrong-alignment.docx` Yalnızca paragraf hizalama
uyumsuzluğunun doğru tespit
edildiğini doğrulamak.

---

Test dosyaları aynı temel içerikten türetilmeli; her olumsuz dosyada
yalnızca hedeflenen biçimlendirme özelliği değiştirilmelidir.

## 5. Beklenen Sonuçlar

---

Test Dosyası Font Family Font Size Line Spacing Paragraph
Alignment

---

`correct-thesis.docx` Başarılı Başarılı Başarılı Başarılı

`wrong-font.docx` Başarısız Başarılı Başarılı Başarılı

`wrong-font-size.docx` Başarılı Başarısız Başarılı Başarılı

`wrong-line-spacing.docx` Başarılı Başarılı Başarısız Başarılı

`wrong-alignment.docx` Başarılı Başarılı Başarılı Başarısız

---

Her testte rapordaki toplam, başarılı ve başarısız kural sayıları ile
uyumluluk skoru da validator sonuçlarıyla tutarlı olmalıdır.

## 6. Gelecek Testler

Aşağıdaki alanlar ilgili validatorlar geliştirildikten sonra ayrı olumlu
ve olumsuz DOCX senaryolarıyla plana eklenecektir:

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
- [ ] Git status kontrol edildi; kapsam dışı değişiklik bulunmadığı
      doğrulandı.
- [ ] Değişiklikler açıklayıcı bir mesajla commit edildi.
- [ ] Commit uzak depoya push edildi.

## 8. RuleResolver Test Senaryoları

Projede otomatik unit test altyapısı kurulana kadar aşağıdaki saf veri
senaryoları manuel olarak doğrulanacaktır:

---

Senaryo Beklenen sonuç

---

Sadece general rules Genel kurallar aynı sırada ve yeni
nesneler olarak döner.

General + faculty Genel kurallar fakülte
kurallarından önce çözülür.

General + department Genel kurallar bölüm kurallarından
önce çözülür.

General rule override Spesifik kuralın `overrides` ile
işaretlediği genel kural sonuçtan
çıkarılır.

Birden fazla override Spesifik kuralın işaretlediği tüm
genel kurallar sonuçtan çıkarılır.

Duplicate rule ID `RuleResolutionError` ile açık
configuration error üretilir.

Missing parent Bulunamayan extends referansı
`RuleResolutionError` üretir.

Extends cycle Döngünün yolunu içeren
`RuleResolutionError` üretilir.

Aynı input → aynı output Tekrarlanan çözümlemeler aynı rule
ID sırasını üretir.

Input immutability Rule set, rule, expected, scope ve
overrides nesneleri değişmez.

---

## 9. Akademik seçim test senaryoları

---

Senaryo Beklenen sonuç

---

ÇOMÜ + Uygulamalı Bilimler + Gıda Selector, `comu.bachelor` ve
Teknolojisi + Bachelor `comu.applied-sciences.food-technology.bachelor`
setlerini sağlar; resolver genel kurallara
PAGE_NUMBER kuralını ekler.

Bilinmeyen university Açık bir `AcademicSelectionError` üretilir;
fallback yapılmaz.

Bilinmeyen faculty Faculty kimliğini içeren açık bir
`AcademicSelectionError` üretilir.

Bilinmeyen department Department kimliğini içeren açık bir
`AcademicSelectionError` üretilir.

Desteklenmeyen thesis type Thesis type kimliğini içeren açık bir
`AcademicSelectionError` üretilir.

Selection verilmemesi AnalysisService yalnızca mevcut legacy/default
ÇOMÜ bachelor setini kullanır.

Selector ve resolver sorumluluk Selector rule içeriklerini merge veya override
ayrımı etmeden gerekli rule setleri döndürür; nihai kural
listesi yalnızca RuleResolver çağrısından sonra
oluşur.

---

### Çalışma türü seçim altyapısı

---

Senaryo Beklenen sonuç

---

Gıda Teknolojisi Bachelor Katalog `experimental` ve `source-research`
seçenekleri çalışma türlerini sunar.

Experimental seçimi Seçim geçerlidir ve experimental child rule set
seçilir.

Source research seçimi Seçim geçerlidir ve source-research child rule set
seçilir.

Zorunlu çalışma türü seçilmemiş UI analiz butonunu etkinleştirmez; doğrudan
selector kullanımı `AcademicSelectionError`
üretir.

Bilinmeyen çalışma türü Açık bir `AcademicSelectionError` üretilir;
fallback yapılmaz.

Experimental izolasyonu Dönen zincirde source-research seti bulunmaz.

Source research izolasyonu Dönen zincirde experimental seti bulunmaz.

Ortak department seti `comu.applied-sciences.food-technology.bachelor`
iki seçimde de gelir.

Ortak university seti `comu.bachelor` iki seçimde de parent olarak
gelir.

Üst seçim değişikliği University, organization, unit veya thesis type
değiştiğinde study type temizlenir.

Study type tanımlamayan katalog `studyTypeId` olmadan mevcut akademik seçim akışı
kaydı çalışabilir.

Selection verilmeden Legacy/default davranış korunur; çalışma türü
`analyzeDocx(file)` otomatik seçilmez.

---

## 10. Table of Contents detection test senaryoları

---

Senaryo Beklenen sonuç

---

`fldSimple` TOC `w:instr` değeri TOC komutuysa
field, `fldSimple` yapısıyla
normalize edilir.

Complex field TOC Tamamlanmış
begin/instrText/separate/end alanı
TOC olarak normalize edilir.

Birden fazla `instrText` düğümüne Aynı field kapsamındaki parçalar
bölünmüş TOC birleştirilir ve TOC komutu tespit
edilir.

TOC olmayan normal metin Metinde "TOC" bulunması field
üretmez.

"İçindekiler" başlığı var fakat TOC Başlık tek başına TOC olarak kabul
field yok edilmez.

PAGE field var fakat TOC yok `tableOfContents.hasField` false ve
fields boş olur.

TOC ve PAGE birlikte TOC document.xml'den, PAGE
header/footer parçalarından
birbirini etkilemeden tespit
edilir.

Bozuk veya eksik field yapısı Eksik begin/end, instrText olmayan
veya boş instruction içeren field
parser'ı çökertmez ve TOC üretmez.

TOC bulunmayan normal DOCX Analiz devam eder;
`tableOfContents.hasField` false ve
fields boş olur.

---

## 11. Generic RequiredSection test senaryoları

---

Senaryo Beklenen sonuç

---

Rule'da tanımlı section mevcut Normalize edilmiş tam isim eşleşir
ve validator başarılı olur.

Rule'da tanımlı section yok Required rule başarısız olur.

Türkçe karakter ve case varyasyonu `İÇİNDEKİLER`, `İçindekiler` ve
`icindekiler` aynı normalized name
ile eşleşir.

Heading stili olmayan bağımsız Paragraf metni tam eşleştiği için
başlık section bulunur.

Section kelimesini içeren body Normalize edilmiş tam isim
cümlesi eşleşmediği için false-positive
oluşmaz.

İki required section aynı belgede Her iki rule da aynı immutable
sections listesi üzerinden başarılı
olur.

Bir section var, diğeri yok Yalnız bulunan section'ın rule'u
başarılı olur.

İçindekiler section var, TOC field Required section başarılı;
yok `tableOfContents.hasField` false
olur.

TOC field var, İçindekiler heading `hasField` true kalır; İçindekiler
yok required section başarısız olur.

PAGE, sections ve TOC field Üç normalization/validation
birlikte davranışı birbirini etkilemez.

---

## 12. Türkçe ve İngilizce özet bölümleri

---

Senaryo Beklenen sonuç

---

Türkçe Özet mevcut `summary-tr` rule başarılı olur.

Türkçe Özet yok Yalnız `summary-tr` rule başarısız
olur.

Abstract mevcut `summary-en` rule başarılı olur.

Abstract yok Yalnız `summary-en` rule başarısız
olur.

Özet ve Abstract birlikte İki required-section rule da
başarılı olur.

Yalnız Özet var Türkçe rule başarılı, İngilizce
rule başarısız olur.

Yalnız Abstract var İngilizce rule başarılı, Türkçe
rule başarısız olur.

Body cümlesinde "Bu çalışmanın Tam normalized-name eşleşmesi
özeti..." yazıyor olmadığı için Özet section
sayılmaz.

`ÖZET`/`Özet` ve Case normalizasyonuyla ilgili
`ABSTRACT`/`Abstract` varyasyonları section rule başarılı olur.

Özet, Abstract, İçindekiler ve Dört required-section rule
Kaynaklar birlikte birbirinden bağımsız şekilde
başarılı olur.

---

## 13. Gıda Teknolojisi ortak zorunlu bölümleri

Bu senaryolar deneysel ve teorik/kaynak araştırması çalışmalarının ikisi
için ortak olan İntihal (Aşırma) Beyan Sayfası, Teşekkür, Giriş, Sonuç
ve Özgeçmiş bölümlerine ayrı ayrı uygulanır.

---

Senaryo Beklenen sonuç

---

Her bölüm ayrı ayrı mevcut Yalnız ilgili required-section rule
başarılı olur.

Her bölüm ayrı ayrı yok Yalnız ilgili required-section rule
başarısız olur.

Heading style olmadan bağımsız Paragraf metni tam eşleştiği için
başlık ilgili rule başarılı olur.

Body cümlesinde bölüm adı geçiyor Tam normalized-name eşleşmesi
olmadığı için false-positive
oluşmaz.

Türkçe case/karakter varyasyonu Büyük/küçük harf ve desteklenen
Türkçe karakter normalizasyonuyla
ilgili rule başarılı olur.

Beş ortak bölüm birlikte mevcut Beş required-section rule da
birbirinden bağımsız şekilde
başarılı olur.

Mevcut Özet, Abstract, İçindekiler Önceki dört required-section rule
ve Kaynaklar bölümleri mevcut aynı davranışı korur.

---

## 14. Section heading body kapsamı regresyonu

---

Senaryo Beklenen sonuç

---

Center section heading + justify Section heading body kapsamından
body çıkarılır; alignment rule başarılı
olur.

Left section heading + justify body Section heading body kapsamından
çıkarılır; alignment rule başarılı
olur.

Section heading farklı font size + Body font-size rule başarılı olur.
doğru body font size

Section heading farklı font + doğru Body font-family rule başarılı
body font olur.

Section heading farklı line Body line-spacing rule başarılı
spacing + doğru body spacing olur.

Heading1--Heading3 paragrafları Mevcut style tabanlı body exclusion
davranışı korunur.

Boş paragraf Mevcut empty-paragraph exclusion
davranışı korunur.

Body cümlesinde "kaynaklar" geçiyor Tam section adı olmadığı için
rule-defined heading olarak
işaretlenmez ve body kapsamında
kalır.

Required section başlığı mevcut/yok `RequiredSectionValidator`
sonuçları değişmeden korunur.

---

## 15. Deneysel çalışma zorunlu bölümleri

---

Senaryo Beklenen sonuç

---

Experimental seçimi Üç experimental required-section
rule ortak 21 kurala eklenir;
toplam 24 kural çözülür.

Source research seçimi Experimental rule'lar dahil
edilmez; ortak 21 kural korunur.

Üç experimental section mevcut Üç rule da başarılı olur.

Bölümlerden her biri ayrı ayrı Yalnız eksik bölümün rule'u
eksik başarısız olur.

Türkçe karakter ve case varyasyonu Normalize edilmiş tam section adı
eşleşir.

Heading style olmayan bağımsız Tam section adı eşleştiği için rule
section başarılı olur.

Bölüm adı body cümlesinde geçiyor Tam isim eşleşmediğinden
false-positive oluşmaz.

Experimental section headinglerinde Başlıklar alignment, font-family,
farklı body formatı font-size ve line-spacing body
kapsamından çıkarılır.

Ortak kurallar Ortak 21 kural experimental ve
source-research seçimlerinde
korunur.

---

## 16. Teorik / kaynak araştırması zorunlu bölümü

---

Senaryo Beklenen sonuç

---

Source research seçimi Genel Bilgiler rule'u ortak 21
kurala eklenir; toplam 22 kural
çözülür.

Experimental seçimi Source-research Genel Bilgiler
rule'u dahil edilmez; toplam 24
kural korunur.

Genel Bilgiler mevcut Required-section rule başarılı
olur.

Genel Bilgiler yok Required-section rule başarısız
olur.

Türkçe karakter ve case varyasyonu Normalize edilmiş tam
`Genel Bilgiler` section adı
eşleşir.

Heading style olmayan bağımsız Tam section adı eşleştiği için rule
Genel Bilgiler başarılı olur.

Body cümlesinde "genel bilgiler" Tam isim eşleşmediğinden
geçiyor false-positive oluşmaz.

Genel Bilgiler headinginde farklı Başlık alignment, font-family,
body formatı font-size ve line-spacing body
kapsamından çıkarılır.

Ortak kurallar Ortak 21 kural iki çalışma türünde
de korunur.

Experimental kurallar Üç experimental rule değişmeden ve
yalnız experimental seçiminde
korunur.

---

## 17. Generic bölüm sırası doğrulaması

---

Senaryo Beklenen sonuç

---

Expected A → B → C / document A → B SECTION_ORDER başarılı olur.
→ C

Expected A → B → C / document A → C SECTION_ORDER başarısız olur ve
→ B ters ilişki mesajda belirtilir.

Expected section eksik, kalan Eksiklik REQUIRED_SECTION'a
relative order doğru bırakılır; SECTION_ORDER başarılı
olur.

Expected section eksik, kalan SECTION_ORDER başarısız olur.
relative order yanlış

Unknown section expected bölümler Unknown section yok sayılır ve
arasına giriyor SECTION_ORDER başarılı olur.

Türkçe case/karakter varyasyonu Ortak section normalization ile
eşleşir ve doğru sırada geçer.

Alias document section ile Alias, canonical section adına ait
eşleşiyor occurrence olarak değerlendirilir.

Heading style olmayan bağımsız Parser paragraph konumlarını
sectionlar koruduğu için sıra doğrulanır.

Expected section birden fazla Rastgele occurrence seçilmez;
occurrence içeriyor güvenli ve deterministik validation
failure üretilir.

Empty expected sections Açık SECTION_ORDER configuration
error üretilir.

Yanlış expected shape Açık SECTION_ORDER configuration
error üretilir.

Validator'a farklı rule type Açık configuration error üretilir.
veriliyor

PAGE_NUMBER ve REQUIRED_SECTION Mevcut validator davranışları
korunur.

Input immutability Document sections, expected
sections ve alias dizileri mutate
edilmez.

---

## 18. Gıda Teknolojisi study-type bölüm sırası

---

Senaryo Beklenen sonuç

---

Experimental doğru sıra Experimental SECTION_ORDER başarılı
olur.

Experimental yanlış sıra Experimental SECTION_ORDER
başarısız olur ve problemli
relative ilişkiyi açıklar.

Source Research doğru sıra Source-research SECTION_ORDER
başarılı olur.

Source Research yanlış sıra Source-research SECTION_ORDER
başarısız olur ve problemli
relative ilişkiyi açıklar.

Source Research seçimi Experimental order rule
RuleEngine'e ulaşmaz.

Experimental seçimi Source-research order rule
RuleEngine'e ulaşmaz.

Expected section eksik, kalan sıra SECTION_ORDER başarılı; eksiklik
doğru yalnız REQUIRED_SECTION sonucunu
etkiler.

Expected section eksik, kalan sıra SECTION_ORDER başarısız olur.
yanlış

Koşullu veya unknown section araya Relative order bozulmaz.
giriyor

Expected section duplicate SECTION_ORDER güvenli ve
occurrence deterministik failure üretir.

İki mevcut section yer değiştiriyor REQUIRED_SECTION sonuçları başarılı
kalırken SECTION_ORDER başarısız
olur.

Rule sayıları Experimental 25, source-research 23
rule çözer.

---

## 19. Generic section kelime sayısı

---

Senaryo Beklenen sonuç

---

Max 200 / actual 199 SECTION_WORD_COUNT başarılı olur.

Max 200 / actual 200 Üst sınır dahil olduğu için
başarılı olur.

Max 200 / actual 201 Başarısız olur ve bulunan kelime
sayısını açıklar.

Min 100 / actual 100 Alt sınır dahil olduğu için
başarılı olur.

Min 100 / actual 99 Başarısız olur ve minimum değeri
açıklar.

Min 100, max 200 / actual 150 Range kontrolü başarılı olur.

Section heading Heading paragrafı kelime sayısına
dahil edilmez.

Sonraki gerçek section Sonraki heading ve içeriği hedef
section count'una dahil edilmez.

Birden fazla içerik paragrafı Görünür metinler sırayla
birleştirilip doğru sayılır.

Boş paragraflar Kelime sayısını etkilemez.

Türkçe karakterli kelimeler Tek kelimeler parçalanmadan
sayılır.

Punctuation-only tokenlar `-`, `—` ve `/` kelime sayılmaz.

Section bulunamıyor Presence ile çakışmayan PASS/no-op
sonucu üretilir; sıfır kelime
uygulanmaz.

Duplicate target section Rastgele occurrence seçilmez;
güvenli failure üretilir.

Alias eşleşmesi Alias ile bulunan section içeriği
doğrulanır.

Invalid min/max Non-negative integer olmayan değer
açık configuration error üretir.

Min max değerini aşıyor Açık configuration error üretilir.

Empty section name Açık configuration error üretilir.

Mevcut validatorlar PAGE_NUMBER, REQUIRED_SECTION ve
SECTION_ORDER davranışları korunur.

Input immutability Document, paragraphs, sections,
expected ve aliases mutate edilmez.

---

## 20. Gıda Teknolojisi Özet kelime sınırları

---

Senaryo Beklenen sonuç

---

Türkçe Özet 199 kelime Türkçe Özet SECTION_WORD_COUNT
başarılı olur.

Türkçe Özet tam 200 kelime Üst sınır dahil olduğu için
başarılı olur.

Türkçe Özet 201 kelime Yalnız ilgili word-count rule
başarısız olur.

Türkçe Özet heading Kelime sayısına dahil edilmez.

Abstract heading ve içeriği Türkçe Özet kelime sayısına dahil
edilmez.

Çoklu Türkçe Özet paragrafları Paragraflar birlikte sayılır.

Empty paragraph Kelime sayısını etkilemez.

Türkçe karakterli kelimeler Parçalanmadan sayılır.

Türkçe Özet yok REQUIRED_SECTION eksikliği
raporlar; word-count no-op
davranışı korunur.

İngilizce Özet 200/201 sınırı PDF'nin Türkçe Özet kurallarını
İngilizce Özete de uygulaması
nedeniyle sırasıyla pass/fail olur.

Experimental seçimi İki ortak Özet word-count rule'u
dahil; toplam 27 rule çözülür.

Source Research seçimi İki ortak Özet word-count rule'u
dahil; toplam 25 rule çözülür.

200 ve 201 kelimelik runtime DOCX Presence ve SECTION_ORDER aynı
çifti kalır; yalnız sınırı aşan
word-count sonucu değişir.

SECTION_ORDER regresyonu Özet word-count kuralları bölüm
sırası sonuçlarını değiştirmez.

---

## 21. Tablo ve şekil varlığı normalizasyonu

Bu senaryolar yalnız `word/document.xml` body kapsamındaki OOXML
yapılarını doğrular. Header/footer parçalarındaki nesneler body
tablo/şekil sayısına dahil edilmez.

---

Senaryo Beklenen sonuç

---

Hiç tablo yok `tables.count` 0 ve
`tables.hasTables` false olur.

Bir tablo Body içindeki tek `w:tbl` için
`tables.count` 1 ve
`tables.hasTables` true olur.

Birden fazla tablo Body içindeki her `w:tbl` ayrı
sayılır.

Nested table davranışı İç içe tablo dahil her `w:tbl` ayrı
sayılır; dış tablo + iç tablo
sonucu 2 olur.

Metinde "Tablo 1" yazması Normal text OOXML tablo yapısı
olmadığı için table sayılmaz.

Hiç görsel yok `figures.count` 0 ve
`figures.hasFigures` false olur.

Bir drawing image Body içindeki tek `w:drawing` için
`figures.count` 1 ve
`figures.hasFigures` true olur.

Birden fazla image Body içindeki her `w:drawing` ayrı
sayılır.

Metinde "Şekil 1" yazması Normal text OOXML drawing yapısı
olmadığı için figure sayılmaz.

Table + figure aynı belgede `tables` ve `figures` alanları
birbirinden bağımsız doğru sayıları
döner.

Header/footer image body count'a Header/footer XML içindeki image,
dahil değil `figures.count` değerini artırmaz.

Malformed drawing parser'ı Eksik veya beklenmeyen drawing
düşürmüyor relationship yapısı analiz akışını
çökertmez.

---

## 22. Generic conditional required-section doğrulaması

Bu senaryolar `CONDITIONAL_REQUIRED_SECTION` altyapısını gerçek
üniversite rule JSON'u eklemeden doğrular.

---

Senaryo Beklenen sonuç

---

`hasTables=true` + section var Condition true olur; bölüm bulunduğu
için validator pass döner.

`hasTables=true` + section yok Condition true olur; bölüm bulunmadığı
için validator fail döner.

`hasTables=false` + section yok Condition false olur; validator
no-op/pass döner ve actual
`Uygulanmadı` olur.

`hasTables=false` + section var Condition false olur; validator
no-op/pass döner ve actual
`Uygulanmadı` olur.

`hasFigures=true` + section var Condition true olur; bölüm bulunduğu
için validator pass döner.

`hasFigures=true` + section yok Condition true olur; bölüm bulunmadığı
için validator fail döner.

`hasFigures=false` + section yok Condition false olur; validator
no-op/pass döner ve actual
`Uygulanmadı` olur.

`hasFigures=false` + section var Condition false olur; validator
no-op/pass döner ve actual
`Uygulanmadı` olur.

Türkçe/case normalization Section adı mevcut
`normalizeSectionName()` ile eşleşir.

Alias eşleşmesi Expected `aliases` içindeki geçerli ad
section ile eşleşirse validator pass
döner.

Body cümlesi false-positive üretmez Bölüm adı yalnız body cümlesinde
geçiyorsa tam normalized section
eşleşmesi olmadığı için section
sayılmaz.

Boş section Açık configuration error üretilir.

Boş alias Açık configuration error üretilir.

Unsupported fact Açık configuration error üretilir.

`equals` boolean değil Açık configuration error üretilir.

Yanlış rule type `ConditionalRequiredSectionValidator`
açık configuration error üretir.

REQUIRED_SECTION regresyonu Mevcut `RequiredSectionValidator`
davranışı değişmeden korunur.

SECTION_ORDER regresyonu Mevcut `SectionOrderValidator`
davranışı değişmeden korunur.

SECTION_WORD_COUNT regresyonu Mevcut `SectionWordCountValidator`
davranışı değişmeden korunur.

PAGE_NUMBER regresyonu Mevcut `PageNumberValidator` davranışı
değişmeden korunur.

Document/rule immutability Document, sections, rule ve expected
nesneleri mutate edilmez.

---

## 23. Gıda Teknolojisi koşullu Tablolar/Şekiller Listesi kuralları

Bu senaryolar ÇOMÜ Uygulamalı Bilimler Fakültesi Gıda Teknolojisi Lisans
Bitirme Tezi kural setindeki gerçek `CONDITIONAL_REQUIRED_SECTION`
kurallarını doğrular.

---

Senaryo Beklenen sonuç

---

Table yok + liste yok `hasTables=false`; Tablolar Listesi
kuralı `Uygulanmadı` no-op/pass
döner.

Table var + Tablolar Listesi var Tablolar Listesi kuralı pass döner.

Table var + Tablolar Listesi yok Tablolar Listesi kuralı fail döner.

Yalnız "Tablo 1" text Gerçek `w:tbl` olmadığı için
condition tetiklenmez ve kural
`Uygulanmadı` döner.

Figure yok + liste yok `hasFigures=false`; Şekiller
Listesi kuralı `Uygulanmadı`
no-op/pass döner.

Figure var + Şekiller Listesi var Şekiller Listesi kuralı pass döner.

Figure var + Şekiller Listesi yok Şekiller Listesi kuralı fail döner.

Yalnız "Şekil 1" text Gerçek `w:drawing` olmadığı için
condition tetiklenmez ve kural
`Uygulanmadı` döner.

Table + figure var, iki liste de İki conditional rule da pass döner.
var

Table + figure var, iki liste de İki conditional rule da fail döner.
yok

Table var/listesi var + figure yok Tablolar Listesi pass, Şekiller
Listesi `Uygulanmadı` döner.

Figure var/listesi var + table yok Şekiller Listesi pass, Tablolar
Listesi `Uygulanmadı` döner.

Experimental seçimi Çözülmüş rule listesinde iki
conditional rule bulunur; toplam 29
rule/result beklenir.

Source Research seçimi Çözülmüş rule listesinde iki
conditional rule bulunur; toplam 27
rule/result beklenir.

SECTION_ORDER regresyonu Conditional listeler mevcut order
listelerine eklenmez; mevcut order
davranışı korunur.

REQUIRED_SECTION regresyonu Mevcut required-section kuralları
değişmeden çalışır.

SECTION_WORD_COUNT regresyonu Mevcut word-count kuralları
değişmeden çalışır.

PAGE_NUMBER regresyonu Mevcut page-number kuralları
değişmeden çalışır.

---

## 24. Rule result durumları, skor ve rapor

`NOT_APPLICABLE` PASS veya FAIL değildir. Toplam kontrol tüm sonuçları,
değerlendirilen kontrol yalnız `PASSED + FAILED` sonuçlarını kapsar.
Skor `PASSED / evaluated * 100` formülü ve mevcut `Math.round`
davranışıyla hesaplanır; `evaluated=0` için skor deterministik olarak
`0` olur.

---

Senaryo Beklenen sonuç

---

Conditional condition false `NOT_APPLICABLE`; `passed=false`;
skora girmez.

Conditional condition true + `PASSED`; pay ve paydaya girer.
section var

Conditional condition true + `FAILED`; yalnız paydaya girer.
section yok

Word-count target section yok `NOT_APPLICABLE`; REQUIRED_SECTION
hatası duplicate edilmez.

Word-count target var ve aralık `PASSED`.
içinde

Word-count target var ve aralık `FAILED`.
dışında

Yalnız NOT_APPLICABLE sonuçlar / `evaluated=0`, `score=0`;
boş sonuç listesi NaN/Infinity oluşmaz.

20 PASSED + 1 FAILED + 2 `evaluated=21`; skor
NOT_APPLICABLE `Math.round(20/21*100)=95`.

Başarılı filtresi Yalnız `PASSED`; `NOT_APPLICABLE`
içermez.

Hatalar filtresi Yalnız `FAILED`; `NOT_APPLICABLE`
içermez.

Uygulanmayan filtresi Yalnız `NOT_APPLICABLE`.

Tümü filtresi Tüm sonuçlar; sıra FAILED, PASSED,
NOT_APPLICABLE.

Table yok + figure yok İki conditional sonuç da
`NOT_APPLICABLE`; toplam 29 ise
evaluated 27.

Table var/list yok + figure yok Liste kuralı `FAILED`, figure
kuralı `NOT_APPLICABLE`; diğer 27
pass ise skor
`Math.round(27/28*100)=96`.

Table var/list var + figure yok Liste kuralı `PASSED`, figure
kuralı `NOT_APPLICABLE`; diğerleri
pass ise skor 100.

Figure var/list yok + table yok Figure liste kuralı `FAILED`, table
kuralı `NOT_APPLICABLE`.

Figure var/list var + table yok Figure liste kuralı `PASSED`, table
kuralı `NOT_APPLICABLE`.

Table + figure birlikte Her conditional kural kendi section
varlığına göre bağımsız
PASSED/FAILED olur.

REQUIRED_SECTION regresyonu Gerçek PASS/FAIL davranışı korunur.

SECTION_ORDER regresyonu Gerçek PASS/FAIL davranışı korunur.

PAGE_NUMBER regresyonu Gerçek PASS/FAIL davranışı korunur.

Formatting validator regresyonu Font, size, spacing, alignment,
heading ve margin PASS/FAIL
davranışı korunur.

Uygulanmayan sonuç kartı "Uygulanmadı" metni ve nötr stil
gösterir; başarı/başarısızlık
olarak sunulmaz.

---

## 25. Kısaltma kullanım fact normalizasyonu

Bu altyapı akademik bir zorunluluk kararı vermez. Yalnız görünür body
metnindeki konservatif heuristic eşleşmeleri normalize edilmiş document
fact olarak üretir.

---

Senaryo Beklenen sonuç

---

Tek abbreviation: `PCR` Tek item, occurrence 1, count 1 ve
`hasAbbreviations=true`.

Birden fazla: `DNA` + `PCR` İki item ilk görülme sırasında
üretilir.

`PCR` üç kez Tek item ve occurrence 3.

`TÜBİTAK` Unicode uppercase desteğiyle tespit
edilir.

`UV-VIS` İç hyphen korunarak tek item olur.

`CO2` ve `H2O` Alphanumeric abbreviation olarak
tespit edilir.

`(PCR), PCR. PCR;` Dış punctuation temizlenir; tek
item ve occurrence 3 olur.

Lowercase normal kelime Tespit edilmez.

Title Case normal kelime Tespit edilmez.

Saf sayı: `2026`, `12`, `200` Tespit edilmez.

Tek uppercase harf: `A`, `B`, `C` Tespit edilmez.

Boş belge Empty items, count 0 ve
`hasAbbreviations=false`; crash
olmaz.

Abbreviation içermeyen normal body Empty result üretir.

`ÖZET` ve `GİRİŞ` section heading Rule-defined heading işaretiyle
hariç tutulur.

REQUIRED_SECTION heading Kısaltma false-positive'i üretmez.

CONDITIONAL_REQUIRED_SECTION Kısaltma false-positive'i üretmez.
heading

Heading1--Heading3 paragrafı Stil adı veya ID üzerinden tarama
dışında kalır.

Header içinde abbreviation Body paragraph modeline girmediği
için ignore edilir.

Footer içinde abbreviation Body paragraph modeline girmediği
için ignore edilir.

Duplicate occurrence count Aynı normalized token tek item
altında doğru sayılır.

First-seen ordering Item dizisi belgedeki ilk görülme
sırasını korur.

Immutability Document, paragraph ve run dizileri
mutate edilmez.

Table/figure detection regresyonu Mevcut count/has fact davranışı
değişmez.

Section detection regresyonu Mevcut section parsing ve marking
davranışı değişmez.

NOT_APPLICABLE regresyonu Status, score denominator ve rapor
davranışı değişmez.

---

## 26. ÇOMÜ Simgeler ve Kısaltmalar Listesi conditional kuralı

Gerçek rule ID:
`comu.applied-sciences.food-technology.bachelor.list-of-abbreviations`.

---

Senaryo Beklenen sonuç

---

Abbreviation yok + liste yok `NOT_APPLICABLE`, `passed=false`;
değerlendirilen sayısına ve skora
girmez.

Abbreviation var + liste yok `FAILED`, `passed=false`; yalnız
score denominator'a girer.

Abbreviation var + liste var `PASSED`, `passed=true`; score
numerator ve denominator'a girer.

Body içinde `PCR` `hasAbbreviations=true`;
conditional kontrol tetiklenir.

Body içinde `DNA` `hasAbbreviations=true`;
conditional kontrol tetiklenir.

Body içinde `TÜBİTAK` Unicode uppercase desteğiyle
kontrol tetiklenir.

Body içinde `UV-VIS` Hyphen korunur ve kontrol
tetiklenir.

Body içinde `CO2` / `H2O` Alphanumeric heuristic kontrolü
tetikler.

Heading Uppercase section normalization ile
`SİMGELER VE KISALTMALAR LİSTESİ` bulunur.

Heading Case normalization ile bulunur.
`Simgeler ve Kısaltmalar Listesi`

Ad yalnız body cümlesinde geçiyor Bağımsız section olmadığı için
section present sayılmaz.

Resolved liste heading'i farklı formatta Generic rule-defined heading
işaretiyle font, size, spacing ve
alignment body kapsamından
çıkarılır.

Experimental seçim Ortak setten inherit edilir;
resolved toplam 30 rule olur.

Source Research seçim Ortak setten inherit edilir;
resolved toplam 28 rule olur.

Table conditional regresyonu `hasTables` ve Tablolar Listesi
sonuçları değişmez.

Figure conditional regresyonu `hasFigures` ve Şekiller Listesi
sonuçları değişmez.

NOT_APPLICABLE score regresyonu Uygulanmayan sonuç toplam kontrolde
bulunur; evaluated/score
denominator'a girmez.

`abbreviation-detection-negative.docx` `hasAbbreviations=false`; yeni rule
doğrudan `NOT_APPLICABLE` olur.

`abbreviation-detection-positive.docx` `hasAbbreviations=true`, liste yok;
yeni rule doğrudan `FAILED` olur.

Abbreviation + liste runtime belgesi `hasAbbreviations=true`, section
present; yeni rule doğrudan
`PASSED` olur.

---

## 27. Generic abbreviation list consistency

Bu senaryolar yalnız generic `ABBREVIATION_LIST_CONSISTENCY` validator
ve liste satırı parser altyapısını kapsar; gerçek university rule ID
veya registry kaydı eklenmez.

---

Senaryo Beklenen sonuç

---

Body `PCR`, list `PCR` `PASSED`; actual `1/1`.

Body `PCR`, `HPLC`; list ikisini `PASSED`; unique coverage `2/2`.
içeriyor

Body `PCR`, `HPLC`; list yalnız `PCR` `FAILED`; missing ve actual içinde
`HPLC` gösterilir.

Body `PCR`; list `PCR`, `HPLC` `PASSED`; list extra failure
üretmez.

Body abbreviation yok `NOT_APPLICABLE`, `passed=false`.

Body abbreviation var, list section Presence hatası duplicate edilmez;
yok `NOT_APPLICABLE`.

Duplicate list section Rastgele occurrence seçilmez;
deterministik `FAILED`.

`TÜBİTAK` Unicode token list key'i ve body
value eşleşir.

`UV-VIS` İç hyphen korunur ve eşleşir.

`CO2`, `H2O` Alphanumeric key'ler eşleşir.

`PCR    Polimeraz Zincir Reaksiyonu` Çoklu whitespace separator ile
`PCR` çıkarılır.

`PCR\tPolimeraz Zincir Reaksiyonu` Tek tab separator ile `PCR`
çıkarılır.

`TÜBİTAK - Türkiye Bilimsel...` Boşluklu hyphen separator ile
`TÜBİTAK` çıkarılır.

`HPLC: Yüksek Performanslı...` Colon separator ile `HPLC`
çıkarılır.

Normal açıklama cümlesi Geçerli uppercase key/separator
yapısı olmadığı için entry
sayılmaz.

Hedef heading paragrafı Liste entry'si veya body
abbreviation olarak sayılmaz.

Sonraki rule-defined section Section range sınırıdır; sonraki
içerik listeye dahil edilmez.

Body `PCR` birden fazla occurrence Coverage unique `PCR` üzerinden bir
kez değerlendirilir.

List duplicate `PCR` Deterministik olarak tek list key'i
kabul edilir.

Input immutability Rule, document, section, paragraph
ve abbreviation dizileri mutate
edilmez.

Existing abbreviation detector Unicode, punctuation, duplicate
occurrence ve first-seen davranışı
korunur.

Conditional required-section Mevcut presence rule davranışı
değişmez.

NOT_APPLICABLE score Generic status mevcut denominator
semantiğini değiştirmez.

---

## 28. Gıda Teknolojisi kaynak düzeltmeleri

---

Senaryo Beklenen sonuç

---

Gıda Teknolojisi top margin 3 cm Department override `PASSED`.

Gıda Teknolojisi top margin 2,5 cm Department override `FAILED`.

Sol 3 cm, sağ/alt 2,5 cm Mevcut margin kuralları değişmeden
değerlendirilir.

Gıda Teknolojisi Heading1 TNR, 12 Department override `PASSED`.
pt, bold

Gıda Teknolojisi Heading1 TNR, 14 Eski değer artık `FAILED`.
pt, bold

Heading2 ve Heading3 TNR, 12 pt, Mevcut kurallar `PASSED`; değerleri
bold değişmez.

Body font size 12 pt Mevcut body font-size kuralı
değişmeden `PASSED`.

Resolver override İki global rule department
rule'larıyla değiştirilir; toplam
rule sayısı değişmez.

---

## 29. Gıda Teknolojisi Kabul ve Onay Sayfası

---

Senaryo Beklenen sonuç

---

Bağımsız `KABUL VE ONAY SAYFASI` Canonical section eşleşir;
heading'i `PASSED`.

Canonical heading yok `FAILED`.

Bağımsız `KABUL VE ONAY` heading'i Resmi şablon alias'ı eşleşir;
`PASSED`.

Uppercase canonical/alias Türkçe case normalization ile
`PASSED`.

Normal case canonical/alias Case normalization ile `PASSED`.

Heading style olmayan bağımsız Exact normalized-name eşleşmesiyle
paragraph `PASSED`.

Body cümlesinde "kabul ve onay Tam section adı olmadığı için
işlemleri" false-positive oluşmaz.

Aynı section birden fazla Mevcut REQUIRED_SECTION presence
occurrence semantiği korunur; en az bir
eşleşmeyle `PASSED`.

Heading farklı body formatting Generic rule-defined heading
içeriyor işaretiyle body
font/size/spacing/alignment
kapsamından çıkarılır.

Experimental seçim Ortak setten inherit edilir;
resolved toplam 31 rule olur.

Source Research seçim Ortak setten inherit edilir;
resolved toplam 29 rule olur.

Mevcut required sections PASS/FAIL davranışları değişmez.

SECTION_ORDER Presence kontrolünden bağımsızdır;
bulunan Kabul ve Onay
occurrence'ının relative sırasını
denetler.

---

## 30. Gıda Teknolojisi Kabul ve Onay SECTION_ORDER entegrasyonu

---

Senaryo Beklenen sonuç

---

Canonical `Kabul ve Onay Sayfası` SECTION_ORDER `PASSED`.
İntihal ile Teşekkür arasında

Resmi alias `KABUL VE ONAY` İntihal Canonical occurrence olarak
ile Teşekkür arasında tanınır; SECTION_ORDER `PASSED`.

Kabul ve Onay, Teşekkür'den sonra SECTION_ORDER `FAILED`.

Kabul ve Onay, İntihal'den önce SECTION_ORDER `FAILED`.

Kabul ve Onay missing SECTION_ORDER tek başına
missing-section failure üretmez.

Kabul ve Onay missing, presence `acceptance-approval`
değerlendirmesi REQUIRED_SECTION `FAILED`.

Canonical/alias eşleşen birden Deterministic safe SECTION_ORDER
fazla Kabul ve Onay occurrence'ı `FAILED`.

Experimental: İntihal → Kabul ve SECTION_ORDER `PASSED`.
Onay → Teşekkür → çalışma türüne  
 özel devam

Source Research: İntihal → Kabul ve SECTION_ORDER `PASSED`.
Onay → Teşekkür → çalışma türüne  
 özel devam

Experimental ve Source Research'in Önceki relative-order sonuçları
kalan özel bölüm sıraları değişmez.

Beklenen listede bulunmayan Bulunan beklenen bölümlerin
conditional/unknown section araya relative sırasını bozmaz.
girer

Uppercase `KABUL VE ONAY` ve Türkçe Mevcut Türkçe section normalization
karakter/case varyantları ile alias eşleşmesi korunur.

---

## 31. Generic SECTION_KEYWORDS ve ÇOMÜ keyword kuralları

---

Senaryo Beklenen sonuç

---

TR `Anahtar Kelimeler: A, B, C` 3 entry; `PASSED`.

TR 5 keyword Üst sınır dahil; `PASSED`.

TR 2 keyword Minimum altında; `FAILED`.

TR 6 keyword Maksimum üstünde; `FAILED`.

EN `Keyword: A, B, C` 3 entry; `PASSED`.

EN 5 keyword Üst sınır dahil; `PASSED`.

EN 2 keyword Minimum altında; `FAILED`.

EN 6 keyword Maksimum üstünde; `FAILED`.

Section var, exact label yok Label bulunamadığı için `FAILED`.

Hedef section yok Presence hatası tekrarlanmaz;
`NOT_APPLICABLE`.

`Anahtar kelimeler bu çalışmanın...` Başlangıçta exact `label:` olmadığı
için eşleşmez.

`The keyword used in this study...` Başlangıçta exact `label:` olmadığı
için eşleşmez.

`Anahtar Kelimeler: PCR, , DNA` Boş entry elenir; bulunan count 2.

`Anahtar Kelimeler: TÜBİTAK, Özet, Gıda` Türkçe Unicode korunur; 3 entry.

Keyword paragrafı section sonunda Placement uygun.

Keyword paragrafından sonra görünür body Placement `FAILED`.
metni

Keyword paragrafından sonra yalnız boş Placement `PASSED`.
paragraflar

Keyword paragrafından sonra yeni Section boundary placement'ı
rule-defined section bozmaz.

Aynı section içinde iki matching label Deterministic safe `FAILED`.
paragrafı

`Özet` veya `Abstract` heading'i Section content dışında kalır;
keyword sayılmaz.

TR rule, Abstract içindeki `Keyword:` Section/label isolation nedeniyle
eşleşmez.

Experimental seçim İki ortak keyword rule'u inherit
edilir; resolved toplam 33 rule.

Source Research seçim İki ortak keyword rule'u inherit
edilir; resolved toplam 31 rule.

Mevcut Özet/Abstract SECTION_WORD_COUNT 200 kelime sınırı ve validator
davranışı değişmez.

Keyword satırının word-count etkisi Mevcut davranış korunur; label ve
değerler section kelime
hesabındadır.

Input immutability Rule, document, section ve
paragraph dizileri mutate edilmez.

Mevcut Özet/Abstract REQUIRED_SECTION Presence PASS/FAIL davranışı
değişmez.

Duplicate keyword değerleri Kaynak ayrı hata tanımlamadığı için
görünür entry olarak ayrı ayrı
sayılır.

---

## 32. DOCX numbering metadata ve number-prefix-aware section detection

Bu altyapı senaryoları yeni bir akademik heading-numbering kuralı
tanımlamaz.

---

Grup Senaryo Beklenen sonuç

---

Manual prefix `1. GİRİŞ` / expected `Giriş` Exact remainder eşleşir;
REQUIRED_SECTION `PASSED`.

Manual prefix `2. GENEL BİLGİLER` / expected Section eşleşir.
`Genel Bilgiler`

Manual prefix `3. MATERYAL VE METOT` / expected Section eşleşir.
`Materyal ve Metot`

Manual prefix `4. BULGULAR VE TARTIŞMA` / expected Section eşleşir.
`Bulgular ve Tartışma`

Manual prefix `5. SONUÇ` / expected `Sonuç` Section eşleşir.

Multilevel `2.1. Alt Başlık` Text source, level 1 ve
label `2.1.` normalize
edilir.

Multilevel `2.1.1. Alt Alt Başlık` Text source, level 2 ve
label `2.1.1.` normalize
edilir.

No prefix `GİRİŞ` / expected `Giriş` Mevcut exact normalized-name
davranışıyla eşleşir.

False positive `1. deney sonucunda...` `Giriş` section'ıyla
eşleşmez ve rule-defined
heading olmaz.

False positive `1. Elma`, `2. Armut` Mevcut akademik section
adlarıyla eşleşmez; section
heading olmaz.

Automatic Text `GİRİŞ`, direct `numPr` level 0 Section `Giriş` eşleşir;
source `word`, numId/level
ve destekleniyorsa visible
label bulunur.

Missing XML `word/numbering.xml` yok Parser crash olmaz;
definitions boş kalır.

Style inherited Paragraph direct `numPr` yok, style En yakın style numbering
zincirinde numbering var referansı normalize edilir.

Direct precedence Paragraph ve style farklı numbering taşıyor Direct paragraph `numPr`
kullanılır.

Unsupported Decimal dışı format veya eksik parent Word metadata korunur;
counter `visibleLabel=null`, tahmin
yapılmaz.

Order `1. GİRİŞ → 2. GENEL BİLGİLER → 3. SONUÇ` SECTION_ORDER relative
sırayı doğru bulur.

Content range Numaralı main heading'ler Sonraki rule-defined heading
doğru content boundary olur.

Word count Prefix'siz `ÖZET` SECTION_WORD_COUNT sonucu
değişmez.

Keywords Prefix'siz `ÖZET` / `ABSTRACT` SECTION_KEYWORDS section
lookup ve placement sonucu
değişmez.

Conditional Numaralı rule-defined conditional heading Ortak matcher ile section
presence doğru bulunur.

TOC TOC style/content-control içindeki numaralı Gerçek section occurrence
cached entries olarak kullanılmaz.

Immutability XML, document, paragraph, style ve rule Mutate edilmez; yeni
inputları document/paragraph/section
dizileri üretilir.

Rule count Experimental selection Resolved toplam 33 kalır.

Rule count Source Research selection Resolved toplam 31 kalır.

---

## 33. Generic HEADING_NUMBERING ve ÇOMÜ production kuralları

---

Senaryo Beklenen sonuç

---

Manual `1. GİRİŞ`, expected level 0 `PASSED`.

Automatic Word numbered `GİRİŞ`, level `numId` ve level güvenilir olduğu
0, unresolved label için `PASSED`.

Unnumbered `GİRİŞ` `FAILED`; actual
numaralandırılmamış olarak
raporlanır.

Manual `1.1. GİRİŞ`, expected level 0 `FAILED`; bulunan düzey 2 olarak
raporlanır.

Expected Giriş bulunmuyor Presence hatası tekrarlanmaz; başka
hedef de yoksa `NOT_APPLICABLE`.

Duplicate Giriş Rastgele occurrence seçilmez;
deterministic `FAILED`.

Bazı expected section'lar missing, Presence responsibility separation
bulunanların tümü uygun korunur; numbering `PASSED`.

Prefix-aware REQUIRED_SECTION `1. GİRİŞ`, `Giriş` olarak
eşleşmeye devam eder.

SECTION_ORDER Numaralı section'ların relative
sırası değişmez.

SECTION_WORD_COUNT Prefix'siz Özet sınırları değişmez.

SECTION_KEYWORDS Özet/Abstract lookup ve placement
değişmez.

CONDITIONAL_REQUIRED_SECTION Ortak matcher davranışı değişmez.

Manual/Word equivalence Aynı section ve level iki storage
biçiminde aynı sonucu üretir.

Missing numbering.xml Word definitions boş olabilir;
parser ve text numbering çalışmaya
devam eder.

TOC numaralı cached entry Section occurrence listesine
girmediği için numbering sonucu
üretmez.

`1. Elma`, `2. Armut`, `3. Muz` Expected akademik section adıyla
eşleşmez; değerlendirilmez.

`1. deney sonucunda sıcaklık arttı.` Akademik heading olarak
değerlendirilmez.

Ön bölüm ve arka bölüm başlıkları Numbering expected listesinde
bulunmadıkları için
değerlendirilmez.

Experimental seçim Yalnız experimental
heading-numbering ID'si resolve
edilir.

Source Research seçim Yalnız source-research
heading-numbering ID'si resolve
edilir.

Experimental-only section Source Research rule expected
listesinde bulunmaz.

Source-research-only section Experimental rule expected
listesinde bulunmaz.

Immutability Document, sections, paragraphs,
numbering, rule ve expected arrays
mutate edilmez.

Invalid expected configuration Açık configuration error üretilir.

Unsupported rule type Validator açık type error üretir.

Resolver inheritance Experimental 34, Source Research 32
rule resolve edilir.

Registry exact ID İki production ID
`HeadingNumberingValidator` ile
çalışır; missing-validator sonucu
oluşmaz.

---

Production kontrolü yalnız expected named main section'ın numbered
olmasını ve level 0 olmasını doğrular. Exact punctuation, sıra, skipped
number, parent-child hiyerarşisi, maksimum depth ve Heading2/Heading3
numbering production failure sebebi değildir.

## 34. Generic PAGE_NUMBER_SEQUENCE ve ÇOMÜ production kuralı

---

Senaryo Beklenen sonuç

---

Ön bölümler `lowerRoman`, Giriş OOXML varsayılanı `decimal` kabul
bölümü `start=1`, `fmt` eksik edilir; `PASSED`.

Giriş sonrası bölümde `fmt` ve Önceki `decimal` biçimi miras
`start` eksik alınır.

Ön bölüm `decimal` `FAILED`.

Giriş bölümü `lowerRoman` `FAILED`.

Girişte Arap rakamı var fakat `FAILED`.
başlangıç 1 değil

Sayfa numarası section metadata'sı Özellik tespit edilemediği için
yok `FAILED`.

Giriş section'ı yok REQUIRED_SECTION hatası
tekrarlanmaz; `NOT_APPLICABLE`.

Duplicate Giriş Geçiş rastgele seçilmez; `FAILED`.

Manuel `1. GİRİŞ` Ortak prefix-aware matcher ile
transition section bulunur.

Word automatic heading, text Metin section olarak eşleşir;
`GİRİŞ` numbering metadata metne eklenmez.

TOC cached `1. GİRİŞ` Gerçek occurrence sayılmaz.

`1. Elma`, `2. Armut` Transition section false-positive
üretmez.

`1. deney sonucunda...` Transition section false-positive
üretmez.

Invalid format veya `restartAt < 1` Açık configuration error üretilir.

Immutability Document, section ve rule inputları
mutate edilmez.

Registry / RuleEngine Production ID validator'a bağlıdır;
missing-validator sonucu oluşmaz.

Resolver inheritance Experimental 35, Source Research 33
rule resolve edilir.

Mevcut PAGE_NUMBER Alt bilgi/orta hizalama kontrolü
değişmez.

Heading numbering regression Manual ve Word automatic
eşdeğerliği, prefix matching ve TOC
koruması değişmez.

---

## 35. Generic table/figure caption normalizasyonu

---

Grup Senaryo Beklenen sonuç

---

Table Table + preceding `Tablo 1.` Caption `before`
ilişkilendirilir.

Table Table + following caption Caption `after` olarak
normalize edilir;
akademik karar
verilmez.

Table Table + caption yok `captionId=null`,
position `none`.

Table Caption + boş paragraph + Boş paragraph aşılır;
table `before`.

Table Caption + görünür body Görünür içerik
paragraph + table sınırdır; association
kurulmaz.

Table Birden fazla table Her occurrence bağımsız
ve document order
içinde kalır.

Table Nested table Count korunur; nested
occurrence
block/caption
association almaz.

Table İki bitişik caption + table Rastgele seçim
yapılmaz; `ambiguous`.

Table Nesnesiz `Tablo 1. Başlık` Orphan caption olur;
`hasTables=false`
kalır.

Table `Tablo 1’de...` Caption değildir.

Figure Figure + following caption Caption `after`
ilişkilendirilir.

Figure Figure + preceding caption Caption `before` olarak
normalize edilir.

Figure Figure + caption yok Position `none`.

Figure Birden fazla figure Her drawing ayrı
occurrence olarak
sayılır.

Figure Aynı paragraph'ta çoklu Caption paylaşılmaz;
drawing + tek caption occurrence'lar
`ambiguous`.

Figure Anchored drawing Görsel konum tahmin
edilmez; `ambiguous`.

Figure Inline drawing Body block neighborhood
association
kullanılabilir.

Figure İki caption adayı `ambiguous`.

Figure Nesnesiz `Şekil 1. Başlık` Orphan caption;
`hasFigures=false`.

Figure `Şekil 2 incelendiğinde...` Caption değildir.

Normalize `Tablo 1.` kind table, number `1`.

Normalize `Tablo 2.1.` kind table, number
`2.1`.

Normalize `Şekil 1.` kind figure, number
`1`.

Normalize `Şekil 3.2.` kind figure, number
`3.2`.

Normalize `TABLO` / `ŞEKİL` Türkçe case
normalizasyonuyla
tanınır.

Normalize Prefix sonrası nokta yok Caption değildir.

Normalize `Tablo 1.` ve boş title Caption metadata'sı
üretilebilir.

Normalize `Çizelge 1.` / `Figure 1.` Bu sürümde
desteklenmez.

Regression `tables.count` / `hasTables` Tüm `w:tbl`, nested
dahil önceki sonuç
korunur.

Regression `figures.count` / Her `w:drawing` önceki
`hasFigures` gibi sayılır.

Regression Tablolar/Şekiller Listesi Aynı facts kullanıldığı
conditional için sonuç değişmez.

Regression Section/TOC/numbering/page Caption parser bu
sequence modelleri değiştirmez.

Regression Body formatting Caption paragraph
link'i mevcut
formatting
metadata'sını kullanır.

Regression Immutability Paragraph, block,
caption ve occurrence
inputları mutate
edilmez.

Rule count Experimental 35 kalır.

Rule count Source Research 33 kalır.

---

## 36. ÇOMÜ table/figure caption production kuralları

---

Senaryo Placement Format

---

Table yok `NOT_APPLICABLE` `NOT_APPLICABLE`

Figure yok `NOT_APPLICABLE` `NOT_APPLICABLE`

Table + caption üstte + `PASSED` `PASSED`
left + 1 satır

Table caption altta `FAILED` Association varsa
ayrıca format
değerlendirilir.

Table caption yok `FAILED` Duplicate failure yok;
`NOT_APPLICABLE`.

Table caption üstte `PASSED` `FAILED`.
fakat center

Table caption üstte `PASSED` `FAILED`.
fakat 1.5 satır

Figure + caption `PASSED` `PASSED`
altta + left + 1 satır

Figure caption üstte `FAILED` Association varsa
ayrıca format
değerlendirilir.

Figure caption yok `FAILED` Duplicate failure yok;
`NOT_APPLICABLE`.

Figure caption altta `PASSED` `FAILED`.
fakat center

Figure caption altta `PASSED` `FAILED`.
fakat 1.5 satır

3 table, biri yanlış Aggregate `FAILED`. Güvenilir caption'lar
değerlendirilir.

3 figure, biri yanlış Aggregate `FAILED`. Güvenilir caption'lar
değerlendirilir.

Ambiguous False PASS yok; `NOT_APPLICABLE`.
top-level/inline `FAILED`.  
 association

Orphan caption, object `NOT_APPLICABLE`. `NOT_APPLICABLE`.
yok

Yalnız nested table Count korunur; `NOT_APPLICABLE`.
placement  
 `NOT_APPLICABLE`.

Yalnız anchored figure Teknik limitation; `NOT_APPLICABLE`.
placement  
 `NOT_APPLICABLE`.

Style-inherited left + Effective 1 satır; `PASSED`.
240 OOXML spacing format `PASSED`.

Invalid Açık configuration Açık configuration
placement/format error. error.
expected

Registry / RuleEngine Dört production ID Missing-validator yok.
kayıtlı validator ile  
 çalışır.

Resolver Experimental 39, Source Child setlerde
Research 37. duplicate yok.

---

## 37. Generic OBJECT_IN_TEXT_REFERENCE ve ÇOMÜ kuralları

---

Senaryo Beklenen sonuç

---

Table/Figure yok İlgili rule `NOT_APPLICABLE`.

`Tablo 1.` caption + body Table reference `PASSED`.
`Tablo 1’de`

Caption var, body reference yok `FAILED`.

`Şekil 3.2.` caption + body Figure reference `PASSED`.
`ŞEKİL 3.2'de`

Reference object'tan önce/sonra İkisi de kabul edilir.

Yalnız caption kendisi token Reference sayılmaz; `FAILED`.
içeriyor

Yalnız Tablolar/Şekiller Listesi Reference sayılmaz.

TOC cached entry Reference sayılmaz.

Rule-defined heading token'ı Reference sayılmaz.

`tablolarda`, `şekillerde`, Reference değildir.
`tablolama`, `şekillendirme`

Yanlış object kind Coverage sağlamaz.

Aynı nesneye çoklu reference Tek coverage olarak yeterlidir.

İki nesneden yalnız biri referenced Eksik identity listesiyle `FAILED`.

Duplicate aynı kind/number caption False PASS yok; ambiguity `FAILED`.

Missing/ambiguous caption identity Reference rule duplicate placement
failure üretmez.

Yalnız nested table / anchored `NOT_APPLICABLE`.
figure

Orphan caption Object/reference rule tetiklemez.

Turkish uppercase ve `'` / `’` Unicode güvenli eşleşir.

Multi-level number Exact normalized number ile
eşleşir.

Immutability Document/model/rule inputları
mutate edilmez.

Registry / RuleEngine İki production ID kayıtlı validator
ile çalışır.

Resolver Experimental 41, Source Research 39.

---

## Table/Figure Source Attribution Source-Audit Matrix

Bu sprintte `OBJECT_SOURCE_ATTRIBUTION` production rule'u eklenmedi.
Kılavuz dış kaynaktan alınan tablo/şekil için kaynağın caption ismi
sonunda verilmesini destekler; ancak DOCX/OOXML object provenance
sağlamadığı için bu requirement güvenilir otomatik failure'a
dönüştürülmez.

---

Kod Senaryo Beklenen sonuç

---

A Object yok Yeni source-attribution sonucu yok;
mevcut object kuralları kendi
koşullarına göre `NOT_APPLICABLE`
olabilir.

B Kendi üretilmiş table Source eksik diye yeni failure yok.

C Kendi üretilmiş figure Source eksik diye yeni failure yok.

D Dış kaynaktan table + Akademik olarak uygun örnek; production
caption sonunda source sonucu yok.
citation

E Dış kaynaktan table + Provenance bilinmediği için otomatik
source yok source failure yok; manuel akademik
inceleme gerekir.

F Dış kaynaktan figure + Akademik olarak uygun örnek; production
caption sonunda source sonucu yok.
citation

G Dış kaynaktan figure + Provenance bilinmediği için otomatik
source yok source failure yok; manuel akademik
inceleme gerekir.

H Caption içinde Source candidate olabilir; production
`(Yazar, 2024)` rule olmadığı için PASS/FAIL üretilmez.

I Caption sonunda Exact syntax zorunlu olmadığı ve rule
`(Kaynak: FAO, 2024)` olmadığı için özel sonuç yok.

J Caption'dan sonra ayrı Kılavuz caption sonunu desteklediği için
source paragraph production'a bağlanmaz.

K Normal parantezli `Şekil 1. ... (Örnek Şekil Gösterimi)`
caption source sayılmaz.

L Bibliography citation Object source note sayılmaz; Kaynaklar
bölümü ayrı required-section
sorumluluğudur.

M Body paragraph citation Object source note sayılmaz; in-text
object reference ile karıştırılmaz.

N Missing caption Mevcut `OBJECT_CAPTION_PLACEMENT`
sorumluluğu; source duplicate failure
yok.

O Orphan caption Gerçek object provenance veya source
coverage'a sokulmaz.

P Nested table Count korunur; source attribution
failure yok.

Q Anchored figure Rendered/provenance belirsizliği
nedeniyle source attribution failure
yok.

R Caption placement Table üstte, figure altta davranışı
regression korunmalı.

S Caption format Sola yaslı + 1 satır davranışı
regression korunmalı.

T Object alignment Center object davranışı korunmalı.
regression

U In-text reference Caption/list/TOC/heading exclusion
regression korunmalı.

V Registry Yeni source-attribution validator kaydı
beklenmez.

W RuleEngine Missing-validator sonucu yok; çünkü
production source rule yok.

X Resolver inheritance Experimental 43, Source Research 41
kalmalı.

---

## References / Bibliography / In-Text Citation Source-Audit Matrix

Bu sprintte bibliography/citation için yeni production rule eklenmedi.
Kaynaklar bölümü presence ve relative order mevcut kurallarda kalır;
bibliography entry formatı, alfabetik sıralama, in-text citation formatı
ve citation-bibliography matching için production-safe parser/model
bulunmadığından yeni failure yoktur.

---

Kod Senaryo Beklenen sonuç

---

A Kaynaklar yok Mevcut `references`
REQUIRED_SECTION
`FAILED`; yeni
bibliography duplicate
failure yok.

B Kaynaklar var boş Presence `PASSED`
olabilir; entry
non-empty production
rule yok.

C Tek bibliography entry Entry format/order
production sonucu yok.

D Birden fazla entry Entry format/order
production sonucu yok.

E Alphabetic doğru Akademik olarak uygun
olabilir; production
order sonucu yok.

F Alphabetic yanlış Kılavuz harf sırasını
desteklese de parser
güvenli olmadığı için
production failure yok.

G Body citation + Production consistency
bibliography match sonucu yok.

H Body citation + Matching güvenilir
bibliography missing değil; production
failure yok.

I Bibliography entry + Matching güvenilir
body citation missing değil; production
failure yok.

J Author-year citation Gelecekte normalize
edilebilir aday; bu
sprintte production
sonucu yok.

K Numeric citation `[1]` Resmi kaynak
desteklemez; production
parser olmadığı için
özel failure yok.

L Tek yıl `(2024)` Citation sayılmamalı.

M Caption içindeki Bibliography
citation consistency kapsamına
alınmamalı.

N TOC içindeki Gerçek section heading
`KAYNAKLAR` sayılmamalı.

O Kaynaklar -\> Ekler Future extraction
boundary Kaynaklar section
sonunda durmalı; bu
sprintte parser yok.

P Kaynaklar -\> Özgeçmiş Future extraction
boundary Özgeçmiş'te durmalı; bu
sprintte parser yok.

Q DOI yok DOI `varsa` olduğu için
production failure yok.

R URL yok Sadece çevrimiçi kaynak
türünde örneklenir;
generic failure yok.

S Erişim tarihi yok Generic production
failure yok.

T Dergi adı italic değil Bibliography-specific
format rule yok; body
formatting ownership
değişmez.

U Kitap adı italic değil Bibliography-specific
format rule yok.

V Yazar formatı farklı Grammar production rule
yok.

W `ve ark.` / `vd.` Örneklerde görülür;
kullanımı parser üretimi yok.

X Bibliography entry Şablon convention'ı
placeholder production
requirement'a
dönüştürülmez.

Y Registry Yeni
bibliography/citation
validator kaydı
beklenmez.

Z RuleEngine Missing-validator
sonucu yok; production
rule eklenmedi.

AA Resolver inheritance Experimental 43, Source
Research 41 kalmalı.

---

## HEADING_LEVEL_FORMAT ve ÇOMÜ akademik ana bölüm başlığı biçimi

Bu sprintte yalnız güvenilir identity kurulabilen level 0 akademik body
heading occurrence'ları için production rule eklendi:
`comu.applied-sciences.food-technology.bachelor.body-level-0-heading-format`.
Alt/alt-alt konu başlıkları isimden bağımsız production kontrolüne
alınmadı.

---

Senaryo Beklenen sonuç

---

Doğru manual level 0 heading `PASSED`.

Doğru Word automatic level 0 `PASSED`.
heading

Level 0 yanlış font `FAILED`; sorunlu heading mesajda
gösterilir.

Level 0 yanlış punto `FAILED`; bulunan/beklenen punto
raporlanır.

Level 0 bold eksik `FAILED`.

Birden fazla level 0 heading, Aggregate `FAILED`.
yalnız biri yanlış

Style inheritance ile doğru `PASSED`.
font/punto/bold

Direct font family style'ı override `FAILED`.
eder ve yanlışsa

Direct font size style'ı override `FAILED`.
eder ve yanlışsa

Missing section Duplicate failure yok; ilgili
heading değerlendirilmeye alınmaz.

Section var ama numbering yok `HEADING_NUMBERING` sahipliği;
format rule duplicate failure
üretmez.

Section var ama wrong level `HEADING_NUMBERING` sahipliği;
format rule değerlendirime almaz.

Hiç güvenilir level 0 heading yok `NOT_APPLICABLE`.

Normal numbered list Academic heading format kontrolüne
girmez.

`1. deney sonucunda...` Section identity olmadığı için
heading sayılmaz.

Table caption `Tablo 1.` Section identity olmadığı için
heading sayılmaz.

Figure caption `Şekil 1.` Section identity olmadığı için
heading sayılmaz.

TOC cached entry Section parser korumasıyla gerçek
heading sayılmaz.

Level 1 doğru Production kontrolü yok.

Level 1 yanlış Production kontrolü yok.

Level 2 doğru Production kontrolü yok.

Level 2 yanlış Production kontrolü yok.

Case `GİRİŞ` / `Giriş` Case production kontrolü yok;
section matching Türkçe normalize
kalır.

Alignment yanlış Source-backed production property
olmadığı için bu rule raporlamaz.

Spacing yanlış Source-backed production property
olmadığı için bu rule raporlamaz.

Page break yok Rendered layout güvenilir olmadığı
için bu rule raporlamaz.

Immutability Document, paragraph, styles, rule
ve expected mutate edilmez.

Registry / RuleEngine Yeni production ID validator'a
bağlıdır; missing-validator yok.

Resolver inheritance Experimental 44, Source Research 42
resolved rule üretir.

---

## ÇOMÜ section start / page break source audit

Bu sprintte production page-start rule'u eklenmedi. Aşağıdaki senaryolar
şu an runtime failure üretmemelidir; gelecekte normalize model ve
source-backed validator eklenirse minimum regresyon seti olarak
kullanılmalıdır.

---

Senaryo Beklenen sonuç

---

Giriş önceki paragraf `sectPr` Şablon gözlemi olarak
default/`nextPage` ile ayrılmış raporlanabilir; mevcut production
sonucu yok.

Giriş önünde explicit boundary yok Production failure yok; doğal
pagination bilinemez.

Kaynaklar önceki paragraf `sectPr` Şablon gözlemi olarak
default/`nextPage` ile ayrılmış raporlanabilir; mevcut production
sonucu yok.

Kaynaklar önünde explicit boundary Production failure yok.
yok

Heading direct `pageBreakBefore` Gelecekte explicit page-boundary
adayı; şu an production sonucu yok.

Önceki paragrafta Gelecekte explicit page-boundary
`w:br w:type="page"` adayı; şu an production sonucu yok.

Önceki paragrafta Gelecekte explicit page-boundary
`sectPr type=nextPage` adayı; şu an production sonucu yok.

Önceki paragrafta Gelecekte explicit boundary adayı;
`sectPr type=oddPage/evenPage` tek/çift semantik korunmalı.

Önceki paragrafta Yeni sayfa kabul edilmemeli.
`sectPr type=continuous`

Yalnız boş paragraflar Yeni sayfa kanıtı sayılmamalı.

Doğal sayfa taşması Word layout motoru olmadan unknown;
production failure yok.

Missing section `REQUIRED_SECTION` ownership'i
korunur; page-start failure yok.

Duplicate section Rastgele occurrence seçilmemeli;
mevcut ownership korunur.

TOC cached entry Gerçek section start sayılmamalı.

Conditional liste section yok ve Page-start failure yok.
koşul false

Manual numbering heading Page-start sonucu varsa section
identity aynı kullanılmalı.

Word automatic numbering heading Manual numbering ile aynı akademik
sonuç hedeflenmeli.

Heading format hatalı `HEADING_LEVEL_FORMAT` ownership'i
korunur.

Page-number section metadata `PAGE_NUMBER_SEQUENCE` ile
karıştırılmamalı.

---

## Runtime rule composition audit (current repository truth)

The UI selection value is propagated unchanged through `UploadPage` →
`analyzeDocx` → `RuleSetSelector` → `RuleResolver` → `RuleEngine`.
Unknown study types are rejected; there is no source-research fallback.
The current resolved and engine-result counts are:

Selection Resolved Enabled Engine results Missing validator

---

`experimental` 46 46 46 0
`source-research` 44 44 44 0

Both selections share 41 resolved rules. Experimental adds
`experimental.general-information-literature`,
`experimental.material-method`, `experimental.findings-discussion`,
`experimental.section-order`, and `experimental.heading-numbering`.
Source Research instead adds `source-research.general-information`,
`source-research.section-order`, and
`source-research.heading-numbering`. Thus the net difference is two
rules. `NOT_APPLICABLE` remains a `RuleResult` and is included in total;
only the score denominator excludes it. Earlier 47/45 figures were a
reporting/counting error, not repository or runtime composition truth.
\## Heading spacing source audit

Production decision: no rule added; counts remain Experimental 46 and
Source Research 44.

---

Scenario Expected audit result

---

Guide: paragraph before heading Strong rendered-gap requirement:
1.5 lines

Guide: paragraph after heading Strong rendered-gap requirement: 1
line

Heading 1/2/3 Wording covers headings generally;
no property-level value per level

`before=240` vs `beforeLines=100` Different units; never treated as
equal blindly

Explicit direct zero Preserved and overrides inherited
non-zero

Style inheritance / basedOn cycle Nearest value wins; traversal is
cycle-safe

Adjacent paragraph contributions Rendered gap depends on the maximum
contribution

Empty paragraph Not automatically equivalent to one
line without layout data

Page-start heading Property compliance is not
rendered-layout compliance

Official template variation Implementation evidence only; not a
new requirement

HEADING_SPACING rule Not configured because a
heading-only property check is
unsafe

Resolver/engine parity Experimental 46/46; Source Research
44/44

---

## Body/heading typography hardening

---

Scenario Expected

---

Body TNR / 12 pt Existing font rules PASS

One visible run Arial / 11 pt Corresponding rule FAIL

Character style overrides paragraph Character-style value is effective
style

Direct run overrides character Direct value wins
style

Character-style basedOn cycle No crash

Empty/drawing-only run with Ignored by font family/size checks
different style

Mixed-run heading, one wrong Level HEADING rule FAIL

Style bold=true + direct bold=false HEADING rule FAIL

Level 0/1/2 format Existing three rules own
font/size/bold

Level 0/1/2 alignment Existing common HEADING_ALIGNMENT
owns left alignment

Caption left / single line Caption rule owns
alignment/spacing; general font
rules own TNR/12

Italic/underline/case No new failure without
source-backed prohibition

Counts Experimental 46; Source Research 44

## Academic structure hardening smoke

| Scenario | Expected |
| --- | --- |
| Experimental selector/resolver/engine | 46 / 46 / 46 |
| Source Research selector/resolver/engine | 44 / 44 / 44 |
| Unknown study type | Explicit rejection |
| Missing validator | 0 |
| Duplicate resolved ID | 0 |
| TOC cached `KAYNAKLAR` | Not a section occurrence |
| Table-cell `KAYNAKLAR` | Not a section occurrence |
| Caption `KAYNAKLAR` | Not a section occurrence |
| Body `PCR` | Abbreviation evidence |
| Numbered-list `FAO` | Not abbreviation applicability evidence |
| Missing Heading 2/3 | Legitimate `NOT_APPLICABLE` |
| Optional `Ekler` absent | No failure |

---

## Theme font resolution matrix

---

Scenario Expected

---

Direct explicit Times New Roman / PASS / FAIL
Arial

Character style Times New Roman / PASS / FAIL
Arial

Direct explicit value over Nearest run layer wins
character theme/style

Paragraph theme and Resolved through theme1.xml
document-default theme

Theme maps token to Times New Roman PASS / FAIL
/ Arial

Same `w:rFonts` has explicit and Theme attribute wins
corresponding theme attribute

Higher cascade layer explicit Higher layer wins
versus lower layer theme

Turkish text (`ÇOMÜ`, ASCII and High ANSI slots are both
`İçindekiler`) evaluated

Mixed visible run resolves to two FAIL
different families

Unknown token, missing theme, or FAIL without crash
missing theme font

Character-style or paragraph-style No crash
cycle

Font size, bold, heading Existing behavior unchanged
occurrence, and scope

Counts / engine parity Experimental 45/45; Source Research
43/43

---
## Manual-numbered academic section indentation regression

| Scenario | Expected |
| --- | --- |
| `1. GİRİŞ` is marked as a rule-defined section while its stored `normalizedName` is `1giris` | Section is selected through the shared section matcher |
| Plain prose immediately after that heading has direct `firstLineTwips=850` | `PARAGRAPH_INDENTATION` returns `PASSED` |
| A numbered-list paragraph in the same range has a wrong indentation | Excluded from indentation candidates |
| A table-cell or TOC paragraph in the same range has a wrong indentation | Excluded from indentation candidates |
