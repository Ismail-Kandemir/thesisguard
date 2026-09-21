# Phase 4E-18C — Figure Caption Format Shadow-to-Production Pilot Migration

## 1. Executive summary

İlk kontrollü validator migration’ı tamamlandı. Yalnız `ObjectCaptionFormatValidator` içindeki `comu.applied-sciences.food-technology.bachelor.figure-caption-format` artık academic figure eligibility için `NormalizedDocument.objectSemantics` kullanır. Table caption format ve diğer tüm validator’lar legacy kaynaklarında kalır.

14 ilgili fixture üzerinde legacy ve shadow selection/result dual-run karşılaştırması; eligible sayısı, status, actual, message ve structured evidence açısından tam **PARITY** verdi. Golden `46/46`, corpus `31 regression + 11 exploratory` geçti. Pilot kararı: **PILOT_SUCCESS_WITH_LIMITATIONS**.

## 2. Starting state

- Dal: `main`
- Gerçek başlangıç commit’i: `d55ed7e` (`test: audit shadow semantic migration readiness`)
- Başlangıç çalışma ağacı temizdi.
- `HEAD == origin/main == d55ed7e`.

## 3. Pilot scope

Migration edilen tek validator/rule:

- `ObjectCaptionFormatValidator`
- `comu.applied-sciences.food-technology.bachelor.figure-caption-format`

Figure alignment, caption placement, reference, list-of-figures ve bütün table kuralları kapsam dışıdır. Scoring, report UI ve rule metadata değişmemiştir.

## 4. Pre-migration legacy behavior

Legacy selection, `document.figures.items` içindeki inline occurrence’lardan `captionId` sahibi ve ambiguous olmayanları alıyor; `document.captions` üzerinden paragraph formatting’e ulaşıyordu. Bu nedenle generic `w:drawing` akademik figure setinin başlangıç noktasıydı, ancak caption’sız drawing’ler format kontrolüne zaten girmiyordu.

Golden, picture/chart/diagram/group/unknown/VML/OLE/equation/textbox/AlternateContent/revision fixture’larında pilot rule pre-migration sonucu `PASSED`; captioned SmartArt’ta iki eligible caption ile `PASSED` idi. Targeted yanlış-format vakası `FAILED`, teknik nesne fakat declared caption olmayan vakalar `NOT_APPLICABLE` idi.

## 5. Shadow eligibility contract

Bir caption yalnız tüm koşullar sağlanırsa figure-caption-format girdisidir:

1. `AcademicObjectResolution.status === "declared"`
2. `academicType === "figure"`
3. Aynı object ID için `ObjectCaptionAssociation.status === "matched"`
4. Resolution ve association aynı caption ID’ye işaret eder
5. Representation `scope === "body"`
6. Representation `drawingType === "inline"`
7. Caption semantic `declared/figure`
8. Caption paragraph ve legacy evidence bridge aynı paragraph ID/number ile tutarlıdır

Unresolved, ambiguous, conflicting, excluded ve orphan olgular eligible değildir.

## 6. Source grounding

Primary grounding kaydı figure caption format kuralını **PRIMARY_DIRECT** sınıflandırır. Normatif gereklilik caption’ın sola yaslı ve tek satır aralığında olmasıdır. Validator’ın kontrol ettiği özellikler değiştirilmemiştir: effective paragraph alignment ve line spacing. Şablon örnekleri normatif rehberin yerine geçirilmemiş; font boyutu bu validator’a eklenmemiştir.

## 7. Dual-run methodology

Audit harness aynı normalize belgeyi iki kez `ObjectCaptionFormatValidator`’a verir:

- gerçek pilot rule ID → shadow selection;
- audit-only farklı rule ID, aynı expected değerler → korunmuş legacy selection dalı.

Karşılaştırılan alanlar: legacy/shadow eligible count, `status`, `passed`, `expected`, `actual`, `message`, `evidenceTotal` ve tüm evidence nesneleri. Association audit içinde yeniden kurulmaz; shadow candidate seti mevcut resolution/association ID’lerinden okunur.

## 8. Differential results

| Fixture grubu | Legacy eligible | Shadow eligible | Sonuç | Sınıf |
|---|---:|---:|---|---|
| full-correct | 1 | 1 | PASSED/PASSED | PARITY |
| uncaptioned chart/diagram/group/unknown | 1 baseline | 1 baseline | PASSED/PASSED | PARITY |
| VML/OLE/equation | 1 baseline | 1 baseline | PASSED/PASSED | PARITY |
| DML/VML textbox | 1 baseline | 1 baseline | PASSED/PASSED | PARITY |
| AlternateContent/revision | 1 | 1 | PASSED/PASSED | PARITY |
| captioned SmartArt | 2 | 2 | PASSED/PASSED | PARITY |

Buradaki baseline eligible, fixture’ların zaten içerdiği geçerli normal figure’dır; ek unresolved teknik nesne eligibility’yi artırmamıştır.

## 9. Accepted/rejected divergences

Mevcut corpus’ta divergence yoktur. Tüm kayıtlar `PARITY` sınıfındadır; semantic narrowing/expansion kabulü gerekmedi. Herhangi bir regression, source conflict veya ambiguous difference görülseydi production switch durdurulacaktı.

## 10. Production implementation

Değişiklik yalnız `ObjectCaptionFormatValidator.ts` içindedir. Exact pilot rule ID, yeni `getDeclaredFigureCaptionFormatting()` yoluna gider. Diğer rule ID’leri, özellikle table caption format, `getLegacyAssociatedCaptionFormatting()` kullanmaya devam eder.

Validator XML parse etmez, `w:drawing` aramaz, caption regex’i çalıştırmaz ve nearest-paragraph association kurmaz. Semantic layer’ın object/caption ID’lerini tüketir.

## 11. Paragraph-format bridge

Shadow caption occurrence mevcut `paragraphId` alanıyla normalize paragraph’a bağlanır. Structured evidence şemasını ve mevcut mesajları korumak için aynı paragraph ID’ye sahip legacy `DocumentCaption` kullanılır; kind ve number shadow semantic ile doğrulanır. Formatting kopyalanmaz: tek kaynak `Paragraph` + `EffectiveFormattingResolver` olmaya devam eder.

## 12. Multiple figure behavior

İki declared/matched inline figure birlikte test edildi. Validator iki caption’ı da değerlendirdi; biri doğru, biri yanlış olduğunda genel sonuç `FAILED`, `evidenceTotal=1` ve tek failing caption evidence’ı üretildi. İlk nesnede durma yoktur.

## 13. Mixed resolved/unresolved behavior

Bir doğru declared figure ile bir uncaptioned chart birlikte test edildi. Yalnız declared figure eligible oldu ve sonuç `PASSED`; unresolved chart format sonucunu kirletmedi veya academic figure’a yükseltilmedi.

## 14. Ambiguous/orphan behavior

- Bir figure çevresinde iki caption adayı: association ambiguous, zero eligible, `NOT_APPLICABLE`.
- Valid orphan `Şekil n.` caption: object/resolution üretmez, zero eligible, `NOT_APPLICABLE`.
- Malformed `Şekil 1:`: syntax sorunu caption-format validator’a taşınmaz; declared figure olmadığı için `NOT_APPLICABLE`.

Mevcut RuleResult sözleşmesinde ayrı uncertainty state olmadığı için pilot rule bu durumlarda N/A üretir. Semantic facts kaybolmaz fakat henüz kullanıcı diagnostic’i yoktur.

## 15. Textbox/front-matter/anchor safety

- DrawingML ve VML textbox’lar declared figure eligibility kazanmaz.
- Generic caption’sız front-matter resmi figure’a yükseltilmez. Front-matter rolü hâlâ ayrıştırılmamaktadır; caption-declared body-scope nesnenin akademik bölüm rolü ayrıca kanıtlanmaz.
- Anchor representation `drawingType !== "inline"` nedeniyle pilot dışında kalır. Caption placement/order problemi çözülmeye çalışılmaz.

## 16. RuleResult before/after

Tüm ilgili mevcut fixture’larda pilot rule’un status, actual, message ve evidence çıktıları aynıdır. Production golden ve corpus RuleResult’larında değişiklik görülmedi.

## 17. Score/applicability impact

Regression ve exploratory corpus’ta pilot status/applicability değişmedi; skor numerator/denominator etkisi yoktur. Declared figure bulunmayan teknik-only targeted belgede sonuç `NOT_APPLICABLE`dır; unresolved nesneler PASSED veya FAILED yapılmaz. Unresolved diagnostic eksikliği devam eder.

## 18. Evidence/message impact

Mevcut kullanıcı mesajları ve structured `CaptionRuleEvidence` korunmuştur. Wrong-format testinde `FAILED`, tek evidence ve doğru `evidenceTotal` üretildi. Rapor evidence şeması genişletilmedi.

## 19. Non-pilot validator parity

Chart, SmartArt, group ve unknown-drawing fixture’larında mevcut figure-caption-placement failure’ları; captioned SmartArt’ta figure-in-text-reference failure’ı aynen kaldı. Golden/corpus tüm diğer rule expected sonuçlarını doğruladı. Table caption format legacy seçim kullanır.

## 20. Tests

`tests/audit/figureCaptionFormatPilotMigration.cjs` şunları kanıtlar:

- doğru/yanlış format PASS/FAIL;
- picture/chart/diagram/group/unknown/VML/OLE/equation/textbox non-promotion;
- orphan, ambiguous ve malformed exclusion;
- mixed resolved/unresolved izolasyonu;
- multiple figure aggregation;
- AlternateContent tek occurrence;
- deleted/moveFrom görünmezliği;
- 14 fixture üzerinde legacy/shadow full-result parity;
- seçilmiş non-pilot RuleResult parity.

Yeni DOCX fixture gerekmemiştir; 4E-18B corpus’u yeniden kullanılmıştır.

## 21. Golden/corpus

- Golden: `46/46`.
- Corpus: `31 regression + 11 exploratory`.
- Exploratory pilot divergence: yok.

## 22. Quality gates

Çalıştırılan kapılar: typecheck, lint, build, golden, corpus, pilot audit, shadow regression, semantic coverage readiness, Phase 4E-18 data audit, rule grounding, primary grounding ve source manifest normal/strict doğrulaması.

## 23. Git/source binary safety

Resmî dört binary local/ignored kalmış, strict boyut ve SHA-256 doğrulaması geçmiştir. Binary’ler kopyalanmamış veya stage edilmemiştir. Commit/push yapılmamıştır.

## 24. Remaining limitations

- Unresolved/ambiguous için production diagnostic ve score-trust göstergesi yok.
- Front-matter academic role çözülmüyor.
- Header/footer/note parts object semantics kapsamı dışında.
- Anchor order/placement çözülmüyor.
- Shadow occurrence alignment fact taşımıyor.
- Equation block ownership ve nested/layout table rolleri çözülmedi.
- Field result freshness bilinmiyor.
- Pilot bridge structured evidence için legacy `DocumentCaption` kullanmayı sürdürüyor.

## 25. Pilot decision

**PILOT_SUCCESS_WITH_LIMITATIONS**

Semantic source switch güvenli ve ölçülebilir biçimde gerçekleşti; mevcut RuleResult parity tamdır. Karar yalnız figure caption format kuralını kapsar.

## 26. Recommended next phase

**Phase 4E-18D — Unresolved Academic Object Diagnostic Foundation**

Bir sonraki en güvenli adım yeni validator migration’ı değildir. Önce unresolved/ambiguous nesnelerin kullanıcıya skor dışı, açıklanabilir diagnostic olarak sunulacağı domain/report kontratı kurulmalıdır. Bu, sonraki presence/placement/list migration’larında N/A ve score inflation riskini görünür kılar.
