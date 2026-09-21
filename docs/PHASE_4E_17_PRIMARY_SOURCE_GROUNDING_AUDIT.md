# Phase 4E-17 — Primary Source Grounding Audit

## 1. Purpose

Bu phase, ÇOMÜ Çanakkale Uygulamalı Bilimler Fakültesi Gıda Teknolojisi Bölümü lisans bitirme tezi için resmî artifact'ları immutable snapshot olarak edinir, SHA-256 ile sabitler ve Experimental runtime'daki 46 rule'u primary source'a karşı yeniden denetler. Production parser, validator, rule JSON, UI ve RuleResult semantics değiştirilmemiştir.

## 2. Starting checkpoint

- Branch: `main`
- HEAD/main/origin-main: `f8b187495bc351e7269f3d0c2b5fc71b6e360250`
- Short HEAD: `f8b1874`
- Commit: `test: audit rule source grounding and object semantics`
- Başlangıç working tree: clean

Checkpoint tam eşleştiği için phase devam etti.

## 3. Official source discovery

Resmî bölüm sayfası: `https://gida.cubf.comu.edu.tr/arsiv/duyurular/bitirme-tezi-yazim-kurallari-r56.html`. Sayfa başlığı `Bitirme Tezi Yazım Kuralları`, görünür tarihi `25.03.2022` ve kurumsal kimliği Çanakkale Onsekiz Mart Üniversitesi / Çanakkale Uygulamalı Bilimler Fakültesi / Gıda Teknolojisi Bölümüdür. Dört attachment URL'si HTML anchor'larından çözüldü; filename tahmini yapılmadı.

## 4. Source identity

Guide PDF'nin görünür içeriği fiziksel PDF sayfası 11'deki Ek-1'de şunları birlikte içerir: `T.C.`, `ÇANAKKALE ONSEKİZ MART ÜNİVERSİTESİ`, `ÇANAKKALE UYGULAMALI BİLİMLER FAKÜLTESİ`, `GIDA TEKNOLOJİSİ BÖLÜMÜ`, `LİSANS BİTİRME TEZİ`. Kimlik yalnız URL veya filename'den çıkarılmadı. Citation guide ve iki DOCX şablonunun `word/document.xml` metinleri de aynı kurumsal kimliği taşır.

## 5. Acquisition result

Dört artifact exact bytes olarak başarıyla indirildi:

1. Normative guide PDF (`A1`).
2. Citation guide DOCX (`A2`).
3. Literature thesis template DOCX (`A2`).
4. Laboratory thesis template DOCX (`A2`).

PDF magic `%PDF-`; üç DOCX magic `PK` ve geçerli OOXML ZIP package yapısındadır. Orijinaller yeniden kaydedilmedi veya normalize edilmedi.

## 6. Source manifest

Machine-readable manifest `docs/sources/comu/applied-sciences/food-technology/bachelor/manifest.json` içindedir. Institution, faculty, department, level, official page, page date, retrieval timestamp, source IDs, download URLs, filenames, MIME types, trust levels, sizes ve hashes kaydedildi. Bilinmeyen artifact publication/version/effective date alanları null'dır.

## 7. Hashes

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Citation guide 101 | 17,885 | `0d0bd2be26cabf8f7e826e18e16ef33eee234bcc868a8b3aa2abce352289c3a4` |
| Normative guide 102 | 293,554 | `70326c5854bc6a1c7c1b71fbd9b5d9e1cae59d3afb3b309dc18a617de7359a83` |
| Literature template 103 | 152,710 | `8b26e40baa86a64c2a33cca1126818b6a7c71f20c22d2d071d1cdadb48fd1cca` |
| Laboratory template 104 | 152,886 | `84123c7f79e76395d37fd90e9278a3ed36b0c6192cd8d02017e024d54b344cfa` |

Final manifest audit tüm hash'leri yeniden hesaplar ve mismatch'te fail eder.

## 8. Guide version/date findings

Resmî duyuru tarihi 25.03.2022'dir. Guide binary içinde güvenilir publication date, revision date, version number veya effective academic year bulunamadı. Şablondaki `Tezin Sunulduğu Tarih: 15/01/2020`, kabul sayfasındaki `09/08/2021` ve teşekkür sayfasındaki `Ocak 2020` örnek tez tarihleridir; guide version değildir. DOCX core created/modified properties artifact publication tarihi olarak kullanılmadı. Guide version: **UNKNOWN**.

## 9. Primary guide structure

PDF 21 fiziksel sayfadır ve text layer içerir. Audit indexi:

| Fiziksel PDF sayfası | Bölüm | Ana primary hükümler |
| ---: | --- | --- |
| 1 | 4.1 Sayfa Yapısı | Üst/sol 3 cm; sağ/alt 2,5 cm |
| 2 | 4.2 Yazı Karakteri ve Paragraf Yapısı | TNR 12; bold headings; 1,5 line; caption descriptions 1 line; 1,5 cm indent; heading left; body justify |
| 2 | 4.3 Sayfa Numaraları | Bottom-center; lowercase Roman front matter; decimal main/remainder |
| 2-3 | 4.4 Tablo ve Şekiller | Object center; caption left; figure below; table above; in-text reference; conditional source attribution |
| 3 | 4.5 Yazım Usulleri | Academic language guidance |
| 3-5 | 4.6 İçerik ve Başlıklar | Organized/bold numbered heading examples |
| 5 | 4.7 Kısaltmalar | First-use expansion |
| 5-8 | 4.8 Kaynaklar | In-text and bibliography formats |
| 8-9 | 5 Bölüm yapısı | Required/conditional sections by track |
| 11-21 | Ek-1..Ek-11 | Cover, declaration, approval, summary, TOC, lists, CV examples |

`pdfPhysicalPageIndex` audit JSON'da zero-based; `pdfPageNumber` one-based fiziksel PDF sayfasıdır. Basılı/document page label olmadığı yerde uydurulmadı.

## 10. Official templates

Her iki template doğrudan OOXML ile incelendi:

- Literature: 12 section; Laboratory: 11 section.
- Tüm section marginleri `top/left=1701 twip`, `right/bottom=1418 twip` (yaklaşık 3/2,5 cm).
- Front sections `lowerRoman`; Giriş geçişinde `w:start=1`.
- Her template: 2 DrawingML picture, 1 top-level table, 0 chart part, 0 SmartArt/diagram part, 0 VML picture.
- Fields: `TOC ... \c "Tablo"`, `TOC ... \c "Şekil"`, `SEQ Tablo`, `SEQ Şekil`.
- Caption examples: `Tablo 1...` ve `Şekil 1...`.
- `Şekil 1` nesnesi PNG picture payload'dır ve içeriği diyagram benzeri bir görseldir.
- Caption style `ResimYazs`: left, line 240 (single), size 18 half-points (9 pt).

Son madde guide'ın tüm metin için 12 pt normuyla çatışan template formatting observation'dır. Normative A1 guide kazanır. Production global 12 pt rule doğrudur; template 9 pt değeri production normu yapılmamalıdır.

## 11. Citation guide

Citation guide kurumsal identity'yi ve yazar/yıl ile bibliography format örneklerini içerir. Current 46 içinde yalnız `references` required-section rule'u vardır; bibliography format veya in-text academic citation-format production rule'u yoktur. Citation guide mevcut 46 layout rule'una yeni mismatch üretmez. Bir figure taxonomy tanımı sağlamaz; object semantics için kullanılmadı.

## 12. 46-rule primary grounding

Her rule için provenance, expected value, sourceId, physical page index, one-based page, section, short evidence, interpretation, confidence, secondary comparison, value comparison ve implementation note `tests/audit/data/comuFoodTechnologyPrimaryRuleGrounding.json` içinde explicit olarak tutulur.

| # | Rule kısa adı | Primary classification | Page/section | Value |
| ---: | --- | --- | --- | --- |
| 1 | font-family | PRIMARY_DIRECT | 2 / 4.2 | MATCH |
| 2 | font-size | PRIMARY_DERIVED | 2 / 4.2 | NORMALIZED_MATCH |
| 3 | heading2 | PRIMARY_DERIVED | 2 / 4.2 | NORMALIZED_MATCH |
| 4 | heading3 | PRIMARY_DERIVED | 2 / 4.2 | NORMALIZED_MATCH |
| 5 | line-height | PRIMARY_DERIVED | 2 / 4.2 | NORMALIZED_MATCH |
| 6 | body alignment | PRIMARY_DIRECT | 2 / 4.2 | MATCH |
| 7-9 | left/right/bottom margins | PRIMARY_DERIVED | 1 / 4.1 | NORMALIZED_MATCH |
| 10 | heading alignment | PRIMARY_DIRECT | 2 / 4.2 | MATCH |
| 11 | paragraph indentation | PRIMARY_DERIVED | 2 / 4.2 | NORMALIZED_MATCH |
| 12 | top margin | PRIMARY_DERIVED | 1 / 4.1 | NORMALIZED_MATCH |
| 13-14 | heading1/body level-0 format | PRIMARY_DERIVED | 2 / 4.2 | NORMALIZED_MATCH |
| 15 | page-number | PRIMARY_DIRECT | 2 / 4.3 | MATCH |
| 16-20 | TOC/references/summaries/declaration | PRIMARY_DIRECT | 8-9 / section table | MATCH |
| 21 | page-number-sequence | PRIMARY_DERIVED | 2 + Ek-7 | NORMALIZED_MATCH |
| 22-29 | table/figure object-caption-reference | PRIMARY_DIRECT | 2-3 / 4.2, 4.4 | MATCH |
| 30-34 | approval/thanks/introduction/conclusion/CV | PRIMARY_DIRECT | 8-9 / section table | MATCH |
| 35-37 | conditional lists | PRIMARY_DIRECT | 8-9 / section table | MATCH |
| 38 | TR summary word count | PRIMARY_DIRECT | 8 / section table | MATCH |
| 39 | EN summary word count | PRIMARY_DERIVED | 8 / section table | NORMALIZED_MATCH |
| 40 | TR keywords | PRIMARY_DIRECT | 8 / section table | MATCH |
| 41 | EN keywords | PRIMARY_DERIVED | 8 / section table + templates | NORMALIZED_MATCH |
| 42-44 | Experimental required sections | PRIMARY_DIRECT | 9 / section table | MATCH |
| 45 | Experimental section order | PRIMARY_DIRECT | 8-9 / section table | MATCH |
| 46 | Experimental heading numbering | PRIMARY_DIRECT | 3 / 4.6 + Ek-7 | MATCH |

## 13. Classification summary

| Classification | Count |
| --- | ---: |
| PRIMARY_DIRECT | 32 |
| PRIMARY_DERIVED | 14 |
| TEMPLATE_SUPPORTED | 0 |
| SECONDARY_ONLY | 0 |
| AMBIGUOUS | 0 |
| UNSUPPORTED | 0 |
| CONFLICTING | 0 |

Bu classification rule requirement grounding'idir. Figure object taxonomy'sinin unresolved olması, primary guide'daki “Şekil ortalanır/başlığı aşağıdadır/atıf yapılır” akademik hükmünü ambiguous yapmaz; hangi runtime occurrence'ın `Şekil` olduğu ayrı sorudur.

## 14. Phase 4E-16 → 4E-17 transitions

| Transition | Count |
| --- | ---: |
| DIRECT(Level B) → PRIMARY_DIRECT | 27 |
| DERIVED(Level B) → PRIMARY_DERIVED | 14 |
| AMBIGUOUS → PRIMARY_DIRECT | 5 |

Son beş transition figure rule requirement'ının primary-backed olduğunu gösterir; generic `w:drawing` taxonomy'sini doğrulamaz.

## 15. Numeric/string rule comparison

32 value `MATCH`, 14 value `NORMALIZED_MATCH`, 0 `MISMATCH`, 0 `SOURCE_AMBIGUOUS`. Margin, TNR, 12 pt, 1,5 line, 1,5 cm indentation, left/justify alignment, page location/format transition, caption placement/alignment/spacing ve section expectations primary guide ile uyumludur.

## 16. Table semantics

Primary guide 4.4 table object center, caption left, caption above ve in-text reference hükümlerini doğrudan verir. Section table, table varsa Tablolar Listesi ister. Current five table rules bu hükümlerle eşleşir. Top-level `w:tbl` seçimi implementation approximation'dır; primary guide nested-layout tables hakkında konuşmaz.

## 17. Figure semantics

Primary guide 4.4 figure object center, caption left, caption below ve in-text reference hükümlerini doğrudan verir. Section table, figure varsa Şekiller Listesi ister. Bu beş akademik requirement `PRIMARY_DIRECT`tır. Primary guide “Şekil”in OOXML veya görsel alt türlerini tanımlamaz.

## 18. Object taxonomy

| Object | Guide mention | Template evidence | Decision | Confidence |
| --- | --- | --- | --- | --- |
| Picture | Yok | PNG example captioned Şekil 1 | CONTEXT_DEPENDENT | medium |
| Photograph | Yok | Yok | UNRESOLVED | low |
| Screenshot | Yok | Yok | UNRESOLVED | low |
| Chart | Yok | Chart part yok | UNRESOLVED | low |
| Graph | Yok | Yok | UNRESOLVED | low |
| SmartArt | Yok | Diagram part yok | UNRESOLVED | low |
| Diagram | Yok | Diyagram benzeri PNG example Şekil 1 | CONTEXT_DEPENDENT | medium |
| Schema | Yok | Yok | UNRESOLVED | low |
| Map | Yok | Yok | UNRESOLVED | low |
| Grouped Drawing | Yok | Yok | UNRESOLVED | low |
| VML Image | Yok | Yok | UNRESOLVED | low |
| OLE | Yok | Yok | UNRESOLVED | low |
| Equation | Yok | Yok | UNRESOLVED | low |

Primary guide ve üç DOCX üzerinde case-insensitive search, `Tablo`/`Şekil` dışında grafik/chart/resim/image/fotoğraf/diyagram/diagram/şema/SmartArt/group/harita/çizelge/OLE/VML/equation taxonomy tanımı bulmadı. Template image'i tek bir example için evidence'dır; universal mapping değildir.

## 19. Caption semantics

Guide caption identity örneklerini `Tablo 2.` ve `Şekil 2.` ile verir; templates `SEQ Tablo`/`SEQ Şekil` ve corresponding TOC fields kullanır. Caption position/alignment/line spacing primary-backed'tir. Exact parser regex, nearest-block association ve canonical number metadata implementation choices'dır. Guide tüm possible caption aliases veya punctuation grammar'ı tanımlamaz.

## 20. Reference semantics

Guide “Tablo ve şekillere metin içerisinde atıf yapılmalıdır” hükmünü örneklerle verir. Current two object-reference rules primary-backed'tir. Caption number üzerinden identity kurmak implementation normalization'dır. Citation guide'daki academic author/year rules bu object-reference rules ile karıştırılmadı.

## 21. List semantics

Guide section table açıkça “tablo var ise” Tablolar Listesi ve “şekil var ise” Şekiller Listesi ister. Templates ilgili Word TOC fields'i içerir, fakat guide otomatik field kullanımını yalnız faydalı olarak anlatır; field zorunluluğu yoktur. Current conditional presence rules primary-backed'tir; list content consistency/page correctness rule'u yoktur.

## 22. Table vs Çizelge

Normative PDF, citation guide ve iki template içinde `Çizelge` taxonomy veya caption alias'ı bulunmadı. `Çizelge == Tablo` sonucu **UNSUPPORTED**tır. Production'a alias eklenmemelidir.

## 23. Template evidence

Templates guide'ı margins, page-number transition, section structure, lists, table/figure caption labels ve one concrete PNG-as-Şekil example'ı açısından destekler. Guide ile template formatting gözlemi arasında caption size çatışması vardır: A1 guide 12 pt global norm, A2 templates `ResimYazs` 9 pt. Hiyerarşi gereği guide kazanır.

## 24. Source/config mismatches

46 current rule expected value içinde primary guide'a aykırı config bulunmadı: **0 MISMATCH**. Template caption size conflict'i production config mismatch değildir; global 12 pt config primary guide ile uyumludur. Generic `w:drawing → figure` rule config value değil, parser domain-classification sınırıdır.

## 25. Error-severity trust risks

Tanımlı risk ölçütüne göre severity=error ve classification `SECONDARY_ONLY/AMBIGUOUS/UNSUPPORTED/CONFLICTING` olan rule yoktur. Bununla birlikte beş figure error rule'unun occurrence seti generic `w:drawing` tarafından üretildiği için ayrı **implementation semantic trust risk** sürer. Chart/SmartArt/group exploratory FAIL'leri akademik yanlışlık olarak doğrulanmış değildir.

## 26. Provenance architecture recommendation

Production `RuleDefinition` için ileride minimal `sourceReferences` önerilir:

```ts
sourceReferences: [{
  sourceId: string;
  section?: string;
  pdfPhysicalPageIndex?: number;
  interpretation?: string;
}]
```

Source identity, URL, hash ve dates ayrı `GuideSource` registry'sinde tutulmalıdır. Büyük quote blob'ları production rule JSON'una kopyalanmamalıdır. Bu phase'de model değiştirilmedi.

## 27. Source update strategy

Yeni guide eski binary üzerine yazılmamalıdır. Yeni collection/sourceId, immutable filename, URL, retrieval timestamp, hash, version metadata ve yeni grounding dataset gerektirir. Eski snapshot tarihsel denetim için korunur. Manifest hash audit silent replacement'ı fail ettirir.

## 28. 4E-15A readiness

Karar: **ARCHITECTURE CHANGE NEEDED — CAPTION/SEMANTIC MODEL SHOULD PRECEDE CLASSIFIER.** Primary guide figure requirements'ını tanımlar, fakat object taxonomy'yi tanımlamaz. Template evidence, bir PNG/diyagram örneğinin `Şekil 1` caption'ıyla akademik rol kazanabildiğini gösterir. Bu, caption-first/hybrid model araştırmasını representation-only classifier'dan daha değerli yapar.

Eksik institutional evidence nedeniyle chart, SmartArt, photograph, screenshot, grouped drawing, VML, OLE ve equation için include/exclude policy yazılamaz.

## 29. Production-change boundary

Production `src` altında değişiklik yapılmadı. Rule config mismatch bulunmadığı için fix önerilmedi. Parser semantic limitation belgelenmiş, ancak speculative classifier uygulanmamıştır.

## 30. Next phase recommendation

Önerilen Phase 4E-18: **Caption-Declared Academic Object Semantics Design Audit**. Amaç, temsil (`picture/chart/diagram/group`), caption semantic type (`Şekil/Tablo/unknown`) ve guide policy'yi ayıran domain modelini tasarlamak; explicitly captioned objects için güvenli policy belirlemek; caption'sız objects için UNKNOWN sonucunu modellemek olmalıdır. Production uygulaması ayrı onay gerektirir.

## 31. Caption-first semantics evaluation

Guide ve templates akademik identity'yi `Şekil n.` / `Tablo n.` captionları üzerinden görünür kılar. Bir chart açıkça `Şekil 4.` diye caption edilmişse document author akademik rol beyanında bulunmuştur. Bu, representation-only mapping'den daha güçlü bir signal olabilir. Ancak guide yanlış/missing caption halinde category inference'ı tanımlamaz; caption-first model audit edilmeden doğrudan uygulanmamalıdır.

## 32. Representation-first semantics evaluation

Primary source `w:drawing`, DrawingML, picture, chart veya SmartArt terimlerini kullanmaz. Dolayısıyla `w:drawing → figure` için institutional justification yoktur. Teknik representation tek başına academic object type değildir.

## 33. Hybrid model evaluation

Önerilen conceptual equation:

`ObjectRepresentation + CaptionSemanticType + GuidePolicy → AcademicObjectType`

Örnek: representation=chart, caption=`Şekil 3`, guide policy=figure-caption semantics → candidate academic figure. Caption yoksa veya collision varsa `UNKNOWN`, otomatik NOT_FIGURE/FIGURE yerine daha güvenlidir. Bu yalnız architecture recommendation'dır.

## 34. Source license/storage risk

Artifact'lar resmî ve public department page'den alınmıştır; ownership ÇOMÜ'dedir. Açık redistribution license bulunmadı. Phase 4E-17B policy'si `docs/sources/**/original/*` içindeki binary'leri Git'ten dışlar; manifest, README, audit data ve scripts track edilebilir kalır. Binary'ler local evidence snapshot olarak korunur. Default manifest audit fresh clone'da eksik binary'leri açıkça `SKIPPED` raporlar; `THESISGUARD_REQUIRE_SOURCE_BINARIES=1` strict mode eksik snapshot'ı fail ettirir. Mevcut fakat size/hash'i bozuk binary her iki modda da fail olur.

## 35. Audit results

- `primarySourceManifestAudit.cjs`: PASS; 4 artifact/hash.
- `primaryRuleGroundingAudit.cjs`: PASS; 46/46, provenance/source/page validation.
- Phase 4E-16 `ruleSourceGroundingAudit.cjs`: PASS; historical 46/46 completeness korundu.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS; yalnız mevcut 500 kB chunk warning'i.
- `npm run test:golden`: PASS, 46/46.
- `npm run test:corpus`: PASS, 31 regression + 8 exploratory.
- Final manifest re-hash: PASS; dört original binary manifest ile aynı.

## 36. Trust boundary

Primary binary acquisition ve exact-byte hashes doğrulandı. PDF text extraction ile relevant pages, appendices ve terminology arandı; visible identity ayrıca kontrol edildi. Templates OOXML düzeyinde incelendi. Buna rağmen Word rendered pagination/layout engine yeniden uygulanmadı; tek template örneği universal taxonomy değildir; bilinmeyen guide version üretilmedi; source ownership lisans hakkı olarak yorumlanmadı.
