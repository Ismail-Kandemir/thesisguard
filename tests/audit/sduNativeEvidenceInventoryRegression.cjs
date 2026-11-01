const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Inventory/provenance only. No DOCX generation, ZIP rewrite, parser or guard run.
const root = process.cwd();
const fixtureDirectory = "tests/fixtures/comu/food-technology/experimental";
const fixtureManifestPath = `${fixtureDirectory}/manifest.json`;
const sourceManifestPath = "docs/sources/comu/applied-sciences/food-technology/bachelor/manifest.json";
const reportPath = "docs/audit/SDU_NATIVE_EVIDENCE_REQUEST.md";
const excludedDirectories = new Set([".git", "node_modules", "dist", ".codex", ".agents", ".aws"]);
const relative = (file) => path.relative(root, file).split(path.sep).join("/");
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
let checks = 0;
function check(label, action) { action(); checks++; console.log(`PASS ${label}`); }

function scanDocx(directory, skippedLinks) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { skippedLinks.push(relative(absolute)); return []; }
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : scanDocx(absolute, skippedLinks);
    return entry.isFile() && path.extname(entry.name).toLowerCase() === ".docx" ? [absolute] : [];
  });
}

/** Recorded synthetic provenance is a classification source, not native proof.
 * No automatic Word/LibreOffice promotion from a name, tool label or ZIP fields.
 * A future native artifact needs separately reviewed provenance and new tests.
 */
function classify(record) {
  return record?.origin === "synthetic-ooxml" && typeof record.createdWith === "string" && record.createdWith.trim().length > 0
    ? "programmatic" : "unverified";
}

function inventory() {
  const skippedLinks = [];
  const files = scanDocx(root, skippedLinks).sort((a, b) => relative(a).localeCompare(relative(b), "en"));
  const manifest = readJson(fixtureManifestPath);
  const byPath = new Map();
  for (const record of manifest.fixtures) {
    assert.equal(path.basename(record.file), record.file, "Fixture path must stay inside its manifest directory.");
    const file = `${fixtureDirectory}/${record.file}`;
    assert.equal(byPath.has(file), false, `Duplicate fixture provenance: ${file}`);
    byPath.set(file, record);
  }
  const rows = files.map((file) => {
    const record = byPath.get(relative(file));
    return { file: relative(file), byteSize: fs.statSync(file).size, sha256: hash(file),
      classification: classify(record), nativeVerified: false,
      provenance: record ? { manifest: fixtureManifestPath, origin: record.origin, createdWith: record.createdWith,
        verifiedWith: record.verifiedWith, privacyStatus: record.privacyStatus } : null };
  });
  const source = readJson(sourceManifestPath);
  const sourceDocx = source.artifacts.filter((item) => item.filename.toLowerCase().endsWith(".docx")).map((item) => {
    const file = path.join(path.dirname(sourceManifestPath), item.filename);
    assert.ok(path.resolve(file).startsWith(path.resolve(path.dirname(sourceManifestPath)) + path.sep));
    return { file: file.split(path.sep).join("/"), present: fs.existsSync(file),
      provenance: "registered source reference only; does not establish editor origin" };
  });
  return { rows, sourceDocx, skippedLinks, summary: { inventoryDocx: rows.length,
    verifiedWordNative: 0, verifiedLibreOfficeNative: 0,
    programmatic: rows.filter((item) => item.classification === "programmatic").length,
    unverified: rows.filter((item) => item.classification === "unverified").length,
    missingSourceDocx: sourceDocx.filter((item) => !item.present).length,
    nativeValidation: "BLOCKED", nativeMarginValidation: "BLOCKED", nativeHeadingValidation: "BLOCKED",
    nativeV1V2Parity: "NOT-RUN", productionAuthorization: "not-granted" } };
}

function render(data) {
  const s = data.summary;
  return [
    "# SDÜ native DOCX evidence request — Sprint 39",
    "",
    "Tarih: 1 Kasım 2026. **Native validation: BLOCKED. Production onboarding: NO-GO.**",
    "Doğrulanmış Word-native belge yok; native margin/heading incelemesi ve native v1/v2 parity çalıştırılmadı. Bu dosya gönderilmiş bir dış iletişim değildir.",
    "",
    "## Envanter ve provenance sınıflandırması",
    "",
    "Tarama proje workspace'i ile sınırlıdır; hidden dosyalar dahildir. .git, node_modules, dist, .codex, .agents ve .aws dizinleri ile symbolic link/junction hedefleri dışarıda bırakılır. Kullanıcının kişisel dizinleri veya dış kaynaklar taranmadı.",
    `Atlanan symbolic link/junction sayısı: ${data.skippedLinks.length}. Erişilemeyen dizin hatası olursa regresyon başarısız olur; sessiz tam envanter iddiası üretmez.`,
    "",
    "| Sınıf | Mevcut DOCX sayısı | Dayanak |",
    "| --- | ---: | --- |",
    `| Doğrulanmış Microsoft Word-native | ${s.verifiedWordNative} | Editörde oluşturma/kaydetme zinciri ve son dosyaya bağlı doğrulanmış provenance bulunmadı |`,
    `| Doğrulanmış LibreOffice-native | ${s.verifiedLibreOfficeNative} | Doğrulanmış oluşturma/kaydetme zinciri bulunmadı |`,
    `| Programatik/sentetik | ${s.programmatic} | Mevcut fixture manifesti: synthetic-ooxml, python-docx/kontrollü OOXML mutation geçmişi |`,
    `| Kaynağı doğrulanamayan mevcut dosya | ${s.unverified} | Mevcut taramada manifest dışı DOCX yok |`,
    `| Toplam mevcut DOCX | ${s.inventoryDocx} | Diskte bulunan dosyalar; eksik source referansları hariç |`,
    "",
    "Programatik sınıflandırma mevcut manifestin origin/createdWith kaydıdır; üretim oturumları bu sprintte yeniden gözlenmedi. verifiedWith alanındaki golden/runtime başarısı editör provenance kanıtı değildir.",
    "Dosya adı, ZIP tarihleri, docProps/app.xml Application, rsid, style/numbering kimlikleri, OOXML yapısı veya resmî bir indirme URL'si tek başına Word-native kanıtı kabul edilmedi.",
    "Bütün mevcut dosyalar tests/fixtures/comu/food-technology/experimental altındadır. full-correct.docx manifestte python-docx; diğer 41 dosya kontrollü OOXML türevleri olarak kayıtlıdır.",
    "",
    "### Eksik source artifact referansları",
    "",
    "Aşağıdakiler COMÜ source manifestindeki ayrı DOCX referanslarıdır; bu sprintte byte'ları elde edilmedi. Dosyalar mevcut envantere/native sayımına dahil değildir. COMÜ referansı SDÜ normatif scope onayı da değildir.",
    "",
    "| Manifestte kayıtlı dosya | Diskte mevcut | Editor origin kanıtı |",
    "| --- | --- | --- |",
    ...data.sourceDocx.map((item) => `| ${item.file} | ${item.present ? "Evet" : "Hayır"} | Doğrulanmadı |`),
    "",
    "## Native bulgular ve mevcut sentetik baseline ayrımı",
    "",
    "| İnceleme | Native sonuç | Bilinen sentetik baseline / bilinmeyen |",
    "| --- | --- | --- |",
    "| Margin section/pgMar/top/bottom, section sayısı, raw unit/twips ve parser sonucu | BLOCKED | Word'ün 2.5cm veya 3cm'yi nasıl kaydettiğine dair deney yapılmadı |",
    "| Heading pPr/pStyle/outlineLvl, styles.xml ve numbering.xml | BLOCKED | Native heading provenance, table ayrımı ve SEC-19 identity doğrulanmadı |",
    "| Split runs ve NFC/NFD saklama/yeniden kaydetme | BLOCKED | Word'ün Unicode/run temsilini koruduğu veya dönüştürdüğü iddia edilmez |",
    "| Aynı native DOCX üzerinde original/v1/v2 + coverage/provenance karşılaştırması | NOT-RUN | Native test başarısı yok |",
    "",
    "[Sprint 38 raporundaki](SDU_SPRINT_38_GUARD_V2_EXPERIMENTAL.md) 91 kontrollü karşılaştırma ve ayrı 22 fixture değerlendirmesi sentetiktir; bu sprintte native kanıt yerine yeniden yorumlanmadı.",
    "Önceki sentetik sonuçlarda 1701 twips için tam/closed koşulda v2 original V'yi koruyor; 1417 ve 2.499/2.501cm U kalıyor. Bunlar Word'ün UI'da 2.5/3cm ayarını hangi raw değere yazdığına kanıt değildir.",
    "v2'nin ±1 twip + ±0.005cm deneysel envelope varsayımı native editör garantisi değildir. Fiziksel/rendered margin veya kaynak onaylı akademik tolerans bu audit ile kanıtlanmadı.",
    "",
    "## İstenen gerçek Word-native örnekler",
    "",
    "Aşağıdaki adlar yalnız önerilen teslim adlarıdır; dosyalar bu sprintte oluşturulmadı. Kişisel verisiz, sıfırdan Word'de yazılmış metin tercih edilir.",
    "",
    "| Örnek | Word'de yapılacak işlem | Gerekli içerik ve beklenen inceleme |",
    "| --- | --- | --- |",
    "| word-margin-25cm.docx | Yeni boş belge; üst/alt kenar boşluğunu UI'dan tam 2.5 cm ayarla; DOCX olarak kaydet | Tek section; UI ayar kaydı ile w:sectPr/w:pgMar raw top/bottom, unit, parser, original/v1/v2 yan yana |",
    "| word-margin-3cm.docx | Ayrı boş belge; üst/alt UI ayarını 3 cm yap; kaydet | 3 cm kontrolü; hangi integer/unit değerinin yazıldığı önceden varsayılmaz |",
    "| word-multi-section.docx | Word section break ekle; farklı section'larda 2.5 ve 3 cm ayarla; uygulanacak section'ı UI'dan doğrula | Tüm section'lar, paragraph/body sectPr ayrımı ve tam population; tek uygun section'dan toplam C çıkarılmaz |",
    "| word-sec19-structural.docx | Exact Yaygın Etki/Katma Değer/Kullanılabilirlik metnini gerçek Heading 1 veya açık outline ile yaz | styles.xml, style inheritance, pPr/pStyle/outlineLvl ve existing occurrence qualification |",
    "| word-sec19-distractors.docx | Exact heading yanına normal paragraf A/Değer/Etki ve aynı metinleri içeren tablo hücreleri ekle | Gerçek heading ile body/table ayrımı; ilgisiz metinler identity kanıtı değildir |",
    "| word-sec19-partial-split.docx | Partial bileşenleri ve ayrı heading paragraflarında Katma / Değer gibi split bileşeni oluştur; ayrı kontrol olarak Normal style tam ad ekle | Partial/split/unresolved identity U yolları; yeni akademik alias kabulü değildir |",
    "| word-sec19-runs-unicode.docx | Exact başlığın bir kelimesinin bölümüne bold/italic uygulayarak Word'ün run ayırmasını sağla; NFC/NFD girdi yöntemini kaydet | Run sınırı ve Unicode kod noktalarının kaydetme öncesi/sonrası gözlemi; ZIP/XML elle düzenlenmez |",
    "",
    "LibreOffice karşılaştırması istenirse ayrı, sıfırdan LibreOffice'de oluşturulmuş DOCX ve ayrı provenance teslim edilmelidir; Word örnekleriyle aynı native sınıfına konulmaz.",
    "Word'de yalnız açılıp yeniden kaydedilen programatik belge, sıfırdan Word-created belge olarak etiketlenmez. Bu tür round-trip örnekleri ayrıca, başlangıç artifact'ı ve bütün dönüşüm zinciriyle işaretlenebilir.",
    "",
    "## Oluşturma ve doğrulanabilir provenance",
    "",
    "1. Uygulama adı, tam sürüm/build, işletim sistemi, tarih ve DOCX kayıt formatını kaydet. Boş belge mi, template mi, önceki artifact mı açıkça belirt.",
    "2. Word UI üzerinden ayarları yap; UI margin değerleri, section seçimi ve heading stilinin görüldüğü kişisel verisiz ekran/oturum kaydı tut. UI isimleri sürüme göre değişebilir.",
    "3. Oluşturma adımlarını uygulayan kişinin işlem kaydı ile dosyanın o oturumdan çıktığını gösteren kaydı birlikte teslim et. Bir tool adı veya dosya içi Application alanı bağımsız doğrulama yerine geçmez.",
    "4. Son kayıttan sonra dosyayı kapat; exact teslim byte'larından SHA-256 ve byte size hesapla. Provenance kaydı bu hash, dosya adı ve işlem geçmişine bağlansın; hash yalnız byte kimliğini kanıtlar.",
    "5. Editor creation/save, anonimleştirme, Save As, conversion, automated processing veya yeniden kaydetme adımlarını kronolojik kaydet. Her değişen artifact için yeni hash ve ilişki kaydı tut.",
    "6. ZIP/OOXML mutation, python-docx üretimi veya programatik template enjeksiyonu yapma. Otomatik API/COM kullanımı varsa ayrıca bildir; manuel Word-native örnekle karıştırma.",
    "7. Kanıt inceleyicisi editor ve dosya ilişkisini ayrıca gözden geçirsin. Kaynağı belirsiz veya çelişkili belge unverified kalır; native sayısına otomatik eklenmez.",
    "",
    "## Kişisel veri temizleme",
    "",
    "- Gerçek tez/öğrenci dosyası yerine baştan kişisel verisiz test metni kullan. Ad, öğrenci numarası, e-posta, danışman, imza, kurum içi not veya hassas görsel ekleme.",
    "- Gerçek belge zorunluysa gerekli paylaşım iznini doğrula; comments, tracked changes/deleted text, hidden text, headers/footers, properties, custom XML, embedded object ve dış bağlantıları incele.",
    "- Word'ün belge inceleme/gizlilik araçlarını kullan; kaldırma işleminin margin/style/numbering yapısını değiştirip değiştirmediğini kontrol et. Temizlenmiş son sürümün provenance ve hash'ini yeniden oluştur.",
    "- Ekran kayıtlarında kullanıcı hesabı, dosya yolu, son belgeler veya kişisel bilgi görünmesin. Yalnız final sanitized artifact test için paylaşılır; hassas ham belge fixture'a alınmaz.",
    "",
    "## Test kabul kriterleri ve sonraki adım",
    "",
    "- Mevcut inventory/provenance regresyonu yalnız envanter bütünlüğü ve yanlış native terfisini denetler. PASS sonucu native validation PASS anlamına gelmez.",
    "- Yeni dosya gelince bu regresyon inceleme gerektirerek durmalıdır; manifestte word-native yazmak veya filename/Application alanını değiştirmek yeterli değildir.",
    "- Editor/creation/save zinciri gözden geçirilmiş, final byte'lara hash ile bağlı, privacy-safe ve test kullanımına uygun belge ayrı provenance kaydıyla kabul edilir. Word/LibreOffice/programmatic/unverified sınıfları ayrılır.",
    "- 2.5cm ve 3cm UI kayıtları section bazında mevcut olmalı. Raw OOXML değerleri ilk defa read-only gözlenir; parser/guard beklentileri gözlemden önce uydurulmaz.",
    "- Heading incelemesi styles/numbering/outline, current body/table ayrımı, split runs, Unicode ve mevcut AcademicSectionOccurrence üzerinden yapılır. Teknik benzerlik akademik alias değildir.",
    "- Native kanıt kabul edildikten sonra ayrı kalıcı native regresyonda original/v1/v2, coverage, source/evidence provenance ve karar değişiklikleri raporlanır; DOCX byte'ları korunur.",
    "- Başarılı native temsil testi dahi fiziksel footer/margin konumu, normatif SDÜ scope veya production authorization sağlamaz. Yeni alias/tolerans eklenmez.",
    "",
    "P1 native belge kanıtı açık. P1 source/scope reconciliation ile P0 identity/precision onayları da açık kalır. Native validation için Sprint 40 **NO-GO**; yalnız provenance doğrulanmış örnek temini/incelemesi için **GO**. Production onboarding **NO-GO**, authorization `not-granted`.",
    "",
    "## Envanteri yeniden doğrulama",
    "",
    "[sduNativeEvidenceInventoryRegression.cjs](../../tests/audit/sduNativeEvidenceInventoryRegression.cjs) DOCX veya guard çalıştırmaz; mevcut dosyaların path/size/SHA-256/provenance kaydını stdout JSON olarak verir. Normal koşu bu talep dokümanının gözlemlerle eşleşmesini de denetler.",
    "",
    "```powershell",
    "node tests/audit/sduNativeEvidenceInventoryRegression.cjs",
    "npm.cmd run typecheck",
    "npm.cmd run lint",
    "npm.cmd run build",
    "git diff --check",
    "git status --short",
    "```",
    "",
    "Yalnız bu talep dokümanını aynı gözlemlerle yenilemek için --write-report kullanılabilir. npm.cmd run test, add, commit veya push çalıştırılmaz.",
    "",
  ].join("\n");
}

function main() {
  const data = inventory();
  const before = new Map(data.rows.map((item) => [item.file, item.sha256]));
  const protectedPaths = [fixtureManifestPath, sourceManifestPath,
    "tests/audit/sduConservativeDecisionGuard.ts", "tests/audit/sduConservativeDecisionGuardV2.ts",
    "tests/audit/sduGuardedAssessmentBatch.ts", "tests/audit/sduGuardCalibrationAuditRegression.cjs"];
  const protectedHashes = new Map(protectedPaths.map((file) => [file, hash(file)]));
  check("workspace DOCX inventory maps exactly to existing 42 fixture records", () => {
    const records = readJson(fixtureManifestPath).fixtures;
    assert.equal(data.rows.length, 42);
    assert.equal(records.length, 42);
    assert.equal(new Set(records.map((item) => item.file)).size, records.length);
    assert.deepEqual(data.rows.map((item) => item.file).sort(), records.map((item) => `${fixtureDirectory}/${item.file}`).sort());
  });
  check("recorded programmatic provenance cannot be promoted to native", () => {
    data.rows.forEach((item) => {
      assert.equal(item.classification, "programmatic"); assert.equal(item.nativeVerified, false);
      assert.equal(item.provenance.origin, "synthetic-ooxml");
      assert.ok(item.provenance.createdWith.trim()); assert.ok(item.provenance.privacyStatus.trim());
      assert.ok(item.byteSize > 0); assert.match(item.sha256, /^[a-f0-9]{64}$/);
    });
  });
  check("filename/tool label/metadata-only assertions never establish Word or LibreOffice origin", () => {
    // Plain metadata records only: these are not synthetic DOCX/native validation tests.
    for (const record of [undefined, { file: "word-native.docx", createdWith: "Microsoft Word" },
      { origin: "word-native", createdWith: "Microsoft Word", Application: "Microsoft Office Word", zipTimestamp: "2026-11-01" },
      { origin: "libreoffice-native", createdWith: "LibreOffice", stylesXmlPresent: true, numberingXmlPresent: true }]) assert.equal(classify(record), "unverified");
    assert.equal(classify({ origin: "synthetic-ooxml", createdWith: "python-docx", Application: "Microsoft Word" }), "programmatic");
  });
  check("source manifest references are not present/native artifacts", () => {
    assert.equal(data.sourceDocx.length, 3);
    assert.ok(data.sourceDocx.every((item) => !item.present));
    assert.equal(data.summary.missingSourceDocx, 3);
  });
  check("native validation is BLOCKED independently of inventory PASS", () => {
    assert.equal(data.summary.verifiedWordNative, 0); assert.equal(data.summary.verifiedLibreOfficeNative, 0);
    assert.equal(data.summary.nativeValidation, "BLOCKED"); assert.equal(data.summary.nativeV1V2Parity, "NOT-RUN");
    assert.equal(data.summary.unverified, 0); assert.equal(data.summary.productionAuthorization, "not-granted");
  });
  const report = render(data);
  if (process.argv.includes("--write-report")) fs.writeFileSync(reportPath, report, "utf8");
  else check("missing evidence request matches current read-only inventory", () => assert.equal(fs.readFileSync(reportPath, "utf8"), report));
  check("DOCX, manifests and guard implementations remain byte-identical", () => {
    for (const [file, original] of [...before, ...protectedHashes]) assert.equal(hash(file), original, file);
  });
  console.log(JSON.stringify({ inventory: data.rows, missingSourceReferences: data.sourceDocx, skippedLinks: data.skippedLinks }));
  console.log(JSON.stringify({ audit: "sduNativeEvidenceInventory", inventoryRegression: "PASS", checks,
    ...data.summary, nativeValidationPerformed: false, fixtureWrites: 0 }));
}
try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
