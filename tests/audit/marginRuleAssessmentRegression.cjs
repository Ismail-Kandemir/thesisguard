const assert = require("node:assert/strict");
require("../golden/experimentalGoldenRegression.cjs");
const { MarginValidator } = require("../../src/features/analysis/rules/validators/MarginValidator.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const rule = {
  id: "margin-assessment-test", type: "MARGIN_TOP", category: "margin", title: "Top margin",
  description: "Test", expected: { value: 2.5, unit: "cm" }, severity: "error", score: 10,
  message: "Test", solution: "Test", enabled: true, version: "1.0.0",
};
const margins = (top) => ({ top, left: 3, right: 2.5, bottom: 2.5 });
const document = (...values) => ({
  pageMargins: margins(2.5),
  pageSections: values.map((value, index) => ({
    index, startParagraphIndex: index, endParagraphIndex: index,
    source: index === values.length - 1 ? "body" : "paragraph", pageMargins: margins(value),
  })),
});
const validator = new MarginValidator("top");
const assess = (doc, requirement = rule) => validator.assess(doc, requirement);
const decide = (doc, requirement = rule) => decideRuleAssessment(assess(doc, requirement));
let cases = 0;
function check(label, run) {
  run(); cases += 1; console.log(`PASS ${label}`);
}

check("confirmed match uses section evidence and existing decision", () => {
  const result = assess(document(2.5, 2.5));
  assert.equal(decideRuleAssessment(result), "compliant");
  assert.deepEqual(result.reference, { kind: "rule", id: rule.id });
  assert.equal(result.coverage.population, "closed");
  assert.deepEqual(result.observations.map((item) => item.subject), [
    { kind: "page-section", sectionIndex: 0 }, { kind: "page-section", sectionIndex: 1 },
  ]);
  assert.equal(result.observations[1].evidence.items[0].sectionIndex, 1);
  assert.equal(result.observations[0].evidence.items[0].actual, 2.5);
  assert.equal(result.observations[0].evidence.items[0].expected, 2.5);
});
check("all four sides and legacy untyped requirements", () => {
  for (const side of ["top", "bottom", "left", "right"]) {
    const requirement = { ...rule, type: `MARGIN_${side.toUpperCase()}`, expected: 2.5 };
    const doc = document(2.5);
    doc.pageSections[0].pageMargins[side] = 2.5;
    const instance = new MarginValidator(side);
    assert.equal(decideRuleAssessment(instance.assess(doc, requirement)), "compliant");
    assert.equal(decideRuleAssessment(instance.assess(doc, { ...requirement, type: undefined })), "compliant");
    doc.pageSections[0].pageMargins[side] = 3.1;
    assert.equal(decideRuleAssessment(instance.assess(doc, requirement)), "violation");
  }
});
check("confirmed mismatch, including mixed unknown evidence, remains violation", () => {
  assert.equal(decide(document(3)), "violation");
  assert.equal(decide(document(null, 3, 2.5)), "violation");
});
check("missing/null/unknown values never become violations or N/A", () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, "unknown", "2.5"]) {
    const result = assess(document(value));
    assert.equal(decideRuleAssessment(result), "undetermined");
    assert.equal(result.observations[0].state, "undetermined");
    assert.equal(result.observations[0].evidence.certainty, "missing");
    assert.equal(Object.hasOwn(result.observations[0], "finding"), false);
  }
});
check("unresolved applicability never yields a confirmed finding", () => {
  for (const patch of [
    { enabled: false }, { category: "format" }, { type: "MARGIN_LEFT" },
    { expected: "unknown" }, { expected: "" }, { expected: true },
    { expected: { value: 2.5, unit: "in" } }, { expected: { required: true } },
  ]) {
    for (const value of [2.5, 3]) {
      const result = assess(document(value), { ...rule, ...patch });
      assert.equal(result.applicability.state, "undetermined");
      assert.deepEqual(result.observations, []);
      assert.equal(decideRuleAssessment(result), "undetermined");
    }
  }
  assert.equal(decide(document(2.5), { ...rule, expected: "2.5" }), "compliant");
});
check("incomplete evaluated coverage blocks compliance; aggregate margin cannot mask it", () => {
  assert.equal(decide(document(2.5, null)), "undetermined");
  assert.equal(decide(document(null, 2.5)), "undetermined");
  const doc = document(2.5, 2.5);
  doc.pageMargins.top = 3;
  assert.equal(decide(doc), "compliant");
});
check("missing section inventory stays open even with a matching aggregate margin", () => {
  const doc = document();
  assert.equal(assess(doc).coverage.population, "open");
  assert.equal(decide(doc), "undetermined");
  doc.pageMargins.top = null;
  assert.equal(decide(doc), "undetermined");
  doc.pageMargins.top = 3;
  assert.equal(decide(doc), "violation");
});
check("section breaks without a terminal body section cannot close coverage", () => {
  const doc = document(2.5);
  doc.pageSections[0].source = "paragraph";
  assert.equal(assess(doc).coverage.population, "open");
  assert.equal(decide(doc), "undetermined");
  doc.pageSections[0].pageMargins.top = 3;
  assert.equal(decide(doc), "violation");
});
check("N/A eligibility requires explicit semantics, absent from current margin model", () => {
  for (const doc of [document(), document(null), document(2.5)]) {
    assert.notEqual(decide(doc), "not-applicable");
    assert.equal(decide(doc, { ...rule, enabled: false }), "undetermined");
  }
  // The foundation already supports genuine semantic N/A; the producer must not invent it.
  assert.equal(decideRuleAssessment({
    reference: { kind: "inventory", id: "explicit-condition-contract-test" },
    applicability: {
      state: "not-applicable", reason: "Explicit source condition proven false (contract only).",
      evidence: [{ kind: "document-format", property: "explicit source condition", actual: false }],
    },
  }), "not-applicable");
});
check("legacy validate stays independent, including its missing-evidence failure", () => {
  for (const [doc, status] of [[document(2.5), "PASSED"], [document(3), "FAILED"], [document(null), "FAILED"], [document(), "PASSED"]]) {
    const before = validator.validate(doc, rule);
    assert.equal(before.status, status);
    const docBefore = JSON.stringify(doc);
    assess(doc);
    assert.equal(JSON.stringify(doc), docBefore);
    assert.deepEqual(validator.validate(doc, rule), before);
  }
  const instance = new MarginValidator("top");
  instance.validate = () => { throw new Error("assess must not call validate"); };
  assert.equal(decideRuleAssessment(instance.assess(document(2.5), rule)), "compliant");
});
check("production engine never calls assess and scoring is unchanged after opt-in", () => {
  const registry = new ValidatorRegistry();
  const instance = registry.getValidator(rule);
  assert.ok(instance instanceof MarginValidator);
  const original = instance.assess;
  let calls = 0;
  instance.assess = function (...args) { calls += 1; return original.apply(this, args); };
  const engine = new RuleEngine(registry);
  const builder = new ReportBuilder();
  const doc = document(null);
  const before = engine.run(doc, [rule]);
  const report = builder.build(before);
  assert.equal(calls, 0);
  assert.equal(report.score, 0);
  assert.equal(decideRuleAssessment(instance.assess(doc, rule)), "undetermined");
  assert.deepEqual(engine.run(doc, [rule]), before);
  assert.deepEqual(builder.build(before), report);
  assert.equal(calls, 1);
  assert.equal(builder.build(engine.run(document(2.5), [rule])).score, 100);
  assert.equal(calls, 1);
});
console.log(JSON.stringify({ audit: "marginRuleAssessmentRegression", result: "PASS", cases, fixturesWritten: 0 }));
