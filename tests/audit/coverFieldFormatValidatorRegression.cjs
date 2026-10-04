require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeCoverSemantics,
} = require("../../src/features/analysis/parsers/coverSemanticsNormalizer.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");

const COMPUTER_SELECTION = {
  universityId: "comu",
  facultyId: "engineering",
  departmentId: "computer-engineering",
  thesisTypeId: "bachelor",
};

const FOOD_SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

function main() {
  assertCorrectFormattingPass();
  assertWrongFontFails();
  assertWrongSizeFails();
  assertNotBoldFails();
  assertMixedRunsDoNotFalsePass();
  assertAmbiguousAndUnknownFieldDoNotPass();
  assertWrongCoverScopeFails();
  assertSyntheticSecondUniversityGenericDispatch();
  assertProductionFormatRulesAndBaselines();

  console.log(JSON.stringify({
    phase: "cover-semantics-sprint-5",
    result: "PASS",
    audit: "coverFieldFormatValidatorRegression.cjs",
  }, null, 2));
}

function assertCorrectFormattingPass() {
  const document = semanticDocument(
    coverParagraph("Çanakkale Onsekiz Mart Üniversitesi") +
      pageBreakParagraph() +
      coverParagraph("Çanakkale Onsekiz Mart Üniversitesi") +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, formatRule("outer-cover", "institution"), "PASSED", "outer institution format pass");
  assertStatus(document, formatRule("inner-cover", "institution"), "PASSED", "inner institution format pass");
  assertStatus(document, formatRule("inner-cover", "work-type"), "PASSED", "inner work-type format pass");
}

function assertWrongFontFails() {
  const document = semanticDocument(
    formattedParagraph("Çanakkale Onsekiz Mart Üniversitesi", {
      fontFamily: "Arial",
      fontSize: 12,
      bold: true,
    }) +
      pageBreakParagraph() +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, formatRule("outer-cover", "institution"), "FAILED", "wrong font fail");
}

function assertWrongSizeFails() {
  const document = semanticDocument(
    formattedParagraph("Çanakkale Onsekiz Mart Üniversitesi", {
      fontFamily: "Times New Roman",
      fontSize: 14,
      bold: true,
    }) +
      pageBreakParagraph() +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, formatRule("outer-cover", "institution"), "FAILED", "wrong size fail");
}

function assertNotBoldFails() {
  const document = semanticDocument(
    formattedParagraph("Çanakkale Onsekiz Mart Üniversitesi", {
      fontFamily: "Times New Roman",
      fontSize: 12,
      bold: false,
    }) +
      pageBreakParagraph() +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, formatRule("outer-cover", "institution"), "FAILED", "not bold fail");
}

function assertMixedRunsDoNotFalsePass() {
  const document = semanticDocument(
    splitFormattedParagraph([
      { text: "Çanakkale Onsekiz Mart ", fontFamily: "Times New Roman", fontSize: 12, bold: true },
      { text: "Üniversitesi", fontFamily: "Arial", fontSize: 12, bold: true },
    ]) +
      pageBreakParagraph() +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, formatRule("outer-cover", "institution"), "FAILED", "mixed run false pass blocked");
}

function assertAmbiguousAndUnknownFieldDoNotPass() {
  const unknownDocument = semanticDocument(
    coverParagraph("Çanakkale Onsekiz Mart Üniversitesi"),
  );

  assertStatus(unknownDocument, formatRule("unknown", "institution"), "FAILED", "unknown occurrence false pass blocked");

  const ambiguousDocument = {
    ...semanticDocument(coverParagraph("Çanakkale Onsekiz Mart Üniversitesi") + pageBreakParagraph()),
    coverSemantics: {
      boundaryEvidence: [],
      occurrences: [{
        id: "cover-ambiguous",
        scope: "outer-cover",
        confidence: "medium",
        startParagraphIndex: 0,
        endParagraphIndex: 0,
        boundaryEvidenceIds: [],
        fieldOccurrenceIds: ["cover-ambiguous-field-1"],
        evidence: ["synthetic-ambiguous-cover"],
        sourcePart: "word/document.xml",
      }],
      fields: [{
        id: "cover-ambiguous-field-1",
        field: "institution",
        value: "Çanakkale Onsekiz Mart Üniversitesi",
        normalizedValue: "canakkaleonsekizmartuniversitesi",
        paragraphId: "paragraph-1",
        paragraphIndex: 0,
        coverOccurrenceId: "cover-ambiguous",
        confidence: "high",
        evidence: ["institution-pattern"],
        sourcePart: "word/document.xml",
      }],
    },
  };

  assertStatus(ambiguousDocument, formatRule("outer-cover", "institution"), "FAILED", "ambiguous occurrence false pass blocked");
}

function assertWrongCoverScopeFails() {
  const document = semanticDocument(
    coverParagraph("Çanakkale Onsekiz Mart Üniversitesi") +
      pageBreakParagraph() +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, formatRule("inner-cover", "institution"), "FAILED", "wrong cover scope fail");
}

function assertSyntheticSecondUniversityGenericDispatch() {
  const document = semanticDocument(
    coverParagraph("Çanakkale Onsekiz Mart Üniversitesi") +
      pageBreakParagraph() +
      coverParagraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );
  const result = runRule(document, {
    ...formatRule("inner-cover", "work-type"),
    id: "second-university.engineering.software-engineering.bachelor.inner-cover-work-type-format",
  });

  assertEqual(result.status, "PASSED", "second-university generic cover format validator pass");
}

function assertProductionFormatRulesAndBaselines() {
  const computerRules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const foodRules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const formatRuleIds = computerRules
    .filter((rule) => rule.type === "COVER_FIELD_FORMAT")
    .map((rule) => rule.id)
    .sort();

  assertDeepEqual(
    formatRuleIds,
    [
      "comu.engineering.computer-engineering.bachelor.inner-cover-institution-format",
      "comu.engineering.computer-engineering.bachelor.inner-cover-work-type-format",
      "comu.engineering.computer-engineering.bachelor.outer-cover-institution-format",
    ],
    "production computer cover format rules",
  );
  assertEqual(computerRules.length, 47, "computer engineering rule count");
  assertEqual(foodRules.length, 46, "food technology rule count");
}

function semanticDocument(bodyXml) {
  const xml = wrapDocumentXml(bodyXml);
  return normalizeCoverSemantics(parseDocumentXml(xml), xml);
}

function assertStatus(document, rule, expectedStatus, message) {
  assertEqual(runRule(document, rule).status, expectedStatus, message);
}

function runRule(document, rule) {
  return new RuleEngine().run(document, [rule])[0];
}

function formatRule(coverScope, field) {
  return {
    id: `synthetic.cover-format.${coverScope}.${field}`,
    type: "COVER_FIELD_FORMAT",
    title: "Synthetic Cover Field Format",
    description: "Synthetic cover field format rule.",
    category: "structure",
    expected: {
      coverScope,
      field,
      minConfidence: "medium",
      fontFamily: "Times New Roman",
      fontSize: 12,
      bold: true,
    },
    severity: "error",
    score: 1,
    message: "Cover field format mismatch.",
    solution: "Fix cover field format.",
    enabled: true,
    version: "test",
  };
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>';
}

function coverParagraph(text) {
  return formattedParagraph(text, {
    fontFamily: "Times New Roman",
    fontSize: 12,
    bold: true,
  });
}

function formattedParagraph(text, format) {
  return `<w:p>${formattedRun(text, format)}</w:p>`;
}

function splitFormattedParagraph(runs) {
  return `<w:p>${runs.map((run) => formattedRun(run.text, run)).join("")}</w:p>`;
}

function formattedRun(text, format) {
  return `<w:r><w:rPr><w:rFonts w:ascii="${format.fontFamily}" w:hAnsi="${format.fontFamily}"/><w:sz w:val="${format.fontSize * 2}"/>${format.bold ? "<w:b/>" : '<w:b w:val="0"/>'}</w:rPr><w:t>${text}</w:t></w:r>`;
}

function pageBreakParagraph() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function sectionBreakParagraph() {
  return '<w:p><w:pPr><w:sectPr/></w:pPr></w:p>';
}

function assertDeepEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    throw new Error(`${message}: expected ${expectedText}, received ${actualText}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
