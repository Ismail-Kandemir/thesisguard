const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { analyzeDocx, createNormalizedDocumentFromDocx } = require("../../src/features/analysis/analysisService.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { runSduGuardedAssessmentBatch: batch, createSyntheticGuardedBatchRequest } = require("./sduGuardedAssessmentBatch.ts");
const { runSduVersionedConservativePilot: versioned } = require("./sduConservativeDecisionGuardV2.ts");

const root = path.resolve(__dirname, "../..");
const corpus = "tests/fixtures/comu/food-technology/experimental";
const manifestPath = `${corpus}/manifest.json`;
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8"));
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology",
  thesisTypeId: "bachelor", studyTypeId: "experimental" };
const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
const sides = ["top", "bottom", "left", "right"];
const marginRules = sides.map((side) => rules.find((rule) => rule.category === "margin" && rule.id.endsWith(`margin.${side}`)));
assert.equal(rules.length, 46);
assert.ok(marginRules.every(Boolean));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const same = (value) => sides.map(() => value);
const all = (value) => sides.map(() => value);
const meanings = { C: "compliant", U: "undetermined", V: "violation" };

// Literal lexical/precision examples from the existing margin contract, not a
// second numeric parser or new academic requirement. Order: top,bottom,left,right.
const section = (values) => `<w:sectPr>${values === null ? "" : `<w:pgMar${sides.map((side, index) =>
  values[index] === null ? "" : ` w:${side}="${values[index]}"`).join("")}/>`}</w:sectPr>`;
const body = (sections, terminal = true) => sections.map((values, index) => terminal && index === sections.length - 1
  ? `<w:p/>${section(values)}` : `<w:p><w:pPr>${section(values)}</w:pPr></w:p>`).join("");
const one = (id, raw, expected, decisions) => ({ id, sections: [same(raw)], expected: [all(expected)], decisions: [decisions, decisions] });
const scenarios = [
  one("exact-cm", "2.5cm", 2.5, "CCC"),
  one("integer-1417", "1417", 2.5, "CUU"),
  one("integer-1701", "1701", 3, "VUV"),
  one("explicit-3cm", "3cm", 3, "VVV"),
  one("decimal-below-target", "2.499cm", 2.5, "CUU"),
  one("decimal-above-target", "2.501cm", 2.5, "CUU"),
  one("integer-1415-rounds-to-target", "1415", 2.5, "CUU"),
  one("integer-1420-rounds-to-target", "1420", 2.5, "CUU"),
  one("integer-1421-interval-overlap", "1421", 2.51, "VUU"),
  one("integer-1422-interval-excludes", "1422", 2.51, "VUV"),
  one("millimeters", "25mm", 2.5, "CUU"),
  one("inch", "1in", 2.54, "VUU"),
  one("zero-is-numeric", "0", 0, "VUV"),
  one("signed-leading-zero-whitespace", " +001417 ", 2.5, "CUU"),
  { ...one("negative-signed-vs-unsigned", "-1417", -2.5, "VUV"), expected: [[-2.5, -2.5, null, null]] },
  ...[null, "", " ", "1417.0", "1.417e3", "0x589", "NaN", "Infinity", "9007199254740992", "2,5", "2.5CM"]
    .map((raw, index) => one(`missing-invalid-${index + 1}`, raw, null, "UUU")),
  { id: "missing-pgMar", sections: [null], expected: [all(null)], decisions: ["UUU", "UUU"] },
  { id: "missing-top-attribute", sections: [[null, "2.5cm", "3cm", "2.5cm"]],
    expected: [[null, 2.5, 3, 2.5]], decisions: ["UUU", "CCC"] },
  { id: "malformed-bottom-attribute", sections: [["3cm", "bad", "3cm", "2.5cm"]],
    expected: [[3, null, 3, 2.5]], decisions: ["VVV", "UUU"] },
  { id: "multi-section-all-comu-correct", sections: Array.from({ length: 3 }, () => ["3cm", "2.5cm", "3cm", "2.5cm"]),
    expected: Array.from({ length: 3 }, () => [3, 2.5, 3, 2.5]), decisions: ["VVV", "CCC"] },
  { id: "multi-section-different-margins", sections: [same("2.5cm"), same("3cm")],
    expected: [all(2.5), all(3)], decisions: ["VVV", "VVV"] },
  { id: "missing-first-valid-final", sections: [null, same("2.5cm")],
    expected: [all(null), all(2.5)], decisions: ["UUU", "UUU"] },
  { id: "valid-first-missing-final", sections: [same("2.5cm"), null],
    expected: [all(2.5), all(null)], decisions: ["UUU", "UUU"] },
  { id: "missing-plus-proven-violation", sections: [null, same("3cm")],
    expected: [all(null), all(3)], decisions: ["VVU", "VVU"] },
  { id: "no-section-properties", sections: [], expected: [], decisions: ["UUU", "UUU"] },
  { id: "missing-terminal-section", terminal: false, sections: [["3cm", "2.5cm", "3cm", "2.5cm"]],
    expected: [[3, 2.5, 3, 2.5]], decisions: ["VVU", "UUU"], knownLegacyCoverageGap: true },
  { ...one("unsupported-carrier-open-extraction", "2.5cm", 2.5, "CUU"), extra: "<w:altChunk/>" },
];

function scan(directory) {
  const excluded = new Set([".git", "node_modules", "dist", ".codex", ".agents", ".aws"]);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : scan(file);
    return entry.isFile() && /\.docx$/i.test(entry.name) ? [file] : [];
  });
}

function input(bytes, name) {
  // JSZip consumes this Uint8Array directly; do not use a plain File-like object.
  const data = new Uint8Array(bytes);
  Object.defineProperties(data, { name: { value: name }, size: { value: data.byteLength },
    type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
  return data;
}

async function measure(bytes, name) {
  const data = input(bytes, name);
  const zip = await JSZip.loadAsync(data, { checkCRC32: true });
  assert.ok(zip.file("[Content_Types].xml"), `${name}: missing content types`);
  assert.ok(zip.file("word/document.xml"), `${name}: missing document`);
  const xml = new DOMParser().parseFromString(await zip.file("word/document.xml").async("string"), "application/xml");
  const rawMargins = Array.from(xml.getElementsByTagNameNS(word, "sectPr")).map((sect) => {
    const pgMar = sect.getElementsByTagNameNS(word, "pgMar").item(0);
    return sides.map((side) => pgMar?.getAttributeNS(word, side) ?? null);
  });
  const document = await createNormalizedDocumentFromDocx(data);
  const report = await analyzeDocx(data, selection);
  const v1 = await batch(data, { admissionPolicy: "synthetic-pilot", guardEnabled: true });
  assert.equal(v1.status, "completed", name);
  assert.equal(v1.originalReport.records.length, 11);
  for (const field of ["executionErrors", "guardErrors", "rejectedRecords"]) assert.deepEqual(v1[field], []);
  const bindings = v1.admission.value.bindings;
  assert.ok(bindings.every((binding) => binding.academicScope.department.id === "synthetic-department"));
  const v2 = await versioned(data, { enabled: true, version: "v2-experimental", bindings });
  assert.equal(v1.productionAuthorization, "not-granted");
  assert.equal(v2.productionAuthorization, "not-granted");
  assert.deepEqual(v2.originalReport, v1.originalReport);
  assert.equal(v2.guardMetadata.length, 11);
  const guards = ["top", "bottom"].map((side) => {
    const id = `pilot.sdu.2026.margin.${side}`;
    const record = v1.originalReport.records.find((item) => item.executionId === id);
    const first = v1.guardMetadata.find((item) => item.executionId === id);
    const second = v2.guardMetadata.find((item) => item.executionId === id);
    assert.equal(second.v1Decision, first.guardedDecision);
    assert.deepEqual(first.originalProvenance, second.originalProvenance);
    if (first.guardedDecision !== "undetermined") assert.equal(first.guardedDecision, record.execution.decision);
    if (second.guardedDecision !== "undetermined") assert.equal(second.guardedDecision, record.execution.decision);
    return { side, original: record.execution.decision, v1: first.guardedDecision, v2: second.guardedDecision,
      reasons: [first.reasonCode, second.reasonCode], coverage: record.execution.assessment.coverage.population,
      evidence: first.evidenceReference, provenance: first.originalProvenance, intervals: second.intervals };
  });
  const margins = document.pageSections.map((section) => sides.map((side) => section.pageMargins[side]));
  const comu = marginRules.map((rule) => report.results.find((result) => result.ruleId === rule.id).status);
  // Missing numeric evidence in ANY section may never be a legacy PASS.
  for (const [sideIndex, status] of comu.entries()) {
    if (!margins.length || margins.some((values) => values[sideIndex] === null)) assert.notEqual(status, "PASSED", name);
  }
  return { name, rawMargins, margins, comu, guards, sectionSources: document.pageSections.map((section) => section.source),
    extractionCoverage: document.sectionExtractionCoverage.population,
    counts: [report.totalRules, report.passedRules, report.failedRules, report.notApplicableRules] };
}

async function main() {
  const files = scan(root).sort();
  assert.equal(files.length, 44, "Review inventory if the fixture population changes");
  const hashes = new Map(files.map((file) => [file, sha256(fs.readFileSync(file))]));
  const inventory = []; const results = [];
  try {
    for (const file of files) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      const record = relative.startsWith(`${corpus}/`) ? manifest.fixtures.find((item) => item.file === path.basename(file)) : undefined;
      const bytes = fs.readFileSync(file);
      inventory.push({ file: relative, byteSize: bytes.length, sha256: hashes.get(file),
        classification: record?.origin === "synthetic-ooxml" ? "Programmatic/synthetic" : "Unknown/unverified",
        source: record ? manifestPath : "docs/audit/SPRINT_41_DOCX_MARGIN_COMPARISON.md (synthetic declaration only)",
        method: record?.createdWith ?? "Unknown; creation/save chain not recorded", result: await measure(bytes, path.basename(file)) });
    }
    const denied = await batch(null, { guardEnabled: true });
    assert.equal(denied.status, "admission-rejected");
    const real = createSyntheticGuardedBatchRequest();
    real.academicScope.department.id = "industrial-engineering";
    real.candidates.forEach((candidate) => { candidate.academicScope.department.id = "industrial-engineering"; });
    assert.equal((await batch(null, { admissionPolicy: "synthetic-pilot", request: real })).status, "admission-rejected");
    const base = fs.readFileSync(path.join(root, corpus, "full-correct.docx"));
    for (const scenario of scenarios) {
      const zip = await JSZip.loadAsync(base);
      const raw = await zip.file("word/document.xml").async("string");
      zip.file("word/document.xml", raw.replace(/<w:body>[\s\S]*<\/w:body>/u,
        `<w:body>${body(scenario.sections, scenario.terminal ?? true)}${scenario.extra ?? ""}</w:body>`));
      const result = await measure(await zip.generateAsync({ type: "nodebuffer" }), `${scenario.id}.docx`);
      assert.deepEqual(result.margins, scenario.expected, scenario.id);
      const expectedComu = sides.map((_side, index) => scenario.expected.length &&
        scenario.expected.every((values) => values[index] === marginRules[index].expected.value) ? "PASSED" : "FAILED");
      assert.deepEqual(result.comu, expectedComu, scenario.id);
      result.guards.forEach((guard, index) => assert.deepEqual([guard.original, guard.v1, guard.v2],
        [...scenario.decisions[index]].map((code) => meanings[code]), `${scenario.id}/${guard.side}`));
      const coverageGap = result.guards.some((guard) => guard.coverage === "open") && result.comu.includes("PASSED");
      assert.equal(coverageGap, scenario.knownLegacyCoverageGap ?? false, `${scenario.id}: unexpected legacy coverage risk`);
      results.push({ ...result, knownLegacyCoverageGap: coverageGap });
      console.log(`PASS ${scenario.id}${coverageGap ? " (known legacy safety gap: open coverage can PASS)" : ""}`);
    }
    const summary = { docx: inventory.length, scenarios: results.length,
      programmatic: inventory.filter((item) => item.classification === "Programmatic/synthetic").length,
      unverified: inventory.filter((item) => item.classification === "Unknown/unverified").length,
      verifiedWordNative: 0, verifiedLibreOffice: 0, legacySafetyGaps: results.filter((item) => item.knownLegacyCoverageGap).length,
      defaultAdmission: "denied", realScopeAdmission: "denied", fixtureWrites: 0 };
    if (process.argv.includes("--write-report")) fs.writeFileSync(path.join(root, "docs/audit/SPRINT_42_DOCX_COMPATIBILITY.md"), render(inventory, results, summary), "utf8");
    console.log(JSON.stringify({ audit: "Sprint 42", regression: "PASS", summary }));
  } finally {
    assert.deepEqual(scan(root).sort(), files, "DOCX population changed");
    for (const [file, hash] of hashes) assert.equal(sha256(fs.readFileSync(file)), hash, `DOCX changed: ${file}`);
  }
}

function render(inventory, results, summary) {
  const cell = (value) => String(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  const counts = (rows) => rows.map((row) => row.join("/")).join("; ") || "none";
  const decisions = (row) => row.guards.map((guard) => `${guard.side}: ${guard.original}/${guard.v1}/${guard.v2} (${guard.reasons.join("/")}; ${guard.coverage})`).join("; ");
  return [
    "# Sprint 42 — DOCX Compatibility Audit", "", "Tarih: 3 Kasım 2026.", "",
    "**Sprint 42 NO-GO (safety koşulu tam sağlanmadı); production onboarding NO-GO.**",
    "Regresyon sözleşme kontrolleri PASS; bu, aşağıda kaydedilen legacy güvenlik açığının düzeldiği anlamına gelmez.", "",
    "## Kapsam ve önceki raporlar", "",
    "Sprint 39: [native evidence request](SDU_NATIVE_EVIDENCE_REQUEST.md); Sprint 40: [acceptance gate](SDU_SPRINT_40_NATIVE_EVIDENCE_ACCEPTANCE.md); Sprint 41: [margin/package debug](SPRINT_41_DOCX_MARGIN_COMPARISON.md) incelendi.",
    "Mevcut Node TS/DOM golden harness, production createNormalizedDocumentFromDocx/analyzeDocx ve test-only SDÜ batch/versioned guard kullanıldı. Yeni bağımlılık yok.",
    "Tarama workspace ile sınırlı; .git/node_modules/dist/.codex/.agents/.aws ve symbolic link hedefleri hariç. DOCX paketleri yalnız okundu; yeni senaryolar full-correct.docx üzerinden JSZip ile yalnız bellekte body OOXML değiştirilerek oluşturuldu.",
    `İncelenen mevcut DOCX: ${summary.docx}; yeni in-memory senaryo: ${summary.scenarios}. Tüm paketlerde CRC32 ve [Content_Types].xml/word/document.xml varlığı kontrol edildi. Bu tam OOXML schema/render doğrulaması değildir.`, "",
    "## Provenance", "",
    `Programmatic/synthetic ${summary.programmatic}; Unknown/unverified ${summary.unverified}; LibreOffice-generated verified 0; Microsoft Word-native verified 0.`,
    "42 kayıt manifestte synthetic-ooxml; createdWith alanı aşağıda aynen saklanır. Üretim oturumları yeniden gözlenmedi. Sprint 41'in iki dosyası sentetik olarak beyanlıdır ancak oluşturma yöntemi/save-chain kaydı yoktur; Unknown/unverified sınıfında tutuldu. Dosya adı, app.xml ve ZIP metadata'sı native kanıtı değildir.",
    "Kaynak S1: tests/fixtures/comu/food-technology/experimental/manifest.json. S2: docs/audit/SPRINT_41_DOCX_MARGIN_COMPARISON.md (sentetik beyanı, üretim zinciri yok). İlk 42 dosyanın fixture açıklamaları aynı dizindeki README.md'dedir.", "",
    "| Dosya (workspace relative) | Byte | SHA-256 | Sınıf / kaynak | Oluşturma yöntemi |", "| --- | ---: | --- | --- | --- |",
    ...inventory.map((item) => `| ${item.file} | ${item.byteSize} | ${item.sha256} | ${item.classification} / ${item.source === manifestPath ? "S1" : "S2"} | ${cell(item.method)} |`), "",
    "## Mevcut 44 dosya: parser, ÇOMÜ ve SDÜ", "",
    "Sıra top/bottom/left/right. Section'lar noktalı virgülle ayrılır. ÇOMÜ P=PASSED, F=FAILED; SDÜ original/v1/v2 ve reason code/coverage ayrı gösterilir. null eksik/geçersiz/desteklenmeyen kanıttır.",
    "ÇOMÜ scope Gıda Teknolojisi/Lisans/Deneysel; margin beklentileri 3/2.5/3/2.5 cm. Tam rapor sayıları toplam/PASSED/FAILED/NOT_APPLICABLE.", "",
    "| DOCX | Raw margin | Parser cm | ÇOMÜ margin | ÇOMÜ tam rapor | SDÜ top/bottom |", "| --- | --- | --- | --- | --- | --- |",
    ...inventory.map(({ file, result }) => `| ${path.basename(file)} | ${counts(result.rawMargins.map((values) => values.map((value) => value ?? "null")))} | ${counts(result.margins.map((values) => values.map((value) => value ?? "null")))} | ${result.comu.map((value) => value === "PASSED" ? "P" : "F").join("/")} | ${result.counts.join("/")} | ${decisions(result)} |`), "",
    "## Yeni senaryolar", "",
    "Her satır programmatic/synthetic, full-correct.docx kontrollü in-memory OOXML body mutation. Literal parser beklentileri mevcut MARGIN_NUMERIC_AND_PRECISION_CONTRACT.md ve margin validator/guard sözleşmelerinden alınır; yeni akademik tolerans tanımlanmaz.",
    "Eksik/null sayısal kanıt taşıyan her kenarın ÇOMÜ PASSED olmaması assert edilir. SDÜ 11 pilotun original raporları, metadata/provenance eşitliği ve karar yükseltmeme sınırları kontrol edilir.", "",
    "| Senaryo | Raw margin | Parser cm | ÇOMÜ margin | SDÜ original/v1/v2 (reasons; coverage) | Safety |", "| --- | --- | --- | --- | --- | --- |",
    ...results.map((row) => `| ${row.name} | ${counts(row.rawMargins.map((values) => values.map((value) => value ?? "null")))} | ${counts(row.margins.map((values) => values.map((value) => value ?? "null")))} | ${row.comu.map((value) => value === "PASSED" ? "P" : "F").join("/")} | ${decisions(row)} | ${row.knownLegacyCoverageGap ? "FAIL: open coverage + legacy PASS" : "PASS"} |`), "",
    "## Bulgular ve sınırlar", "",
    "- Eksik pgMar/attribute, bozuk/boş lexeme, bare decimal/scientific/hex, NaN/Infinity ve safe-integer dışı değer null kalır; bunlar hiçbir kenarda yanlış legacy PASSED üretmedi.",
    "- Multi-section değerlendirme tüm section'ları kullanır; son section'ın uygunluğu önceki eksik/hatalı değeri gizlemez. Unknown + proven violation original assessment'ta violation olabilir; bu unknown'ın compliant olması değildir.",
    "- **Açık doğrulama açığı:** missing-terminal-section senaryosunda parser paragraph section'ı korur; margin assessment coverage=open kalır. Legacy MarginValidator.validate coverage kullanmadığı için 4 kenara PASSED verir. SDÜ original top violation, bottom undetermined; v2 ikisini de undetermined bırakır. Bu production davranışı değiştirilmedi; mevcut sözleşmenin kaydı regresyonda korunurken safety sütunu FAIL kalır. Sprint 42'nin eksik kanıtın PASSED olmaması hedefi bu yapısal durumda tam sağlanmıyor.",
    "- İki ondalık cm yuvarlaması exact fiziksel eşitlik değildir. 1415–1420 twips ve 2.499/2.501cm hedefe yuvarlanabilir. Guard v1 precision-unapproved ile U bırakır; v2 aralık hedefi dışlarsa mevcut V'yi korur, örtüşme C üretmez. Unit eşdeğerliği tek başına guard onayı değildir.",
    "- Terminal section olmayan belgede ve unsupported carrier'da kapsam sınırlıdır. Guard v1 açık kapsamda explicit-cm counterexample V'sini koruyabilir; v2 coverage nedeniyle U kalabilir. Fiziksel yerleşim ve editör round-trip bu statik audit ile kanıtlanmaz.",
    "- Bu senaryolar tüm OOXML kombinasyonlarını kapsamaz. Gerçek kullanıcı/Word-native/LibreOffice round-trip uyumluluğu doğrulanmadı.", "",
    "## SDÜ sınırı ve evidence provenance", "",
    "Tüm 44+senaryo koşularında 11 mevcut pilot, açık synthetic-pilot admission ve synthetic-department kullanıldı. Default admission ve real industrial-engineering scope reddi ayrıca assert edildi. Unscored original rapor v1/v2 aynı; productionAuthorization not-granted.",
    "Margin evidence word/document.xml, her section'ın raw top/bottom değeri; inventory SDU-INV-LAY-05/06. Frozen kaynak SDÜ 2026 kılavuzu §2.2 basılı sayfa 4, SHA-256 f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44. registered-hash-only; yeni kaynak doğrulaması yapılmadı.", "",
    "## QA", "",
    "Focused koşu: node tests/audit/docxCompatibilityRegression.cjs --write-report (rapor üretimi yalnız açık flag ile). Normal koşu raporu yeniden yazmaz. Mevcut dosyaların population/hash kontrolü finally bloğunda yapılır.",
    "Tam QA sonucu çalışma sonunda aşağıya kaydedilir. npm.cmd run test kullanılmaz; package.json gerçek script adları test:golden/test:corpus/typecheck/lint/build olarak doğrulandı.", "",
    "Manuel tekrar:", "```powershell", "node tests/audit/docxCompatibilityRegression.cjs", "npm.cmd run test:golden", "npm.cmd run test:corpus", "npm.cmd run typecheck", "npm.cmd run lint", "npm.cmd run build", "git diff --check", "git status --short", "```", "",
    "Git add, commit veya push yapılmadı. Production kodu ve mevcut DOCX'ler değiştirilmedi.", "",
  ].join("\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
