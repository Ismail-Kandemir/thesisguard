# Phase 4E-18B — Shadow Semantic Coverage & Validator Applicability Readiness Audit

## 1. Executive summary

Shadow modelin çekirdek ayrımları runtime ile doğrulandı; üç gerçek coverage boşluğu için `synthetic-ooxml` keşif fixture’ı eklendi: VML image, equation ve unknown DrawingML payload. Tüm association ve resolution durumları erişilebilir ve test edilmiştir. Bununla birlikte front matter ayrımı yoktur, header/footer/note part’ları taranmaz, anchored görsel sıra çözülmez, equation doğrudan body block’u olmadığı için konumu ambiguous olur ve representation occurrence hizalama olgusu taşımaz.

Karar **OPTION C** ve genel durum **READY_FOR_PILOT_MIGRATION**’dır; ancak yalnız bir validator için: `ObjectCaptionFormatValidator` / `comu.applied-sciences.food-technology.bachelor.figure-caption-format`. Bu seçim, yalnız `declared figure + matched association + inline/body` ile sınırlandırılmış caption format kontrolüdür. Presence, placement, alignment, reference ve list validator’ları bu kararla migration izni almaz.

Production `src`, validator, scoring ve UI değiştirilmemiştir. Mevcut RuleResult’lar aynıdır.

## 2. Starting state

- Dal: `main`
- Gerçek başlangıç commit’i: `0a8d6ca` (`feat: add academic object semantics shadow model`)
- Başlangıçta çalışma ağacı temizdi.
- `HEAD == origin/main == 0a8d6ca`.

## 3. Scope

Denetim dört boyutu ayrı değerlendirdi: representation coverage, caption semantics, association/resolution ve validator applicability. Kodun varlığı kanıt sayılmadı; production parser üzerinden çalışan sentetik XML veya DOCX fixture sonucu arandı. Shadow model production source of truth yapılmadı.

Coverage terimleri:

- **PROVEN:** temel pozitif tespit, akademik kimlik ayrımı ve ilgili collision/scope davranışı runtime ile kanıtlı.
- **PARTIALLY_PROVEN:** temel tespit runtime ile kanıtlı, fakat önemli scope/association varyantı eksik veya bilinen model boşluğu var.
- **UNTESTED:** kod yolu var, runtime kanıtı yok.
- **UNSUPPORTED:** mevcut normalizasyon o alanı taramıyor veya ayırt etmiyor.

## 4. Representation coverage matrix

| Kind | OOXML kanıtı | Fixture/runtime | Pozitif | Negatif/collision | MCE/revision | Scope | Sonuç | Migration blocker |
|---|---|---|---|---|---|---|---|---|
| picture | `w:drawing/pic:pic` | baseline, AlternateContent, resmî şablon | evet | chart/diagram/group ayrımı | ortak resolver ile evet | body; textbox ayrışır | PROVEN | presence tabanlı kurallar için front matter |
| chart | `c:chart` veya chart URI | `chart-object-synthetic` | evet | picture değil; uncaptioned unresolved | ortak traversal; kind-specific revision fixture yok | body | PARTIALLY_PROVEN | captioned chart örneği ve front matter |
| diagram | `dgm:relIds` veya diagram URI | iki SmartArt fixture | evet | uncaptioned unresolved; captioned declared | ortak traversal | body | PROVEN | placement dışındaki pilot için düşük |
| group | `wpg:wgp`/URI | grouped-drawing fixture | evet | uncaptioned unresolved | ortak traversal; kind-specific collision yok | body | PARTIALLY_PROVEN | grup cardinality semantiği |
| textbox | `wps:txbx`, `w:txbxContent` | DrawingML + VML textbox | evet | figure değildir; excluded | AlternateContent/revision ortak güvence | textbox sahipliği | PROVEN | `excluded` anlamının dar tutulması |
| vml-image | OLE dışında `w:pict/v:imagedata` | yeni VML fixture | evet | VML textbox ve OLE’den ayrılır; unresolved | özel MCE/revision varyantı yok | body | PARTIALLY_PROVEN | captioned VML ve nested scope yok |
| ole | `w:object/o:OLEObject` | OLE fixture | evet | nested VML image ayrıca sayılmaz; unresolved | özel MCE/revision yok | body paragraph | PROVEN | captioned OLE politikası belirsiz |
| equation | `m:oMathPara` veya bağımsız `m:oMath` | yeni equation fixture | evet | figure değildir | revision ortak traversal | direct body; block yok | PARTIALLY_PROVEN | block ownership → ambiguous |
| table | semantic `w:tbl` | baseline + sentetik table testleri | evet | captioned declared; uncaptioned unresolved | semantic traversal | body/table-cell | PARTIALLY_PROVEN | layout/nested/front matter ayrımı |
| unknown-drawing | tanınmayan `w:drawing` payload | yeni unknown fixture | evet | picture’a dönüşmez; unresolved | ortak traversal | body | PROVEN | unresolved diagnostic olmadan production migration |

## 5. Caption semantic coverage

| Durum | Tetik | Runtime kanıtı | Sonuç |
|---|---|---|---|
| `declared/figure` | desteklenen `Şekil n.` | baseline, split-run, SEQ result, SmartArt caption | PROVEN |
| `declared/table` | desteklenen `Tablo n.` | baseline ve sentetik table | PROVEN |
| `unnumbered` | yalnız bilinen label | audit sentetik XML | PROVEN |
| `malformed` | bilinen label + desteklenmeyen sözdizimi | `Tablo 1:` audit XML | PROVEN |
| `unknown` | type fallback | classifier ilgisiz paragrafı occurrence yapmaz | UNTESTED / DESIGN-ONLY |
| unrelated paragraph | label değil | occurrence üretilmez | PROVEN |
| orphan valid caption | valid beyan, nesne yok | audit sentetik XML | PROVEN |

Kabul edilen regex genişletilmemiştir. Nokta zorunludur; çok seviyeli sayısal numara desteklenir; custom/localized label otomatik eşanlamlı değildir.

Field tabanlı sentetik caption’da görünür sonuç `Şekil 4. ...`, `declared/figure/4` üretmiş ve `SEQ Şekil` instruction `fieldEvidence` içinde korunmuştur. Cached result’ın güncel olup olmadığı belirlenemez; freshness **UNSUPPORTED**’dır.

Split-run `Şe` + `kil ` + `3.` + ` Açıklama` ortak paragraph metninde yeniden kurulmuş ve `declared/figure/3` olarak eşleşmiştir: **PROVEN**.

## 6. Association-state coverage

| Durum | Gerçek tetik | Runtime kanıtı | Migration anlamı |
|---|---|---|---|
| `matched` | tek bitişik, declared ve beklenen türde caption | picture, table, diagram | guards ile tüketilebilir |
| `missing` | direct block çevresinde caption yok | uncaptioned picture/chart/VML/unknown | normal validator’a sessizce verilmemeli |
| `ambiguous` | çoklu caption, paylaşılan caption, anchor/null block | 1→many, many→1, equation block | normal validator için BLOCKED |
| `conflicting` | table yanında yalnız Şekil veya non-table yanında yalnız Tablo | table + `Şekil 6.` | normal validator için BLOCKED |
| `not-attempted` | textbox kind/scope | DrawingML/VML textbox | akademik policy değil scope guard |

Durumların tamamı reachable ve runtime-proven’dır. Reason code, candidate IDs, yön ve mesafe tutulur. `missing` ilişkinin yokluğudur; `unresolved` ise bunun akademik çözüm sonucudur.

## 7. Academic-resolution coverage

| Durum | Tetik | Academic type | Kanıt | Uygulanabilirlik |
|---|---|---|---|---|
| `declared` | matched + declared caption | figure/table | baseline, table, captioned diagram | guarded validator input |
| `unresolved` | missing/usable caption yok | null | chart/group/OLE/VML/unknown | diagnostic only |
| `ambiguous` | ambiguous veya conflicting association | null | cardinality, conflict, equation | blocked |
| `excluded` | textbox kind veya textbox-owned scope | null | DML/VML textbox | object validator çalışmaz |

`declared`, belgenin caption beyanını ifade eder; dışsal ontolojik doğrulama değildir. `excluded`, “dekoratif/non-academic olduğu kanıtlandı” anlamına gelmez. Mevcut uygulamada “textbox kapsamı academic object association’a alınmadı” anlamındadır. Bu adın politika exclusion gibi yorumlanması migration riskidir.

## 8. Document-scope coverage

| Scope/part | Durum |
|---|---|
| main `word/document.xml` body | PROVEN |
| textbox ownership | PROVEN |
| table-cell/nested | PARTIALLY_PROVEN; scope vardır, direct block/association yoktur |
| header/footer | NOT SCANNED |
| footnote/endnote | NOT SCANNED |
| front matter | NOT DISTINGUISHED |
| section/body role | NOT DISTINGUISHED |
| AlternateContent | PROVEN single active branch |
| deleted/moveFrom | PROVEN excluded by visibility policy |

## 9. VML/equation/unknown-drawing findings

- VML image `vml-image` olarak tespit edildi; baseline figure’a ek legacy figure üretmedi, shadow resolution `unresolved` kaldı. VML textbox ayrı `textbox`tır.
- `m:oMathPara` `equation` olarak tespit edildi ve figure olmadı. Ancak body block listesi yalnız `w:p/w:tbl` içerdiğinden block index yoktur; association ve resolution `ambiguous` olur. Bu production bug olarak düzeltilmedi, readiness blocker olarak kaydedildi.
- Tanınmayan DrawingML payload `unknown-drawing` olarak korundu ve shadow’da unresolved kaldı. Legacy pipeline aynı `w:drawing`ı ikinci figure sayarak caption-placement failure üretti. Bu fark fallback’in amacını somutlaştırır.

## 10. Front-matter findings

Her iki yerel resmî şablonda shadow çıktı aynıdır: body scope’ta `picture(unresolved)`, `table(declared/table)`, `picture(declared/figure)`. İlk picture büyük olasılıkla cover/logo bağlamındadır; bu bağlamsal çıkarımdır, parser front matter rolü üretmez.

Sonuç: unresolved picture’ı figure validator’a geçirmek false-positive ve düşük skor riski; tamamen yok saymak gerçek başlıksız figure’larda false-negative/yüksek skor riski yaratır. Front matter ayrımı object alignment, caption placement ve list/presence migration’ları için **HIGH** blocker’dır. Yalnız matched caption format pilotu unresolved resmi tüketmediği için bu blocker’dan etkilenmez.

## 11. Anchored drawing findings

Inline drawing XML block sırasına bağlanabilir. Anchor’ın XML’deki paragraph konumu gerçek sayfa koordinatını ve caption’ın görsel üst/alt konumunu garanti etmez. Shadow model anchor için association’ı doğrudan ambiguous yapar.

- Caption placement riski: **HIGH**.
- Semantic association riski: **HIGH**.
- Alignment riski: **MEDIUM/HIGH**; shadow occurrence zaten alignment olgusu taşımaz.
- Matched-inline caption format pilotu: **LOW**, anchor guard ile dışarıda kalır.

## 12. Cardinality findings

| Cardinality | Davranış |
|---|---|
| 1 object → 1 caption | tek aday ise matched |
| 1 object → 0 caption | missing → unresolved |
| 1 object → many captions | ambiguous |
| many objects → 1 caption | paylaşılan claim sonradan ambiguous |
| many objects → many captions | block sınırları ayırıyorsa yerel 1:1 mümkün; bitişik cluster’da ambiguity korunur |

Algoritma keyfî en-yakın seçimi yapmaz. Buna rağmen page/section koordinatı ve composite group cardinality çözülmediğinden çoklu ilişki problemi “tam çözülmüş” değildir.

## 13. Current validator inventory

| Rule ID | Validator | Legacy input |
|---|---|---|
| `...figure-object-alignment` | `ObjectAlignmentValidator` | `document.figures.items` |
| `...table-object-alignment` | `ObjectAlignmentValidator` | top-level `document.tables.items` |
| `...figure-caption-placement` | `ObjectCaptionPlacementValidator` | inline legacy figures |
| `...table-caption-placement` | `ObjectCaptionPlacementValidator` | top-level legacy tables |
| `...figure-caption-format` | `ObjectCaptionFormatValidator` | associated inline figure captions |
| `...table-caption-format` | `ObjectCaptionFormatValidator` | associated top-level table captions |
| `...figure-in-text-reference` | `ObjectInTextReferenceValidator` | associated inline figure caption number + references |
| `...table-in-text-reference` | `ObjectInTextReferenceValidator` | associated top-level table caption number + references |
| `...list-of-figures` | `ConditionalRequiredSectionValidator` | `document.figures.hasFigures` |
| `...list-of-tables` | `ConditionalRequiredSectionValidator` | `document.tables.hasTables` |

Tam namespace: `comu.applied-sciences.food-technology.bachelor`.

## 14. Validator applicability matrix

Terimler: **RUN** normal akademik kontrol; **DO_NOT_RUN** kesin scope exclusion; **DIAGNOSTIC_ONLY** skor dışı belirsizlik; **BLOCKED** güvenli karar için eksik veri; **NOT_APPLICABLE** nesne sınıfı kuralın türü değildir.

| Kural | Decl. figure | Unresolved drawing | Ambig. figure | Excl. textbox | Decl. table | Unresolved table | Ambig. table | Orphan fig. cap. | Orphan table cap. | Readiness |
|---|---|---|---|---|---|---|---|---|---|---|
| figure alignment | RUN | DIAGNOSTIC_ONLY | BLOCKED | DO_NOT_RUN | N/A | N/A | N/A | N/A | N/A | BLOCKED |
| figure caption placement | RUN inline | DIAGNOSTIC_ONLY | BLOCKED | DO_NOT_RUN | N/A | N/A | N/A | DIAGNOSTIC_ONLY | N/A | BLOCKED |
| figure caption format | RUN guarded | DIAGNOSTIC_ONLY | BLOCKED | DO_NOT_RUN | N/A | N/A | N/A | DIAGNOSTIC_ONLY | N/A | READY_WITH_GUARDS |
| figure reference | RUN guarded | DIAGNOSTIC_ONLY | BLOCKED | DO_NOT_RUN | N/A | N/A | N/A | DIAGNOSTIC_ONLY | N/A | READY_WITH_GUARDS |
| list of figures | RUN set | DIAGNOSTIC_ONLY | BLOCKED | DO_NOT_RUN | N/A | N/A | N/A | DIAGNOSTIC_ONLY | N/A | BLOCKED |
| table alignment | N/A | N/A | N/A | N/A | RUN | DIAGNOSTIC_ONLY | BLOCKED | N/A | DIAGNOSTIC_ONLY | BLOCKED |
| table caption placement | N/A | N/A | N/A | N/A | RUN | DIAGNOSTIC_ONLY | BLOCKED | N/A | DIAGNOSTIC_ONLY | BLOCKED |
| table caption format | N/A | N/A | N/A | N/A | RUN guarded | DIAGNOSTIC_ONLY | BLOCKED | N/A | DIAGNOSTIC_ONLY | READY_WITH_GUARDS |
| table reference | N/A | N/A | N/A | N/A | RUN guarded | DIAGNOSTIC_ONLY | BLOCKED | N/A | DIAGNOSTIC_ONLY | READY_WITH_GUARDS |
| list of tables | N/A | N/A | N/A | N/A | RUN set | DIAGNOSTIC_ONLY | BLOCKED | N/A | DIAGNOSTIC_ONLY | BLOCKED |

Alignment BLOCKED çünkü shadow representation alignment/source taşımıyor. Placement BLOCKED çünkü anchor/front matter ve unresolved nesne score etkisi var. Reference guards ile mümkün olsa da duplicate/reference adapter riski caption format’tan yüksektir. Liste kuralları applicability ve denominator’ı değiştirir.

## 15. Legacy vs shadow differential

| Fixture | Legacy F/T | Shadow declared F/T | Unresolved | Ambiguous | Excluded |
|---|---:|---:|---:|---:|---:|
| full-correct | 1/1 | 1/1 | 0 | 0 | 0 |
| chart | 2/1 | 1/1 | 1 | 0 | 0 |
| SmartArt | 2/1 | 1/1 | 1 | 0 | 0 |
| group | 2/1 | 1/1 | 1 | 0 | 0 |
| OLE | 1/1 | 1/1 | 1 | 0 | 0 |
| DML textbox | 1/1 | 1/1 | 0 | 0 | 1 |
| VML textbox | 1/1 | 1/1 | 0 | 0 | 1 |
| VML image | 1/1 | 1/1 | 1 | 0 | 0 |
| equation | 1/1 | 1/1 | 0 | 1 | 0 |
| unknown drawing | 2/1 | 1/1 | 1 | 0 | 0 |
| captioned SmartArt | 2/1 | 2/1 | 0 | 0 | 0 |

`F/T`, legacy figure/table count’tur. Shadow resolved set ile legacy count’un eşit olmaması beklenen semantic differential’dır; doğruluğu otomatik kanıtlamaz.

## 16. RuleResult impact simulation

- Baseline ve captioned SmartArt’ta declared set, legacy güvenilir caption setiyle uyumludur.
- Caption’sız chart/SmartArt/group/unknown drawing yalnız declared set’e geçirilirse mevcut figure-caption-placement failure ortadan kalkar ve muhtemelen N/A/PASS kapsam değişimi oluşur. Bunun doğru olduğu kaynakla kanıtlanmadığı için placement migration BLOCKED’dır.
- OLE/VML/equation shadow’da görünürken legacy figure setinde yoktur. Bunları figure validator’a geçirmek de kaynak dışıdır.
- Figure caption format bugün zaten yalnız güvenilir associated inline caption’ları kontrol eder. Guarded shadow input mevcut corpus’ta aynı caption’ları seçer; beklenen RuleResult divergence **yoktur**.
- List-of-figures generic drawing presence yerine declared count kullanırsa chart/group/unknown-only belgelerde applicability değişebilir. Mevcut corpus baseline figure içerdiği için bu risk tam izole edilmez.

## 17. Score/applicability risks

Unresolved nesneleri dışlamak FAILED→N/A veya PASSED→N/A geçişi, applicable-rule denominator düşüşü ve yapay yüksek skor yaratabilir. Hepsini academic object saymak ise yapay düşük skor yaratabilir. Gelecek scoring, unresolved diagnostic sayısını raporlamalı; semantics çözülmeden doğrudan puan vermemeli. N/A, “belirsizlik çözüldü” olarak kullanılmamalıdır.

Caption format pilotunda unresolved nesneler bugün de format validator’a girmez; bu nedenle ilk pilot için yeni denominator riski düşüktür. Pilot yine dual-run parity ile korunmalıdır.

## 18. Unresolved diagnostic contract

Gelecek skor-dışı diagnostic en az şunları taşımalıdır:

- occurrence ID ve representation kind;
- source part, scope, block/paragraph konumu ve drawing mode;
- representation evidence;
- association status/reason ve candidate caption IDs;
- yakın caption raw/normalized text ve semantic status;
- resolution status/reason;
- “insan incelemesi gerekli” göstergesi.

Diagnostic mevcut aşamada skoru doğrudan etkilememelidir; fakat score trust’ın qualified olduğunu gösterebilmelidir.

## 19. First validator migration candidate

Tek aday:

- Validator: `ObjectCaptionFormatValidator`
- Rule: `comu.applied-sciences.food-technology.bachelor.figure-caption-format`
- Readiness: **READY_WITH_GUARDS**

Neden: primary grounding doğrudan; gerekli caption paragraph biçim olguları mevcut; identity yalnız declared/matched caption’dan gelir; anchor/unresolved/front-matter nesneleri giriş setine alınmaz; legacy validator da zaten yalnız associated inline figure captions üzerinde çalışır; parity yüzeyi küçük ve geri alma basittir.

## 20. Required migration guards

Pilot yalnız şu koşullarda RUN etmelidir:

1. `resolution.status === "declared"`
2. `resolution.academicType === "figure"`
3. `association.status === "matched"`
4. resolution/association aynı object ve caption’a işaret eder
5. representation `scope === "body"`
6. representation `drawingType === "inline"`
7. caption `semantic.status === "declared"` ve `academicType === "figure"`
8. caption paragraph ve effective formatting çözülebilir

Unresolved/ambiguous/conflicting/excluded ve orphan caption normal PASS/FAIL üretmemeli; ileride diagnostic olmalıdır. Duplicate caption/object kimliği guard ihlalidir. Pilot, mevcut caption placement veya object presence kararını değiştirmemelidir.

## 21. Migration parity strategy

Phase 4E-18C’de production source switch öncesinde:

1. Legacy ve shadow figure-caption-format evaluator audit/test içinde dual-run.
2. Eligible object/caption sayısı, status, actual/evidence ayrı karşılaştırılır.
3. Tüm golden, 34-fixture corpus, resmî şablonlar ve cardinality sentetikleri taranır.
4. Divergence `expected semantic narrowing | bug | unsupported uncertainty` olarak sınıflandırılır.
5. İlk production switch yalnız zero-unclassified-divergence ile yapılır.
6. Rollback koşulu: herhangi bir regression RuleResult değişimi, eligible caption set farkı, unresolved/ambiguous nesnenin score’a girmesi veya evidence kaybı.

## 22. Remaining blockers

- Front matter/body-role ayrımı yok.
- Header/footer/footnote/endnote object parts taranmıyor.
- Anchored görsel sayfa sırası yok.
- Shadow representation alignment/source taşımıyor.
- Equation direct block ownership yok.
- Nested/layout table academic rolü çözülmüyor.
- `unknown` caption status production classifier tarafından üretilmiyor.
- SEQ result freshness bilinmiyor.
- VML image/chart/group için captioned ve özel revision/MCE varyantları sınırlı.
- Unresolved diagnostic/report/score-trust kontratı henüz production değil.

## 23. Phase decision

**OPTION C — Shadow model is ready for ONE guarded pilot validator migration.**

Bu karar bütün validator’ların hazır olduğu anlamına gelmez. Yalnız figure caption format için, declared/matched/inline/body guard’larıyla ve önce dual-run parity aşamasıyla geçerlidir.

## 24. Recommended next phase

**Phase 4E-18C — Figure Caption Format Shadow-to-Production Pilot Migration**

Tek kapsam: `ObjectCaptionFormatValidator` içindeki `comu.applied-sciences.food-technology.bachelor.figure-caption-format`. Table counterpart, placement, alignment, reference, presence/list ve scoring kapsam dışıdır.
