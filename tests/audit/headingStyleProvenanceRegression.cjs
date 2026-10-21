const assert = require("node:assert/strict");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
const { normalizeDocumentNumbering } = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
const { normalizeDocumentHeadings, getHeadingStyleLevel } = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { StyleInheritanceResolver } = require("../../src/features/analysis/parsers/styleInheritanceResolver.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RequiredSectionValidator } = require("../../src/features/analysis/rules/validators/RequiredSectionValidator.ts");
const { ConditionalRequiredSectionValidator } = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const rule = { id: "provenance-test.required", type: "REQUIRED_SECTION", expected: { section: "Giris", required: true },
  category: "structure", title: "Test", description: "Test", severity: "error", score: 0, message: "", solution: "", enabled: true, version: "test" };
const anchor = { ...rule, id: "provenance-test.numbering", type: "HEADING_NUMBERING", expected: { sections: [{ section: "Giris", level: 0 }] } };
const format = { ...rule, id: "provenance-test.format", type: "HEADING_LEVEL_FORMAT", expected: { level: 0, bold: true } };
const alignment = { ...rule, id: "provenance-test.alignment", type: "HEADING_ALIGNMENT", expected: { levels: [0], alignment: "left" } };
const conditional = { ...rule, id: "provenance-test.conditional", type: "CONDITIONAL_REQUIRED_SECTION", expected: { section: "Giris", requiredWhen: { fact: "hasTables", equals: true } } };
const style = (id, { name = id, basedOn = null, outline, type = "paragraph", custom } = {}) =>
  `<w:style w:type="${type}" w:styleId="${id}"${custom === undefined ? "" : ` w:customStyle="${custom}"`}><w:name w:val="${name}"/>${basedOn === null ? "" : `<w:basedOn w:val="${basedOn}"/>`}${outline === undefined ? "" : `<w:pPr><w:outlineLvl w:val="${outline}"/></w:pPr>`}</w:style>`;
const genuine = style("Heading1", { name: "Heading 1" });
const p = (text = "Giris", id = null, outline) => `<w:p><w:pPr>${id === null ? "" : `<w:pStyle w:val="${id}"/>`}${outline === undefined ? "" : `<w:outlineLvl w:val="${outline}"/>`}<w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
const table = '<w:tbl><w:tr><w:tc>' + p("Cell") + '</w:tc></w:tr></w:tbl>';
function doc(body = p("Giris", "Heading1"), definitions = genuine, selectedRule = rule) {
  const parsed = parseDocumentXml(`<w:document xmlns:w="${w}"><w:body>${body}</w:body></w:document>`);
  const styles = parseStylesXml(`<w:styles xmlns:w="${w}">${definitions}</w:styles>`);
  const rules = [selectedRule, anchor, format, alignment];
  const numbered = normalizeDocumentNumbering({ ...parsed, styles: styles.styles, documentDefaults: styles.documentDefaults });
  return normalizeAcademicSections(normalizeDocumentHeadings(markRequiredSectionHeadings(numbered, rules), rules), rules);
}
const validator = new RequiredSectionValidator();
const assess = (document, selectedRule = rule) => selectedRule.type === "CONDITIONAL_REQUIRED_SECTION"
  ? new ConditionalRequiredSectionValidator().assess(document, selectedRule) : validator.assess(document, selectedRule);
const decide = (document, selectedRule = rule) => decideRuleAssessment(assess(document, selectedRule));
const provenance = (document) => document.academicSections.occurrences[0].structuralIdentity.headingProvenance;
let cases = 0;
const documents = [];
function check(label, run) { run(); cases++; console.log(`PASS ${label}`); }
function expect(document, decision) { documents.push(document); assert.equal(decide(document), decision); return document; }
check("Sprint 15 misleading display-name substring with outline 9 is undetermined, never absence", () => {
  for (const outline of [undefined, "9"]) {
    const document = expect(doc(p("Giris", "Quote"), style("Quote", { name: "Quotation Heading1 Example", outline })), "undetermined");
    assert.equal(assess(document).coverage.population, "closed");
    assert.equal(assess(document).observations[0].state, "undetermined");
    assert.equal(provenance(document).certainty, "non-heading");
    assert.equal(provenance(document).level, null);
    assert.equal(validator.validate(document, rule).status, "PASSED");
  }
});
check("misleading style ID and display-name-only canonical tokens are not independent proof", () => {
  expect(doc(p("Giris", "NotHeading1Example"), style("NotHeading1Example")), "undetermined");
  expect(doc(p("Giris", "Quote"), style("Quote", { name: "Heading 1" })), "undetermined");
});
check("genuine unnumbered Heading1 with complete paragraph definition is compliant", () => {
  const document = expect(doc(), "compliant");
  assert.equal(provenance(document).source, "heading-style");
  assert.equal(provenance(document).level, 0);
});
check("explicit paragraph outline level confirms a manual unnumbered heading", () => {
  const document = expect(doc(p("Giris", null, "0"), ""), "compliant");
  assert.equal(document.paragraphs[0].outlineLevel, 0);
  assert.equal(provenance(document).source, "paragraph-outline");
  expect(doc(p("Giris", "Body", "0"), style("Body", { outline: "9" })), "compliant");
});
check("explicit custom style outline and inherited outline retain their provenance", () => {
  const document = expect(doc(p("Giris", "Child"), style("Child", { basedOn: "Base", custom: "1" }) + style("Base", { outline: "0", custom: "1" })), "compliant");
  assert.equal(provenance(document).source, "style-outline");
  assert.deepEqual(provenance(document).styleIds, ["Child", "Base"]);
});
check("valid paragraph style inheritance reaches genuine heading semantics", () => {
  const document = expect(doc(p("Giris", "Child"), style("Child", { basedOn: "Heading1", custom: "1" }) + genuine), "compliant");
  assert.deepEqual(provenance(document).styleIds, ["Child", "Heading1"]);
});
check("broken inheritance is unresolved even after a heading ID has been found", () => {
  expect(doc(p("Giris", "Child"), style("Child", { basedOn: "Missing" })), "undetermined");
  const document = expect(doc(p("Giris", "Heading1"), style("Heading1", { basedOn: "Missing" })), "undetermined");
  assert.equal(provenance(document).certainty, "unresolved");
});
check("cyclic inheritance never supplies confirmed heading provenance", () => {
  const definitions = style("Child", { basedOn: "Heading1" }) + style("Heading1", { basedOn: "Child" });
  const document = expect(doc(p("Giris", "Child"), definitions), "undetermined");
  assert.match(provenance(document).reason, /cyclic/);
});
check("missing style definitions remain unresolved including explicit outline overrides", () => {
  expect(doc(p("Giris", "Heading1"), ""), "undetermined");
  expect(doc(p("Giris", "Missing", "0"), ""), "undetermined");
});
check("non-paragraph and duplicate style definitions cannot prove heading identity", () => {
  for (const type of ["character", "table", "numbering", "unknown"]) {
    expect(doc(p("Giris", "Heading1"), style("Heading1", { type })), "undetermined");
    expect(doc(p("Giris", "Child"), style("Child", { basedOn: "Heading1" }) + style("Heading1", { type })), "undetermined");
  }
  expect(doc(p("Giris", "Heading1"), genuine + genuine), "undetermined");
});
check("custom style masquerading as a canonical ID requires independent evidence", () => {
  expect(doc(p("Giris", "Heading1"), style("Heading1", { custom: "1" })), "undetermined");
  expect(doc(p("Giris", "Heading1"), style("Heading1", { custom: "1", outline: "0" })), "compliant");
});
check("outline 9 cannot be a heading level or become a confirmed violation", () => {
  for (const document of [doc(p("Giris", null, "9"), ""), doc(p("Giris", "Body"), style("Body", { outline: "9" })), doc(p("Giris", "Heading1", "9"))]) {
    expect(document, "undetermined");
    assert.equal(provenance(document).level, null);
  }
});
check("conflicting outline, canonical ID/name and inheritance evidence remain ambiguous", () => {
  for (const document of [doc(p("Giris", "Heading1", "1")), doc(p("Giris", "Heading1"), style("Heading1", { name: "Heading 2" })), doc(p("Giris", "Heading1"), style("Heading1", { outline: "2" })), doc(p("Giris", "Heading1"), style("Heading1", { basedOn: "Heading2" }) + style("Heading2"))]) {
    expect(document, "undetermined");
    assert.equal(provenance(document).certainty, "ambiguous");
  }
});
check("outline inheritance respects a nearer valid override on custom styles", () => {
  expect(doc(p("Giris", "Child"), style("Child", { basedOn: "Base", outline: "0" }) + style("Base", { outline: "1" })), "compliant");
});
check("malformed outline evidence is not coerced to zero or inherited away", () => {
  for (const outline of ["", " ", "x", "-1", "10", "0.5"]) {
    const document = expect(doc(p("Giris", "Heading1", outline)), "undetermined");
    assert.equal(document.paragraphs[0].outlineLevel, null);
    expect(doc(p("Giris", "Heading1"), style("Heading1", { outline })), "undetermined");
  }
  const duplicate = p("Giris", "Heading1", "0").replace('</w:pPr>', '<w:outlineLvl w:val="0"/></w:pPr>');
  expect(doc(duplicate), "undetermined");
});
check("manual numbering remains independent, while plain unnumbered name hits stay unknown", () => {
  expect(doc(p("1. Giris"), ""), "compliant");
  expect(doc(p("Giris"), ""), "undetermined");
  expect(doc(p("1. Giris", null, "9"), ""), "undetermined");
});
check("nested heading semantics and numbered-style conflicts retain Sprint 14 uncertainty", () => {
  expect(doc(p("Giris", "Heading2"), style("Heading2")), "undetermined");
  expect(doc(p("Giris", null, "1"), ""), "undetermined");
  expect(doc(p("1.1 Giris", "Heading1")), "undetermined");
});
check("TOC and deleted revisions cannot establish presence; closed absence remains a violation", () => {
  expect(doc(p("Giris", "TOC1") + p("Body"), style("TOC1")), "violation");
  expect(doc('<w:del>' + p("Giris", "Heading1") + '</w:del>' + p("Body")), "violation");
  expect(doc(p("Body")), "violation");
});
check("table/textbox and unreadable carriers keep Sprint 13 coverage open", () => {
  for (const body of ['<w:tbl><w:tr><w:tc>' + p("Giris", "Heading1") + '</w:tc></w:tr></w:tbl>', '<w:p><w:r><w:pict><w:txbxContent>' + p("Giris", "Heading1") + '</w:txbxContent></w:pict></w:r></w:p>', p("Giris", "Heading1") + '<w:altChunk/>']) {
    const document = expect(doc(body), "undetermined");
    assert.equal(assess(document).coverage.population, "open");
  }
});
check("conditional assessment and cached provenance recheck use the same recovered evidence", () => {
  const document = doc(p("Giris", "Quote") + table, style("Quote", { name: "Quotation Heading1 Example", outline: "9" }), conditional);
  assert.equal(decide(document, conditional), "undetermined");
  const stale = doc();
  stale.styles[0].outlineLevel = 9;
  expect(stale, "undetermined");
});
check("legacy heading discovery, numbering, format, validate and scoring remain isolated", () => {
  const misleading = doc(p("Giris", "Quote"), style("Quote", { name: "Quotation Heading1 Example", outline: "9" }));
  assert.equal(getHeadingStyleLevel("Quote", new StyleInheritanceResolver(misleading.styles)), 0);
  assert.equal(misleading.headings[0].level, 0);
  assert.equal(validator.validate(misleading, rule).status, "PASSED");
  const engine = new RuleEngine();
  const builder = new ReportBuilder();
  for (const document of [...documents, misleading]) {
    const before = JSON.stringify(document);
    const results = engine.run(document, [rule, anchor, format, alignment]);
    const report = builder.build(results);
    const isolated = new RequiredSectionValidator();
    isolated.validate = () => { throw new Error("legacy validate called"); };
    isolated.assess(document, rule);
    assert.equal(JSON.stringify(document), before);
    assert.deepEqual(engine.run(document, [rule, anchor, format, alignment]), results);
    assert.deepEqual(builder.build(results), report);
  }
});
console.log(JSON.stringify({ audit: "headingStyleProvenanceRegression", result: "PASS", cases, fixtureWrites: 0 }));
