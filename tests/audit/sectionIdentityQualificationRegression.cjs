const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const required = { id: "identity-test.required", type: "REQUIRED_SECTION", expected: { section: "Giris", aliases: ["Introduction"], required: true },
  category: "structure", title: "Giris", description: "Test", severity: "error", score: 10, message: "Test", solution: "Test", enabled: true, version: "1" };
const conditional = { ...required, id: "identity-test.conditional", type: "CONDITIONAL_REQUIRED_SECTION",
  expected: { section: "Giris", requiredWhen: { fact: "hasTables", equals: true } } };
const anchor = { ...required, id: "identity-test.anchor", type: "HEADING_NUMBERING", expected: { sections: [{ section: "Giris", level: 0 }] } };
const rules = [required, conditional, anchor];
const p = (text, style = null) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const table = (body) => `<w:tbl><w:tr><w:tc>${body}</w:tc></w:tr></w:tbl>`;
const textbox = (body) => `<w:p><w:r><w:pict><w:txbxContent>${body}</w:txbxContent></w:pict></w:r></w:p>`;
const wrap = (body) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x="urn:unsupported"><w:body>${body}</w:body></w:document>`;
function doc(body, selectedRules = rules) {
  const parsed = parseDocumentXml(wrap(body));
  const styles = parseStylesXml('<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="TOC 1"/></w:style></w:styles>');
  const numbered = normalizeDocumentNumbering({ ...parsed, styles: styles.styles });
  return normalizeAcademicSections(normalizeDocumentHeadings(markRequiredSectionHeadings(numbered, selectedRules), selectedRules), selectedRules);
}
const requiredValidator = new RequiredSectionValidator();
const conditionalValidator = new ConditionalRequiredSectionValidator();
const validator = (rule) => rule.type === "CONDITIONAL_REQUIRED_SECTION" ? conditionalValidator : requiredValidator;
const assess = (document, rule = required) => validator(rule).assess(document, rule);
const decision = (document, rule = required) => decideRuleAssessment(assess(document, rule));
const samples = [
  p("Giris", "Heading1"), p("Giris"), table(p("Giris", "Heading1")), textbox(p("Giris", "Heading1")),
  p("Other", "Heading1") + p("1.1 Giris", "Heading2"), p("1.1 Giris", "Heading1"),
  p("Giris", "TOC1"), '<w:del>' + p("Giris", "Heading1") + '</w:del>' + p("Body"),
  p("Giris", "Heading1") + p("Giris", "Heading1"), p("Body"),
  '<w:p><w:r>' + p("Giris", "Heading1") + '</w:r></w:p>',
];
const legacyResults = samples.flatMap((body) => {
  const document = doc(body);
  return [requiredValidator.validate(document, required), conditionalValidator.validate(document, conditional)];
});
const legacyDigest = crypto.createHash("sha256").update(JSON.stringify(legacyResults)).digest("hex");
if (process.argv.includes("--audit-current")) {
  console.log(JSON.stringify({ legacyDigest, samples: samples.map((body) => {
    const document = doc(body);
    return { decision: decision(document), legacy: requiredValidator.validate(document, required).status, coverage: assess(document).coverage.population };
  }) }));
} else {
  let cases = 0;
  function check(label, run) { run(); cases += 1; console.log(`PASS ${label}`); }
  const qualification = (document) => document.academicSections.occurrences[0].structuralIdentity;
  check("confirmed body section has independent structure and traceable provenance", () => {
    const document = doc(p("Giris", "Heading1"));
    assert.equal(decision(document), "compliant");
    assert.equal(qualification(document).certainty, "confirmed");
    for (const signal of ["body-paragraph", "current-revision", "paragraph-block", "heading-style"]) {
      assert.ok(qualification(document).evidence.includes(signal), signal);
    }
    assert.ok(assess(document).observations[0].identity.evidence.some((item) => item.kind === "document-format" && item.property === "academic-section.structural-identity"));
    assert.equal(decision(doc(p("1. Giris"))), "compliant");
  });
  check("name and rule-created anchors do not prove section identity", () => {
    const document = doc(p("Giris"));
    assert.equal(document.headings[0].isRuleDefinedSection, true);
    assert.equal(document.academicSections.occurrences[0].status, "declared");
    assert.equal(qualification(document).certainty, "unresolved");
    assert.equal(decision(document), "undetermined");
    assert.equal(requiredValidator.validate(document, required).status, "PASSED");
  });
  for (const [label, carrier] of [["table-cell", table], ["textbox", textbox]]) {
    check(`${label} headings remain unsupported candidates with open coverage`, () => {
      const document = doc(p("Body") + carrier(p("Giris", "Heading1")));
      assert.equal(document.academicSections.occurrences.length, 0);
      assert.equal(assess(document).coverage.population, "open");
      assert.equal(decision(document), "undetermined");
    });
  }
  check("nested hierarchy cannot be promoted by a matching name or forced anchor level", () => {
    const document = doc(p("Other", "Heading1") + p("1.1 Giris", "Heading2"));
    assert.equal(document.headings[0].level, 0);
    assert.equal(qualification(document).certainty, "ambiguous");
    assert.ok(qualification(document).evidence.includes("nested-heading"));
    assert.equal(decision(document), "undetermined");
  });
  check("conflicting style and numbering levels remain ambiguous", () => {
    const document = doc(p("1.1 Giris", "Heading1"));
    assert.equal(decision(document), "undetermined");
    assert.ok(qualification(document).evidence.includes("conflicting-heading-levels"));
  });
  check("nested OOXML paragraphs and unknown wrappers cannot acquire confirmed identity", () => {
    for (const body of ['<w:p><w:r>' + p("Giris", "Heading1") + '</w:r></w:p>', '<x:carrier>' + p("Giris", "Heading1") + '</x:carrier>']) {
      const document = doc(body);
      assert.equal(decision(document), "undetermined");
      assert.notEqual(qualification(document).certainty, "confirmed");
    }
  });
  check("TOC entries are not academic sections and closed absence is a violation", () => {
    const document = doc(p("Giris", "TOC1") + p("Body"));
    assert.equal(document.academicSections.occurrences.length, 0);
    assert.equal(decision(document), "violation");
    assert.equal(assess(document).coverage.population, "closed");
  });
  check("TOC field results cannot be confirmed through an academic heading style", () => {
    const complex = '<w:p><w:r><w:fldChar w:fldCharType="begin"/><w:instrText> TOC </w:instrText><w:fldChar w:fldCharType="separate"/></w:r></w:p>' +
      p("Giris", "Heading1") + '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' + p("Body");
    assert.equal(decision(doc(complex)), "violation");
    const simple = doc('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:fldSimple w:instr=" TOC "><w:r><w:t>Giris</w:t></w:r></w:fldSimple></w:p>');
    assert.equal(simple.paragraphs[0].sectionContext.isTocResult, true);
    assert.equal(decision(simple), "undetermined");
    assert.notEqual(qualification(simple).certainty, "confirmed");
  });
  check("unknown Word numbering cannot be overridden by a heading style", () => {
    const document = doc('<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="42"/></w:numPr></w:pPr><w:r><w:t>Giris</w:t></w:r></w:p>');
    assert.equal(document.paragraphs[0].numbering.source, "word");
    assert.equal(document.paragraphs[0].numbering.visibleLabel, null);
    assert.equal(decision(document), "undetermined");
  });
  check("deleted and moveFrom revisions cannot establish academic identity", () => {
    for (const revision of ["del", "moveFrom"]) {
      const document = doc(`<w:${revision}>${p("Giris", "Heading1")}</w:${revision}>` + p("Body"));
      assert.equal(document.paragraphs[0].sectionContext.revision, "deleted");
      assert.equal(document.academicSections.occurrences.length, 0);
      assert.equal(decision(document), "violation");
    }
  });
  check("active MCE fallback retains body structure; unresolved branches retain open coverage", () => {
    const document = doc('<mc:AlternateContent><mc:Choice Requires="x">' + p("Giris", "Heading2") + '</mc:Choice><mc:Fallback>' + p("Giris", "Heading1") + '</mc:Fallback></mc:AlternateContent>');
    assert.equal(decision(document), "compliant");
    assert.equal(decision(doc(p("Body") + '<mc:AlternateContent><mc:Choice Requires="x">' + p("Giris") + '</mc:Choice></mc:AlternateContent>')), "undetermined");
  });
  check("multiple competing occurrences cannot silently confirm one academic identity", () => {
    const document = doc(p("Giris", "Heading1") + p("Introduction", "Heading1"));
    assert.equal(decision(document), "undetermined");
    assert.ok(document.academicSections.occurrences.every((item) => item.structuralIdentity.certainty === "ambiguous"));
    const collision = { ...required, id: "other-section", expected: { section: "Other", aliases: ["Giris"], required: true } };
    assert.equal(decision(doc(p("Giris", "Heading1"), [...rules, collision])), "undetermined");
  });
  check("missing current context or stale structural metadata cannot authorize compliance", () => {
    const document = doc(p("Giris", "Heading1"));
    delete document.paragraphs[0].sectionContext;
    assert.equal(decision(document), "undetermined");
    const stale = doc(p("Giris", "Heading1"));
    stale.paragraphs[0].styleId = null;
    assert.equal(stale.academicSections.occurrences[0].structuralIdentity.certainty, "confirmed");
    assert.equal(decision(stale), "undetermined");
    const detached = doc(p("Giris", "Heading1"));
    detached.blocks = [];
    assert.equal(decision(detached), "undetermined");
  });
  check("confirmed absence requires complete coverage; presence does not mask unknown carriers", () => {
    assert.equal(decision(doc(p("Body"))), "violation");
    for (const body of [p("Body"), p("Giris", "Heading1")]) {
      assert.equal(decision(doc(body + '<w:altChunk/>')), "undetermined");
      assert.equal(decision(doc(body + table(p("Giris")))) , "undetermined");
    }
    const document = doc(p("Body"));
    delete document.sectionExtractionCoverage;
    assert.equal(decision(document), "undetermined");
  });
  check("conditional required sections reuse qualified identity without changing applicability", () => {
    assert.equal(decision(doc(p("Giris", "Heading1") + table(p("Cell"))), conditional), "compliant");
    assert.equal(decision(doc(p("1.1 Giris", "Heading2") + table(p("Cell"))), conditional), "undetermined");
    assert.equal(decision(doc(p("Body") + table(p("Cell"))), conditional), "violation");
    assert.equal(decision(doc(p("Body")), conditional), "undetermined");
  });
  check("legacy outputs match pre-change audit; assessment is pure and isolated from scoring", () => {
    assert.equal(legacyDigest, "06460d6061a574c121284a36b9d4298ecc53d1e67b96096f51629363a6464bfb");
    for (const body of samples) {
      const document = doc(body);
      const before = JSON.stringify(document);
      const engine = new RuleEngine();
      const builder = new ReportBuilder();
      const results = engine.run(document, [required, conditional]);
      const report = builder.build(results);
      const isolated = new RequiredSectionValidator();
      isolated.validate = () => { throw new Error("validate called"); };
      isolated.assess(document, required);
      conditionalValidator.assess(document, conditional);
      assert.equal(JSON.stringify(document), before);
      assert.deepEqual(engine.run(document, [required, conditional]), results);
      assert.deepEqual(builder.build(results), report);
    }
  });
  console.log(JSON.stringify({ audit: "sectionIdentityQualificationRegression", result: "PASS", cases, legacyDigest, fixturesWritten: 0 }));
}
