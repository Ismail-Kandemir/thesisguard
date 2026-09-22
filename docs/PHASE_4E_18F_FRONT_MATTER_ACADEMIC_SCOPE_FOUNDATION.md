# Phase 4E-18F — Front-Matter Academic Scope Foundation

## 1. Executive summary

Bu fazda ThesisGuard üretim modeline akademik belge kapsamı eklendi: `front-matter`, `main-content`, `unknown`. Kapsam, teknik temsil veya akademik nesne kimliği değildir; bağımsız bir yapısal fact olarak tutulur.

Faz kararı: **OPTION A — Front-matter academic scope foundation is production-ready.**

## 2. Starting state

- Dal: `main`
- HEAD: `c16ecc2`
- `origin/main`: `c16ecc2`
- 4E-18D ve 4E-18E local değişiklikleri korunarak devam edildi.

## 3. Problem

`word/document.xml` body kapsamı akademik kapsamla aynı değildir. Kapak/ön bölümdeki resim, tablo veya grafik ana akademik içerikteki nesneyle aynı şekilde yorumlanmamalıdır.

## 4. Primary-source grounding

Primary grounding, `Giriş` bölümünün iki çalışma türünde de tez yapısında bulunduğunu ve sayfa numarası geçişinin `Giriş` ile başladığını destekler. Ön bölümde `İntihal`, `Kabul ve Onay`, `Teşekkür`, `Özet`, `Abstract`, `İçindekiler`, listeler; ana akademik içerikte `Giriş` ve devamındaki çalışma türü bölümleri yer alır.

## 5. Existing section model

Mevcut sistem:

- paragraph order ve block order tutar;
- TOC paragraflarını işaretler;
- section names normalize eder;
- required section rules ile canonical section eşleşmesi yapar;
- heading normalization manual `1. Giriş` ve Word numbering facts kullanır.

Eksik olan şey section range / academic document scope idi.

## 6. Scope taxonomy

Yeni taxonomy:

- `front-matter`
- `main-content`
- `unknown`

Back matter ayrı scope yapılmadı; references/appendix semantics daha fazla kaynak ve policy ister.

## 7. Boundary policy

Ana içerik boundary’si, rule set içindeki `PAGE_NUMBER_SEQUENCE.expected.transitionSection` değerinden türetilir. COMÜ Food Technology için bu canonical boundary `Giriş`tir. Tam bir confident boundary için rule-defined section olarak tek bir `Giriş` gerekir.

## 8. Unknown policy

Boundary yoksa veya birden fazlaysa scope `unknown` kalır. Missing boundary tüm body’yi front matter yapmaz.

## 9. Numbered heading handling

Manual `1. Giriş` mevcut `sectionMatchesExpectedName` üzerinden desteklenir. Word numbering ile text `Giriş` olan heading de desteklenir.

## 10. Document-order model

Scope assignment paragraph index ve block index üzerinden deterministik yapılır. Random ID veya fiziksel sayfa tahmini kullanılmaz.

## 11. Object ownership

`ObjectRepresentationOccurrence.academicScope` eklendi. Object scope, representation’ın `blockIndex` veya `paragraphIndex` ownership facts’inden atanır.

## 12. Table behavior

Front-matter table otomatik layout table veya academic table sayılmaz. Sadece `representation=table + academicScope=front-matter` fact’i üretilir.

## 13. Picture behavior

Front-matter picture otomatik logo veya figure sayılmaz.

## 14. Chart/diagram/group behavior

Confident front-matter chart/diagram/group için unresolved academic object diagnostic susturulur. Main-content veya unknown scope davranışı korunur.

## 15. Caption interaction

Bu faz caption association/resolution semantics değiştirmedi. Declared caption front-matter conflict policy ileride daha ayrıntılı ele alınmalıdır; bu fazda validator migration yapılmadı.

## 16. Main-content behavior

`Giriş` boundary’sinden itibaren object representations `main-content` scope alır. Main-content chart caption declaration yoksa semantically unresolved kalır ve diagnostic üretir.

## 17. Back-matter decision

Back matter ayrı modellenmedi. `Kaynaklar` sonrası ve appendices semantics güvenli biçimde ayrıştırılmadı; appendices meşru figure/table içerebilir.

## 18. TOC/list behavior

TOC paragrafları section boundary kuramaz. Existing TOC ownership logic yeniden kullanıldı.

## 19. Revision behavior

Deleted/moveFrom text boundary kuramaz. Visible moveTo/inserted `Giriş`, mevcut visible document semantics’e göre boundary kurabilir.

## 20. AlternateContent behavior

Scope assignment, normalize edilmiş aktif semantic branch ve mevcut paragraph/block facts üzerinden çalışır; Choice/Fallback yeniden parse edilmez.

## 21. Missing/ambiguous boundary

Missing boundary → `unknown/missing-main-boundary`. Birden fazla boundary → `unknown/ambiguous-main-boundary`.

## 22. Object-semantic integration

Technical representation, academic scope, caption semantic ve academic identity ayrı kalır. `isAcademicFigure` gibi collapsed boolean eklenmedi.

## 23. Diagnostic integration

Diagnostic builder front-matter scope’u tüketir. Confident front-matter unresolved technical objects diagnostic spam üretmez. Unknown ve main-content diagnostic davranışı korunur.

## 24. Declared-caption conflict policy

Explicit `Şekil n.` / `Tablo n.` declaration front-matter ile çakışırsa bu faz production resolution davranışını değiştirmedi. Güvenli politika için ayrı hardening önerilir.

## 25. Official-template runtime findings

Official DOCX binaries bu makinede yoktu; runtime official-template scope/noise testi yapılmadı. Manifest audit binary integrity için `SKIPPED=4`.

## 26. Synthetic fixture findings

`frontMatterAcademicScopeRegression.cjs` synthetic XML ile kanıtladı:

- front chart before `Giriş` → `front-matter`, diagnostic `0`
- chart after `Giriş` → `main-content`, diagnostic `1`
- missing `Giriş` → `unknown`, diagnostic `1`
- TOC `Giriş` boundary değildir
- deleted `Giriş` boundary değildir
- visible moveTo `Giriş` boundary olabilir

## 27. Diagnostic noise before/after

Before: front-matter chart missing association ile unresolved diagnostic üretebilirdi. After: confident front-matter chart diagnostic üretmez. Main-content chart diagnostic üretmeye devam eder.

## 28. Score parity

Score arithmetic değişmedi. Scope facts RuleResult hesaplamasına bağlanmadı.

## 29. RuleResult parity

Golden `46/46`, corpus `31 regression + 11 exploratory` geçti.

## 30. Golden

Golden:

- `46/46`
- diagnostics: `0`

## 31. Corpus

Corpus baseline geçerliliği korundu.

## 32. Existing audits

4E-18C pilot, 4E-18D diagnostic, 4E-18E UX ve semantic coverage auditleri geçti.

## 33. Quality gates

Geçen kapılar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:golden`
- `npm run test:corpus`
- `node tests/audit/frontMatterAcademicScopeRegression.cjs`
- ilgili 4E-18C/D/E ve source grounding auditleri

## 34. Git diff

4E-18F üretim değişiklikleri:

- `src/features/analysis/parsers/academicDocumentScopeNormalizer.ts`
- `src/features/analysis/parsers/objectSemanticsNormalizer.ts`
- `src/features/analysis/parsers/documentXmlParser.ts`
- `src/features/analysis/analysisService.ts`
- `src/features/analysis/diagnostics/academicObjectDiagnostics.ts`
- `src/features/analysis/report/diagnosticPresentation.ts`
- `src/features/analysis/types/AnalysisReport.ts`
- `src/features/analysis/types/index.ts`

Validator değişikliği yok.

## 35. Remaining limitations

- Header/footer object scope çözülmedi.
- Footnote/endnote object scope çözülmedi.
- Anchored visual ordering çözülmedi.
- Back matter ayrı scope değil.
- Official templates bu makinede runtime test edilmedi.
- Declared caption + front-matter conflict policy sadece belgelenmiştir, üretim resolution davranışı değiştirilmemiştir.

## 36. Phase decision

**OPTION A — Front-matter academic scope foundation is production-ready.**

## 37. Recommended next phase

**Phase 4E-18G — Anchored Drawing Semantic Ordering Audit**
