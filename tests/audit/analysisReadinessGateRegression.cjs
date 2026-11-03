const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { evaluateAnalysisReadiness: evaluate, runReadinessGatePilot: pilot,
  AnalysisReadinessDeferredError, readinessMessage } = require("./analysisReadinessGatePilot.ts");
const { createNormalizedDocumentFromDocx, analyzeDocx } = require("../../src/features/analysis/analysisService.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");

const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "tests/fixtures/comu/food-technology/experimental");
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology",
  thesisTypeId: "bachelor", studyTypeId: "experimental" };
const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
const marginRules = rules.filter((rule) => rule.category === "margin");
const registry = new ValidatorRegistry();
const sides = ["top", "bottom", "left", "right"];
const good = ["3cm", "2.5cm", "3cm", "2.5cm"];
const section = (values) => `<w:sectPr>${values === null ? "" : `<w:pgMar${sides.map((side, index) =>
  values[index] === null ? "" : ` w:${side}="${values[index]}"`).join("")}/>`}</w:sectPr>`;
const paragraphSection = (values) => `<w:p><w:pPr>${section(values)}</w:pPr></w:p>`;
const math = '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></m:oMathPara>';
const scenarios = [
  { id: "missing-terminal", body: paragraphSection(good), deferred: true },
  { id: "open-multiple-sections", body: paragraphSection(good) + paragraphSection(good), deferred: true },
  { id: "missing-section-inventory", body: "<w:p/>", deferred: true },
  { id: "missing-pgMar", body: `<w:p/>${section(null)}`, deferred: true },
  { id: "missing-top-attribute", body: `<w:p/>${section([null, ...good.slice(1)])}`, deferred: true },
  { id: "malformed-top", body: `<w:p/>${section(["NaN", ...good.slice(1)])}`, deferred: true },
  { id: "violation-cannot-hide-missing-evidence", body: paragraphSection(null) + `<w:p/>${section(["4cm", "3cm", "4cm", "3cm"])}`, deferred: true },
  { id: "complete-single", body: `<w:p/>${section(good)}`, deferred: false },
  { id: "complete-multiple", body: paragraphSection(good) + `<w:p/>${section(good)}`, deferred: false },
  { id: "complete-multiple-real-violation", body: paragraphSection(["3cm", "2.5cm", "3.2cm", "2.5cm"]) + `<w:p/>${section(good)}`, deferred: false },
  ...["altChunk", "subDoc", "contentPart"].map((carrier) => ({ id: `unsupported-${carrier}`, body: `<w:p/><w:${carrier}/>${section(good)}`, deferred: true })),
  { id: "equation-only-overblocking-control", body: `<w:p/>${math}${section(good)}`, deferred: true, compatibilityRisk: true },
  { id: "equation-plus-altChunk", body: `<w:p/>${math}<w:altChunk/>${section(good)}`, deferred: true },
];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function asInput(bytes, name) {
  const result = new Uint8Array(bytes);
  Object.defineProperties(result, { name: { value: name }, size: { value: result.byteLength },
    type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
  return result;
}
function scan(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? scan(file) : /\.docx$/i.test(file) ? [file] : [];
  });
}

// Exercise the single pilot boundary with real engine/builder callbacks; deferred
// requests must not even enter those methods and must not return any score.
function exercise(document, expectedDeferred, name) {
  const snapshot = structuredClone(document);
  const engine = new RuleEngine(); const builder = new ReportBuilder();
  let engineCalls = 0; let builderCalls = 0;
  let returned;
  const execute = () => { engineCalls++; const results = engine.run(document, marginRules);
    builderCalls++; return builder.build(results); };
  if (expectedDeferred) {
    assert.throws(() => { returned = pilot(document, rules, execute); }, (error) => {
      assert.ok(error instanceof AnalysisReadinessDeferredError, name);
      assert.equal(error.message, readinessMessage);
      assert.ok(error.issues.length > 0);
      assert.equal(error instanceof require("../../src/features/analysis/readers/docxPackageReader.ts").DocxPackageError, false);
      for (const field of ["status", "passed", "report", "score"]) assert.equal(Object.hasOwn(error, field), false);
      return true;
    });
    assert.equal(returned, undefined);
  } else {
    returned = pilot(document, rules, execute);
    assert.deepEqual(returned, new ReportBuilder().build(new RuleEngine().run(document, marginRules)), name);
  }
  assert.equal(engineCalls, expectedDeferred ? 0 : 1, name);
  assert.equal(builderCalls, expectedDeferred ? 0 : 1, name);
  assert.deepEqual(document, snapshot, name);
}

async function main() {
  const files = scan(path.join(root, "tests")).sort();
  assert.equal(files.length, 44);
  const hashes = new Map(files.map((file) => [file, hash(fs.readFileSync(file))]));
  const rows = []; const corpusRows = [];
  try {
    const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
    const controls = new Map();
    for (const scenario of scenarios) {
      const zip = await JSZip.loadAsync(base);
      const xml = await zip.file("word/document.xml").async("string");
      zip.file("word/document.xml", xml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${scenario.body}</w:body>`));
      const input = asInput(await zip.generateAsync({ type: "uint8array" }), `${scenario.id}.docx`);
      const document = await createNormalizedDocumentFromDocx(input);
      const readiness = evaluate(document, rules);
      assert.equal(readiness.kind, scenario.deferred ? "deferred" : "ready", scenario.id);
      exercise(document, scenario.deferred, scenario.id);
      const report = await analyzeDocx(input, selection); // Production has no gate; never counted as pilot protection.
      const statuses = marginRules.map((rule) => report.results.find((item) => item.ruleId === rule.id).status);
      rows.push({ id: scenario.id, candidate: readiness, productionMarginStatuses: statuses,
        extraction: document.sectionExtractionCoverage.population, sources: document.pageSections.map((item) => item.source),
        compatibilityRisk: scenario.compatibilityRisk ?? false });
      if (scenario.id.startsWith("equation-")) {
        controls.set(scenario.id, { pageSections: document.pageSections, coverage: document.sectionExtractionCoverage,
          assessments: marginRules.map((rule) => registry.getValidator(rule).assess(document, rule)) });
      }
      if (scenario.id === "violation-cannot-hide-missing-evidence") {
        assert.ok(marginRules.every((rule) => decideRuleAssessment(registry.getValidator(rule).assess(document, rule)) === "violation"));
        assert.ok(readiness.issues.some((issue) => issue.reason === "margin-evidence-unavailable"));
      }
      console.log(`PASS pilot ${scenario.id}${scenario.compatibilityRisk ? " (compatibility acceptance FAIL: unnecessary deferral)" : ""}`);
    }
    // Both controls expose the same consumed semantic evidence: a blanket
    // equation exception cannot reliably authorize the equation+altChunk input.
    assert.deepEqual(controls.get("equation-only-overblocking-control"), controls.get("equation-plus-altChunk"));
    for (const file of files) {
      const input = asInput(fs.readFileSync(file), path.basename(file));
      const document = await createNormalizedDocumentFromDocx(input);
      const readiness = evaluate(document, rules);
      exercise(document, readiness.kind === "deferred", file);
      assert.ok(marginRules.every((rule) => {
        const assessment = registry.getValidator(rule).assess(document, rule);
        return assessment.coverage.population === "closed" && assessment.observations.every((item) => item.state === "confirmed");
      }), `${file}: complete margin inventory expected`);
      corpusRows.push({ file: path.relative(root, file).split(path.sep).join("/"), readiness });
    }
    const blocked = corpusRows.filter((row) => row.readiness.kind === "deferred");
    assert.deepEqual(blocked.map((row) => path.basename(row.file)), ["equation-object-synthetic.docx"], "Review compatibility census if evidence changes");
    assert.equal(evaluate(await createNormalizedDocumentFromDocx(asInput(base, "control.docx")), []).kind, "ready");
    console.log(JSON.stringify({ scenarios: rows, corpus: corpusRows }));
    console.log(JSON.stringify({ candidateChecks: "PASS", scenarios: scenarios.length, docx: files.length,
      candidateReady: files.length - blocked.length, candidateDeferred: blocked.length, unnecessaryCorpusDeferrals: blocked.length,
      productionIntegrated: false, productionFalsePassClosed: false, compatibilityAcceptance: "FAIL", fixtureWrites: 0 }));
    if (process.argv.includes("--require-integration")) {
      assert.equal(blocked.length, 0, "Production integration rejected: the candidate unnecessarily defers a complete-margin equation fixture; production false-PASS remains open.");
      assert.fail("Production integration has not been implemented or proven");
    }
  } finally {
    assert.deepEqual(scan(path.join(root, "tests")).sort(), files);
    for (const [file, before] of hashes) assert.equal(hash(fs.readFileSync(file)), before, file);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
