const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { sduMarginAssessmentPilot: pilot, sduAssessmentReadiness, runSduMarginAssessmentPilot: runPilot } = require("./sduMarginAssessmentPilot.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");

const fixtureDirectory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const fixtureHashes = new Map();
const digest = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
async function readFixture(name) {
  const filename = path.join(fixtureDirectory, name);
  const bytes = fs.readFileSync(filename);
  fixtureHashes.set(filename, digest(bytes));
  const zip = await JSZip.loadAsync(bytes);
  return zip.file("word/document.xml").async("string");
}

// Changes only the extracted XML string in memory. Never regenerates/writes a ZIP.
function withMargins(xml, side, values) {
  let index = 0;
  const result = xml.replace(/<w:pgMar\b[^>]*\/>/gu, (element) => {
    const value = values[index++];
    const attribute = new RegExp(`\\s+w:${side}="[^"]*"`, "u");
    assert.ok(attribute.test(element), `Corpus section contains ${side} attribute`);
    return element.replace(attribute, value === null ? "" : ` w:${side}="${value}"`);
  });
  assert.equal(index, values.length, "Every corpus section must receive an explicit test value");
  return result;
}
const entriesFor = (xml, executor) => runPilot(parseDocumentXml(xml), executor);
function assertDecisions(entries, expected) {
  assert.equal(entries.length, 2);
  entries.forEach((entry, index) => {
    assert.equal(entry.kind, "assessment", JSON.stringify(entry));
    assert.equal(entry.ruleId, pilot.candidates[index].rule.id);
    assert.equal(entry.assessment.reference.id, entry.ruleId);
    assert.equal(entry.decision, expected[index]);
    for (const key of ["score", "status", "passed"]) assert.equal(Object.hasOwn(entry, key), false);
  });
}
let cases = 0;
const failures = [];
async function check(label, run) {
  cases += 1;
  try { await run(); console.log(`PASS ${label}`); }
  catch (error) { failures.push({ label, message: error.message }); console.error(`FAIL ${label}: ${error.message}`); }
}

async function main() {
  const fullXml = await readFixture("full-correct.docx");
  const multiXml = await readFixture("multi-section-margin-all-correct-synthetic.docx");
  const correctXml = withMargins(fullXml, "top", ["1417", "1417"]);
  await check("pilot source provenance and inventory IDs stay separate from execution rule IDs", () => {
    assert.deepEqual(pilot.candidates.map((candidate) => candidate.inventoryId), ["SDU-INV-LAY-05", "SDU-INV-LAY-06"]);
    assert.deepEqual(pilot.candidates.map((candidate) => candidate.rule.type), ["MARGIN_TOP", "MARGIN_BOTTOM"]);
    assert.equal(pilot.source.section, "2.2");
    assert.equal(pilot.source.printedPage, 4);
    assert.match(pilot.source.frozenSourceSha256, /^[a-f0-9]{64}$/u);
    for (const candidate of pilot.candidates) {
      assert.notEqual(candidate.inventoryId, candidate.rule.id);
      assert.ok(candidate.rule.id.startsWith("pilot."));
      assert.deepEqual(candidate.rule.expected, { value: 2.5, unit: "cm" });
    }
  });
  await check("untouched corpus evidence is assessed against SDU, not COMU expectations", () => {
    const entries = entriesFor(fullXml);
    assertDecisions(entries, ["violation", "compliant"]);
    const document = parseDocumentXml(fullXml);
    assert.equal(document.pageSections.length, 2);
    entries.forEach((entry, side) => entry.assessment.observations.forEach((item, index) => {
      assert.equal(item.subject.sectionIndex, document.pageSections[index].index);
      assert.equal(item.evidence.items[0].actual, document.pageSections[index].pageMargins[side === 0 ? "top" : "bottom"]);
    }));
    const rawMargins = Array.from(fullXml.matchAll(/<w:pgMar\b[^>]*>/gu), (match) => ({
      topTwips: /\bw:top="([^"]*)"/u.exec(match[0])?.[1] ?? null,
      bottomTwips: /\bw:bottom="([^"]*)"/u.exec(match[0])?.[1] ?? null,
    }));
    console.log(JSON.stringify({ corpus: "full-correct.docx", rawMargins,
      sectionMargins: document.pageSections.map((section) => ({ index: section.index, top: section.pageMargins.top, bottom: section.pageMargins.bottom })),
      decisions: entries.map((entry) => entry.decision) }));
  });
  await check("both margins compliant across all OOXML sections", () => {
    const entries = entriesFor(correctXml);
    assertDecisions(entries, ["compliant", "compliant"]);
    assert.ok(entries.every((entry) => entry.assessment.observations.length === 2 && entry.assessment.coverage.population === "closed"));
  });
  await check("top margin violation is preserved", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "top", ["1701", "1417"])), ["violation", "compliant"]);
  });
  await check("bottom margin violation is preserved", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "bottom", ["1417", "1701"])), ["compliant", "violation"]);
  });
  await check("explicit numeric zero remains a confirmed violation", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "top", ["0", "1417"])), ["violation", "compliant"]);
    assertDecisions(entriesFor(withMargins(correctXml, "bottom", ["1417", "0"])), ["compliant", "violation"]);
  });
  await check("missing top evidence is undetermined", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "top", [null, null])), ["undetermined", "compliant"]);
  });
  await check("missing bottom evidence is undetermined", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "bottom", [null, null])), ["compliant", "undetermined"]);
  });
  await check("malformed and non-finite OOXML values are undetermined", () => {
    for (const side of ["top", "bottom"]) for (const value of ["unknown", "NaN", "Infinity"]) {
      assertDecisions(entriesFor(withMargins(correctXml, side, [value, value])), side === "top"
        ? ["undetermined", "compliant"] : ["compliant", "undetermined"]);
    }
  });
  await check("valid and unknown sections cannot produce compliant for either side", () => {
    for (const side of ["top", "bottom"]) for (const values of [["1417", null], [null, "1417"]]) {
      assertDecisions(entriesFor(withMargins(correctXml, side, values)), side === "top"
        ? ["undetermined", "compliant"] : ["compliant", "undetermined"]);
    }
  });
  await check("three-section corpus preserves every occurrence and an intermediate violation", () => {
    const matching = withMargins(multiXml, "top", ["1417", "1417", "1417"]);
    const entries = entriesFor(matching);
    assertDecisions(entries, ["compliant", "compliant"]);
    assert.deepEqual(entries[0].assessment.observations.map((item) => item.subject.sectionIndex), [0, 1, 2]);
    assertDecisions(entriesFor(withMargins(matching, "top", ["1417", "1701", "1417"])), ["violation", "compliant"]);
    assertDecisions(entriesFor(withMargins(matching, "bottom", ["1417", "1701", null])), ["compliant", "violation"]);
  });
  await check("missing pgMar or section inventory stays undetermined without N/A assumptions", () => {
    const noMargins = correctXml.replace(/<w:pgMar\b[^>]*\/>/gu, "");
    assertDecisions(entriesFor(noMargins), ["undetermined", "undetermined"]);
    const noSections = correctXml.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gu, "");
    assert.equal(parseDocumentXml(noSections).pageSections.length, 0);
    assertDecisions(entriesFor(noSections), ["undetermined", "undetermined"]);
  });
  await check("pilot is opt-in and calls assess only for the two requested margins", () => {
    const registry = new ValidatorRegistry();
    const calls = [];
    const originals = [];
    for (const { rule } of pilot.candidates) {
      const validator = registry.getValidator(rule);
      const { assess, validate } = validator;
      originals.push(() => { validator.assess = assess; validator.validate = validate; });
      validator.assess = function (document, requested) { calls.push(requested.id); return assess.call(this, document, requested); };
      validator.validate = () => { throw new Error("Pilot must not invoke legacy validate"); };
    }
    try {
      const executor = new AssessmentExecutionService(registry, sduAssessmentReadiness);
      assert.deepEqual(calls, []);
      assertDecisions(entriesFor(correctXml, executor), ["compliant", "compliant"]);
      assert.deepEqual(calls, pilot.candidates.map((candidate) => candidate.rule.id));
    } finally { originals.forEach((restore) => restore()); }
  });
  await check("production discovery does not contain pilot inventory, rules or SDU program", () => {
    const sets = loadAvailableRuleSets();
    const productionIds = new Set(sets.flatMap((set) => set.rules.map((rule) => rule.id)));
    for (const candidate of pilot.candidates) {
      assert.equal(productionIds.has(candidate.rule.id), false);
      assert.equal(productionIds.has(candidate.inventoryId), false);
    }
    assert.equal(sets.some((set) => set.metadata.university.id === "sdu"), false);
    const loader = fs.readFileSync(path.resolve("src/features/analysis/rules/RuleLoader.ts"), "utf8");
    assert.ok(loader.includes('"../../../data/universities/**/*.json"'));
    assert.ok(!path.resolve(__dirname, "sduMarginAssessmentPilot.ts").startsWith(path.resolve("src/data/universities") + path.sep));
  });
  await check("COMU 46/47 baselines, IDs, metadata and legacy scores remain unchanged", () => {
    const selections = [
      { facultyId: "applied-sciences", departmentId: "food-technology", studyTypeId: "experimental" },
      { facultyId: "engineering", departmentId: "computer-engineering" },
    ];
    for (const selection of selections) {
      const rules = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", thesisTypeId: "bachelor", ...selection }));
      const food = selection.departmentId === "food-technology";
      assert.equal(rules.length, food ? 46 : 47);
      const counts = (key) => rules.reduce((result, rule) => ({ ...result, [rule.validation[key]]: (result[rule.validation[key]] ?? 0) + 1 }), {});
      assert.deepEqual(counts("coverage"), food ? { COMPLETE: 45, PARTIAL: 1 } : { COMPLETE: 33, PARTIAL: 14 });
      assert.deepEqual(counts("trust"), food ? { HIGH: 45, MEDIUM: 1 } : { HIGH: 33, MEDIUM: 14 });
      const document = parseDocumentXml(fullXml);
      const engine = new RuleEngine();
      const builder = new ReportBuilder();
      const legacyRules = rules.filter((rule) => rule.category === "margin");
      const before = engine.run(document, legacyRules);
      const report = builder.build(before);
      const documentBefore = JSON.stringify(document);
      const pilotResults = runPilot(document);
      assertDecisions(pilotResults, ["violation", "compliant"]);
      assert.equal(JSON.stringify(document), documentBefore);
      assert.deepEqual(engine.run(document, legacyRules), before);
      assert.deepEqual(builder.build(before), report);
      assert.ok(legacyRules.every((rule) => !rule.id.startsWith("pilot.")));
      if (food) {
        const prefix = "comu.applied-sciences.food-technology.bachelor.";
        assert.deepEqual(rules.find((rule) => rule.id === prefix + "page-number").validation, { coverage: "PARTIAL", trust: "MEDIUM" });
        assert.deepEqual(rules.find((rule) => rule.id === prefix + "page-number-sequence").validation, { coverage: "COMPLETE", trust: "HIGH" });
      }
    }
  });
  await check("test-only TypeScript pilot config passes strict typechecking without emission", () => {
    const filename = path.join(__dirname, "sduMarginAssessmentPilot.ts");
    const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options));
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
    }));
  });
  // Regression guards: blank values stay unknown; explicit numeric zero is
  // independently checked above and must remain a confirmed numeric value.
  await check("blank top attributes must remain undetermined, not confirmed zero", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "top", ["", " "])), ["undetermined", "compliant"]);
  });
  await check("blank bottom attributes must remain undetermined, not confirmed zero", () => {
    assertDecisions(entriesFor(withMargins(correctXml, "bottom", [" ", ""])), ["compliant", "undetermined"]);
  });
  await check("all source DOCX files remain byte-identical", () => {
    for (const [filename, before] of fixtureHashes) assert.equal(digest(fs.readFileSync(filename)), before);
  });
  console.log(JSON.stringify({ pilot: pilot.id, result: failures.length > 0 ? "FAIL" : "PASS", cases,
    passed: cases - failures.length, failed: failures.length, failures, fixturesWritten: 0 }));
  if (failures.length > 0) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
