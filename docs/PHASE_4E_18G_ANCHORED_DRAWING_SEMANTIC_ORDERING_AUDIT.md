# Phase 4E-18G - Anchored Drawing Semantic Ordering Audit

## 1. Executive summary

Karar: **OPTION B - Anchored objects should remain excluded from physical placement/alignment validation, with diagnostic/trust handling.**

Bu faz uretim semantigini, validator'lari, scoring'i veya diagnostic politikasini degistirmedi. Yeni audit, `wp:inline` ve `wp:anchor` ayriminin korundugunu; anchor icin XML paragraph ownership'in kaydedildigini; fakat bu ownership'in rendered visual placement olmadigini runtime ile kanitladi. Anchor-only placement, caption format ve in-text reference guvenlik guard'lari N/A uretiyor. Alignment ise anchor'i fiziksel olarak yorumlamiyor; anchor-only durumda N/A, inline+anchor karisiminda anchor icin "unknown" kaynakli failure uretip daha kuvvetli bir "tum sekiller ortalanmis" iddiasini reddediyor.

## 2. Starting state

- Branch: `main`
- Baslangic checkpoint: `c16ecc2` (`feat: migrate figure caption format to semantic model`)
- `HEAD == origin/main == c16ecc2`
- 4E-18D, 4E-18E ve 4E-18F local degisiklikleri korunarak calisildi.
- Git clean-up, stage, commit, push, stash, reset veya restore yapilmadi.

## 3. Audit scope

Kapsam yalniz audit scripti ve dokumantasyondur:

- `tests/audit/anchoredDrawingSemanticOrderingAudit.cjs`
- `docs/PHASE_4E_18G_ANCHORED_DRAWING_SEMANTIC_ORDERING_AUDIT.md`

Yeni DOCX fixture eklenmedi; sentetik OOXML script icinde tutuldu. Amac mevcut parser/validator davranisini olcmekti, Word layout engine taklit etmek degildi.

## 4. Current inline model

Inline kontrol fixture'i `mainBoundary + inline picture + Sekil 1.` ile calisti:

| Fact | Runtime sonucu |
|---|---|
| Representation kind | `picture` |
| drawingType | `inline` |
| paragraph/block owner | direct body paragraph/block |
| association | `matched` |
| resolution | `declared/figure` |
| caption placement | `PASSED` |
| caption format pilot | `PASSED` |

Inline model, XML logical block order'u guvenli bir metinsel sahiplik yaklasimi olarak kullanabiliyor.

## 5. Current anchor model

Anchor kontrol fixture'i `wp:anchor + Sekil 1.` ile calisti:

| Fact | Runtime sonucu |
|---|---|
| Representation kind | `picture` |
| drawingType | `anchor` |
| paragraph/block owner | kayitli |
| association | `ambiguous` |
| reason | `object-position-not-deterministic` |
| resolution | `ambiguous` |
| legacy figure | anchor olarak sayildi |
| legacy captionPosition | `ambiguous` |
| diagnostic | `AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION` |

Model anchor'in XML paragraf sahibini bilir, ancak bunun rendered visual position oldugunu iddia etmez.

## 6. OOXML anchor facts

| OOXML fact | Sinif |
|---|---|
| `wp:anchor` mode | USEFUL STRUCTURAL FACT |
| `wp:docPr` | USEFUL STRUCTURAL FACT |
| `wp:extent` | POTENTIALLY USEFUL |
| `wp:positionH`, `wp:positionV` | POTENTIALLY USEFUL |
| `wp:posOffset`, `wp:align`, `wp:simplePos` | RENDERER-DEPENDENT |
| `relativeFrom` | POTENTIALLY USEFUL |
| wrap modes and distances | RENDERER-DEPENDENT |
| `layoutInCell` | POTENTIALLY USEFUL |
| `relativeHeight`, `behindDoc`, `allowOverlap` | NOT RELEVANT TO CURRENT RULES |

## 7. XML ownership vs visual placement

Bes ayri seviye karistirilmamali:

| Seviye | ThesisGuard bugun ne bilir? |
|---|---|
| XML paragraph ownership | Evet, paragraph/block ID kayitli |
| Logical document order | Evet, body block sirasi kayitli |
| Anchor reference frame | Hayir, normalized fact olarak saklanmiyor |
| Requested anchor position | Hayir, normalized fact olarak saklanmiyor |
| Rendered visual position | Hayir, layout engine yok |

## 8. Anchor reference frames

`relativeFrom="paragraph"`, `"page"` ve `"margin"` sentetik varyantlari calistirildi. Ucu de `drawingType=anchor` ve `association=ambiguous` urettiler. Bu metadata mevcut normalized modele alinmiyor; alinmasi bile final layout'u tek basina kanitlamaz.

## 9. Position offsets

Pozitif ve negatif `wp:posOffset` degerleri parse edilmis bir normalized fact olarak gorunmedi. Runtime davranis degismedi: anchor association `ambiguous` kaldi. `posOffset` tek basina Word layout'unu, final page number'i veya caption-object distance'i kanitlamaz.

## 10. Wrapping

`wrapSquare` ve distance attribute'lari fixture'da bulundu, ancak current semantic facts'e aktarilmadi. Wrap bilgisi metnin nesne etrafinda nasil akabilecegine dair renderer-dependent bir presentation fact'tir; akademik caption association veya above/below compliance'i tek basina kanitlamaz.

## 11. Alignment semantics

Inline tek cizim ve bos paragraph durumunda paragraph alignment object alignment icin kullanilabilir. Anchor icin current validator paragraph alignment'a guvenmiyor:

- anchor-only: `figure-object-alignment = NOT_APPLICABLE`
- inline + anchor: `figure-object-alignment = FAILED`, anchor `unknown` oldugu icin tum figure seti guvenle ortalanmis sayilmiyor

Sinif: **SEMANTIC OVERCLAIM riski yonetiliyor**, fakat legacy figure setine anchor katildigi icin non-pilot alignment sonucu anchor'dan etkilenebiliyor.

## 12. Caption association semantics

Shadow association inline icin adjacent block caption ile `matched` uretir. Anchor icin yakin caption olsa bile `object-position-not-deterministic` gerekcesiyle `ambiguous` uretir ve candidate caption claim etmez. Bu guvenli bir guard'dir.

Textual/logical association ileride anlamli olabilir; fiziksel above/below placement ile ayni sey degildir.

## 13. Caption placement semantics

`ObjectCaptionPlacementValidator` figure tarafinda yalniz `drawingType === "inline"` occurrence'lari kullanir. Anchor baseline'da placement `NOT_APPLICABLE`; inline+anchor karisiminda placement inline figure uzerinden `PASSED` kaldi. Bu, anchor icin physical above/below iddiasini engeller.

## 14. Pilot validator behavior

`ObjectCaptionFormatValidator` pilot eligibility `declared figure + matched association + body scope + inline` guard'lari ile anchor'i disarida birakir. Anchor fixture'inda figure caption format `NOT_APPLICABLE` oldu.

## 15. Legacy validator behavior

Legacy `parseFigures()` textbox olmayan `w:drawing` anchor'i figure olarak sayar ve `drawingType=anchor` bilgisini korur. Bu nedenle:

- `list-of-figures` anchor nedeniyle applicable olur ve eksik liste bolumu icin fail edebilir.
- `figure-object-alignment` anchor'i `unknown` alignment olarak gorebilir.
- `figure-caption-placement`, `figure-caption-format` ve `figure-in-text-reference` figure tarafinda inline guard kullandigi icin anchor'i fiziksel/caption iddiasi icin tuketmez.

## 16. Front-matter interaction

Scope ve drawing type bagimsizdir:

- main-content anchor chart: `academicScope=main-content`, `drawingType=anchor`, `kind=chart`
- missing-boundary/front area anchor chart: scope `unknown`

Anchor olmak bir nesneyi akademik yapmaz; main-content olmak da anchor'in placement'ini kanitlamaz.

## 17. Textbox interaction

`wp:anchor` icindeki WPS textbox `kind=textbox` olarak kaldi. Legacy figure uretilmedi, academic resolution `excluded` oldu. Anchor support audit'i textbox'i figure'a yukseltmedi.

## 18. Chart/diagram/group interaction

Anchor payload turu drawing mode'dan bagimsiz korundu:

| Fixture | Runtime |
|---|---|
| anchored chart | `kind=chart`, `drawingType=anchor` |
| anchored diagram | `kind=diagram`, `drawingType=anchor` |
| anchored group | `kind=group`, `drawingType=anchor` |

## 19. AlternateContent

Anchor, `mc:AlternateContent` supported Choice icine kondugunda tek semantic branch uretildi. Fallback duplicate edilmedi. Runtime: `representations.length = 1`, `drawingType=anchor`.

## 20. Revision visibility

`w:del` ve `w:moveFrom` icindeki anchor, shadow `objectSemantics` tarafinda invisible kaldi. `w:moveTo` icindeki anchor visible olarak korundu. Ancak legacy `document.figures.items` path'i deleted/moveFrom anchor drawing'i halen generic figure olarak sayabiliyor; bu audit uretim davranisini degistirmedi, fakat legacy validator guard ihtiyacina ek kanit olarak kaydetti.

## 21. Table-cell/layoutInCell

Table cell icindeki anchor `scope=table-cell` ve `drawingType=anchor` uretir. `layoutInCell` normalized fact olarak saklanmiyor. Bu fact gelecekte placement applicability icin yararli olabilir, fakat mevcut thesis rule'lari final visual position'i bundan kanitlayamaz.

## 22. Z-order/overlap

Fixture `relativeHeight`, `behindDoc` ve `allowOverlap` tasidi. Bunlar normalized facts'te korunmuyor ve mevcut akademik kurallar icin dogrudan uygunluk kaniti degil. Visual stacking/overlap reconstruction bu fazin disindadir.

## 23. Anchored caption limitation

Caption model normal body paragraph visible text'ine dayanir. Textbox, shape veya drawing icindeki caption semantigi bu fazda desteklenmez. Bu limitation intentional olarak dokumante edildi; textbox caption semantics uygulanmadi.

## 24. Active-rule impact matrix

| Rule | Anchor impact |
|---|---|
| figure object alignment | SAFE WITH CURRENT GUARD for paragraph-alignment inference; legacy anchor unknown sonucu etkileyebilir |
| figure caption placement | SAFE WITH CURRENT GUARD |
| figure caption format | SAFE WITH CURRENT GUARD |
| figure in-text reference | SAFE WITH CURRENT GUARD |
| list of figures | SEMANTICALLY UNSAFE / legacy figure participation |
| table object alignment | NOT APPLICABLE to drawing anchor |
| table caption placement | NOT APPLICABLE to drawing anchor |
| table caption format | NOT APPLICABLE to drawing anchor |
| table in-text reference | NOT APPLICABLE to drawing anchor |
| list of tables | NOT APPLICABLE to drawing anchor |

## 25. Proven false results

Anchor physical placement/alignment icin kanita dayali false positive: **0**. Kanita dayali false negative: **0**. Word renderer olmadigi icin bir anchor'in final visual konumu bilinmiyor; bu yuzden physical placement alaninda "yanlis" yerine "unverifiable" veya "semantic overclaim risk" kullanildi.

Ancak revision visibility alaninda kanitlanmis bir legacy false positive vardir: `w:del`/`w:moveFrom` icindeki anchored drawing shadow `objectSemantics` tarafinda invisible iken legacy `document.figures.items` tarafinda figure olarak sayilir ve list/presence tabanli non-pilot sonuclari etkileyebilir.

## 26. Semantic overclaims

Bulunan asil overclaim, legacy layer'in anchor'i generic figure fact olarak liste/presence ve alignment kapsaminda hala tuketebilmesidir. Buna revision visibility gap'i de eklenir: deleted/moveFrom anchor'lar semantic modelde yokken legacy figure listesinde kalabilir. Placement ve pilot format icin guard var.

## 27. Architectural limitations

- Word layout engine yok.
- `positionH/positionV/posOffset/relativeFrom/wrap/layoutInCell` normalized fact olarak saklanmiyor.
- XML paragraph ownership rendered visual position degil.
- Page number, pixel coordinate, final y-order, overlap ve object-caption distance kanitlanamaz.
- Anchored captions inside textbox/shape desteklenmez.
- Revision visibility shadow object semantics tarafinda uygulanirken legacy figure path deleted/moveFrom anchor'i hala sayabilir.

## 28. Proposed future model

Minimum future model, validator migration'dan once sadece fact tasimali:

```ts
interface DrawingPlacementFacts {
  mode: "inline" | "anchor" | "unknown";
  horizontalReference: string | null;
  verticalReference: string | null;
  horizontalAlignment: string | null;
  horizontalOffsetEmu: number | null;
  verticalAlignment: string | null;
  verticalOffsetEmu: number | null;
  wrapMode: string | null;
  layoutInCell: boolean | null;
}
```

Bu model final layout iddiasi degil, applicability/diagnostic girdisi olmalidir.

## 29. Diagnostic recommendation

Main-content declared veya ambiguous anchored object icin ileride skor disi review diagnostic dusunulmeli: "Bu nesnenin sayfadaki gorsel konumu otomatik olarak dogrulanamadi." Bu diagnostic alignment/placement skorunu degistirmeden score trust'i nitelendirmelidir.

## 30. Fixture results

Yeni fixture dosyasi yoktur. Runtime cases audit script icinde sentetik OOXML olarak tutuldu: inline baseline, anchor baseline, before/down, after/up, empty/text owner paragraph, two captions, relativeFrom page/margin, front/main scope, textbox, chart/diagram/group, AlternateContent, revision visibility, table cell ve inline+anchor.

## 31. Golden/corpus

Golden hedefi: `46/46`, diagnostics `0`. Corpus hedefi: mevcut `31 regression + 11 exploratory` korunmali. Audit script golden fixture icin 46/46 ve zero diagnostics assert eder.

## 32. Existing audit parity

4E-18D/E/F ve onceki 4E-18 auditleri bu fazda degistirilmedi. Ilgili auditler quality gate olarak tekrar calistirilir.

## 33. Quality gates

Calistirilacak kapilar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:golden`
- `npm run test:corpus`
- 4E-18G audit ve ilgili mevcut auditler

## 34. Git diff

Beklenen yeni 4E-18G diff:

- `tests/audit/anchoredDrawingSemanticOrderingAudit.cjs`
- `docs/PHASE_4E_18G_ANCHORED_DRAWING_SEMANTIC_ORDERING_AUDIT.md`

Yeni 4E-18G production semantic file: **none**. Validator diff: **none**. Scoring diff: **none**.

## 35. Phase decision

**OPTION B** secildi. Current model anchor icin exact physical validation'a yeterli degil; ancak mevcut guard'lar placement/format/reference icin guvenli bir sinir sagliyor. En pratik sonraki adim, anchor physical alignment/placement validation'i guard'li tutup review/trust handling'i gelistirmektir.

## 36. Recommended next phase

**Phase 4E-18H - Anchored Object Validation Applicability Guard**

Bu faz, legacy list/alignment etkisini ve anchor diagnostic/trust mesajini netlestirmek icin en kucuk guvenli adimdir; Word renderer veya spekulatif placement validation gerektirmez.
