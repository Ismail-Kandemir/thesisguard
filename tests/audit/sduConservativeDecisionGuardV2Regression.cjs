const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { sectionCases, marginCases } = require("./sduGuardCalibrationAuditRegression.cjs");
const { runSduVersionedConservativePilot: run, guardSduAssessmentReportV2: guard,
  experimentalPolicyVersion } = require("./sduConservativeDecisionGuardV2.ts");
const { runSduConservativeDecisionPilot: runV1 } = require("./sduConservativeDecisionGuard.ts");
const { runSduGuardedAssessmentBatch: batch, createSyntheticGuardedBatchRequest: request } = require("./sduGuardedAssessmentBatch.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const headingModule = require("../../src/features/analysis/parsers/headingStyleProvenance.ts");
const { createAssessmentReport } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const target = sections.candidates.find((item) => item.inventoryId === "SDU-INV-SEC-19").rule;
const exact = target.expected.section;
const rules = [...sections.candidates, ...margins.candidates].map((item) => item.rule);
const enabled = { version: "v2-experimental", enabled: true };
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const paragraph = (text, style = "Heading1") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const section = (value) => `<w:sectPr>${value === null ? "" : `<w:pgMar w:top="${value}" w:bottom="${value}"/>`}</w:sectPr>`;
const reportPath = path.resolve("docs/audit/SDU_SPRINT_38_GUARD_V2_EXPERIMENTAL.md");
let cases = 0;
const sectionRows = []; const marginRows = []; const corpusRows = [];
const confusion = { v1: { TP: 0, FP: 0, FN: 0, TN: 0 }, v2: { TP: 0, FP: 0, FN: 0, TN: 0 } };
async function check(label, action) { await action(); cases++; console.log(`PASS ${label}`); }
function safe(result) {
  assert.equal(result.productionAuthorization, "not-granted");
  assert.deepEqual(result.originalReport.scoring, { mode: "unscored", legacyContribution: "none" });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.ok(Object.isFrozen(result));
  for (const item of result.guardMetadata) {
    assert.equal(item.policyVersion, experimentalPolicyVersion);
    if (item.guardedDecision === "compliant") assert.equal(item.originalDecision, "compliant");
    if (item.guardedDecision === "violation") assert.equal(item.originalDecision, "violation");
    if (item.guardedDecision === "not-applicable") assert.equal(item.originalDecision, "not-applicable");
    assert.ok(Object.isFrozen(item.originalProvenance.source));
    assert.ok(item.evidenceReference.reportRecord);
  }
}
function comparison(first, second, id, scenario) {
  assert.deepEqual(first.originalReport, second.originalReport);
  const a = first.guardMetadata.find((item) => item.executionId === id);
  const b = second.guardMetadata.find((item) => item.executionId === id);
  assert.equal(b.v1Decision, a.guardedDecision);
  return { scenario, executionId: id, original: a.originalDecision, v1: a.guardedDecision, v2: b.guardedDecision,
    reason: b.reasonCode, candidates: b.candidates, intervals: b.intervals, evidenceReference: b.evidenceReference };
}
async function main() {
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".docx")).map((file) => path.join(directory, file));
  const protectedFiles = ["sduConservativeDecisionGuard.ts", "sduConservativeDecisionGuardRegression.cjs",
    "sduGuardedAssessmentBatch.ts", "sduGuardedAssessmentBatchRegression.cjs", "sduGuardCalibrationAuditRegression.cjs",
    "sduConservativePolicySimulationRegression.cjs", "sduNormalizationPolicyBoundaryRegression.cjs"].map((name) => path.join(__dirname, name));
  protectedFiles.push(path.resolve("src/features/analysis/parsers/documentXmlParser.ts"), path.resolve("docs/audit/SDU_SPRINT_37_GUARD_CALIBRATION_AUDIT.md"));
  const hashes = new Map([...files, ...protectedFiles].map((file) => [file, digest(fs.readFileSync(file))]));
  const originalPolicy = JSON.stringify([sections, margins]);
  const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
  const xml = await (await JSZip.loadAsync(base)).file("word/document.xml").async("string");
  async function variant(body) {
    const zip = await JSZip.loadAsync(base);
    const raw = xml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`);
    zip.file("word/document.xml", raw);
    return { bytes: await zip.generateAsync({ type: "nodebuffer" }), raw };
  }
  try {
    for (const scenario of sectionCases()) await check(`Sprint 37 SEC-19: ${scenario.name}`, async () => {
      const { bytes } = await variant(scenario.body + (scenario.open ? "<w:altChunk/>" : "") + section("2.5cm"));
      const a = await runV1(bytes, { enabled: true }); const b = await run(bytes, enabled);
      safe(b);
      const row = comparison(a, b, target.id, scenario.name);
      assert.equal(row.original, scenario.original);
      assert.equal(row.v1, scenario.guarded);
      const expected = scenario.classification === "candidate-false-positive" && scenario.original !== "undetermined"
        ? scenario.original : scenario.guarded;
      assert.equal(row.v2, expected, JSON.stringify(row));
      const v1Raw = a.guardMetadata.find((item) => item.executionId === target.id).evidenceReference.rawValues;
      assert.equal(row.candidates.length, scenario.inputs.length);
      row.candidates.forEach((item, index) => {
        const relevance = scenario.inputs[index].relevant;
        for (const [version, selected] of [["v1", v1Raw.includes(item.raw)], ["v2", item.selected]]) {
          confusion[version][relevance ? selected ? "TP" : "FN" : selected ? "FP" : "TN"]++;
        }
        assert.equal(item.selected, relevance, `Candidate refinement mismatch ${scenario.name}/${item.raw}`);
      });
      sectionRows.push(row);
    });
    for (const scenario of marginCases()) await check(`Sprint 37 margins: ${scenario.name}`, async () => {
      const body = scenario.values.map((raw, index) => scenario.terminal && index === scenario.values.length - 1 ? section(raw)
        : `<w:p><w:pPr>${section(raw)}</w:pPr></w:p>`).join("") + (scenario.extractionOpen ? "<w:altChunk/>" : "");
      const { bytes } = await variant(body);
      const a = await runV1(bytes, { enabled: true }); const b = await run(bytes, enabled);
      safe(b);
      for (const { rule } of margins.candidates) {
        const row = comparison(a, b, rule.id, scenario.name);
        assert.equal(row.original, scenario.original); assert.equal(row.v1, scenario.guarded);
        const expected = !scenario.terminal || scenario.extractionOpen || scenario.values.some((raw) => raw === null || raw === "0x589")
          ? "undetermined" : scenario.original === "violation" && scenario.values.some((raw) => raw === "1701" || raw === "3cm")
            ? "violation" : scenario.guarded;
        assert.equal(row.v2, expected, JSON.stringify(row));
        if (scenario.values.includes("1417")) assert.notEqual(row.v2, "compliant");
        if (scenario.name === "1701") assert.ok(row.intervals[0].excludesTarget);
        if (/^14\d\d$/.test(scenario.name)) assert.equal(row.intervals[0].excludesTarget, false);
        marginRows.push({ ...row, raw: scenario.values, closed: scenario.terminal && !scenario.extractionOpen });
      }
    });
    const controlled = await variant(paragraph(exact) + section("2.5cm"));
    const a = await runV1(controlled.bytes, { enabled: true });
    const document = normalizeAcademicSections(markRequiredSectionHeadings(await readDocx(controlled.bytes), rules), rules);
    await check("explicit version/opt-in; default output remains v1", async () => {
      assert.deepEqual(await run(controlled.bytes, { enabled: true }), a);
      assert.deepEqual(await run(controlled.bytes, { enabled: true, version: "v1" }), a);
      const off = await run(controlled.bytes, { version: "v2-experimental" });
      assert.equal(off.enabled, false); assert.deepEqual(off.guardMetadata, []);
      assert.deepEqual(off.originalReport, a.originalReport);
      await assert.rejects(() => run(null, { version: "unknown", enabled: true }), /Unknown/);
    });
    await check("invalid ID/duplicate/changed contract/provenance fail closed", async () => {
      for (const badRules of [[rules[0], rules[0]], [{ ...rules[0], id: "unknown" }], [{ ...rules[0], expected: { section: "Changed", required: true } }]]) {
        await assert.rejects(() => run(controlled.bytes, { ...enabled, rules: badRules }));
      }
      const bindings = a.originalReport.records.map(({ execution, ...binding }) => binding);
      await assert.rejects(() => run(controlled.bytes, { ...enabled, bindings: [bindings[0], bindings[0]] }));
      for (const source of [undefined, { ...bindings[0].source, claim: "Forged" }]) {
        await assert.rejects(() => run(controlled.bytes, { ...enabled, bindings: [{ ...bindings[0], source }, ...bindings.slice(1)] }));
      }
      const badReport = structuredClone(a.originalReport); badReport.records[0].execution.decision = "PASSED";
      assert.throws(() => guard(badReport, document, controlled.raw, true));
    });
    await check("missing raw, mismatched structural provenance and malformed metadata never restore certainty", () => {
      for (const raw of [null, controlled.raw.replace(exact, "Unrelated")]) {
        const result = guard(a.originalReport, document, raw, true);
        assert.ok(result.guardMetadata.every((item) => item.guardedDecision === "undetermined"));
      }
      const badDocument = structuredClone(document); badDocument.paragraphs[0].sectionContext = undefined;
      assert.ok(guard(a.originalReport, badDocument, controlled.raw, true).guardMetadata.every((item) => item.guardedDecision === "undetermined"));
      const badSource = structuredClone(a.originalReport); delete badSource.records[0].execution.assessment.applicability.evidence;
      assert.throws(() => guard(badSource, document, controlled.raw, true));
    });
    await check("unresolved partial heading remains U; full non-heading text never creates C", async () => {
      for (const [text, style] of [["Katma Değer", "MissingStyle"], ["KatmaDeğer", "Heading1"], [exact, null]]) {
        const { bytes } = await variant(paragraph(text, style) + section("2.5cm"));
        const b = await run(bytes, enabled); const item = b.guardMetadata.find((item) => item.executionId === target.id);
        assert.equal(item.guardedDecision, "undetermined"); assert.equal(item.candidates[0].selected, true);
      }
    });
    await check("split component requires adjacent reliable headings; exact ignores unrelated cells/body", async () => {
      const split = await variant(paragraph("Katma") + paragraph("Değer") + section("2.5cm"));
      const splitResult = (await run(split.bytes, enabled)).guardMetadata.find((item) => item.executionId === target.id);
      assert.equal(splitResult.guardedDecision, "undetermined");
      assert.ok(splitResult.candidates.every((item) => item.splitComponent === "Katma Değer"));
      const noisy = await variant(paragraph(exact) + paragraph("Değer", null) + paragraph("Etki", null) +
        `<w:tbl><w:tr><w:tc>${paragraph("A", null)}</w:tc></w:tr></w:tbl>` + section("2.5cm"));
      const result = (await run(noisy.bytes, enabled)).guardMetadata.find((item) => item.executionId === target.id);
      assert.equal(result.guardedDecision, "compliant");
      assert.equal(result.candidates.filter((item) => item.selected).length, 1);
    });
    await check("an old absence report cannot preserve violation over a present exact heading", async () => {
      const missing = await variant(paragraph("Unrelated body", null) + section("2.5cm"));
      const old = await runV1(missing.bytes, { enabled: true });
      const result = guard(old.originalReport, document, controlled.raw, true);
      assert.equal(result.guardMetadata.find((item) => item.executionId === target.id).guardedDecision, "undetermined");
    });
    await check("guard runtime error isolated and fail-closed", () => {
      const original = headingModule.resolveHeadingStyleProvenance;
      try {
        headingModule.resolveHeadingStyleProvenance = () => { throw new Error("Controlled v2 candidate error"); };
        assert.throws(() => guard(a.originalReport, document, controlled.raw, true), /Controlled/);
        let calls = 0;
        headingModule.resolveHeadingStyleProvenance = (...args) => {
          if (++calls > 1) throw new Error("Controlled v2-only candidate error");
          return original(...args);
        };
        const result = guard(a.originalReport, document, controlled.raw, true);
        const failed = result.guardMetadata.find((item) => item.executionId === target.id);
        assert.equal(failed.reasonCode, "v2-runtime-error"); assert.equal(failed.guardedDecision, "undetermined");
        assert.equal(result.guardMetadata.length, 11);
      } finally { headingModule.resolveHeadingStyleProvenance = original; }
    });
    await check("interval is rational representation reasoning, never acceptance tolerance", async () => {
      for (const raw of ["+01701", " 1701 ", "-1701", "9007199254740992", "1.701e3", "2.499cm", "2.501cm"]) {
        const { bytes } = await variant(paragraph("Unrelated body", null) + section(raw));
        const b = await run(bytes, enabled);
        for (const { rule } of margins.candidates) {
          const metadata = b.guardMetadata.find((item) => item.executionId === rule.id);
          assert.equal(metadata.guardedDecision, ["+01701", " 1701 ", "-1701"].includes(raw) ? "violation" : "undetermined");
        }
      }
    });
    await check("report v1 immutable; metadata round-trip; real admission still default-deny", async () => {
      const b = await run(controlled.bytes, enabled); safe(b);
      assert.deepEqual(createAssessmentReport(b.originalReport.records.map((item) => item.execution), b.originalReport.records), b.originalReport);
      const denied = await batch(null, { guardEnabled: true }); assert.equal(denied.status, "admission-rejected");
      const real = request(); real.academicScope.department.id = "industrial-engineering";
      real.candidates.forEach((item) => { item.academicScope.department.id = "industrial-engineering"; });
      const realDenied = await batch(null, { guardEnabled: true, admissionPolicy: "synthetic-pilot", request: real });
      assert.equal(realDenied.status, "admission-rejected"); assert.equal(realDenied.admission.error.code, "scope-mismatch");
    });
    for (const file of ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"]) await check(`${file}: eleven comparisons and both legacy scores isolated`, async () => {
      const bytes = fs.readFileSync(path.join(directory, file)); const document = await readDocx(bytes);
      const engine = new RuleEngine(); const builder = new ReportBuilder();
      for (const selection of [
        { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" },
        { universityId: "comu", facultyId: "engineering", departmentId: "computer-engineering", thesisTypeId: "bachelor" },
      ]) {
        const selectedRules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
        const before = structuredClone(builder.build(engine.run(document, selectedRules)));
        const first = await runV1(bytes, { enabled: true }); const second = await run(bytes, enabled); safe(second);
        assert.deepEqual(builder.build(engine.run(document, selectedRules)), before);
        if (selection.departmentId === "food-technology") for (const metadata of first.guardMetadata) {
          corpusRows.push({ file, ...comparison(first, second, metadata.executionId, file) });
        }
      }
    });
    assert.equal(JSON.stringify([sections, margins]), originalPolicy);
  } finally {
    for (const [file, before] of hashes) assert.equal(digest(fs.readFileSync(file)), before, file);
  }
  assert.deepEqual(confusion.v1, { TP: 24, FP: 9, FN: 0, TN: 5 });
  assert.deepEqual(confusion.v2, { TP: 24, FP: 0, FN: 0, TN: 14 });
  const rows = [...sectionRows, ...marginRows];
  const summary = { cases, controlledEvaluations: rows.length, confusion,
    changed: rows.filter((row) => row.v1 !== row.v2).length,
    complianceRestoredFromV1: rows.filter((row) => row.v1 !== "compliant" && row.v2 === "compliant").length,
    violationsRestoredFromV1: rows.filter((row) => row.v1 !== "violation" && row.v2 === "violation").length,
    originalViolationsPreservedV1: rows.filter((row) => row.original === "violation" && row.v1 === "violation").length,
    originalViolationsPreservedV2: rows.filter((row) => row.original === "violation" && row.v2 === "violation").length,
    stricterViolationDowngrades: rows.filter((row) => row.v1 === "violation" && row.v2 === "undetermined").length,
    undeterminedReduction: rows.filter((row) => row.v1 === "undetermined" && row.v2 !== "undetermined").length,
    undeterminedIncrease: rows.filter((row) => row.v1 !== "undetermined" && row.v2 === "undetermined").length,
    newAcademicCompliance: rows.filter((row) => row.original !== "compliant" && row.v2 === "compliant").length,
    newAcademicViolation: rows.filter((row) => row.original !== "violation" && row.v2 === "violation").length,
    corpusEvaluationsSeparate: corpusRows.length, corpusChanged: corpusRows.filter((row) => row.v1 !== row.v2).length,
    productionAuthorization: "not-granted", fixtureWrites: 0 };
  const data = { summary, sectionRows, marginRows, corpusRows };
  const rendered = render(data);
  if (process.argv.includes("--write-report")) fs.writeFileSync(reportPath, rendered, "utf8");
  else assert.equal(fs.readFileSync(reportPath, "utf8"), rendered, "Experimental v2 report is stale.");
  console.log(JSON.stringify({ comparisonMatrices: data }));
  console.log(JSON.stringify({ audit: "sduConservativeDecisionGuardV2", result: "PASS", ...summary }));
}

function render(data) {
  const { summary: s, sectionRows, marginRows, corpusRows } = data;
  const json = (value) => JSON.stringify(value).replaceAll("|", "&#124;");
  return [
    "# SDÜ Sprint 38 — Conservative Guard v2 experimental",
    "",
    "Tarih: 1 Kasım 2026. Yalnız test/pilot; production onboarding değildir.",
    "",
    "## v1/v2 mimarisi ve sürüm izolasyonu",
    "",
    "Yeni modül: [sduConservativeDecisionGuardV2.ts](../../tests/audit/sduConservativeDecisionGuardV2.ts).",
    "Selector `runSduVersionedConservativePilot` varsayılan olarak v1'e delege eder; yalnız `version: \"v2-experimental\", enabled: true` v2'yi çalıştırır.",
    "Policy version `sdu-conservative-decision/v2-experimental`. Disabled durumda metadata yoktur. Mevcut v1 guard ve Sprint 36 batch harness değiştirilmedi.",
    "v2 önce v1'in 11 execution ID / contract / provenance / AssessmentReport doğrulamasını kullanır; sonra yalnız SEC-19 ve iki margin kararını yeniden sınırlar.",
    "Original AssessmentReport v1 ve kararları değiştirilmez. Guard metadata ayrı, JSON round-trip uyumlu ve immutable snapshot olarak taşınır.",
    "Sprint 37 senaryo üreticileri export edildi; CLI audit çıktısı ve dokümanı aynı kaldı. Aynı corpus kopyalanmadan iki sürümde çalıştırılır.",
    "",
    "## SEC-19 candidate confusion matrix",
    "",
    "Controlled relevance etiketleri Sprint 37'den alınmıştır. Bunlar alias veya gerçek belge ground truth'u değildir; sayım paragraf bazındadır.",
    "",
    "| Sürüm | TP | FP | FN | TN |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(s.confusion).map(([version, row]) => `| ${version} | ${row.TP} | ${row.FP} | ${row.FN} | ${row.TN} |`),
    "",
    "v2 generic A/Değer/Etki'yi tek başına tam bileşen saymaz. Table/TOC/caption, current-revision veya body provenance eksikliği heading adaylığını kurmaz.",
    "Tam bileşenler token sınırlarıyla değerlendirilir. Joined-component ve adjacent/reliable heading token split'i yalnız belirsizlik adayıdır; yeni occurrence veya akademik kimlik oluşturulmaz.",
    "Tam adın non-heading görünümü unresolved identity olarak korunabilir; bu confirmed heading veya compliant sayılmaz. Style/outline belirsiz partial başlık da U kalır.",
    "C yalnız original C + exact NFC raw text + mevcut confirmed occurrence/observation + closed coverage ile korunur. Onaysız case/diacritic/slash/whitespace değişiklikleri U kalır.",
    "",
    "| Senaryo | v1 | v2 | Seçilen v2 raw adaylar | Değişiklik/koruma gerekçesi |",
    "| --- | --- | --- | --- | --- |",
    ...sectionRows.map((row) => `| ${row.scenario} | ${row.v1} | ${row.v2} | ${json(row.candidates.filter((p) => p.selected).map((p) => p.raw))} | ${row.reason} |`),
    "",
    "## Margin interval modeli ve dayanak sınırı",
    "",
    "Integer raw değer, lexical geçerlilik ve safe-integer sınırı korunarak okunur. Parser'ın mevcut iki ondalık cm sözleşmesi değiştirilmez.",
    "Deneysel temsil envelope'u raw merkez etrafında ±1 twip + ±0.005 cm'dir. Bir twip=254/144000 cm; parser yarım adımı=720/144000 cm; toplam half-width=974/144000 cm.",
    "n integer için interval `[(254n−974)/144000, (254n+974)/144000]`; target `360000/144000` ile BigInt kullanılarak karşılaştırılır.",
    "Bu envelope akademik tolerans veya kabul bandı değildir: overlap yalnız U üretir, asla C üretmez. Yakın raw temsilin C sayılması yetkilendirilmez.",
    "±1 twip floor/ceil/nearest için konservatif bir deneysel üst sınır varsayımıdır; tüm editörlerin veya fiziksel çıktının evrensel hata garantisi değildir. Parser rounding payı raw merkezde ayrıca eklenerek bilerek geniş tutulur.",
    "Model ayrı opt-in teknik kalibrasyondur; native belge/ölçüm kanıtı ve normatif precision incelemesi tamamlanmış sayılmaz.",
    "Bu prototip definite margin incelemesini integer twips ve explicit cm ile sınırlar; diğer unitler bu v2 dalında U kalır.",
    "V korunması için original V, güvenilir raw/projection/provenance, closed margin ve extraction coverage, bütün section ölçümlerinin lexical/parsed geçerliliği ve interval dışı counterexample gerekir.",
    "Eksik/malformed ölçüm veya open coverage varsa explicit 3cm dahil U döner. Bu, v1'in bir counterexample ile V koruyan politikasından bilinçli olarak daha sıkıdır.",
    "",
    "## Margin karar matrisi",
    "",
    "Her satır üst/alt pilotlarda ayrı doğrulanmıştır; sonuçları aynıdır. Tam evidence/interval rational değerleri regresyon JSON çıktısındadır.",
    "",
    "| Senaryo | Raw section ölçümleri | Closed margin+extraction | v1 | v2 | Gerekçe |",
    "| --- | --- | --- | --- | --- | --- |",
    ...marginRows.filter((row) => row.executionId.endsWith(".top")).map((row) => `| ${row.scenario} | ${json(row.raw)} | ${row.closed} | ${row.v1} | ${row.v2} | ${row.reason} |`),
    "",
    "1701 twips = 3.000375 cm; interval `[431080/144000, 433028/144000]` ≈ `[2.993611…, 3.007139…]` cm. Hedef tamamen dışarıda: tam/closed kanıtta original V korunur.",
    "1417 twips için interval `[358944/144000, 360892/144000]` hedefi içerir: U. 1414–1421 bandının tamamı da U kalır.",
    "2.499cm ve 2.501cm, parser 2.50 üretse de U kalır. Multi-1701+missing veya open-1701 U kalır; herhangi bir section'daki yakın değer tüm belgeyi C yapmaz.",
    "",
    "## Karar değişiklikleri ve risk",
    "",
    `Kontrollü corpus: ${s.controlledEvaluations} değerlendirme. v1→v2 değişen ${s.changed}; U'dan çıkış ${s.undeterminedReduction}, U'ya giriş ${s.undeterminedIncrease}; net U azalması ${s.undeterminedReduction - s.undeterminedIncrease}.`,
    `v1'e göre C restorasyonu ${s.complianceRestoredFromV1}; V restorasyonu ${s.violationsRestoredFromV1}. Original kararına göre yeni akademik C=${s.newAcademicCompliance}, yeni akademik V=${s.newAcademicViolation}.`,
    `Original confirmed V korunması: v1 ${s.originalViolationsPreservedV1}, v2 ${s.originalViolationsPreservedV2}. Daha sıkı coverage/section şartları nedeniyle v1 V→v2 U sayısı ${s.stricterViolationDowngrades}.`,
    "Bu dört downgrade explicit 3cm+missing ve open-confirmed kontrollerinin iki side'ıdır; kazanımlar raporlanırken saklanmaz. Eksik kanıtta counterexample semantiğine geri dönmek ayrı policy kararı olur.",
    "Candidate specificity, provenance yetersiz gerçek partial/split'i kaçırabilir. Bu yüzden full unresolved identity, missing-style partial ve adjacent reliable split U kontrolleri korunur; sentetik FN=0 gerçek belgede sıfır hata garantisi değildir.",
    "Margin interval varsayımı farklı editor quantization davranışlarında yetersiz kalabilir. Native kanıt olmadan production'a taşınmaz; intervalin akademik tolerans sayılması false C/V riski doğurur.",
    "",
    "## Mevcut iki DOCX — ayrı 22 pilot karşılaştırması",
    "",
    `Bu 22 değerlendirme kontrollü 91'lik toplamdan ayrıdır; değişen ${s.corpusChanged}. Aşağıda yalnız değişen satırlar vardır. Diğer pilotlarda original/v1/v2 korunmuştur.`,
    "",
    "| DOCX | Execution ID | Original | v1 | v2 | Gerekçe |",
    "| --- | --- | --- | --- | --- | --- |",
    ...corpusRows.filter((row) => row.v1 !== row.v2).map((row) => `| ${row.file} | ${row.executionId} | ${row.original} | ${row.v1} | ${row.v2} | ${row.reason} |`),
    "",
    "## Safety invariant sonuçları",
    "",
    "- Default selector v1 çıktısıyla birebir eşit; disabled durumda metadata yok. Bilinmeyen version reddedilir.",
    "- Unknown/duplicate ID, changed contract, missing/forged provenance, invalid decision/applicability metadata reddedilir; admission reddi violation değildir.",
    "- Raw evidence eksikliği veya raw/paragraph structural projection uyuşmazlığı U'dur; source provenance eksikliği batch rejection olabilir.",
    "- Exact heading + unrelated body/table text C'yi gereksiz düşürmez; genuine partial/split ve unresolved heading U'dur. Eski yokluk raporu mevcut exact heading üzerine V'yi koruyamaz.",
    "- Ortak v1 doğrulama hatası exception ile reddedilir; v2 refinement hatası ilgili metadata'da v2-runtime-error/U olur. Her iki yol da fail-closed'dur.",
    "- AssessmentReport v1, immutable metadata, evidence/provenance ve JSON round-trip korunur. Legacy PASSED/FAILED/NOT_APPLICABLE dönüşümü yapılmaz.",
    "- Gerçek scope admission default-deny, authorization not-granted. COMÜ 46/47 kurallı iki bölümün skorları iki fixture üzerinde aynı kalır.",
    "",
    "## Remaining P0/P1 blockers ve Sprint 39",
    "",
    "P0 SEC-19 akademik identity/eşdeğerlik ve P0 margin precision onayı açık. v2 teknik deneyi yeni alias/tolerans onayı değildir.",
    "P1 source/scope reconciliation ve native/gerçek öğrenci belgesi kanıtı açık; bu sprint yeni PDF doğrulaması veya gerçek scope yetkisi üretmedi.",
    "Sprint 39: **GO**, yalnız bağımsız pilot kalibrasyon incelemesi, native temsil kanıtı ve interval varsayımlarının doğrulanması için. Production onboarding: **NO-GO**.",
    "",
    "## QA ve yeniden üretim",
    "",
    `Yeni v2 regresyonu ${s.cases} senaryo grubu; 91 kontrollü + 22 ayrı fixture pilot karşılaştırması. Korunan dosyalar/DOCX'ler SHA-256 ile denetlenir.`,
    "Bu sprintte Sprint 35 48/48, Sprint 36 63/63 ve Sprint 37 91 kontrollü + 22 baseline karşılaştırması PASS kaldı. Sprint 37 raporunun normal read-only eşleşmesi değişmedi.",
    "Golden 46/46, corpus 31 regresyon + 11 exploratory fixture, typecheck, lint, build ve diff whitespace kontrolleri PASS. Build 500 kB chunk uyarısı verdi. Yeni TS modülü ayrıca strict TypeScript ve ESLint kontrolünden geçti.",
    "İlk runtime fault-injection v1 doğrulayıcısını tetikledi; test ortak v1 rejection ve v2 refinement U yollarını ayrı doğrulayacak şekilde düzeltildi. Son koşular başarılıdır.",
    "npm.cmd run test çalıştırılmadı; production/DOCX değişikliği ve add/commit/push yok. Status önceki untracked dosyalar ile Sprint 38 dosyalarını gösterir.",
    "",
    "```powershell",
    "node tests/audit/sduConservativeDecisionGuardV2Regression.cjs",
    "node tests/audit/sduConservativeDecisionGuardRegression.cjs",
    "node tests/audit/sduGuardedAssessmentBatchRegression.cjs",
    "node tests/audit/sduGuardCalibrationAuditRegression.cjs",
    "npm.cmd run test:golden",
    "npm.cmd run test:corpus",
    "npm.cmd run typecheck",
    "npm.cmd run lint",
    "npm.cmd run build",
    "git diff --check",
    "git status --short",
    "```",
    "",
    "Normal regresyon raporla birebir eşleşmeyi kontrol eder; yalnız açık --write-report seçeneği bu dokümanı yeniler.",
    "Dayanaklar: [Sprint 37 audit](SDU_SPRINT_37_GUARD_CALIBRATION_AUDIT.md), [numeric contract](../MARGIN_NUMERIC_AND_PRECISION_CONTRACT.md), [Sprint 33 policy gate](SDU_SPRINT_33_POLICY_APPROVAL_PREPARATION.md).",
    "",
  ].join("\n");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
