const assert = require("node:assert/strict");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
const { normalizeDocumentNumbering } = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
const { normalizeDocumentHeadings } = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RequiredSectionValidator } = require("../../src/features/analysis/rules/validators/RequiredSectionValidator.ts");
const { ConditionalRequiredSectionValidator } = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");
const { HeadingNumberingValidator } = require("../../src/features/analysis/rules/validators/HeadingNumberingValidator.ts");
const { HeadingLevelFormatValidator } = require("../../src/features/analysis/rules/validators/HeadingLevelFormatValidator.ts");
const { HeadingAlignmentValidator } = require("../../src/features/analysis/rules/validators/HeadingAlignmentValidator.ts");
const { HeadingValidator } = require("../../src/features/analysis/rules/validators/HeadingValidator.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const base = (type, expected, category = "structure") => ({
  id: `qualification-test.${type}`, type, expected, category, title: type, description: "Test",
  severity: "error", score: 10, message: "Test", solution: "Test", enabled: true, version: "1.0.0",
});
const required = base("REQUIRED_SECTION", { section: "Giris", required: true });
const numbering = base("HEADING_NUMBERING", { sections: [{ section: "Giris", level: 0 }] });
const format = base("HEADING_LEVEL_FORMAT", { level: 0, fontFamily: "Times New Roman", fontSize: 12, bold: true });
const alignment = base("HEADING_ALIGNMENT", { levels: [0], alignment: "left" });
const legacy = base("HEADING", { level: "Heading1", fontFamily: "Times New Roman", fontSize: 12, bold: true }, "heading");
const conditional = base("CONDITIONAL_REQUIRED_SECTION", { section: "Giris", requiredWhen: { fact: "hasTables", equals: true } });
const rules = [required, numbering, format, alignment, legacy, conditional];
const registry = new ValidatorRegistry();
const validator = (rule) => registry.getValidator(rule);
const assess = (doc, rule = required) => validator(rule).assess(doc, rule);
const decide = (doc, rule = required) => decideRuleAssessment(assess(doc, rule));
const paragraph = (text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const table = '<w:tbl><w:tr><w:tc>' + paragraph("Cell") + '</w:tc></w:tr></w:tbl>';
const heading = (text = "1. Giris", style = "Heading1") =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:jc w:val="left"/></w:pPr>` +
  '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:b/></w:rPr>' +
  `<w:t>${text}</w:t></w:r></w:p>`;
const wrap = (body) => '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>';
function document(body = heading(), selectedRules = rules) {
  const parsed = parseDocumentXml(wrap(body));
  const styles = parseStylesXml('<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/></w:style></w:styles>');
  const numbered = normalizeDocumentNumbering({ ...parsed, styles: styles.styles, documentDefaults: styles.documentDefaults });
  const marked = markRequiredSectionHeadings(numbered, selectedRules);
  return normalizeAcademicSections(normalizeDocumentHeadings(marked, selectedRules), selectedRules);
}
let cases = 0;
function check(label, run) { run(); cases += 1; console.log(`PASS ${label}`); }

check("real structural section passes; name-only paragraph keeps legacy PASS but assessment is unknown", () => {
  assert.equal(decide(document()), "compliant");
  assert.equal(decide(document(heading("Giris"))), "compliant");
  const nameOnly = document(paragraph("Giris"));
  assert.equal(nameOnly.academicSections.occurrences[0].status, "declared");
  assert.ok(nameOnly.academicSections.occurrences[0].recognitionEvidence.includes("heading-style"));
  assert.equal(validator(required).validate(nameOnly, required).status, "PASSED");
  assert.equal(decide(nameOnly), "undetermined");
  assert.equal(assess(nameOnly).observations[0].identity.certainty, "unresolved");
  for (const rule of [numbering, alignment]) assert.equal(decide(nameOnly, rule), "undetermined");
});
check("manual numbering supports existing structural identity without needing a heading style", () => {
  assert.equal(decide(document(paragraph("1. Giris"))), "compliant");
});
check("confirmed missing required section is a violation only with closed candidate coverage", () => {
  const absent = document(paragraph("Body text"));
  assert.equal(assess(absent).coverage.population, "closed");
  assert.equal(decide(absent), "violation");
  absent.sections = [];
  assert.equal(assess(absent).coverage.population, "open");
  assert.equal(decide(absent), "undetermined");
  assert.equal(decide(document("")), "undetermined");
});
check("unresolved and ambiguous section identities never become confirmed presence", () => {
  for (const status of ["unresolved", "ambiguous"]) {
    const doc = document();
    doc.academicSections.occurrences[0].status = status;
    assert.equal(decide(doc), "undetermined");
    assert.equal(assess(doc).observations[0].identity.certainty, status);
  }
});
check("incomplete section source and partial cached occurrences cannot silently close coverage", () => {
  const doc = document();
  doc.sections = [];
  assert.equal(decide(doc), "undetermined");
  const second = { ...required, id: "second-required", expected: { section: "Yontem", required: true } };
  const cached = document(heading() + heading("2. Yontem"), [...rules, second]);
  cached.academicSections.occurrences = cached.academicSections.occurrences.slice(0, 1);
  assert.equal(assess(cached, second).coverage.population, "open");
  assert.equal(decide(cached, second), "undetermined");
});
check("explicit optional section provides genuine N/A; missing input or disabled rules do not", () => {
  const optional = { ...required, expected: { ...required.expected, required: false } };
  assert.equal(decide(document(paragraph("Body")), optional), "not-applicable");
  assert.ok(assess(document(), optional).applicability.evidence.length > 0);
  assert.equal(decide(document(), { ...required, enabled: false }), "undetermined");
});
check("confirmed heading targets and complete coverage support all four heading validators", () => {
  const doc = document();
  for (const rule of [numbering, format, alignment, legacy]) {
    assert.equal(decide(doc, rule), "compliant", rule.type);
    assert.equal(assess(doc, rule).coverage.population, "closed");
    assert.equal(assess(doc, rule).observations[0].identity.certainty, "confirmed");
  }
});
check("missing HEADING_NUMBERING anchors preserve silent legacy N/A but opt-in is undetermined", () => {
  const doc = document(heading(), rules.filter((rule) => rule.type !== "HEADING_NUMBERING"));
  assert.equal(doc.headings.length, 0);
  for (const rule of [numbering, format, alignment, legacy]) {
    assert.equal(validator(rule).validate(doc, rule).status, "NOT_APPLICABLE");
    assert.equal(decide(doc, rule), "undetermined");
    assert.equal(assess(doc, rule).coverage.population, "open");
  }
});
check("empty heading targets are not N/A without explicit applicability evidence", () => {
  const doc = document(paragraph("Body text"));
  for (const rule of [numbering, format, alignment, legacy]) assert.equal(decide(doc, rule), "undetermined");
  const docWithOnlyMain = document();
  assert.equal(decide(docWithOnlyMain, { ...format, expected: { level: 1, bold: true } }), "undetermined");
});
check("missing or duplicated named heading targets block compliance", () => {
  const partial = { ...numbering, expected: { sections: [...numbering.expected.sections, { section: "Yontem", level: 0 }] } };
  const doc = document(heading(), [...rules, partial]);
  assert.equal(validator(partial).validate(doc, partial).status, "PASSED");
  assert.equal(decide(doc, partial), "undetermined");
  assert.equal(decide(document(heading() + heading("2. Giris")), numbering), "undetermined");
  const named = { ...format, expected: { ...format.expected, sections: [{ section: "Giris" }, { section: "Yontem" }] } };
  assert.equal(decide(document(), named), "undetermined");
});
check("unrepresented structural heading candidates keep target population open", () => {
  const doc = document(heading() + heading("1.1 Kapsam", "Heading2"));
  assert.equal(doc.headings.length, 2);
  doc.headings = doc.headings.slice(0, 1);
  assert.equal(decide(doc, format), "undetermined");
  assert.equal(assess(doc, format).coverage.population, "open");
});
check("confirmed formatting and alignment mismatches are violations", () => {
  const doc = document();
  doc.paragraphs[0].runs[0].fontSize = 11;
  for (const rule of [format, legacy]) assert.equal(decide(doc, rule), "violation");
  doc.paragraphs[0].alignment = "center";
  assert.equal(decide(doc, alignment), "violation");
});
check("unknown formatting and alignment evidence stay undetermined", () => {
  const doc = document();
  doc.paragraphs[0].runs[0].fontSize = null;
  doc.paragraphs[0].alignment = null;
  for (const rule of [format, legacy, alignment]) assert.equal(decide(doc, rule), "undetermined");
  doc.paragraphs[0].runs[0].fontFamily = "Arial";
  doc.paragraphs[0].runs[0].fontFamilyReference = null;
  assert.equal(decide(doc, format), "violation");
});
check("confirmed numbering mismatch differs from unresolved Word numbering evidence", () => {
  const doc = document(heading("1.1 Giris"));
  assert.equal(decide(doc, numbering), "violation");
  const unnumbered = document(heading("Giris"));
  assert.equal(decide(unnumbered, numbering), "violation");
  doc.headings[0].numberingSource = "word";
  doc.headings[0].numId = "1";
  doc.headings[0].visibleLabel = null;
  assert.equal(decide(doc, numbering), "undetermined");
});
check("hierarchical numbering uses existing label semantics", () => {
  const hierarchical = { ...numbering, expected: { ...numbering.expected, requireHierarchicalLabels: true, maxLevel: 1 } };
  assert.equal(decide(document(heading() + heading("1.1 Kapsam", "Heading2")), hierarchical), "compliant");
  assert.equal(decide(document(heading() + heading("2.1 Kapsam", "Heading2")), hierarchical), "violation");
});
check("conditional section presence uses qualified sections and explicit condition proof", () => {
  const doc = document(heading() + table);
  assert.equal(decide(doc, conditional), "compliant");
  const nameOnly = document(paragraph("Giris") + table);
  assert.equal(decide(nameOnly, conditional), "undetermined");
  assert.equal(decide(document(), conditional), "undetermined");
  const inverse = { ...conditional, expected: { ...conditional.expected, requiredWhen: { fact: "hasTables", equals: false } } };
  assert.equal(decide(doc, inverse), "not-applicable");
});
check("assessment is opt-in, pure, and never calls validate", () => {
  const constructors = [RequiredSectionValidator, ConditionalRequiredSectionValidator, HeadingNumberingValidator,
    HeadingLevelFormatValidator, HeadingAlignmentValidator, HeadingValidator];
  for (const [index, rule] of [required, conditional, numbering, format, alignment, legacy].entries()) {
    const doc = document(heading() + table);
    const before = validator(rule).validate(doc, rule);
    const serialized = JSON.stringify(doc);
    assess(doc, rule);
    assert.deepEqual(validator(rule).validate(doc, rule), before);
    assert.equal(JSON.stringify(doc), serialized);
    const isolated = new constructors[index]();
    isolated.validate = () => { throw new Error("assess must not call validate"); };
    assert.equal(decideRuleAssessment(isolated.assess(doc, rule)), "compliant");
  }
});
check("engine never invokes assess and legacy scoring stays unchanged", () => {
  const doc = document(paragraph("Giris"));
  const engine = new RuleEngine(registry);
  const builder = new ReportBuilder();
  for (const rule of [required, numbering, format, alignment, legacy, conditional]) {
    const instance = validator(rule);
    const original = instance.assess;
    let calls = 0;
    instance.assess = function (...args) { calls += 1; return original.apply(this, args); };
    const before = engine.run(doc, [rule]);
    const report = builder.build(before);
    assert.equal(calls, 0);
    instance.assess(doc, rule);
    assert.deepEqual(engine.run(doc, [rule]), before);
    assert.deepEqual(builder.build(before), report);
    assert.equal(calls, 1);
    instance.assess = original;
  }
  assert.equal(builder.build(engine.run(doc, [required])).score, 100);
  assert.equal(decide(doc), "undetermined");
});
console.log(JSON.stringify({ audit: "sectionHeadingRuleAssessmentRegression", result: "PASS", cases, fixturesWritten: 0 }));
