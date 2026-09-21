# Phase 4E-16 — University Guide Grounding & Object Semantics Audit

## 1. Purpose

Bu audit, ÇOMÜ Uygulamalı Bilimler Fakültesi Gıda Teknolojisi Deneysel Lisans tez setinde çözümlenen 46 kuralın repository içi kaynak dayanağını ve Phase 4E-15'te görülen nesne sınıflandırma belirsizliğini inceler. Production parser, validator, rule config veya semantics değiştirilmemiştir.

## 2. Baseline

- Beklenen ve doğrulanan branch: `main`.
- `HEAD`, `main`, `origin/main`: `d1daf9b3f018f5965e90dddd0fffdd3cf4d90539`.
- İç repository başlangıçta temizdi.
- Runtime setleri: Common 41, Experimental 46, Source Research 44.
- Phase 4E-15 sınıflandırması: object classification gap, architectural limitation, ambiguous product semantics.

## 3. Source hierarchy

1. Level A: Gerçek guide/snapshot. Repository'de yok.
2. Level B: `docs/UNIVERSITY_RULES.md` ve Gıda Teknolojisi README'sindeki kılavuz aktarımı. Bu auditin en güçlü kanıtı.
3. Level C: JSON rule config. Mevcut yorumu gösterir; kaynak değildir.
4. Level D: parser/validator. Davranışı gösterir; üniversite hükmü değildir.

`DIRECT` bu raporda “Level B metninde açıkça aktarılmış” demektir; primary belgenin bağımsız doğrulandığı anlamına gelmez.

## 4. Repository source inventory

| Path | Düzey | Rol |
| --- | --- | --- |
| `docs/UNIVERSITY_RULES.md` | B | Kılavuz maddeleri, source kararları, rule scope ve approximation notları |
| `src/data/universities/comu/faculties/applied-sciences/departments/food-technology/README.md` | B | Bölüm bazlı kılavuz aktarımı ve runtime composition |
| `src/data/universities/comu/bachelor.json` | C | 11 university-level tanım; runtime'da 9'u kalır |
| `.../food-technology/bachelor.json` | C | 32 department tanımı; iki university rule'unu override eder |
| `.../bachelor/experimental.json` | C | 5 deneysel track kuralı |
| `.../bachelor/source-research.json` | C | 3 kaynak araştırması track kuralı |
| `src/features/analysis/rules/RuleResolver.ts` | D | Extends sırası, override ve çözümleme |
| `src/features/analysis/parsers/documentCaptionsNormalizer.ts` | D | Tablo, drawing, caption ve association normalizasyonu |
| `src/features/analysis/rules/validators/*Object*.ts` | D | Object rule değerlendirmesi |
| `docs/PHASE_4E_15_OBJECT_REPRESENTATION_AUDIT.md` | D/audit | Representation fixture kanıtları |
| `tests/fixtures/comu/food-technology/experimental/*.docx` | test | Synthetic/golden test belgeleri; guide değildir |

Aramada gerçek guide PDF'si, indirilmiş HTML'i, kaynak DOCX şablonları veya versioned source snapshot bulunmadı. Test DOCX'leri primary source değildir.

## 5. Primary source availability

**PRIMARY SOURCE NOT PRESENT IN REPOSITORY.** Repository dokümantasyonu “kılavuz 4.1/4.2/4.4/4.6” ve iki resmî Word şablonunu aktarıyor, fakat bağımsız denetim için bu belgelerin kendileri, URL'leri, hash'leri, retrieval tarihi, yayın tarihi ve sürümü tutulmuyor. Sayfa numarası uydurulmadı; yalnız repository'de kayıtlı section/madde referansları kullanıldı.

## 6. Rule architecture

| Katman | Tanımlı | Resolved role | Amaç | Source confidence |
| --- | ---: | --- | --- | --- |
| `comu.bachelor` | 11 | 9 | Üniversite ortak typography/paragraph/margin defaults | Level C; Level B aktarımıyla destekli |
| Food Technology bachelor | 32 | 32 | Department ortak kuralları ve iki override | Level C; çoğu Level B'de açıklanmış |
| Experimental | 5 | 5 | Deneysel çalışma sections/order/numbering | Level C + Level B |
| Source Research | 3 | 3 | Kaynak araştırması sections/order/numbering | Level C + Level B |

Common çözüm: 11 university + 32 department − 2 override = 41. Experimental = 41 + 5 = 46. Source Research = 41 + 3 = 44.

## 7. Resolved rule provenance

Audit script çözüm sırasını deterministik olarak yeniden kurdu: 9 university, 32 department, 5 experimental. Override edilen ID'ler `comu.bachelor.margin.top` ve `comu.bachelor.heading.heading1`; yerlerine department ID'leri gelir. Production `RuleDefinition` üzerinde origin/provenance alanı yoktur; resolver sonuç listesi kaynağını taşımadığından runtime sonrasında provenance geri kazanılamaz. Audit provenance'ı layer girdilerinden yeniden kurar.

## 8. 46-rule grounding summary

| Classification | Count | Percent |
| --- | ---: | ---: |
| DIRECT | 27 | 58.7% |
| DERIVED | 14 | 30.4% |
| ASSUMED | 0 | 0.0% |
| UNSUPPORTED | 0 | 0.0% |
| AMBIGUOUS | 5 | 10.9% |
| **DIRECT + DERIVED** | **41** | **89.1%** |

Bu internal traceability metric ürün skoru değildir. “0 unsupported”, primary source'un mevcut olduğu anlamına gelmez; 41 kayıt Level B aktarımında açık dayanak bulmuştur. Beş ambiguity, `Şekil` requirement'ının OOXML object taxonomy'sine uygulanma sınırıdır.

## 9. Grounding matrix

Expected değerlerin ayrıntısı ilgili JSON rule'dadır; burada kısa condition gösterilmiştir. Her rule'da solution bulunduğu script tarafından doğrulanır.

| # | Rule ID | Category/severity | Expected/condition | Grounding | Source/reference | Not |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `comu.bachelor.typography.font-family` | typography/error | Times New Roman | DIRECT | Food Tech README 75-84 | Tüm metin |
| 2 | `comu.bachelor.typography.font-size` | typography/error | 12 pt | DERIVED | README 78-84 | Numeric normalization |
| 3 | `comu.bachelor.heading.heading2` | heading/error | TNR 12 bold | DERIVED | README 81-84 | Alt başlığa modelleme |
| 4 | `comu.bachelor.heading.heading3` | heading/warning | TNR 12 bold | DERIVED | README 81-84 | Alt-alt başlığa modelleme |
| 5 | `comu.bachelor.spacing.line-height` | spacing/warning | 1.5 line | DERIVED | University Rules remaining audit | Numeric normalization |
| 6 | `comu.bachelor.format.alignment` | format/warning | justify | DIRECT | University Rules remaining audit | Ana metin |
| 7 | `comu.bachelor.margin.left` | margin/error | 3 cm | DERIVED | README 78-80 | OOXML unit conversion |
| 8 | `comu.bachelor.margin.right` | margin/error | 2.5 cm | DERIVED | README 78-80 | OOXML unit conversion |
| 9 | `comu.bachelor.margin.bottom` | margin/error | 2.5 cm | DERIVED | README 78-80 | OOXML unit conversion |
| 10 | `...heading-alignment` | heading/error | levels 0/1/2 left | DIRECT | README 13-25 | Scope normalization |
| 11 | `...paragraph-indentation` | spacing/error | first line 1.5 cm | DERIVED | README 46-56 | 849–851 twip |
| 12 | `...margin.top` | margin/error | 3 cm | DERIVED | README 78-80 | University top margin override |
| 13 | `...heading.heading1` | heading/error | TNR 12 bold | DERIVED | README 81-84 | University 14 pt override |
| 14 | `...body-level-0-heading-format` | heading/error | level 0 TNR 12 bold | DERIVED | README 398-422 | Occurrence model |
| 15 | `...page-number` | structure/error | footer, center, required | DIRECT | README 101-104 | Field existence/location |
| 16 | `...table-of-contents` | structure/error | İçindekiler required | DIRECT | README 101-104 | Field type şart değil |
| 17 | `...references` | structure/error | Kaynaklar required | DIRECT | README 106-108 | Format kontrolü değil |
| 18 | `...summary-tr` | structure/error | Özet required | DIRECT | README 110-113 | Section presence |
| 19 | `...summary-en` | structure/error | Abstract required | DIRECT | README 110-113 | Section presence |
| 20 | `...plagiarism-declaration` | structure/error | Beyan required | DIRECT | README 115-123 | İçerik/oran kontrolü değil |
| 21 | `...page-number-sequence` | structure/error | roman → decimal restart 1 | DERIVED | University Rules 876-900 | Section metadata normalization |
| 22 | `...table-object-alignment` | format/error | table center | DIRECT | University Rules 972-995 | `w:tbl` scope net |
| 23 | `...figure-object-alignment` | format/error | figure center | AMBIGUOUS | University Rules 972-1033 | Figure object taxonomy yok |
| 24 | `...table-caption-placement` | format/error | before | DIRECT | University Rules 902-927 | Top-level table approximation |
| 25 | `...figure-caption-placement` | format/error | after | AMBIGUOUS | University Rules 902-927 | Figure taxonomy yok |
| 26 | `...table-caption-format` | format/error | left, single | DIRECT | University Rules 902-940 | Style inheritance approximation |
| 27 | `...figure-caption-format` | format/error | left, single | AMBIGUOUS | University Rules 902-940 | Figure taxonomy yok |
| 28 | `...table-in-text-reference` | citation/error | every identified table | DIRECT | University Rules 942-970 | Caption-number association |
| 29 | `...figure-in-text-reference` | citation/error | every identified figure | AMBIGUOUS | University Rules 942-970 | Figure taxonomy yok |
| 30 | `...acceptance-approval` | structure/error | section required | DIRECT | README 86-99 | Resmî alias destekli |
| 31 | `...acknowledgements` | structure/error | Teşekkür required | DIRECT | README 115-119 | Section presence |
| 32 | `...introduction` | structure/error | Giriş required | DIRECT | README 115-119 | Section presence |
| 33 | `...conclusion` | structure/error | Sonuç required | DIRECT | README 115-119 | Section presence |
| 34 | `...cv` | structure/error | Özgeçmiş required | DIRECT | README 115-123 | Section presence |
| 35 | `...list-of-tables` | structure/error | if table, list required | DIRECT | University Rules 1228-1245 | Content consistency değil |
| 36 | `...list-of-figures` | structure/error | if figure, list required | AMBIGUOUS | University Rules 1228-1245 | `hasFigures` taxonomy gap |
| 37 | `...list-of-abbreviations` | structure/error | if abbreviation, list required | DIRECT | README 141-159 | Heuristic fact approximation |
| 38 | `...summary-tr-word-count` | structure/error | max 200 | DIRECT | README 200-209 | Visible content count |
| 39 | `...summary-en-word-count` | structure/error | max 200 | DERIVED | README 200-205 | TR hükmü EN'e aktarılmış |
| 40 | `...summary-tr-keywords` | structure/error | 3–5, section end | DIRECT | README 211-220 | Label/range explicit |
| 41 | `...summary-en-keywords` | structure/error | 3–5 Keyword | DERIVED | README 211-220 | English normalization |
| 42 | `...experimental.general-information-literature` | structure/error | section required | DIRECT | README 164-178 | Track-only |
| 43 | `...experimental.material-method` | structure/error | section required | DIRECT | README 164-178 | Track-only |
| 44 | `...experimental.findings-discussion` | structure/error | section required | DIRECT | README 164-178 | Track-only |
| 45 | `...experimental.section-order` | structure/error | relative ordered sections | DIRECT | README 186-198 | Conditional sections excluded |
| 46 | `...experimental.heading-numbering` | structure/error | main headings numbered level 0 | DIRECT | University Rules 812-834 | Exact sequence kontrolü değil |

Tam evidence metni, confidence ve note alanları `tests/audit/data/comuFoodTechnologyRuleGrounding.json` içindedir.

## 10. Category summary

| Runtime category | Total | DIRECT | DERIVED | ASSUMED | UNSUPPORTED | AMBIGUOUS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| typography | 2 | 1 | 1 | 0 | 0 | 0 |
| heading | 5 | 1 | 4 | 0 | 0 | 0 |
| spacing | 2 | 0 | 2 | 0 | 0 | 0 |
| format | 7 | 4 | 0 | 0 | 0 | 3 |
| margin | 4 | 0 | 4 | 0 | 0 | 0 |
| structure | 24 | 20 | 3 | 0 | 0 | 1 |
| citation | 2 | 1 | 0 | 0 | 0 | 1 |

İstenen kavramsal family eşlemesinde typography 2; paragraph 3 (line height, alignment, indentation); margins 4; heading 6; required sections/order 15; summary/abstract/keywords 6; page numbering 2; tables 5; figures 5; references 1; abbreviations 1'dir. Overlap önlenmesi için her rule tek family'ye atanmıştır.

## 11. Severity summary

| Severity | Total | DIRECT | DERIVED | ASSUMED | UNSUPPORTED | AMBIGUOUS | Grounded DIRECT+DERIVED |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| error | 43 | 26 | 12 | 0 | 0 | 5 | 38 |
| warning | 3 | 1 | 2 | 0 | 0 | 0 | 3 |

Error severity içindeki beş ambiguous rule kullanıcı güveni açısından kritiktir; sorun akademik hükmün kendisi değil, `figure` kümesinin sınırıdır.

## 12. Object terminology findings

Repository Level B source aktarımında normatif terimler `Tablo` ve `Şekil`dir. `Tablolar Listesi`, `Şekiller Listesi`, `Tablo n.` ve `Şekil n.` örnekleri vardır. `ResimYazs` yalnız style ID notunda geçer ve production şartı değildir. Grafik, diyagram, şema, harita, fotoğraf, screenshot, SmartArt, chart ve çizelge için tanım veya “Şekil alt türüdür” ilişkisi bulunmadı. İngilizce figure/chart/image/diagram kullanımları çoğunlukla implementation/audit terminolojisidir, guide taxonomy kanıtı değildir.

## 13. Object semantics matrix

| Object | OOXML representation | Current parser | Source says | Recommended category | Confidence | Action |
| --- | --- | --- | --- | --- | --- | --- |
| Normal picture | `w:drawing` + usually `pic:pic` | figure | Yalnız genel “Şekil”; picture mapping yok | UNRESOLVED | low | Policy bekle |
| Photograph | Usually picture payload | representation'a göre figure | Terim yok | UNRESOLVED | low | Content semantics gerekli |
| Screenshot | Usually picture payload | representation'a göre figure | Terim yok | UNRESOLVED | low | Content semantics gerekli |
| Chart | `w:drawing` + `c:chart` | figure | Chart/grafik mapping yok | UNRESOLVED | low | Exclude/include etme |
| Graph | Chart/picture/shapes olabilir | representation-dependent | Grafik tanımı yok | UNRESOLVED | low | OOXML chart ile eşitleme |
| SmartArt | `w:drawing` + diagram parts | figure | SmartArt/diyagram mapping yok | UNRESOLVED | low | Exclude/include etme |
| Diagram | SmartArt/group/picture olabilir | representation-dependent | Diyagram tanımı yok | UNRESOLVED | low | Semantic evidence edin |
| Schema | Shapes/picture/SmartArt olabilir | representation-dependent | Şema tanımı yok | UNRESOLVED | low | Semantic evidence edin |
| Map | Picture/group olabilir | representation-dependent | Harita tanımı yok | UNRESOLVED | low | Semantic evidence edin |
| Grouped shapes | grouped DrawingML | figure | Group mapping yok | UNRESOLVED | low | İçeriği group tag'inden çıkarma |
| VML image | `w:pict/v:imagedata` | not figure | Mapping yok | UNRESOLVED | low | Policy bekle |
| OLE | `w:object/o:OLEObject` | not figure | Mapping yok | UNRESOLVED | low | Policy bekle |
| Equation | `m:oMath`, OLE veya image | genelde not figure | Mapping yok | UNRESOLVED | low | Ayrı category olasılığını araştır |
| Table | top-level `w:tbl` | table | Açıkça Tablo | table | high | Mevcut category korunabilir |
| Çizelge | Ayrı OOXML tipi yok | caption alias değil | Tanım/eşanlam yok | UNRESOLVED | low | Tablo alias'ı ekleme |

## 14. Table vs Çizelge

Config `table`, UI/source label `Tablo`, caption detector yalnız case-insensitive `Tablo <number>.` kullanır. `Çizelge` prefix'i tanınmaz. Repository source aktarımı “Çizelge = Tablo” veya ayrı kategori demez. Sonuç: eşitlik source-backed değildir; **UNRESOLVED**. Mevcut behavior kaynakla çatıştığı kanıtlanmış değildir.

## 15. Figure semantics

Config tek `figure` kategorisi kullanır. Parser body altındaki semantic `w:drawing` öğelerinden textbox içerenleri çıkarıp kalan her drawing'i figure yapar. `pic:pic`, `c:chart`, diagram URI veya group payload şartı yoktur. Guide aktarımı yalnız `Şekil` der ve alt türleri tanımlamaz. Dolayısıyla akademik hüküm açık, representation-to-domain mapping belirsizdir.

## 16. Caption semantics

Source/config uyumu: table caption üstte; figure caption altta; ikisi sola yaslı, tek satır aralıklı. Parser yalnız `Tablo n.` ve `Şekil n.` prefix'lerini caption kabul eder, yakın block association kurar; nested table ve anchored figure için güvenli sınırlamalar vardır. Exact punctuation/title/capitalization ayrı source-backed rule değildir. Drift: reliable-nearest-paragraph association bir **IMPLEMENTATION APPROXIMATION**dır; figure taxonomy ise **SOURCE AMBIGUITY**dır.

## 17. Figure reference semantics

Repository Level B aktarımı kılavuzun tablo ve şekillere metin içinde atfı açıkça zorunlu tuttuğunu söyler. Rule bu nedenle varsayım değildir. Validator güvenilir caption numarası olan her figure için caption/list/TOC dışı metinde aynı kind/number arar. Exact cümle, atfın önce gelmesi ve sequence kontrol edilmez. Figure kümesi belirsiz olduğu için rule grounding `AMBIGUOUS`tır.

## 18. Alignment semantics

Source aktarımı 4.4'te tablo ve şekillerin kendisinin ortalanmasını ister; caption ise sola yaslıdır. Config bu iki condition'ı doğru ayırır. Table alignment direct/style `w:jc`; inline figure alignment taşıyıcı paragraph alignment'ından çıkarılır. Rendered coordinate olmadığı için bu **IMPLEMENTATION APPROXIMATION**dır. “Caption centered” diye yanlış yorum yoktur.

## 19. List-of-figures semantics

Source aktarımı: şekil varsa Şekiller Listesi zorunludur; sayı eşiği veya always-required hükmü yoktur. Config `requiredWhen hasFigures == true` ile uyumludur. Ancak `hasFigures`, generic `w:drawing` kümesinden üretildiği için chart/SmartArt/group list requirement'ını tetikleyebilir. İçerik eşleşmesi, page number ve field zorunluluğu denetlenmez ve kaynakta güçlü requirement olmadığı belgelenmiştir.

## 20. Table semantics

Table için source/config: center object; caption before; caption left/single; in-text reference; table varsa Tablolar Listesi. Parser top-level `w:tbl` occurrence kullanır; nested tables akademik object scope dışında bırakılır. Bu exclusion guide hükmü değil, false association azaltan implementation approximationdır. Figure kuralları table'dan körlemesine kopyalanmamıştır: placement yönü farklıdır; ortak format/alignment/reference hükümleri source aktarımında açıkça birlikte anılır.

## 21. Source/config/validator drift

| Alan | Source | Config | Validator/parser | Classification |
| --- | --- | --- | --- | --- |
| Margins/font/spacing | Exact values | Exact normalized values | OOXML/effective formatting | NO DRIFT / normalization |
| Heading alignment | Body headings left | levels 0/1/2 left | Reliable academic heading occurrence | IMPLEMENTATION APPROXIMATION |
| Indentation | 1.5 cm | 1.5 cm, ±1 twip | Selected body sections/exclusions | IMPLEMENTATION APPROXIMATION |
| Table identity | Tablo | `object: table` | top-level `w:tbl` | IMPLEMENTATION APPROXIMATION |
| Figure identity | Şekil | `object: figure` | every non-textbox `w:drawing` | SOURCE AMBIGUITY / RULE INTERPRETATION |
| Captions | above/below, left/single | same | nearest reliable block | IMPLEMENTATION APPROXIMATION |
| References | table/figure referenced | same | caption number match | IMPLEMENTATION APPROXIMATION |
| Figure list | if figure | `hasFigures` | any normalized drawing | POTENTIAL VALIDATOR/RULE BOUNDARY BUG, unproven |
| Abbreviation list | if abbreviations | conditional | heuristic `hasAbbreviations` | IMPLEMENTATION APPROXIMATION |
| Guide provenance | real guide implied | title only | no per-rule source | UNSUPPORTED PROVENANCE MODEL |

Hiçbir potential bug bu phase'de production bug'a promote edilmedi; doğru semantic policy bilinmiyor.

## 22. Trust risks

Beş error rule kesin FAIL üretebilirken figure object seti source-backed değildir: figure alignment, caption placement, caption format, in-text reference ve list-of-figures. Phase 4E-15 fixture'larında chart/SmartArt/group 45/46 sonucu bunun somut etkisini gösterir. Kullanıcıya akademik kesinlik izlenimi vermek risklidir. Ayrıca production rule'ların 0/46'sında per-rule source metadata vardır; UI guide title gösterebilse de quote/section/confidence gösteremez.

## 23. Phase 4E-15 decision

**OPTION C — Source object taxonomy konusunda yetersiz. 4E-15A BLOCKED BY SEMANTICS.** Current generic behavior'ın sonuç etkisi kanıtlandı, yanlışlığı kanıtlanmadı. Chart, SmartArt ve grouped drawing'i dışlamak da dahil etmek kadar spekülatif olur.

## 24. Recommended source metadata architecture

Minimum production önerisi (bu phase'de uygulanmadı):

```ts
interface GuideSource {
  id: string;
  title: string;
  institution: string;
  faculty?: string;
  department?: string;
  program?: string;
  documentVersion?: string;
  effectiveDate?: string;
  retrievedAt: string;
  sourceUrl: string;
  snapshotPath: string;
  sha256: string;
}

interface RuleSourceReference {
  guideId: string;
  section?: string;
  page?: number;
  quote: string;
  interpretation?: string;
  confidence: "high" | "medium" | "low";
}
```

RuleDefinition doğrudan serbest `sourceQuote` alanlarıyla şişirilmek yerine `sourceReferences: RuleSourceReference[]` taşımalıdır. Guide snapshot immutable/versioned olmalı; rule-set `1.0.0` ile guide document version ayrı alanlardır.

## 25. Trust boundary

Bu audit repository içi kanıtla sınırlıdır. Level B belgelerdeki guide aktarımlarının primary PDF'ye sadakati doğrulanamadı. Synthetic fixtures Microsoft Word render fidelity kanıtı değildir. Object content'i yalnız tag'den güvenilir çıkarılamaz. Page bilinmediğinde page yazılmadı. External internet kanıtı kullanılmadı.

## 26. Next phase recommendation

En yüksek değerli sonraki phase parser değişikliği değil, **versioned primary source acquisition / ingestion** olmalıdır. Guide PDF ve resmî şablonlar izinli biçimde repository’ye veya doğrulanabilir artifact store'a alınmalı; URL, retrieval date, hash ve document version kaydedilmeli. Özellikle “Şekil kapsamına grafik/resim/fotoğraf/diyagram/şema/harita girer mi?”, “Çizelge Tablo mudur?” ve embedded/equation policy için exact guide wording veya yetkili fakülte açıklaması gerekir. Ancak bundan sonra 4E-15A classifier policy tasarlanmalıdır.

## 27. Source Research ruleset

Source Research 44 = Common 41 + üç track-only rule: `source-research.general-information`, `source-research.section-order`, `source-research.heading-numbering`. Experimental 46 = Common 41 + beş track-only rule: üç required section, section order, heading numbering. 46−44 farkı sayı olarak iki olsa da ID setleri arasında sekiz symmetric-difference ID vardır (5 experimental-only, 3 source-research-only). Fark source confidence derecesi değil, çalışma türü yapısıdır.

## 28. Common ruleset

Common 41, iki çalışma türünün paylaştığı akademik hükümleri taşır. Common → child progression development history değil açık runtime inheritance'tır; fakat katman adları tek başına source confidence ifade etmez. Source confidence ayrı metadata olmadığı için bundan çıkarılamaz.

## 29. Guide metadata and version trust

`GuideMetadata` yalnız `{ title: string }` içerir. Bilinen title: “Gıda Teknolojisi Bitirme Tezi Hazırlama Kılavuzu”. URL, guide version, date, faculty, department, retrievedAt ve hash guide nesnesinde yoktur. Rule-set `version: 1.0.0` guide sürümü değildir. UI/report `ruleSetVersion` ve `guideTitle` taşır; guide version taşımadığı için ayrımı tam modelleyemez. Guide version: **UNKNOWN**.

## 30. Audit artifacts and deterministic checks

- `tests/audit/data/comuFoodTechnologyRuleGrounding.json`: 46 explicit rule record + 15 object record.
- `tests/audit/ruleSourceGroundingAudit.cjs`: exact resolved ID equality, duplicates, unknown/missing IDs, allowed enums, object completeness, category/severity/provenance summary.
- Script sonucu: PASS; 46 resolved = 46 records; duplicate/missing/unknown yok; production source metadata 0/46.

## 31. Phase 4E-15A readiness

**4E-15A NOT READY.** Eksik exact evidence:

- Chart/grafik `Şekil` midir?
- Resim/fotoğraf/screenshot `Şekil` midir?
- Diyagram/şema/SmartArt `Şekil` midir?
- Grouped shapes içerikten bağımsız `Şekil` sayılır mı?
- Harita, equation, VML ve OLE kategorileri nedir?
- `Çizelge` ile `Tablo` eşanlamlı mıdır?
- Kategori caption prefix'inden mi, object representation'dan mı, yoksa yazar beyanından mı belirlenir?

## 32. Final object decision table

| Object | Current parser | Source says | Confidence | Decision |
| --- | --- | --- | --- | --- |
| Picture | figure | Mapping yok | low | UNRESOLVED |
| Chart | figure | Mapping yok | low | UNRESOLVED |
| Graph | representation-dependent | Mapping yok | low | UNRESOLVED |
| SmartArt | figure | Mapping yok | low | UNRESOLVED |
| Diagram | representation-dependent | Mapping yok | low | UNRESOLVED |
| Schema | representation-dependent | Mapping yok | low | UNRESOLVED |
| Map | representation-dependent | Mapping yok | low | UNRESOLVED |
| Grouped Drawing | figure | Mapping yok | low | UNRESOLVED |
| VML Image | not figure | Mapping yok | low | UNRESOLVED |
| OLE | not figure | Mapping yok | low | UNRESOLVED |
| Equation | normally not figure | Mapping yok | low | UNRESOLVED |
| Table | table | Tablo açık | high | table |
| Çizelge | not recognized | Eşitlik yok | low | UNRESOLVED |

## 33. Verification results

| Check | Result |
| --- | --- |
| `node tests/audit/ruleSourceGroundingAudit.cjs` | PASS; 46/46 audit record, 15/15 object record |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; yalnız mevcut 500 kB chunk warning'i |
| `npm run test:golden` | PASS; 46/46 |
| `npm run test:corpus` | PASS; 31 regression + 8 exploratory |
| `git diff --name-only -- src` | Empty; production source değişmedi |

İlk sandbox typecheck/lint denemesi Node'un `C:\Users\i5` için `lstat EPERM` hatasıyla başlamadan durdu; aynı komutlar yetkili çalışma bağlamında exit 0 ile geçti. Bu bir code/test failure değildir.
