const assert = require("node:assert/strict");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { ObjectCaptionPlacementValidator } = require("../../src/features/analysis/rules/validators/ObjectCaptionPlacementValidator.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const rule = {
  id: "figure-placement-assessment-test", type: "OBJECT_CAPTION_PLACEMENT", category: "format",
  title: "Figure placement", description: "Test", expected: { object: "figure", position: "after" },
  severity: "error", score: 10, message: "Test", solution: "Test", enabled: true, version: "1.0.0",
};
const validator = new ObjectCaptionPlacementValidator();
const paragraph = (text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const caption = (n = 1) => paragraph(`\u015Eekil ${n}. Test`);
const graphic = '<a:graphic><a:graphicData><pic:pic/></a:graphicData></a:graphic>';
const drawing = (type = "inline", content = graphic) => `<w:p><w:r><w:drawing><wp:${type}>${content}</wp:${type}></w:drawing></w:r></w:p>`;
const textbox = () => drawing("inline", '<wps:txbx><w:txbxContent>' + paragraph("Textbox") + '</w:txbxContent></wps:txbx>');
const document = (body = "") => parseDocumentXml(
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
  ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
  ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
  ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"' +
  ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' +
  `<w:body>${body}</w:body></w:document>`,
);
const assess = (doc, requirement = rule) => validator.assess(doc, requirement);
const decide = (doc) => decideRuleAssessment(assess(doc));
// Current normalization cannot declare anchors. Supply a confirmed semantic
// identity explicitly to test the independent rendered-placement boundary.
function declaredAnchor() {
  const doc = document(drawing() + caption());
  doc.objectSemantics.representations[0].drawingType = "anchor";
  return doc;
}
let cases = 0;
function check(label, run) { run(); cases += 1; console.log(`PASS ${label}`); }

check("inline eligible figure: confirmed identity, placement and complete coverage", () => {
  const doc = document(drawing() + caption());
  const result = assess(doc);
  assert.equal(decideRuleAssessment(result), "compliant");
  assert.equal(result.coverage.population, "closed");
  assert.equal(result.observations[0].identity.certainty, "confirmed");
  assert.equal(result.observations[0].evidence.items[0].captionId, doc.objectSemantics.captions[0].id);
  assert.equal(validator.validate(doc, rule).status, "PASSED");
});
check("anchored eligible figure remains unsupported even with a matched association", () => {
  const doc = declaredAnchor();
  const result = assess(doc);
  assert.equal(decideRuleAssessment(result), "undetermined");
  assert.equal(result.observations[0].identity.certainty, "confirmed");
  assert.equal(result.observations[0].evidence.boundary, "rendered-layout");
  assert.equal(validator.validate(doc, rule).status, "NOT_APPLICABLE");
  doc.objectSemantics.associations[0].position = "before";
  assert.equal(decide(doc), "undetermined");
});
check("mixed inline and anchored figures retain every occurrence", () => {
  const doc = document(drawing() + caption() + paragraph("Separator") + drawing() + caption(2));
  doc.objectSemantics.representations[1].drawingType = "anchor";
  const result = assess(doc);
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].finding, "compliant");
  assert.equal(result.observations[1].state, "undetermined");
  assert.equal(decideRuleAssessment(result), "undetermined");
  assert.equal(validator.validate(doc, rule).status, "PASSED");
});
check("unresolved and ambiguous academic identity cannot establish placement findings", () => {
  for (const doc of [document(drawing()), document(caption() + drawing() + caption(2)), document(drawing("anchor") + caption())]) {
    const result = assess(doc);
    assert.equal(decideRuleAssessment(result), "undetermined");
    assert.equal(result.coverage.population, "open");
    assert.ok(["unresolved", "ambiguous"].includes(result.observations[0].identity.certainty));
    assert.equal(Object.hasOwn(result.observations[0], "finding"), false);
    assert.equal(validator.validate(doc, rule).status, "NOT_APPLICABLE");
  }
});
check("excluded textbox has semantic exclusion proof and cannot create a figure", () => {
  const doc = document(textbox());
  assert.equal(doc.objectSemantics.resolutions[0].status, "excluded");
  assert.equal(decide(doc), "not-applicable");
  const mixed = document(textbox() + paragraph("Separator") + drawing() + caption());
  const result = assess(mixed);
  assert.equal(decideRuleAssessment(result), "compliant");
  assert.equal(result.observations.length, 1);
  assert.equal(result.coverage.excludedSubjects.length, 1);
  assert.ok(result.coverage.excludedSubjects[0].evidence.length > 0);
  assert.equal(decide(document(textbox() + caption())), "undetermined");
});
check("generic drawing does not establish identity, even with a declared caption nearby", () => {
  const doc = document(drawing("inline", "") + caption());
  assert.equal(doc.objectSemantics.representations[0].kind, "unknown-drawing");
  const result = assess(doc);
  assert.equal(decideRuleAssessment(result), "undetermined");
  assert.equal(result.observations[0].identity.certainty, "unresolved");
  assert.equal(result.coverage.population, "open");
});
check("missing or ambiguous placement evidence stays undetermined, not a violation", () => {
  for (const mutate of [
    (semantics) => { semantics.associations = []; },
    (semantics) => { semantics.associations[0].position = null; },
    (semantics) => { semantics.associations[0].status = "ambiguous"; },
    (semantics) => { semantics.associations[0].captionId = "missing-caption"; },
    (semantics) => { semantics.captions = []; },
    (semantics) => { semantics.representations[0].blockIndex = null; },
  ]) {
    const doc = document(drawing() + caption());
    mutate(doc.objectSemantics);
    const result = assess(doc);
    assert.equal(decideRuleAssessment(result), "undetermined");
    assert.equal(result.observations[0].identity.certainty, "confirmed");
    assert.equal(result.observations[0].evidence.certainty, "missing");
  }
});
check("incomplete inventory cannot hide unresolved carriers, missing resolutions or dangling records", () => {
  const mixed = document(drawing() + caption() + paragraph("Separator") + drawing());
  assert.equal(decide(mixed), "undetermined");
  assert.equal(assess(mixed).observations.length, 2);
  const missingResolution = document(drawing() + caption());
  missingResolution.objectSemantics.resolutions = [];
  assert.equal(decide(missingResolution), "undetermined");
  const dangling = document(drawing() + caption());
  dangling.objectSemantics.representations = [];
  assert.equal(decide(dangling), "undetermined");
  assert.equal(assess(dangling).coverage.population, "open");
  dangling.objectSemantics.resolutions = [];
  dangling.objectSemantics.captions = [];
  assert.equal(decide(dangling), "undetermined");
  assert.equal(decide(document(caption())), "undetermined");
  const unavailable = document();
  delete unavailable.objectSemantics;
  assert.equal(decide(unavailable), "undetermined");
});
check("genuine N/A requires a closed inventory with no eligible figure", () => {
  for (const doc of [document(), document(textbox()), document(paragraph("Tablo 1. Data") + '<w:tbl><w:tr><w:tc>' + paragraph("Cell") + '</w:tc></w:tr></w:tbl>')]) {
    const result = assess(doc);
    assert.equal(decideRuleAssessment(result), "not-applicable");
    assert.ok(result.applicability.evidence.length > 0);
    assert.equal(result.coverage, undefined);
  }
  assert.equal(decideRuleAssessment(assess(document(), { ...rule, enabled: false })), "undetermined");
  assert.equal(decideRuleAssessment(assess(document(), { ...rule, expected: { object: "table", position: "before" } })), "undetermined");
});
check("confirmed violation survives incomplete coverage and unrelated unknown placement", () => {
  const doc = document(caption() + drawing() + paragraph("Separator") + drawing());
  const result = assess(doc);
  assert.equal(result.coverage.population, "open");
  assert.equal(decideRuleAssessment(result), "violation");
  assert.equal(result.observations[0].evidence.items[0].actual, "before");
  assert.equal(validator.validate(doc, rule).status, "FAILED");
});
check("all occurrences are assessed beyond the legacy evidence display cap", () => {
  const doc = document(Array.from({ length: 12 }, (_, index) => drawing() + caption(index + 1) + paragraph("Separator")).join(""));
  assert.equal(assess(doc).observations.length, 12);
  assert.equal(decide(doc), "compliant");
  doc.objectSemantics.associations[11].position = "before";
  assert.equal(decide(doc), "violation");
});
check("assessment is pure and never invokes validate; legacy output stays identical", () => {
  for (const doc of [document(), document(drawing() + caption()), document(caption() + drawing()), declaredAnchor()]) {
    const before = validator.validate(doc, rule);
    const serialized = JSON.stringify(doc);
    assess(doc);
    assert.equal(JSON.stringify(doc), serialized);
    assert.deepEqual(validator.validate(doc, rule), before);
  }
  const instance = new ObjectCaptionPlacementValidator();
  instance.validate = () => { throw new Error("assess called validate"); };
  assert.equal(decideRuleAssessment(instance.assess(document(drawing() + caption()), rule)), "compliant");
});
check("engine calls only validate; opt-in leaves legacy scoring unchanged", () => {
  const registry = new ValidatorRegistry();
  const instance = registry.getValidator(rule);
  const original = instance.assess;
  let calls = 0;
  instance.assess = function (...args) { calls += 1; return original.apply(this, args); };
  const engine = new RuleEngine(registry);
  const builder = new ReportBuilder();
  const doc = document(drawing() + caption() + paragraph("Separator") + drawing("anchor") + caption(2));
  const before = engine.run(doc, [rule]);
  const report = builder.build(before);
  assert.equal(report.score, 100);
  assert.equal(calls, 0);
  assert.equal(decideRuleAssessment(instance.assess(doc, rule)), "undetermined");
  assert.deepEqual(engine.run(doc, [rule]), before);
  assert.deepEqual(builder.build(before), report);
  assert.equal(calls, 1);
});
console.log(JSON.stringify({ audit: "figurePlacementRuleAssessmentRegression", result: "PASS", cases, fixturesWritten: 0 }));
