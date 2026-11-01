const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { runSduConservativeDecisionPilot: run, guardSduAssessmentReport: guard } = require("./sduConservativeDecisionGuard.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runOriginal } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { createAssessmentReport } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { admitAssessmentBatch } = require("../../src/features/analysis/engine/AssessmentAdmission.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const pilots = [...sections.candidates, ...margins.candidates];
const rules = pilots.map((item) => item.rule);
const target = sections.candidates.find((item) => item.inventoryId === "SDU-INV-SEC-19").rule;
const exact = target.expected.section;
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const paragraph = (text, style = "Heading1") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const section = (value) => `<w:sectPr>${value === null ? "" : `<w:pgMar w:top="${value}" w:bottom="${value}"/>`}</w:sectPr>`;
const transitions = {};
let cases = 0;
let simulationComparisons = 0;
async function check(label, action) { await action(); cases++; console.log(`PASS ${label}`); }
function decision(result, id, original, guarded) {
  const metadata = result.guardMetadata.find((item) => item.executionId === id);
  assert.ok(metadata);
  assert.equal(metadata.originalDecision, original);
  assert.equal(metadata.guardedDecision, guarded);
  assert.equal(metadata.policyVersion, "sdu-conservative-decision/v1");
  const key = `${original} -> ${guarded}`;
  transitions[key] = (transitions[key] ?? 0) + 1;
  return metadata;
}
async function main() {
  const hashes = new Map(manifest.fixtures.map(({ file }) => [file, digest(fs.readFileSync(path.join(directory, file)))]));
  const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
  const originalXml = await (await JSZip.loadAsync(base)).file("word/document.xml").async("string");
  async function variant(body) {
    const zip = await JSZip.loadAsync(base);
    const xml = originalXml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`);
    zip.file("word/document.xml", xml);
    return { bytes: await zip.generateAsync({ type: "nodebuffer" }), xml };
  }
  try {
    for (const [name, raw, style, before, after] of [
      ["exact", exact, "Heading1", "compliant", "compliant"],
      ["NFC", exact.normalize("NFC"), "Heading1", "compliant", "compliant"],
      ["NFD", exact.normalize("NFD"), "Heading1", "compliant", "compliant"],
      ["case", exact.toLocaleUpperCase("tr-TR"), "Heading1", "compliant", "undetermined"],
      ["Turkish-diacritics", "Yaygin Etki/Katma Deger/Kullanilabilirlik", "Heading1", "compliant", "undetermined"],
      ["whitespace", "  Yaygın  Etki / Katma Değer / Kullanılabilirlik  ", "Heading1", "compliant", "undetermined"],
      ["hyphen", exact.replaceAll("/", "-"), "Heading1", "compliant", "undetermined"],
      ["fullwidth-slash", exact.replaceAll("/", "／"), "Heading1", "compliant", "undetermined"],
      ["word-boundary", "YaygınEtkiKatmaDeğerKullanılabilirlik", "Heading1", "compliant", "undetermined"],
      ["in-word-punctuation", exact.replace("Yaygın", "Ya!ygın"), "Heading1", "compliant", "undetermined"],
      ...["Yaygın Etki", "Katma Değer", "Kullanılabilirlik", "Yaygın Etki/Katma Değer"].map((raw) => [raw, raw, "Heading1", "violation", "undetermined"]),
      ["name-only", exact, null, "undetermined", "undetermined"],
      ["misleading-style", exact, "QuoteHeading1Substring", "undetermined", "undetermined"],
    ]) await check(`SEC-19 ${name}`, async () => {
      const { bytes } = await variant(paragraph(raw, style) + section("2.5cm"));
      const result = await run(bytes, { enabled: true });
      const metadata = decision(result, target.id, before, after);
      if (before === "compliant" && after === "undetermined") {
        assert.equal(metadata.reasonCode, "identity-equivalence-unapproved");
        assert.equal(metadata.uncertainty, "identity");
      }
      if (!["Katma Değer", "Kullanılabilirlik", "Yaygın Etki/Katma Değer"].includes(name)) simulationComparisons++;
    });
    for (const [name, body, before, after] of [
      ["split", ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik"].map((raw) => paragraph(raw)).join(""), "violation", "undetermined"],
      ["closed absence", paragraph("Unrelated body", null), "violation", "violation"],
      ["open exact", paragraph(exact) + "<w:altChunk/>", "undetermined", "undetermined"],
    ]) await check(name, async () => {
      const { bytes } = await variant(body + section("2.5cm"));
      decision(await run(bytes, { enabled: true }), target.id, before, after);
      simulationComparisons++;
    });
    for (const [raw, before, after] of [
      ...Array.from({ length: 8 }, (_, index) => [String(index + 1414), index === 0 || index === 7 ? "violation" : "compliant", "undetermined"]),
      ["2.5cm", "compliant", "compliant"], ["2.499cm", "compliant", "undetermined"], ["2.501cm", "compliant", "undetermined"],
      [null, "undetermined", "undetermined"], ["0x589", "undetermined", "undetermined"], ["3cm", "violation", "violation"],
    ]) await check(`margin ${raw}`, async () => {
      const { bytes } = await variant(paragraph("Body", null) + section(raw));
      const result = await run(bytes, { enabled: true });
      margins.candidates.forEach(({ rule }) => decision(result, rule.id, before, after));
      simulationComparisons += 2;
    });
    for (const [name, values, terminal, before, after] of [
      ["exact", ["2.5cm", "2.5cm"], true, "compliant", "compliant"],
      ["mixed", ["2.5cm", "1417"], true, "compliant", "undetermined"],
      ["missing", ["2.5cm", null], true, "undetermined", "undetermined"],
      ["confirmed plus missing", ["3cm", null], true, "violation", "violation"],
      ["open exact", ["2.5cm", "2.5cm"], false, "undetermined", "undetermined"],
      ["open quantization", ["1421", "1417"], false, "violation", "undetermined"],
      ["open violation", ["3cm", "2.5cm"], false, "violation", "violation"],
    ]) await check(`multiple sections ${name}`, async () => {
      const body = values.map((raw, index) => terminal && index === values.length - 1 ? section(raw)
        : `<w:p><w:pPr>${section(raw)}</w:pPr></w:p>`).join("");
      const { bytes } = await variant(body);
      const result = await run(bytes, { enabled: true });
      margins.candidates.forEach(({ rule }) => decision(result, rule.id, before, after));
      simulationComparisons += 2;
    });
    const { bytes, xml } = await variant(paragraph(exact) + section("2.5cm"));
    const document = normalizeAcademicSections(markRequiredSectionHeadings(await readDocx(bytes), rules), rules);
    const enabled = await run(bytes, { enabled: true });
    const report = enabled.originalReport;
    await check("opt-in/out; 11 original decisions; lossless report/provenance and JSON", async () => {
      const off = await run(bytes);
      assert.equal(off.enabled, false);
      assert.deepEqual(off.guardMetadata, []);
      assert.deepEqual(off.originalReport, report);
      const original = runOriginal(document, new AssessmentExecutionService(undefined, pilots), rules);
      assert.deepEqual(report.records.map((item) => item.execution), original);
      assert.equal(report.records.length, 11);
      assert.equal(enabled.guardMetadata.length, 11);
      assert.deepEqual(JSON.parse(JSON.stringify(enabled)), enabled);
      assert.ok(Object.isFrozen(enabled.guardMetadata[0].originalProvenance.source));
      assert.deepEqual(report.scoring, { mode: "unscored", legacyContribution: "none" });
      for (const metadata of enabled.guardMetadata) {
        const record = report.records.find((item) => item.executionId === metadata.executionId);
        const { execution, ...binding } = record;
        assert.deepEqual(metadata.originalProvenance, binding);
        assert.equal(metadata.evidenceReference.reportRecord, execution.ruleId);
      }
      assert.throws(() => createAssessmentReport([{ ...original[0], guard: enabled.guardMetadata[0] }], report.records), /outside/);
    });
    await check("missing/mismatched raw evidence fails closed", () => {
      for (const raw of [null, xml.replace(exact, "Another heading")]) {
        const result = guard(report, document, raw, true);
        assert.ok(result.guardMetadata.every((metadata) => metadata.guardedDecision === "undetermined"));
      }
      // The existing Node DOM shim tolerates malformed XML; it must still fail closed.
      assert.ok(guard(report, document, "invalid XML", true).guardMetadata.every((item) => item.guardedDecision === "undetermined"));
      assert.throws(() => guard({ ...report, schemaVersion: "unknown" }, document, xml, true));
      assert.throws(() => guard(report, document, xml, "yes"));
    });
    await check("open extraction cannot authorize margin compliance", async () => {
      const { bytes } = await variant(paragraph(exact) + "<w:altChunk/>" + section("2.5cm"));
      const result = await run(bytes, { enabled: true });
      margins.candidates.forEach(({ rule }) => decision(result, rule.id, "compliant", "undetermined"));
    });
    await check("missing provenance, duplicate/unknown IDs and changed contracts reject before execution", async () => {
      await assert.rejects(() => run(bytes, { enabled: true, rules: [rules[0], rules[0]] }), /Duplicate/);
      await assert.rejects(() => run(bytes, { enabled: true, rules: [{ ...rules[0], id: "unknown" }] }), /unknown-rule/);
      await assert.rejects(() => run(bytes, { enabled: true, rules: [{ ...rules[0], expected: { section: "Changed", required: true } }] }), /contract-mismatch/);
      const bindings = report.records.map(({ execution, ...binding }) => binding);
      await assert.rejects(() => run(bytes, { enabled: true, bindings: [bindings[0], bindings[0]] }), /Duplicate/);
      for (const source of [undefined, { ...bindings[0].source, claim: "Forged claim" }]) {
        await assert.rejects(() => run(bytes, { enabled: true, bindings: [{ ...bindings[0], source }, ...bindings.slice(1)] }));
      }
      await assert.rejects(() => run(bytes, { enabled: true, bindings: [] }), /No binding/);
      await assert.rejects(() => run(bytes, { enabled: "true" }), /boolean/);
    });
    await check("existing N/A evidence only; invalid applicability rejects; errors stay errors", () => {
      const changed = structuredClone(report);
      const execution = changed.records[0].execution;
      execution.assessment = { reference: execution.assessment.reference,
        applicability: { state: "not-applicable", reason: "Existing producer applicability proof (synthetic transport case)",
          evidence: execution.assessment.applicability.evidence } };
      execution.decision = "not-applicable";
      decision(guard(changed, document, xml, true), execution.ruleId, "not-applicable", "not-applicable");
      execution.assessment.applicability.evidence = [];
      assert.throws(() => guard(changed, document, xml, true), /RuleAssessment|AssessmentReport/);
      const errors = structuredClone(report);
      errors.records[0].execution = { kind: "error", ruleId: execution.ruleId, code: "runtime-error", message: "Controlled error" };
      const result = guard(errors, document, xml, true);
      assert.equal(result.guardMetadata.length, 10);
      assert.equal(result.originalReport.records[0].execution.kind, "error");
    });
    await check("admission default-deny and production not-granted", async () => {
      const scope = { university: { id: "sdu" }, faculty: { id: "synthetic" }, department: { id: "synthetic" }, programLevel: { id: "synthetic" }, workType: { id: "synthetic" } };
      const candidates = report.records.map(({ execution, ...binding }) => ({ ...binding, academicScope: scope, readiness: "assessment-ready" }));
      await assert.rejects(() => admitAssessmentBatch({ purpose: "assessment-only", academicScope: scope, candidates }), (error) => error.code === "unknown-execution-id");
      assert.equal(enabled.productionAuthorization, "not-granted");
    });
    for (const file of ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"]) await check(`${file}: legacy scoring and existing eleven decisions isolated`, async () => {
      const input = fs.readFileSync(path.join(directory, file));
      const document = await readDocx(input);
      const legacyRules = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" }));
      const engine = new RuleEngine(); const builder = new ReportBuilder();
      const before = structuredClone(builder.build(engine.run(document, legacyRules)));
      const result = await run(input, { enabled: true });
      assert.deepEqual(builder.build(engine.run(document, legacyRules)), before);
      assert.deepEqual(result.originalReport, (await run(input)).originalReport);
      assert.equal(legacyRules.length, 46);
    });
  } finally {
    for (const [file, hash] of hashes) assert.equal(digest(fs.readFileSync(path.join(directory, file))), hash, file);
  }
  console.log(JSON.stringify({ audit: "sduConservativeDecisionGuard", result: "PASS", cases, transitions,
    sprint32Comparison: { comparisons: simulationComparisons, decisionDifferences: 0,
      implementationDifference: "raw evidence and structural proof replace scenario declarations; invalid metadata rejects" },
    productionAuthorization: "not-granted", fixtureWrites: 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
