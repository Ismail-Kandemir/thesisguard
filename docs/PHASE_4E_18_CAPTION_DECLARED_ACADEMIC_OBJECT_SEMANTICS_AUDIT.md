# Phase 4E-18 — Caption-Declared Academic Object Semantics Design Audit

## 1. Executive summary

Bu denetimin kararı **OPTION C: figure davranışı değiştirilmeden önce yeni bir semantik katman gereklidir**.

Mevcut sistem, ana gövdedeki textbox olmayan her semantik `w:drawing` öğesini `DocumentFigureOccurrence` olarak üretir. Bu, teknik bir temsil bulgusunu kaynakların desteklemediği biçimde akademik `Şekil` kimliğine dönüştürür. `w:tbl` için teknik anlam daha güçlüdür; yine de kapak, imza, yerleşim ve iç içe tablo gibi roller nedeniyle her tabloyu evrensel biçimde akademik `Tablo` saymak da kanıtlanmış değildir.

Birincil rehber, `Şekil` ve `Tablo` kurallarını doğrudan destekler; OOXML sınıflarını akademik sınıflara eşlemez. Bu nedenle temsil, belgenin başlık yoluyla yaptığı semantik beyan, nesne–başlık ilişkisi ve üniversite politikası ayrı tutulmalıdır. Geçerli ve ilişkilendirilebilir `Şekil n.` / `Tablo n.` başlığı güçlü kimlik kanıtıdır; fakat yalnız başlığa dayanan model başlıksız akademik nesneleri sessizce kaçırabilir. Çözüm, başlıksız teknik nesneleri `N/A` yapmak değil, puanı hemen etkilemeyen `unresolved/review-required` adaylar olarak görünür tutmaktır.

Bu faz üretim kodunu, validator’ları, puanlamayı veya RuleResult’ları değiştirmez. Mevcut fixture’lardan yararlanan makine-okunur bir audit manifesti ve onun tutarlılık denetimi eklenmiştir.

## 2. Starting state

- Dal: `main`
- Başlangıç commit’i: `92f4a50` (`test: ground rules in official primary sources`)
- Başlangıçta çalışma ağacı temizdi.
- `main`, `origin/main` ile aynı commit’teydi.
- Beklenen yerel kaynak ikilileri Git dışında tutulmaktadır.

## 3. Source hierarchy

Kararlar şu sırayla değerlendirilmiştir:

1. **A1 — Resmî normatif tez rehberi:** akademik gerekliliklerin otoritesi.
2. **A2 — Resmî atıf rehberi ve şablonlar:** güçlü bağlamsal örnek; A1’i genişleten evrensel taksonomi değildir.
3. **B — Depo belgeleri ve türetilmiş kurallar:** izlenebilir uygulama yorumu.
4. **C — Mevcut uygulama:** yazılımın bugün ne yaptığını kanıtlar, üniversite semantiğini kanıtlamaz.
5. **D — Sentetik OOXML fixture’ları:** çalışma zamanı davranışını kanıtlar, politika oluşturmaz.

A1, `Şekil`/`Tablo` için hizalama, başlık, atıf ve liste gerekliliklerini destekler. A1/A2, `w:drawing → Şekil`, `pic:pic → Şekil`, `c:chart → Şekil`, `dgm:relIds → Şekil` veya `Çizelge == Tablo` eşlemesi kurmaz.

## 4. Current architecture map

```text
word/document.xml
  └─ parseDocumentXml
       ├─ paragraph/visible-text normalization
       └─ normalizeDocumentCaptions
            ├─ parseCaptions       text → DocumentCaption(kind)
            ├─ parseTables         w:tbl → DocumentTableOccurrence
            ├─ parseFigures        w:drawing - textbox → DocumentFigureOccurrence
            └─ associateCaptions   komşu body blokları → captionId/position
                         │
                         ├─ ObjectAlignmentValidator
                         ├─ ObjectCaptionPlacementValidator
                         ├─ ObjectCaptionFormatValidator
                         ├─ ObjectInTextReferenceValidator
                         └─ list-of-figures / list-of-tables facts
```

Başlıca üretim sahipleri:

- `src/features/analysis/parsers/documentXmlParser.ts`: normalize edilmiş belgeyi kurar.
- `src/features/analysis/parsers/documentCaptionsNormalizer.ts`: başlık, tablo, çizim ve ilişki olgularını üretir.
- `src/features/analysis/types/index.ts`: `DocumentCaption`, `DocumentTableOccurrence`, `DocumentFigureOccurrence`, koleksiyonlar ve sayıları tanımlar.
- `src/features/analysis/rules/validators/ObjectAlignmentValidator.ts`: nesne hizalaması.
- `ObjectCaptionPlacementValidator.ts`: başlığın nesneye göre yeri.
- `ObjectCaptionFormatValidator.ts`: ilişkilendirilmiş başlık biçimi.
- `ObjectInTextReferenceValidator.ts`: ilişkilendirilmiş nesne numarasının metin içi atfı.
- Liste validator’ları: `hasFigures`/`hasTables` ve normalize edilmiş belge olgularını kullanır.

## 5. Current semantic assumptions

### Kesin dönüşüm noktaları

- `parseFigures()` içinde textbox içermeyen semantik `w:drawing` öğesi doğrudan `DocumentFigureOccurrence` olur. Temsilin akademik semantiğe dönüştüğü asıl nokta budur; başlık ayrıştırma/ilişkilendirme bu karardan sonra gelir.
- `parseTables()` içinde semantik `w:tbl` doğrudan `DocumentTableOccurrence` olur. Ad teknik olarak daha isabetli olsa da tüketiciler bunu akademik tablo olarak kullanır.
- Başlık regex’i görünür paragraf metnindeki `Tablo|Şekil` etiketini `DocumentCaption.kind` değerine dönüştürür.
- Yakındaki tür-eşleşen başlık, nesnenin `captionId` ve `captionPosition` alanına bağlanır.

### Mevcut tiplerin sorumluluğu ve belirsizliği

| Tip/alan | Mevcut alanlar (özet) | Fiilî sorumluluk | Sorun |
|---|---|---|---|
| `DocumentFigureOccurrence` | id, paragraph/index, blockIndex, drawingType, alignment/source, captionId/position | textbox olmayan `w:drawing` olgusu ve başlık ilişkisi | `Figure` adı akademik kesinliği fazla iddia eder; payload türü ve belirsizlik yoktur. |
| `DocumentTableOccurrence` | id, blockIndex, isNested, style, alignment/source, captionId/position | her semantik `w:tbl` olgusu | belge rolü/scope yoktur; akademik tablo olduğu varsayılabilir. |
| `DocumentCaption` | id, paragraph/index, blockIndex, text, kind, label, number | görünür metinden başlık semantiği | parse edilmeyen/malformed beyan ve field kanıtı korunmaz. |
| `DocumentFigures.count/hasFigures` | items/count/presence | genel DrawingML sayısı | akademik şekil sayısı gibi görünür. |
| `DocumentTables.count/hasTables` | items/count/presence | tüm tablo temsilleri | üst düzey akademik tablo sayısı değildir. |

Başlık ilişkilendirmesi akademik sınıflandırmadan önce değil, sistemin nesneyi zaten figure/table adlandırmasından sonra gerçekleşir.

## 6. Representation taxonomy

Önerilen taksonomi yalnız teknik temsili söyler:

```ts
type ObjectRepresentationKind =
  | "picture"
  | "chart"
  | "diagram"
  | "group"
  | "textbox"
  | "vml-image"
  | "ole"
  | "equation"
  | "table"
  | "unknown-drawing";
```

| Kind | OOXML kanıtı | Bugünkü destek | Tespit güveni | Fixture |
|---|---|---|---|---|
| picture | `w:drawing` + `a:graphicData` + `pic:pic` | generic drawing olarak | yüksek (gelecekte payload ayrımıyla) | `full-correct`, resmî şablonlar |
| chart | chart URI ve/veya `c:chart` | figure sayılır, tür korunmaz | yüksek | `chart-object-synthetic` |
| diagram | diagram URI ve/veya `dgm:relIds` | figure sayılır, tür korunmaz | yüksek | `smartart-*` |
| group | WordprocessingGroup URI / `wpg:*` | figure sayılır, tür korunmaz | orta-yüksek | `grouped-drawing-object-synthetic` |
| textbox | `wps:txbx` veya `w:txbxContent` sahipliği | figure’dan hariç | yüksek | DrawingML ve VML textbox regresyonları |
| vml-image | `w:pict/v:shape/v:imagedata` | bağımsız nesne olgusu yok | orta | VML textbox kapsamı var; saf resim yok |
| ole | `w:object/o:OLEObject` | nesne/figure olgusu yok | yüksek | `ole-object-synthetic` |
| equation | `m:oMath`/`m:oMathPara` | akademik nesne olgusu yok | yüksek tespit edilebilirlik, politika belirsiz | özel fixture yok |
| table | `w:tbl` | table occurrence | yüksek teknik tespit | baseline ve tablo regresyonları |
| unknown-drawing | `w:drawing`, tanınmayan payload | generic figure | yüksek “bilinmeyen” tespiti | dolaylı olarak generic mimari |

Taksonomi akademik tür bildirmez. Örneğin `representation: "chart"`, kendi başına `academicType: "figure"` değildir.

## 7. Caption semantic taxonomy

Gerekli ayrı kavramlar:

- `declared-figure`: desteklenen söz dizimiyle `Şekil` beyanı.
- `declared-table`: desteklenen söz dizimiyle `Tablo` beyanı.
- `malformed`: bilinen etikete benzeyen ancak desteklenen başlık söz dizimini karşılamayan metin.
- `unnumbered`: etiket var, kullanılabilir numara yok.
- `ambiguous`: birden çok akademik yorum veya aday ilişki.
- `conflicting`: temsil/komşuluk içinde çelişen `Şekil` ve `Tablo` beyanları.
- `orphan`: semantik başlık var, ilişkilendirilebilir nesne yok.
- `unknown`: etiket/politika güvenle yorumlanamıyor.

Mevcut regex özünde `^\s*(tablo|şekil)\s+((?:\d+\.)*\d+)\.\s*(.*)$` biçimindedir (Türkçe küçük harfe dönüştürülmüş metin). Güncel destek:

| Örnek/kanıt | Bugün | Hedef notu |
|---|---|---|
| `Şekil 1. Açıklama` | desteklenir | güçlü beyan |
| `ŞEKİL 1. Açıklama` | desteklenir | locale-aware case normalizasyonu korunmalı |
| `Şekil 1.2. Açıklama` | desteklenir | çok seviyeli numara |
| `Şekil 1` | desteklenmez | noktasız biçim kaynak/politika kararı ister |
| `Şekil 1:` | desteklenmez | iki nokta kaynak/politika kararı ister |
| `Şekil 2-3.` | desteklenmez | aralık semantiği tanımlanmamalı |
| split run başlık | desteklenir | paragraf görünür metni birleştirilir |
| field result text | sonuç görünür metni uygunsa desteklenir | field instruction ayrıca kanıt olarak saklanmalı |
| yalnız `SEQ Şekil` instruction | doğrudan semantik kanıt olarak ayrıştırılmaz | instruction + sonuç ayrı tutulmalı |
| paragraph style | kimlik kanıtı değildir | yardımcı kanıt olabilir, tek başına yeterli değil |
| localized/custom label (`Çizelge`, `Figure`) | desteklenmez | aktif guide açıkça eşlemedikçe otomatik eşanlamlı yapılmamalı |

## 8. Caption association analysis

Mevcut deterministik davranış:

- Yalnız doğrudan `w:body` blok akışındaki başlık paragrafları ilişkilendirmeye katılır; boş ve TOC paragrafları başlık değildir.
- Figure ve table için, nesnenin öncesi/sonrasındaki bitişik paragraf blokları taranır. Boş paragraflar atlanır; tablo/başka blok veya ilk eşleşmeyen görünür paragraf sınır oluşturur.
- Tür, daha önce atanmış nesne tipinden beklenir: figure yalnız `Şekil`, table yalnız `Tablo` adayı arar.
- Tek aday `matched` ve `before/after`; birden çok aday `ambiguous`; aday yoksa `none` olur.
- Bir başlığı birden fazla nesne önerirse ilişkiler belirsizleştirilir.
- Anchored drawing ilişkisi güvenli konumsal sıra olmadığı için belirsizdir.
- İç içe / üst düzey bloğu olmayan tablo güvenle eşlenmez.
- Table cell ve textbox içindeki başlıklar doğrudan body bloğu değildir. `AlternateContent` etkin dal çözümü ve revision görünürlüğü upstream davranışa bağlıdır.

Gelecekte ilişki sonucu `matched | missing | ambiguous | conflicting | not-attempted` olmalı; aday caption kimlikleri, blok mesafesi, beklenen/gerçek yön ve gerekçe kodlarını korumalıdır. “En yakın” olmak tek başına akademik doğruluk değildir; sayfa/section sınırı, iki nesne–bir başlık, bir nesne–iki başlık, nested ownership ve anchored layout açık belirsizlik üretmelidir.

## 9. Missing-caption paradox

Yalnız temsile dayalı model, logo/kapak/imza/dekoratif resmi akademik şekil sayarak sahte düşük skor riski yaratır. Yalnız başlığa dayalı model ise başlığı gerçekten eksik olan akademik şekli yok sayarak sahte yüksek skor riski yaratır. Kaynaklar bu iki durumun tüm belgelerde otomatik ayrımını sağlamaz.

Sonuç: **ne representation-only ne caption-only yeterlidir**. Teknik temsil önce `ObjectOccurrence` üretmeli; uygun kapsamda olanlar aday olarak kalmalı; başlık beyanı ve ilişki çözümü akademik kimlik sağlayabilmeli; çözülemeyen aday `review-required` diagnostic olarak raporda görünmelidir. Bu durum mevcut fazda PASS/FAIL/N/A veya skoru değiştirmemelidir. İleride aktif üniversite politikası açık bir temsil ön-kabulü getirirse bu, generic parser’da değil policy/resolution katmanında uygulanmalıdır.

## 10. Table special-case analysis

`w:tbl`, chart/resme göre daha kuvvetli bir teknik tablo semantiğidir. Bu, nesnenin WordprocessingML tablosu olduğunu kanıtlar; tez rehberindeki numaralandırılmış akademik `Tablo` rolünü her bağlamda kanıtlamaz. Olası karşı örnekler: kapak/metadata yerleşimi, imza alanı, kenarlıksız layout, header/footer tablosu, textbox veya hücre içi tablo, nested table.

Mevcut normalizasyon tüm semantik `w:tbl` oluşumlarını sayar; object validator’ları çoğunlukla nested tabloları dışlasa da `hasTables/count` daha geniştir. Davranış kanıtsız biçimde zayıflatılmamalıdır. Gelecek model teknik `table` temsilini korumalı, `scope + document role + caption declaration + association` kanıtlarıyla akademik tablo çözümlemelidir.

## 11. Document-scope analysis

Her temsil oluşumu en az şu konumu kaydetmelidir: OPC part, block/paragraph, section, ana gövde–front matter rolü, table-cell sahipliği, textbox sahipliği, header/footer, footnote/endnote ve AlternateContent/revision görünürlüğü. Scope, semantik kimliğin kendisi değildir; adaylığa ve validator uygulanabilirliğine girdi sağlar.

Mevcut iyi sınırlar (TOC hariç tutma, textbox sahipliği, etkin AlternateContent dalı, görünür revision metni) korunmalıdır. Eksik part kapsamı “nesne yok” diye yorumlanmamalı; parser coverage olarak raporlanmalıdır.

## 12. Official-template evidence

Yerel resmî edebiyat ve laboratuvar şablonlarının önceki doğrulanmış incelemesi şunları gösterir:

- Her birinde iki DrawingML picture vardır.
- Chart, SmartArt, VML ve OLE örneği yoktur.
- `SEQ Tablo`, `SEQ Şekil`, tablo/şekil TOC alanları ve görünür `Tablo 1` / `Şekil 1` örnekleri vardır.
- Bir PNG/diagram-benzeri görsel `Şekil 1` olarak başlıklandırılmıştır.

Bu, caption/SEQ ile akademik kimlik arasında güçlü bağlamsal kanıttır. Tek örnekten “tüm PNG’ler/resimler şekildir” veya “tüm chart’lar şekildir” sonucu çıkarılamaz.

## 13. Fixture matrix

Yeni DOCX üretilmemiştir; mevcut corpus yeterlidir. `tests/audit/data/academicObjectSemanticsAudit.json` aşağıdaki kanıtları tekrar kullanılabilir biçimde bağlar:

| Fixture | Temsil | Başlık/ilişki | Bugünkü sonuç | Tasarım sonucu | Sınıf |
|---|---|---|---|---|---|
| `full-correct.docx` | picture | declared figure / matched | figure | resolved figure | EXPECTED_BEHAVIOR |
| `chart-object-synthetic.docx` | chart | none / missing | figure | unresolved candidate | SEMANTIC_OVERCLAIM |
| `smartart-object-synthetic.docx` | diagram | none / missing | figure | unresolved candidate | SEMANTIC_OVERCLAIM |
| `grouped-drawing-object-synthetic.docx` | group | none / missing | figure | unresolved candidate | SEMANTIC_OVERCLAIM |
| `ole-object-synthetic.docx` | OLE | none / not attempted | none | unresolved candidate | REPRESENTATION_GAP |
| `smartart-caption-collision-synthetic.docx` | diagram | declared figure / matched | figure | resolved figure | EXPECTED_BEHAVIOR |
| `drawingml-textbox-ownership-synthetic.docx` | textbox | none | none | excluded from object candidacy | EXPECTED_BEHAVIOR |
| `alternate-content-figure-synthetic.docx` | picture | declared figure / matched | one logical figure | resolved figure | EXPECTED_BEHAVIOR |

VML textbox ve tracked-move fixture’ları scope/revision sınırlarını destekler; ayrı akademik kimlik beklentisi kurmaz. Yeni fixture ancak 18A shadow modelinin somut kontratı belirlendiğinde eklenmelidir (özellikle malformed caption, iki nesne–bir caption, orphan caption, saf VML image, equation ve front-matter picture).

## 14. Runtime observations

`tests/audit/objectRepresentationAudit.cjs` ile gözlenen mevcut davranış:

- Baseline picture: 1 normalized figure, geçerli ilişkili başlık, 46/46.
- Caption’sız chart: baseline’a ek ikinci figure; figure caption placement başarısız, 45/46.
- Caption’sız SmartArt: ikinci figure; placement başarısız, 45/46.
- Caption’sız group: ikinci figure; placement başarısız, 45/46.
- OLE: figure sayısını artırmaz; baseline 1 figure ve 46/46 kalır.
- `Şekil 99.` başlıklı SmartArt: ikinci figure ve başlık eşleşir; hizalama/yer/format geçer, metin içi atıf başarısız, 45/46.

Bu gözlemler generic `w:drawing` dönüşümünü ve RuleResult etkisini kanıtlar. Üniversitenin chart/diagram/group için evrensel sınıf beklentisi bilinmediğinden, bunlar kanıtlanmış false positive değildir.

## 15. Proven vs unproven problems

### Kanıtlanmış

- **SEMANTIC_OVERCLAIM:** textbox olmayan `w:drawing`, payload ayrımı ve caption beyanı olmadan `Figure` adı ve figure count üretir.
- **REPRESENTATION_GAP:** VML image, OLE ve equation için genel temsil oluşumu modeli yoktur.
- **ASSOCIATION LIMITATION:** komşuluk modeli anchored, nested ve çoklu aday durumlarında kesin kimlik veremez.
- **INCONSISTENT RULE VISIBILITY:** alignment/placement/list generic veya başlıksız occurrence’ları görebilirken caption format/reference yalnız ilişkilendirilmiş caption’ları tüketir.
- **TYPE CERTAINTY GAP:** mevcut tipler temsil türünü ve semantic uncertainty’yi ifade edemez.

### Kanıtlanmamış

- Kanıtlanmış production false positive: **yok**. Chart/SmartArt/group’un üniversite açısından mutlaka şekil olmadığı kaynakla kurulmamıştır.
- Kanıtlanmış production false negative: **yok**. OLE/VML/equation’ın mutlaka akademik şekil/tablo sayılması kaynakla kurulmamıştır.
- Tüm başlıksız picture’ların figure veya dekoratif olduğu kanıtlanmamıştır.
- `Çizelge`, `Figure` veya style-only caption etiketlerinin bu guide için `Tablo/Şekil` eşdeğeri olduğu kanıtlanmamıştır.

## 16. Proposed domain model

Bu yalnız tasarımdır; üretimde uygulanmamıştır.

```ts
type AcademicObjectType = "figure" | "table";
type SemanticResolutionStatus =
  | "declared"
  | "unresolved"
  | "ambiguous"
  | "excluded";

interface DocumentLocation {
  part: "document" | "header" | "footer" | "footnote" | "endnote";
  blockIndex: number | null;
  paragraphId: string | null;
  sectionIndex: number | null;
  flowRole: "body" | "front-matter" | "unknown";
  owners: readonly ("table-cell" | "textbox" | "alternate-content")[];
}

interface ObjectRepresentationOccurrence {
  id: string;
  kind: ObjectRepresentationKind;
  location: DocumentLocation;
  xmlEvidence: readonly string[];
  layout: { mode: "inline" | "anchor" | "block" | "unknown" };
  detectionConfidence: "high" | "medium" | "low";
}

interface CaptionOccurrence {
  id: string;
  location: DocumentLocation;
  rawText: string;
  normalizedText: string;
  semantic: CaptionSemantic;
  fieldEvidence: readonly { instruction: string; result: string }[];
}

type CaptionSemantic =
  | { status: "declared"; type: AcademicObjectType; label: string; number: string }
  | { status: "malformed" | "unknown"; candidateLabel: string | null; reason: string };

interface ObjectCaptionAssociation {
  objectId: string;
  status: "matched" | "missing" | "ambiguous" | "conflicting" | "not-attempted";
  captionId: string | null;
  candidateCaptionIds: readonly string[];
  actualPosition: "before" | "after" | "unknown" | null;
  distanceInBlocks: number | null;
  reasons: readonly string[];
}

interface AcademicObjectResolution {
  objectId: string;
  status: SemanticResolutionStatus;
  academicType: AcademicObjectType | null;
  captionId: string | null;
  evidence: readonly { source: "representation" | "caption" | "association" | "scope" | "policy"; reason: string }[];
  reviewRequired: boolean;
}
```

Sorumluluklar ve invariant’lar:

- `ObjectRepresentationOccurrence`: parser’a aittir; yalnız teknik varlığı ve konumu bildirir; `DocumentFigureOccurrence` için gelecekteki temel alternatiftir.
- `CaptionOccurrence/CaptionSemantic`: görünür metin ve field kanıtını kaybetmeden belge beyanını bildirir; guide placement kuralını uygulamaz.
- `ObjectCaptionAssociation`: ilişkiyi ve belirsizliği taşır; representation kind’ı değiştirmez.
- `AcademicObjectResolution`: önceki olguları birleştirir; `declared` ancak desteklenen caption semantiği ve yeterli ilişki kanıtıyla oluşur. `unresolved` nesneyi silmez.
- Üniversite policy’si beklenen yer/hizalama/aralık/atıf/list gerekliliklerine sahip olur; generic OOXML parser’a bağlı olmaz.
- Mevcut `DocumentFigureOccurrence`/`DocumentTableOccurrence` ilk aşamada kaldırılmaz; shadow modelden legacy görünümler türetilerek RuleResult uyumluluğu korunur.

## 17. Rule applicability matrix

`D`: normal kural değerlendirmesi; `R`: skor dışı review-required diagnostic; `—`: uygulanmaz; `A`: önce association belirsizliği çözülmeli, akademik uygunluk skoru üretilmemeli.

| Gelecek kural ailesi | Resolved figure | Unresolved drawing | Ambiguous figure association | Excluded/decorative | Resolved table | Unresolved table |
|---|---:|---:|---:|---:|---:|---:|
| figure object alignment | D | R (ölçüm kanıtı saklanır) | A | — | — | — |
| figure caption placement | D | R (olası eksik başlık) | A | — | — | — |
| figure caption format | D | R yalnız malformed caption varsa | A | — | — | — |
| figure in-text reference | D | R, FAIL/PASS yok | A | — | — | — |
| list of figures | D ve resolved set | unresolved sayısı ayrıca gösterilir | A | — | — | — |
| table object alignment | — | — | — | — | D | R (ölçüm kanıtı saklanır) |
| table caption placement | — | — | — | — | D | R (olası eksik başlık) |
| table caption format | — | — | — | — | D | R yalnız malformed caption varsa |
| table in-text reference | — | — | — | — | D | R, FAIL/PASS yok |
| list of tables | — | — | — | — | D ve resolved set | unresolved sayısı ayrıca gösterilir |

Rule applicability resolver, validator’dan önce çalışmalıdır. Validator teknik representation sınıflarını yeniden yorumlamamalıdır. Mevcut davranış bu fazda korunur; matris hedef mimaridir.

## 18. Score-trust implications

Beş başlıksız resmi yok saymak skoru yanlış yükseltebilir; beşini de figure saymak yanlış düşürebilir. Bu nedenle gelecekte `AnalysisReport`, skordan ayrı `unresolvedObjectCount`, tür/scope dağılımı ve `scoreTrust: complete | qualified` benzeri bir gösterge taşıyabilir. `qualified`, “skor yanlış” demek değil, akademik nesne kapsamının insan incelemesi gerektirdiğini söyler. Belirsizlik otomatik `N/A` olmamalı ve bu fazda puan formülü değişmemelidir.

## 19. Migration strategy

1. **18A — Shadow facts:** representation detector ve yeni konum/tür olgularını legacy figure/table modelinin yanında üret; tüm RuleResult’ları aynen koru.
2. **18B — Caption semantics:** ham/görünür metin, field evidence, malformed/unknown durumlarını kayıpsız üret; legacy caption görünümünü türet.
3. **18C — Association + resolution shadow mode:** belirsizliği ve unresolved adayları skor dışı telemetry/audit olarak hesapla; legacy association hâlâ validator’ları beslesin.
4. **18D — Applicability migration:** validator’ları tek tek yeni resolved nesnelere geçir; her geçişte guide kanıtı ve golden/corpus sözleşmesi kur. Liste kuralları count semantiğine etkisi nedeniyle en son taşınmalı.
5. **18E — Legacy retirement:** eşdeğerlik ve review sonrası generic `w:drawing → figure` legacy görünümünü kaldır; rapor modelini uncertainty-aware hale getir.

Big-bang rewrite önerilmez. Her aşama legacy ve yeni olgular arasındaki farkı fixture bazında raporlamalıdır.

## 20. Implementation boundaries

Önerilen küçük modüller:

- `parsers/objectRepresentationDetector.ts`: OOXML payload ve location; üniversite bilgisi yok.
- `parsers/captionOccurrenceParser.ts`: visible text/field/style kanıtı; placement policy yok.
- `domain/captionSemanticClassifier.ts`: desteklenen label/number beyanı; aktif dil/label sözlüğü açık bağımlılık.
- `domain/objectCaptionAssociator.ts`: adaylar, mesafe, yön, sahiplik ve belirsizlik.
- `domain/academicObjectResolver.ts`: representation + caption + association + scope → resolution.
- `universities/.../academicObjectPolicy.ts`: beklenen başlık yeri, hizalama, aralık, atıf, liste ve varsa açık temsil ön-kabulleri.
- `rules/objectRuleApplicability.ts`: resolution/policy → validator input veya review diagnostic.

Bağımlılık yönü `parser facts → generic domain → university policy/applicability → validators` olmalıdır. Parser’ın university rule config’e, representation’ın validator’a geri bağımlılığı olmamalıdır.

## 21. Risks

- Field instruction ve cached result uyuşmazlığı, güncel olmayan Word alanları.
- Anchored nesnenin XML sırası ile görsel sayfa sırasının farklı olması.
- Çoklu nesne/grup ile tek akademik başlık arasında cardinality belirsizliği.
- Front matter/body rolünün section marker’larıyla her belgede kesin çözülememesi.
- Layout tablosu ile akademik tablonun caption yokken ayrıştırılamaması.
- VML/OLE/equation ve header/footer/note part coverage eksikliği.
- Caption söz dizimini genişletirken kaynak dışı label eşanlamları üretme riski.
- Shadow ve legacy sayımların uzun süre ayrışarak bakım maliyeti yaratması.
- Uncertainty göstergesinin kullanıcıya “hata” veya “N/A” gibi yanlış sunulması.

## 22. Phase decision

**OPTION C — New semantic layer is required before changing figure behavior.**

Gerekçe: (1) birincil kaynak akademik kuralı destekliyor fakat OOXML eşlemesini desteklemiyor; (2) runtime generic DrawingML’in figure RuleResult’larına girdiğini kanıtlıyor; (3) caption-only yaklaşım missing-caption açmazını çözemiyor; (4) mevcut tipler representation, declaration, association ve uncertainty’yi ayrı ifade edemiyor. Küçük bir detector koşulu bu dört sorunu birlikte ve kaynak-güvenli biçimde çözemez.

## 23. Recommended next phase

**Phase 4E-18A — Object Representation & Caption Semantic Foundation (Shadow Model)**

En küçük üretim dilimi: teknik `ObjectRepresentationOccurrence` ve kayıpsız `CaptionOccurrence/CaptionSemantic` olgularını mevcut modelin yanında üretmek; legacy `DocumentFigureOccurrence`, validator girdileri, skor ve tüm RuleResult’ları değiştirmemek; fixture bazında shadow/legacy fark raporu eklemek. Association resolver ve validator migration bu ilk dilime dahil edilmemelidir.
