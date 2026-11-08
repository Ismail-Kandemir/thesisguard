const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { createNormalizedDocumentFromDocx, analyzeDocx } = require("../../src/features/analysis/analysisService.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { loadRules } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");

const root = path.resolve(__dirname, "../..");
const baseFile = path.join(root, "tests/fixtures/comu/food-technology/experimental/full-correct.docx");
const sides = ["top", "bottom", "left", "right"];
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology",
  thesisTypeId: "bachelor", studyTypeId: "experimental" };
const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
const margins = sides.map((side) => rules.find((rule) => rule.category === "margin" && rule.id.endsWith(`margin.${side}`)));
assert.equal(rules.length, 46);
assert.ok(margins.every(Boolean));
const registry = new ValidatorRegistry();
const engine = new RuleEngine(registry);
const builder = new ReportBuilder();
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const props = (values) => `<w:sectPr>${values === null ? "" : `<w:pgMar${sides.map((side, index) =>
  values[index] === null ? "" : ` w:${side}="${values[index]}"`).join("")}/>`}</w:sectPr>`;
const paragraph = (values) => `<w:p><w:pPr>${props(values)}</w:pPr></w:p>`;
const good = ["3cm", "2.5cm", "3cm", "2.5cm"];
const pass = sides.map(() => "PASSED");
const fail = sides.map(() => "FAILED");
const compliant = sides.map(() => "compliant");
const unknown = sides.map(() => "undetermined");
const scenarios = [
  { id: "missing-terminal-section", body: paragraph(good) + "<w:p/>", legacy: pass,
    assessment: unknown, marginCoverage: "open", extraction: "closed", blocked: true },
  { id: "multiple-paragraph-sections-open", body: paragraph(good) + paragraph(good), legacy: pass,
    assessment: unknown, marginCoverage: "open", extraction: "closed", blocked: true },
  { id: "unsupported-carrier-open-extraction", body: `<w:p/><w:altChunk/>${props(good)}`, legacy: pass,
    assessment: compliant, marginCoverage: "closed", extraction: "open", blocked: true },
  { id: "missing-pgMar", body: `<w:p/>${props(null)}`, legacy: fail,
    assessment: unknown, marginCoverage: "closed", extraction: "closed", blocked: true },
  { id: "missing-top-evidence", body: `<w:p/>${props([null, ...good.slice(1)])}`,
    legacy: ["FAILED", "PASSED", "PASSED", "PASSED"], assessment: ["undetermined", "compliant", "compliant", "compliant"],
    marginCoverage: "closed", extraction: "closed", blocked: true },
  { id: "complete-reliable-evidence", body: `<w:p/>${props(good)}`, legacy: pass,
    assessment: compliant, marginCoverage: "closed", extraction: "closed", blocked: false },
  { id: "complete-multiple-sections", body: paragraph(good) + `<w:p/>${props(good)}`, legacy: pass,
    assessment: compliant, marginCoverage: "closed", extraction: "closed", blocked: false },
  { id: "multiple-sections-different-margins", body: paragraph(["3cm", "2.5cm", "3.2cm", "2.5cm"]) + `<w:p/>${props(good)}`,
    legacy: ["PASSED", "PASSED", "FAILED", "PASSED"], assessment: ["compliant", "compliant", "violation", "compliant"],
    marginCoverage: "closed", extraction: "closed", blocked: false },
  { id: "missing-earlier-section-evidence", body: paragraph(null) + `<w:p/>${props(good)}`, legacy: fail,
    assessment: unknown, marginCoverage: "closed", extraction: "closed", blocked: true },
];

/** Design proof only. No new numeric/section detector and no RuleResult mapping.
 * A blocked technical report readiness is NOT an academic result or admission.
 * The extraction gate is deliberately conservative; production policy review is
 * required before treating academic extraction coverage as a margin boundary.
 */
function readinessPrototype(document, selectedRules, produceReport) {
  const reasons = [];
  if (document.sectionExtractionCoverage?.population !== "closed") reasons.push("extraction-coverage-unverified");
  const blockedRules = [];
  for (const rule of selectedRules.filter((item) => item.enabled && item.category === "margin")) {
    const validator = registry.getValidator(rule);
    if (!validator?.assess) { blockedRules.push(rule.id); reasons.push("assessment-unavailable"); continue; }
    const assessment = validator.assess(document, rule);
    if (assessment.coverage?.population !== "closed" || decideRuleAssessment(assessment) === "undetermined") {
      blockedRules.push(rule.id); reasons.push("margin-evidence-incomplete");
    }
  }
  if (reasons.length) return { kind: "blocked", reasons: [...new Set(reasons)], blockedRules, report: null };
  return { kind: "ready", report: produceReport() };
}

async function main() {
  const audit = process.argv.includes("--audit-contract");
  const base = fs.readFileSync(baseFile);
  const before = hash(base);
  const safetyFailures = [];
  let remediatedAssertions = 0;
  const rows = [];
  try {
    for (const scenario of scenarios) {
      const zip = await JSZip.loadAsync(base);
      const original = await zip.file("word/document.xml").async("string");
      const raw = original.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${scenario.body}</w:body>`);
      zip.file("word/document.xml", raw);
      const bytes = await zip.generateAsync({ type: "uint8array" });
      Object.defineProperties(bytes, { name: { value: `${scenario.id}.docx` }, size: { value: bytes.byteLength },
        type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
      const parsed = parseDocumentXml(raw);
      const document = await createNormalizedDocumentFromDocx(bytes);
      assert.deepEqual(document.pageSections, parsed.pageSections, scenario.id);
      assert.deepEqual(document.sectionExtractionCoverage, parsed.sectionExtractionCoverage, scenario.id);
      const engineRun = RuleEngine.prototype.run;
      const build = ReportBuilder.prototype.build;
      let engineCalls = 0; let builderCalls = 0; let productionReport; let productionError;
      RuleEngine.prototype.run = function (...args) { engineCalls++; return engineRun.apply(this, args); };
      ReportBuilder.prototype.build = function (...args) { builderCalls++; return build.apply(this, args); };
      try { productionReport = await analyzeDocx(bytes, selection); }
      catch (error) { productionError = error; }
      finally { RuleEngine.prototype.run = engineRun; ReportBuilder.prototype.build = build; }
      const { AnalysisReadinessDeferredError } = require("../../src/features/analysis/engine/AnalysisReadinessGate.ts");
      assert.equal(engineCalls, scenario.blocked ? 0 : 1, scenario.id);
      assert.equal(builderCalls, scenario.blocked ? 0 : 1, scenario.id);
      if (scenario.blocked) {
        assert.ok(productionError instanceof AnalysisReadinessDeferredError, scenario.id);
        assert.equal(productionReport, undefined);
        for (const field of ["report", "score", "status", "passed"]) assert.equal(Object.hasOwn(productionError, field), false);
      } else {
        assert.equal(productionError, undefined);
        assert.equal(productionReport.totalRules, 46);
      }
      // Preserve the historical validator oracle independently of production readiness.
      const report = builder.build(engine.run(document, rules));
      const statuses = margins.map((rule) => report.results.find((item) => item.ruleId === rule.id).status);
      assert.deepEqual(statuses, scenario.legacy, `${scenario.id}: legacy behavior changed; review evidence`);
      const assessments = margins.map((rule) => registry.getValidator(rule).assess(document, rule));
      assert.deepEqual(assessments.map(decideRuleAssessment), scenario.assessment, scenario.id);
      assert.ok(assessments.every((item) => item.coverage.population === scenario.marginCoverage), scenario.id);
      assert.equal(document.sectionExtractionCoverage.population, scenario.extraction, scenario.id);
      // ReportBuilder is shown the production RuleResults: no hidden filtering.
      assert.equal(report.totalRules, 46);
      const marginReport = builder.build(engine.run(document, margins));
      const snapshot = structuredClone(document);
      let calls = 0;
      const proposed = readinessPrototype(document, margins, () => { calls++; return builder.build(engine.run(document, margins)); });
      assert.equal(proposed.kind, scenario.blocked ? "blocked" : "ready", scenario.id);
      assert.equal(calls, scenario.blocked ? 0 : 1, scenario.id);
      assert.deepEqual(document, snapshot, "Readiness must not mutate normalized evidence");
      if (scenario.blocked) {
        assert.equal(proposed.report, null);
        for (const field of ["status", "passed", "score"]) assert.equal(Object.hasOwn(proposed, field), false);
      } else assert.deepEqual(proposed.report, marginReport, "Reliable report and score must remain identical");
      const productionStatuses = productionReport ? margins.map((rule) => productionReport.results.find((item) => item.ruleId === rule.id).status) : [];
      if (!scenario.blocked) assert.deepEqual(productionStatuses, scenario.legacy, scenario.id);
      for (const [index, legacyStatus] of statuses.entries()) {
        const status = productionStatuses[index];
        const incomplete = assessments[index].coverage.population !== "closed" ||
          scenario.assessment[index] === "undetermined" || scenario.extraction !== "closed";
        if (incomplete) {
          assert.equal(productionReport, undefined, scenario.id);
          assert.ok(productionError instanceof AnalysisReadinessDeferredError, scenario.id);
          if (legacyStatus === "PASSED") remediatedAssertions++;
          try { assert.notEqual(status, "PASSED", `${scenario.id}: ${margins[index].id} incomplete evidence must not PASS`); }
          catch (error) { safetyFailures.push(error.message); }
        }
      }
      rows.push({ scenario: scenario.id, sectionSources: document.pageSections.map((item) => item.source),
        extraction: scenario.extraction, marginCoverage: scenario.marginCoverage, assessments: scenario.assessment,
        legacyBefore: statuses, productionAfter: productionReport ? productionStatuses : "DEFER", historicalMarginScore: marginReport.score,
        productionCounts: productionReport ? [productionReport.totalRules, productionReport.passedRules, productionReport.failedRules, productionReport.notApplicableRules] : null,
        proposedReadiness: proposed.kind, proposedScore: proposed.report?.score ?? null });
    }
    // The generic validator also serves base bachelor and engineering rules.
    const engineering = { universityId: "comu", facultyId: "engineering", departmentId: "computer-engineering", thesisTypeId: "bachelor" };
    const otherScopes = [
      { scope: "comu.bachelor base (direct loadRules, not a catalog selection)", rules: loadRules() },
      { scope: engineering, rules: new RuleResolver().resolve(new RuleSetSelector().select(engineering)) },
    ];
    const affected = [];
    for (const { scope, rules: scopedRules } of otherScopes) {
      const selected = scopedRules.filter((rule) => rule.enabled && rule.category === "margin");
      const rawMargins = Object.fromEntries(selected.map((rule) => [rule.id.split(".").at(-1), `${rule.expected.value}cm`]));
      const document = parseDocumentXml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraph(sides.map((side) => rawMargins[side]))}</w:body></w:document>`);
      const results = engine.run(document, selected);
      assert.ok(results.length > 0);
      assert.ok(results.every((result) => result.status === "PASSED"));
      assert.ok(selected.every((rule) => registry.getValidator(rule).assess(document, rule).coverage.population === "open"));
      affected.push({ scope, marginRuleIds: selected.map((rule) => rule.id), falsePassed: results.length });
    }
    assert.equal(remediatedAssertions, 12, "All 12 original false-PASS assertions must be exercised in production");
    console.log(JSON.stringify({ cases: rows, otherScopes: affected }));
    console.log(JSON.stringify({ mode: audit ? "contract-audit" : "safety-acceptance", scenarios: scenarios.length,
      contractChecks: "PASS", prototypeChecks: "PASS", productionSafety: safetyFailures.length ? "FAIL" : "PASS",
      falsePasses: safetyFailures.length, remediatedAssertions, productionChanged: true, fixtureWrites: 0 }));
    for (const failure of safetyFailures) console.error(`SAFETY FAIL ${failure}`);
    if (!audit) assert.equal(safetyFailures.length, 0, "Production must defer incomplete evidence before generating results or score.");
  } finally {
    assert.equal(hash(fs.readFileSync(baseFile)), before, "Base DOCX changed");
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
