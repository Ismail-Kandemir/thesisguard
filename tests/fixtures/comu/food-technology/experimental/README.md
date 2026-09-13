# Experimental DOCX fixture corpus

Bu klasörün manifest kaynağı `manifest.json` dosyasıdır. Her mevcut fixture için
origin, tier, mode, amaç, hedeflenen özellikler, doğrulama aracı, privacy durumu ve
biliniyorsa exact regression sonucu kaydedilir.

## Corpus tier'ları

- **Tier 0 — Golden regression:** Tam production kural setinin deterministic doğru
  örneği.
- **Tier 1 — Targeted negative regression:** Tier 0 üzerinde tek bir davranışı
  bilinçli olarak bozan küçük OOXML mutation'ları.
- **Tier 2 — Word-native representation:** Microsoft Word tarafından kaydedilmiş,
  farklı doğal OOXML temsillerini doğrulayan privacy-safe belgeler.
- **Tier 3 — Realistic synthetic thesis:** Gerçekçi uzunluk ve düzenleme geçmişine
  sahip, tamamen sentetik içerikli tez belgeleri.
- **Tier 4 — Anonymized real-world:** Açık izin, anonimleştirme ve privacy incelemesi
  tamamlanmış gerçek-dünya örnekleri. Bu dosyalar varsayılan olarak repository'ye
  eklenmez.

Bir DOCX'in ZIP/XML içeriğini elle veya script ile değiştirmek onu Word-native
yapmaz. `word-native` origin yalnız Microsoft Word tarafından kaydedilmiş DOCX için
kullanılır. Word-native fixture metadata'sında mümkün olduğunda Word sürümü,
platform ve creation method belirtilmelidir.

Mevcut fixture'lar sentetiktir. `full-correct.docx` python-docx tabanlıdır;
negative ve exploratory fixture'lar bunun kontrollü OOXML mutation türevleridir.

## Manifest alanları

- `file`: klasöre göre fixture dosya adı
- `tier`: 0–4 corpus seviyesi
- `origin`: `synthetic-ooxml`, `word-native`, `realistic-synthetic` veya
  `anonymized-real-world`
- `mode`: `regression` veya `exploratory`
- `purpose`: fixture'ın kısa amacı
- `targetedFeatures`: hedeflenen production davranışları
- `expected`: regression sonucu; exploratory sonuç bilinmiyorsa yazılmaz
- `createdWith`, `verifiedWith`, `privacyStatus`: provenance ve güven bilgisi

Regression `expected` alanı total/passed/failed/N/A sayılarını ve exact failed/N/A
rule ID listelerini taşır. İnsan dilindeki message veya solution metinleri snapshot
olarak tutulmaz.

## Planlanan Word-native dalga

Aşağıdaki dosyalar henüz mevcut değildir ve manifest fixture entry'si değildir:

1. `word-native-style-inheritance-pass.docx`
2. `word-native-docdefaults-theme-pass.docx`
3. `word-native-direct-override-fail.docx`
4. `word-native-automatic-headings-pass.docx`
5. `word-native-split-run-structure-pass.docx`
6. `word-native-complex-page-fields-pass.docx`

Bu belgeler gerçek Microsoft Word ile oluşturulup kaydedildikten, provenance
bilgileri yazıldıktan ve production pipeline sonucu incelendikten sonra manifest'e
eklenmelidir. İlk gözlemde desteklenmeyen bir temsil otomatik olarak bug sayılmaz;
önce bug, limitation veya ambiguous olarak sınıflandırılır.

## Mevcut fixture'lar

Place the verified golden DOCX here:

`full-correct.docx`

This file represents COMU / Applied Sciences / Food Technology / Bachelor /
Experimental, verified manually as `46 PASSED / 0 FAILED / 0 NOT_APPLICABLE`.

`multi-section-margin-synthetic.docx`

Regression fixture derived from `full-correct.docx`. An intermediate
paragraph-level section has intentionally invalid left/right margins, while the
final body-level section keeps the golden margins. It documents current
section-aware margin validation behavior.

`multi-section-final-margin-fail-synthetic.docx`

Regression fixture derived from `full-correct.docx`. Intermediate paragraph-level
section margins are correct, while the final body-level section has intentionally
invalid left/right margins.

`multi-section-margin-all-correct-synthetic.docx`

Regression fixture derived from `full-correct.docx`. Paragraph-level and final
body-level section margins are all correct in a multi-section document.

`experimental-indentation-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
academic body first-line indentation.

`experimental-typography-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
academic body run font size.

`experimental-paragraph-format-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
academic body paragraph line spacing.

`experimental-object-alignment-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
table object alignment.

`experimental-margin-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
right page margin.

`experimental-page-number-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
footer page number alignment.

`experimental-page-sequence-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
page number restart value at the main-text section transition.

`style-inheritance-synthetic.docx`

Derived synthetic OOXML regression fixture whose academic body paragraph receives
its effective justified alignment through a child/base paragraph-style chain.

`docdefaults-theme-synthetic.docx`

Derived synthetic OOXML regression fixture whose target academic body run receives
its effective font size from docDefaults and its effective font family from a
docDefaults minorHAnsi token resolved through the document theme.

`automatic-heading-numbering-synthetic.docx`

Derived synthetic OOXML regression fixture whose academic headings omit literal
number prefixes and receive multilevel visible labels from numPr, numbering.xml,
and production counter-state normalization.

`split-runs-synthetic.docx`

Derived synthetic OOXML regression fixture that fragments semantic tokens across
formatting-equivalent runs while preserving exact visible paragraph text. It
covers heading, caption, reference, keywords, and body/abbreviation reconstruction.

`complex-field-cached-result-synthetic.docx`

Derived synthetic OOXML regression fixture that wraps an in-text figure reference
in a complex REF field. It verifies only control/instruction text exclusion and
split cached-result text reconstruction; it does not claim REF instruction semantics.

`toc-field-marked-synthetic.docx`

Supported marked-TOC regression fixture. Its cached result is identified by both
TOC1 style and a Table of Contents content-control marker, and intentionally uses
11 pt text to prove exclusion from academic body typography.

`toc-field-unmarked-synthetic.docx`

Supported unmarked-TOC regression fixture. Its cached result paragraphs have no
explicit TOC paragraph style or content-control marker; membership comes from the
result range of a balanced, multi-paragraph complex TOC field. Nested PAGEREF fields
must not interrupt that outer ownership range.

Together these fixtures verify cached-result paragraph membership and academic-body
typography exclusion for the supported marked and balanced complex-field forms. They
do not verify rendered pagination, stale TOC cache correctness, arbitrary malformed
Word field recovery, every possible Word TOC variant, or Word-native serialization.

Do not regenerate or edit this binary just to satisfy the regression. A failing
golden run after a production change is evidence to investigate first.
