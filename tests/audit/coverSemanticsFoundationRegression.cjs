require("../golden/experimentalGoldenRegression.cjs");

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeCoverSemantics,
} = require("../../src/features/analysis/parsers/coverSemanticsNormalizer.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");

function main() {
  assertExplicitCoverScopesAndFields();
  assertTurkishMonthYearDateFacts();
  assertPublicationPlaceContext();
  assertUnknownScopeWhenBoundaryEvidenceIsInsufficient();
  assertFalsePositiveExclusions();
  assertComputerEngineeringRuleCountUnchanged();

  console.log(JSON.stringify({
    phase: "cover-semantics-sprint-2",
    result: "PASS",
    audit: "coverSemanticsFoundationRegression.cjs",
  }, null, 2));
}

function assertExplicitCoverScopesAndFields() {
  const document = semanticDocument(
    paragraph("Institution: Example University") +
      paragraph("Title: Static OOXML Evidence") +
      paragraph("Author: Ada Lovelace") +
      pageBreakParagraph() +
      paragraph("Advisor: Prof. Test") +
      paragraph("Work Type: Bachelor Thesis") +
      paragraph("Place: Canakkale") +
      paragraph("Date: 2026") +
      sectionBreakParagraph() +
      paragraph("Title: Body Repeat Must Not Become Cover"),
  );

  assertEqual(document.coverSemantics.boundaryEvidence.length, 2, "explicit boundary evidence count");
  assertEqual(document.coverSemantics.occurrences.length, 2, "cover occurrence count");
  assertEqual(document.coverSemantics.occurrences[0].scope, "outer-cover", "outer cover scope");
  assertEqual(document.coverSemantics.occurrences[0].confidence, "high", "outer cover confidence");
  assertEqual(document.coverSemantics.occurrences[1].scope, "inner-cover", "inner cover scope");
  assertField(document, "cover-1", "institution", "Example University", "high");
  assertField(document, "cover-1", "title", "Static OOXML Evidence", "high");
  assertField(document, "cover-1", "author", "Ada Lovelace", "high");
  assertField(document, "cover-2", "advisor", "Prof. Test", "high");
  assertField(document, "cover-2", "work-type", "Bachelor Thesis", "high");
  assertField(document, "cover-2", "publication-place", "Canakkale", "high");
  assertField(document, "cover-2", "date", "2026", "high");
  assertEqual(findField(document, "cover-2", "date", "2026").dateFacts.precision, "year",
    "year-only date remains distinguishable");
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value === "Body Repeat Must Not Become Cover"),
    false,
    "body repeat after cover boundaries excluded",
  );
}

function assertTurkishMonthYearDateFacts() {
  [
    ["Ocak 2006", 1],
    ["Haziran 2006", 6],
    ["Haziran, 2006", 6],
    ["HAZİRAN 2006", 6],
    ["HAZİRAN, 2006", 6],
  ].forEach(([value, month]) => {
    const document = semanticDocument(paragraph(`Date: ${value}`) + pageBreakParagraph());
    const date = findField(document, "cover-1", "date", value);

    assertEqual(date.dateFacts.month, month, `${value} month`);
    assertEqual(date.dateFacts.year, "2006", `${value} year`);
    assertEqual(date.dateFacts.precision, "month-year", `${value} precision`);
    assertEqual(date.dateFacts.detectionStrategy, "turkish-month-year", `${value} strategy`);
  });

  const document = semanticDocument(
    paragraph("Date: Ocak 2006") +
      paragraph("Date: Haziran 2006") +
      paragraph("Date: Haziran, 2006") +
      paragraph("Date: HAZİRAN 2006") +
      paragraph("Date: HAZİRAN, 2006") +
      pageBreakParagraph() +
      paragraph("Date: 06/2006") +
      sectionBreakParagraph(),
  );
  const dates = document.coverSemantics.fields.filter((field) => field.field === "date");
  const outerDate = findField(document, "cover-1", "date", "Ocak 2006");
  const innerDate = findField(document, "cover-2", "date", "06/2006");

  assertEqual(dates.length, 2, "one date per cover scope retained");
  assertEqual(outerDate.dateFacts.month, 1, "turkish month parsed");
  assertEqual(outerDate.dateFacts.year, "2006", "turkish year parsed");
  assertEqual(outerDate.dateFacts.precision, "month-year", "turkish date precision");
  assertEqual(outerDate.dateFacts.detectionStrategy, "turkish-month-year", "turkish date strategy");
  assertEqual(outerDate.evidence.includes("turkish-month-year-pattern"), true, "turkish evidence");
  assertEqual(innerDate.dateFacts.month, 6, "numeric month preserved");
  assertEqual(innerDate.dateFacts.detectionStrategy, "numeric-month-year", "numeric date strategy");
}

function assertPublicationPlaceContext() {
  const strong = semanticDocument(
    paragraph("Title: Contextual Place") +
      paragraph("Haziran 2006") +
      paragraph("ÇANAKKALE") +
      pageBreakParagraph() +
      paragraph("Work Type: Bitirme Projesi") +
      paragraph("Haziran 2006") +
      paragraph("Bursa") +
      sectionBreakParagraph() +
      paragraph("Haziran 2006") +
      paragraph("ÇANAKKALE"),
  );
  const weak = semanticDocument(
    paragraph("Title: Random Uppercase") +
      paragraph("RASTGELE") +
      paragraph("Haziran 2006") +
      pageBreakParagraph() +
      paragraph("Çanakkale") +
      sectionBreakParagraph(),
  );
  const misleading = semanticDocument(
    paragraph("Institution: Çanakkale Onsekiz Mart Üniversitesi") +
      paragraph("Haziran 2006") +
      paragraph("Bitirme Projesi") +
      pageBreakParagraph() +
      paragraph("Author: Ada Lovelace") +
      paragraph("Haziran 2006") +
      paragraph("Danışman") +
      sectionBreakParagraph(),
  );

  assertField(strong, "cover-1", "publication-place", "ÇANAKKALE", "medium");
  assertField(strong, "cover-2", "publication-place", "Bursa", "medium");
  assertEqual(
    strong.coverSemantics.fields.some((field) => field.value === "Body Repeat Must Not Become Cover"),
    false,
    "body place repeat excluded",
  );
  assertEqual(
    weak.coverSemantics.fields.some((field) => field.field === "publication-place"),
    false,
    "arbitrary uppercase without terminal date context not place",
  );
  assertEqual(
    misleading.coverSemantics.fields.some((field) =>
      field.field === "publication-place" &&
      (field.value === "Bitirme Projesi" || field.value === "Danışman")
    ),
    false,
    "institution/work-type/person-like text not place",
  );
}

function assertUnknownScopeWhenBoundaryEvidenceIsInsufficient() {
  const document = semanticDocument(
    paragraph("Title: Boundary Evidence Missing") +
      paragraph("Author: Ada Lovelace") +
      paragraph("Ordinary body text follows but no explicit page break exists."),
  );

  assertEqual(document.coverSemantics.boundaryEvidence.length, 0, "no fabricated boundary evidence");
  assertEqual(document.coverSemantics.occurrences.length, 1, "unknown candidate occurrence retained");
  assertEqual(document.coverSemantics.occurrences[0].scope, "unknown", "unknown scope retained");
  assertEqual(document.coverSemantics.occurrences[0].confidence, "unknown", "unknown confidence retained");
}

function assertFalsePositiveExclusions() {
  const document = semanticDocument(
    tocParagraph("Title: TOC Title") +
      textboxParagraph("Author: Text Box Author") +
      deletedParagraph("Advisor: Deleted Advisor") +
      moveFromParagraph("Date: 2026") +
      paragraph("Title: Real Cover Title") +
      pageBreakParagraph() +
      paragraph("Author: Inner Author"),
  );

  assertEqual(document.coverSemantics.occurrences.length, 2, "explicit and open-ended cover candidates retained");
  assertEqual(document.coverSemantics.occurrences[1].scope, "unknown", "single boundary does not declare inner cover");
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("TOC")),
    false,
    "TOC field false positive excluded",
  );
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("Text Box")),
    false,
    "textbox field false positive excluded",
  );
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value.includes("Deleted")),
    false,
    "deleted field false positive excluded",
  );
  assertEqual(
    document.coverSemantics.fields.some((field) => field.value === "2026"),
    false,
    "moveFrom field false positive excluded",
  );
  assertField(document, "cover-1", "title", "Real Cover Title", "high");
  assertField(document, "cover-2", "author", "Inner Author", "high");
}

function assertComputerEngineeringRuleCountUnchanged() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select({
    universityId: "comu",
    facultyId: "engineering",
    departmentId: "computer-engineering",
    thesisTypeId: "bachelor",
  }));

  assertEqual(rules.length, 47, "computer engineering rule count");
}

function semanticDocument(bodyXml) {
  const xml = wrapDocumentXml(bodyXml);
  return normalizeCoverSemantics(parseDocumentXml(xml), xml);
}

function assertField(document, coverOccurrenceId, field, value, confidence) {
  const found = findField(document, coverOccurrenceId, field, value);

  if (!found) {
    throw new Error(`Expected cover field not found: ${coverOccurrenceId} ${field} ${value}`);
  }

  assertEqual(found.confidence, confidence, `${field} confidence`);
  assertEqual(found.sourcePart, "word/document.xml", `${field} source part`);
}

function findField(document, coverOccurrenceId, field, value) {
  return document.coverSemantics.fields.find((item) =>
    item.coverOccurrenceId === coverOccurrenceId &&
    item.field === field &&
    item.value === value
  );
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

function moveFromParagraph(text) {
  return `<w:p><w:moveFrom w:id="2"><w:r><w:t>${text}</w:t></w:r></w:moveFrom></w:p>`;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
