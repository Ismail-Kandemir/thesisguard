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
  assertCorrectCoverFieldPass();
  assertMissingFieldFails();
  assertWrongCoverScopeFails();
  assertDatePrecisionPresenceRules();
  assertUnknownAndAmbiguousEvidenceDoNotPass();
  assertFalsePositiveSourcesDoNotPass();
  assertSyntheticSecondUniversityRuleUsesGenericValidator();
  assertProductionCoverRulesAndBaselines();

  console.log(JSON.stringify({
    phase: "cover-semantics-sprint-3",
    result: "PASS",
    audit: "coverFieldPresenceValidatorRegression.cjs",
  }, null, 2));
}

function assertCorrectCoverFieldPass() {
  const document = semanticDocument(
    paragraph("Institution: Example University") +
      pageBreakParagraph() +
      paragraph("Çanakkale Onsekiz Mart Üniversitesi Mühendislik Fakültesi") +
      paragraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, coverRule("outer-cover", "institution"), "PASSED", "outer institution pass");
  assertStatus(document, coverRule("inner-cover", "institution", "medium"), "PASSED", "inner institution pass");
  assertStatus(document, coverRule("inner-cover", "work-type", "medium"), "PASSED", "inner work-type pass");
}

function assertMissingFieldFails() {
  const document = semanticDocument(
    paragraph("Institution: Example University") +
      pageBreakParagraph() +
      paragraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, coverRule("inner-cover", "advisor"), "FAILED", "missing advisor fail");
}

function assertWrongCoverScopeFails() {
  const document = semanticDocument(
    paragraph("Institution: Example University") +
      pageBreakParagraph() +
      paragraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );

  assertStatus(document, coverRule("outer-cover", "work-type", "medium"), "FAILED", "wrong scope fail");
}

function assertDatePrecisionPresenceRules() {
  [
    ["outer Turkish month-year PASS", paragraph("Date: Haziran 2006") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium", "month-year"), "PASSED"],
    ["inner Turkish month-year PASS", paragraph("Title: Outer") + pageBreakParagraph() + paragraph("Date: Haziran 2006") + sectionBreakParagraph(), coverRule("inner-cover", "date", "medium", "month-year"), "PASSED"],
    ["uppercase Turkish month PASS", paragraph("Date: HAZİRAN 2006") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium", "month-year"), "PASSED"],
    ["comma variant PASS", paragraph("Date: Haziran, 2006") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium", "month-year"), "PASSED"],
    ["numeric month-year PASS", paragraph("Date: 06/2006") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium", "month-year"), "PASSED"],
    ["year-only FAIL", paragraph("Date: 2006") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium", "month-year"), "FAILED"],
    ["missing date FAIL", paragraph("Institution: Example University") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium", "month-year"), "FAILED"],
    ["wrong cover scope date FAIL", paragraph("Date: Haziran 2006") + pageBreakParagraph(), coverRule("inner-cover", "date", "medium", "month-year"), "FAILED"],
    [
      "body date must not satisfy",
      paragraph("Institution: Example University") +
        pageBreakParagraph() +
        paragraph("Work Type: Bitirme Projesi") +
        sectionBreakParagraph() +
        paragraph("Date: Haziran 2006"),
      coverRule("inner-cover", "date", "medium", "month-year"),
      "FAILED",
    ],
    ["rules without datePrecision unchanged", paragraph("Date: 2006") + pageBreakParagraph(), coverRule("outer-cover", "date", "medium"), "PASSED"],
  ].forEach(([message, xml, rule, expectedStatus]) => {
    assertStatus(semanticDocument(xml), rule, expectedStatus, message);
  });

  assertStatus(
    lowConfidenceDateDocument(),
    coverRule("outer-cover", "date", "medium", "month-year"),
    "FAILED",
    "insufficient confidence must not pass",
  );
}

function assertUnknownAndAmbiguousEvidenceDoNotPass() {
  const unknownDocument = semanticDocument(
    paragraph("Title: Boundary Evidence Missing") +
      paragraph("Author: Ada Lovelace"),
  );

  assertStatus(unknownDocument, coverRule("unknown", "title"), "FAILED", "unknown scope false pass blocked");

  const ambiguousDocument = {
    ...semanticDocument(paragraph("Title: Synthetic") + pageBreakParagraph()),
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
        field: "title",
        value: "Synthetic",
        normalizedValue: "synthetic",
        paragraphId: "paragraph-1",
        paragraphIndex: 0,
        coverOccurrenceId: "cover-ambiguous",
        confidence: "high",
        evidence: ["explicit-label"],
        sourcePart: "word/document.xml",
      }],
    },
  };

  assertStatus(ambiguousDocument, coverRule("outer-cover", "title"), "FAILED", "ambiguous occurrence false pass blocked");
}

function assertFalsePositiveSourcesDoNotPass() {
  const document = semanticDocument(
    tocParagraph("Institution: TOC University") +
      textboxParagraph("Institution: Textbox University") +
      deletedParagraph("Institution: Deleted University") +
      paragraph("Institution: Real Outer University") +
      pageBreakParagraph() +
      paragraph("Bitirme Projesi") +
      sectionBreakParagraph() +
      paragraph("Institution: Body Repeat University"),
  );

  assertStatus(document, coverRule("outer-cover", "institution"), "PASSED", "real outer institution pass");
  assertStatus(document, coverRule("inner-cover", "institution", "medium"), "FAILED", "body repeat and excluded sources fail");
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("TOC")),
    false,
    "TOC field excluded",
  );
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("Textbox")),
    false,
    "textbox field excluded",
  );
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("Deleted")),
    false,
    "deleted field excluded",
  );
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("Body Repeat")),
    false,
    "body repeat excluded from cover fields",
  );
}

function assertSyntheticSecondUniversityRuleUsesGenericValidator() {
  const document = semanticDocument(
    paragraph("Institution: Example University") +
      pageBreakParagraph() +
      paragraph("Bitirme Projesi") +
      sectionBreakParagraph(),
  );
  const result = runRule(document, {
    ...coverRule("inner-cover", "work-type", "medium"),
    id: "second-university.engineering.software-engineering.bachelor.inner-cover-work-type",
  });

  assertEqual(result.status, "PASSED", "second-university generic cover validator pass");
}

function assertProductionCoverRulesAndBaselines() {
  const computerRules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const foodRules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const coverRuleIds = computerRules
    .filter((rule) => rule.type === "COVER_FIELD_PRESENCE")
    .map((rule) => rule.id)
    .sort();

  assertDeepEqual(
    coverRuleIds,
    [
      "comu.engineering.computer-engineering.bachelor.inner-cover-date",
      "comu.engineering.computer-engineering.bachelor.inner-cover-institution",
      "comu.engineering.computer-engineering.bachelor.inner-cover-work-type",
      "comu.engineering.computer-engineering.bachelor.outer-cover-date",
      "comu.engineering.computer-engineering.bachelor.outer-cover-institution",
    ],
    "production computer cover rules",
  );
  assertMetadata(computerRules, "comu.engineering.computer-engineering.bachelor.outer-cover-date", "PARTIAL", "MEDIUM");
  assertMetadata(computerRules, "comu.engineering.computer-engineering.bachelor.inner-cover-date", "PARTIAL", "MEDIUM");
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

function lowConfidenceDateDocument() {
  const document = semanticDocument(paragraph("Date: Haziran 2006") + pageBreakParagraph());
  return {
    ...document,
    coverSemantics: {
      ...document.coverSemantics,
      fields: document.coverSemantics.fields.map((field) =>
        field.field === "date" ? { ...field, confidence: "low" } : field
      ),
    },
  };
}

function coverRule(coverScope, field, minConfidence = "high", datePrecision = undefined) {
  return {
    id: `synthetic.cover.${coverScope}.${field}`,
    type: "COVER_FIELD_PRESENCE",
    title: "Synthetic Cover Field",
    description: "Synthetic cover field presence rule.",
    category: "structure",
    expected: {
      coverScope,
      field,
      required: true,
      minConfidence,
      ...(datePrecision ? { datePrecision } : {}),
    },
    severity: "error",
    score: 1,
    message: "Cover field missing.",
    solution: "Add cover field.",
    enabled: true,
    version: "test",
  };
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>';
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function pageBreakParagraph() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function sectionBreakParagraph() {
  return '<w:p><w:pPr><w:sectPr/></w:pPr></w:p>';
}

function tocParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>`;
}

function deletedParagraph(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function assertDeepEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    throw new Error(`${message}: expected ${expectedText}, received ${actualText}`);
  }
}

function assertMetadata(rules, ruleId, coverage, trust) {
  const rule = rules.find((item) => item.id === ruleId);

  if (!rule) {
    throw new Error(`${ruleId}: rule not found`);
  }

  assertEqual(rule.validation.coverage, coverage, `${ruleId}: coverage`);
  assertEqual(rule.validation.trust, trust, `${ruleId}: trust`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
