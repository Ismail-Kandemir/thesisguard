const assert = require("node:assert/strict");
const crypto = require("node:crypto");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
const { normalizeDocumentNumbering } = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RequiredSectionValidator } = require("../../src/features/analysis/rules/validators/RequiredSectionValidator.ts");
const { ConditionalRequiredSectionValidator } = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");
const required = { id: "coverage-test.required", type: "REQUIRED_SECTION", expected: { section: "Giris", aliases: ["Introduction"], required: true },
  category: "structure", title: "Giris", description: "Test", severity: "error", score: 10, message: "Test", solution: "Test", enabled: true, version: "1" };
const conditional = { ...required, id: "coverage-test.conditional", type: "CONDITIONAL_REQUIRED_SECTION",
  expected: { section: "Giris", requiredWhen: { fact: "hasTables", equals: true } } };
const p = (text, structural = false) => `<w:p>${structural ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const table = (content) => `<w:tbl><w:tr><w:tc>${content}</w:tc></w:tr></w:tbl>`;
const textbox = (content) => `<w:p><w:r><w:pict><w:txbxContent>${content}</w:txbxContent></w:pict></w:r></w:p>`;
const wrap = (body) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x="urn:unsupported" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>${body}</w:body></w:document>`;
function doc(body) {
  const parsed = parseDocumentXml(wrap(body));
  const styles = parseStylesXml('<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>');
  return normalizeAcademicSections(markRequiredSectionHeadings(normalizeDocumentNumbering({ ...parsed, styles: styles.styles }), [required, conditional]), [required, conditional]);
}
const validator = new RequiredSectionValidator();
const conditionalValidator = new ConditionalRequiredSectionValidator();
const assess = (document, rule = required) => (rule.type === "CONDITIONAL_REQUIRED_SECTION" ? conditionalValidator : validator).assess(document, rule);
const decision = (document, rule = required) => decideRuleAssessment(assess(document, rule));
const samples = [p("Giris", true), p("Giris"), table(p("Giris", true)), textbox(p("Giris", true)), table(p("Cell")), p("Body"), p("Giris", true) + table(p("Giris"))];
const legacy = samples.flatMap((body) => {
  const document = doc(body);
  return [validator.validate(document, required), conditionalValidator.validate(document, conditional)];
});
const legacyDigest = crypto.createHash("sha256").update(JSON.stringify(legacy)).digest("hex");
if (process.argv.includes("--audit-current")) {
  console.log(JSON.stringify({ legacyDigest, samples: samples.map((body) => {
    const document = doc(body);
    return { decision: decision(document), population: assess(document).coverage.population, paragraphs: document.paragraphs.length, occurrences: document.academicSections.occurrences.length };
  }) }));
} else {
  let cases = 0;
  function check(label, run) { run(); cases += 1; console.log(`PASS ${label}`); }
  check("normal structural section is compliant; name-only identity stays unresolved", () => {
    assert.equal(decision(doc(p("Giris", true))), "compliant");
    const nameOnly = doc(p("Giris"));
    assert.equal(decision(nameOnly), "undetermined");
    assert.equal(assess(nameOnly).observations[0].identity.certainty, "unresolved");
  });
  for (const [label, carrier] of [["table-cell", table], ["textbox", textbox]]) {
    check(`${label} relevant heading cannot establish identity or confirmed absence`, () => {
      for (const text of ["Giris", "1. Giris", "Introduction"]) {
        const document = doc(p("Body") + carrier(p(text, true)));
        assert.equal(document.academicSections.occurrences.length, 0);
        assert.equal(assess(document).coverage.population, "open");
        assert.equal(decision(document), "undetermined");
        assert.ok(assess(document).coverage.unresolvedSubjects.some((subject) => subject.kind === "paragraph"));
        assert.ok(!assess(document).observations.some((item) => item.state === "confirmed" && item.finding === "violation"));
        assert.equal(validator.validate(document, required).status, "FAILED");
      }
    });
    check(`${label} name-only candidates also leave coverage open`, () => {
      assert.equal(decision(doc(p("Body") + carrier(p("Giris")))), "undetermined");
    });
  }
  check("excluded unrelated text is documented without inventing section identity", () => {
    const document = doc(p("Body") + table(p("Cell")) + textbox(p("A note")));
    assert.equal(assess(document).coverage.population, "closed");
    assert.equal(decision(document), "violation");
    assert.equal(document.academicSections.occurrences.length, 0);
    assert.ok(assess(document).coverage.excludedSubjects.length >= 2);
  });
  check("confirmed presence cannot mask additional unresolved relevant carriers", () => {
    const document = doc(p("Giris", true) + table(p("Giris")) + textbox(p("Introduction")));
    assert.equal(assess(document).observations[0].identity.certainty, "confirmed");
    assert.equal(assess(document).coverage.unresolvedSubjects.length, 2);
    assert.equal(decision(document), "undetermined");
    assert.equal(validator.validate(document, required).status, "PASSED");
  });
  check("genuinely closed absence is a violation; unknown source coverage is not", () => {
    const document = doc(p("Body"));
    assert.equal(decision(document), "violation");
    delete document.sectionExtractionCoverage;
    assert.equal(decision(document), "undetermined");
    assert.equal(assess(document).coverage.population, "open");
  });
  check("unreadable OOXML carriers prevent document-wide absence and compliance", () => {
    const unsupported = ['<w:altChunk/>', '<w:subDoc/>', '<w:contentPart/>', '<mc:AlternateContent><mc:Choice Requires="x">' + p("Giris") + '</mc:Choice></mc:AlternateContent>', '<w:p><w:r><w:drawing><a:t>Giris</a:t></w:drawing></w:r></w:p>', '<x:heading>Giris</x:heading>', '<w:t>Giris</w:t>'];
    for (const carrier of unsupported) {
      for (const body of [p("Body"), p("Giris", true)]) {
        const document = doc(body + carrier);
        assert.equal(decision(document), "undetermined", carrier);
        assert.equal(assess(document).coverage.population, "open");
      }
    }
  });
  check("inactive MCE choice is not confused with an unexamined active carrier", () => {
    const document = doc(p("Body") + '<mc:AlternateContent><mc:Choice Requires="x"><w:altChunk/></mc:Choice><mc:Fallback>' + p("Note") + '</mc:Fallback></mc:AlternateContent>');
    assert.equal(decision(document), "violation");
  });
  check("missing body and partial candidate inventory cannot prove absence", () => {
    assert.equal(decision(parseDocumentXml('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>')), "undetermined");
    const document = doc(p("Body"));
    document.sections = [];
    assert.equal(decision(document), "undetermined");
  });
  check("conditional required section inherits carrier coverage integrity", () => {
    assert.equal(decision(doc(p("Giris", true) + table(p("Cell"))), conditional), "compliant");
    assert.equal(decision(doc(table(p("Giris", true))), conditional), "undetermined");
    assert.equal(decision(doc(table(p("Cell"))), conditional), "violation");
    assert.equal(decision(doc(p("Body")), conditional), "undetermined");
    const inverse = { ...conditional, expected: { ...conditional.expected, requiredWhen: { fact: "hasTables", equals: false } } };
    assert.equal(decision(doc(table(p("Giris"))), inverse), "not-applicable");
  });
  check("explicit optional requirement alone permits N/A", () => {
    const optional = { ...required, expected: { ...required.expected, required: false } };
    assert.equal(decision(doc(table(p("Giris"))), optional), "not-applicable");
    assert.equal(decision(doc(table(p("Giris")))), "undetermined");
  });
  check("legacy output matches pre-fix audit and assessment never calls validate or mutates input", () => {
    assert.equal(legacyDigest, "e596f4e997bd7e8dc40b9618b969844832638f6363924cb52145d39f54d72f39");
    for (const body of samples) {
      const document = doc(body);
      const before = JSON.stringify(document);
      const isolated = new RequiredSectionValidator();
      isolated.validate = () => { throw new Error("legacy validate called"); };
      isolated.assess(document, required);
      assert.equal(JSON.stringify(document), before);
    }
  });
  console.log(JSON.stringify({ audit: "sectionCoverageIntegrityRegression", result: "PASS", cases, legacyDigest, fixturesWritten: 0 }));
}
