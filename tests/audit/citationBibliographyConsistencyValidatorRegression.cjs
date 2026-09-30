const path = require("path");

require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeBibliographySemantics,
} = require("../../src/features/analysis/parsers/bibliographySemanticsNormalizer.ts");
const {
  normalizeCitationSemantics,
} = require("../../src/features/analysis/parsers/citationSemanticsNormalizer.ts");
const {
  normalizeCitationBibliographyLinkSemantics,
} = require("../../src/features/analysis/parsers/citationBibliographyLinkSemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");

function main() {
  assertAllMatchedPass();
  assertMissingEntryFails();
  assertOneMissingAmongManyFails();
  assertAmbiguousFalsePassBlocked();
  assertUnresolvedFalsePassBlocked();
  assertUnsupportedLowConfidenceNoViolation();
  assertYearSuffixSeparated();
  assertSupportedAuthorKinds();
  assertValidatorDoesNotReparseRawText();
  assertSyntheticSecondUniversityUsesGenericValidator();

  console.log(JSON.stringify({
    phase: "citation-bibliography-sprint-6",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertAllMatchedPass() {
  const result = validate(
    heading("Giris") +
      paragraph("Iki kaynak kullanildi (Yilmaz, 2024; Demir, 2023).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi.") +
      paragraph("Demir, B. (2023). Diger kaynak."),
  );

  assertEqual(result.status, "PASSED", "all matched status");
  assertIncludes(result.actual, "2 güvenilir atıf", "all matched actual");
}

function assertMissingEntryFails() {
  const result = validate(
    heading("Giris") +
      paragraph("Eksik kaynak vardir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Demir, B. (2023). Diger kaynak."),
  );

  assertEqual(result.status, "FAILED", "missing status");
  assertIncludes(result.message, "eşleşen kaynakça girdisi bulunamadı", "missing message");
  assertIncludes(result.actual, "yilmaz, 2024", "missing author year evidence");
}

function assertOneMissingAmongManyFails() {
  const result = validate(
    heading("Giris") +
      paragraph("Biri var biri yoktur (Yilmaz, 2024; Demir, 2023).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );

  assertEqual(result.status, "FAILED", "one missing status");
  assertIncludes(result.actual, "1 atıf", "one missing count");
  assertIncludes(result.actual, "demir, 2023", "one missing key");
}

function assertAmbiguousFalsePassBlocked() {
  const result = validate(
    heading("Giris") +
      paragraph("Belirsiz eslesme vardir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Ilk kaynak.") +
      paragraph("Yilmaz, B. (2024). Ikinci kaynak."),
  );

  assertEqual(result.status, "FAILED", "ambiguous status");
  assertIncludes(result.message, "birden fazla kaynakça girdisiyle eşleştiği", "ambiguous message");
  assertNotIncludes(result.message, "bulunamadı", "ambiguous not missing");
}

function assertUnresolvedFalsePassBlocked() {
  const result = validate(
    heading("Giris") +
      paragraph("Cozulemeyen kaynak vardir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Research Team (2024). Belirsiz kaynak."),
  );

  assertEqual(result.status, "FAILED", "unresolved status");
  assertIncludes(result.message, "yetersiz semantic evidence", "unresolved message");
  assertNotIncludes(result.message, "bulunamadı", "unresolved not missing");
}

function assertUnsupportedLowConfidenceNoViolation() {
  const result = validate(
    heading("Giris") +
      paragraph("Bu normal prose kabul edilir (bkz. 2024 raporu).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );

  assertEqual(result.status, "NOT_APPLICABLE", "unsupported no violation");
  assertNotIncludes(result.message, "bulunamadı", "unsupported not missing");
}

function assertYearSuffixSeparated() {
  const result = validate(
    heading("Giris") +
      paragraph("Suffix ayrimi vardir (Yilmaz, 2020a).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2020b). B kaynagi."),
  );

  assertEqual(result.status, "FAILED", "suffix mismatch status");
  assertIncludes(result.actual, "yilmaz, 2020a", "suffix key");
}

function assertSupportedAuthorKinds() {
  const result = validate(
    heading("Giris") +
      paragraph("Cesitli atiflar (Yilmaz ve Demir, 2024; Kaya vd., 2020; Anonim, 2021; World Health Organization, 2022).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. ve Demir, B. (2024). Iki yazar.") +
      paragraph("Kaya, A., Demir, B. ve Yilmaz, C. (2020). Cok yazar.") +
      paragraph("Anonim (2021). Adsiz kaynak.") +
      paragraph("World Health Organization (2022). Kurumsal kaynak."),
  );

  assertEqual(result.status, "PASSED", "supported author kinds pass");
  assertIncludes(result.actual, "4 güvenilir atıf", "supported author kinds count");
}

function assertValidatorDoesNotReparseRawText() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Orijinal semantic eslesir (Yilmaz, 2024).") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );
  const mutatedDocument = {
    ...document,
    paragraphs: document.paragraphs.map((paragraph) => ({
      ...paragraph,
      text: "Reparse edilirse bu metin eslesmemelidir (Demir, 1999).",
    })),
    bibliography: {
      ...document.bibliography,
      entries: document.bibliography.entries.map((entry) => ({
        ...entry,
        visibleText: "Demir, D. (1999). Mutated.",
        normalizedText: "demir d 1999 mutated",
      })),
    },
  };
  const result = validateDocument(mutatedDocument);

  assertEqual(result.status, "PASSED", "raw text mutation ignored");
}

function assertSyntheticSecondUniversityUsesGenericValidator() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Generic validator calisir (Smith, 2021).") +
      heading("References") +
      paragraph("Smith, J. (2021). Generic source."),
    [
      {
        ...requiredRule("Giris"),
        id: "synthetic.university.program.introduction",
      },
      {
        ...requiredRule("References"),
        id: "synthetic.university.program.references",
      },
    ],
  );
  const result = validateDocument(document, {
    ...consistencyRule(),
    id: "synthetic.university.program.citation-bibliography-consistency",
  });

  assertEqual(result.status, "PASSED", "synthetic validator status");
}

function validate(bodyXml, rules = [requiredRule("Giris"), requiredRule("Kaynaklar")]) {
  return validateDocument(semanticDocument(bodyXml, rules));
}

function validateDocument(document, rule = consistencyRule()) {
  const [result] = new RuleEngine().run(document, [rule]);

  return result;
}

function semanticDocument(bodyXml, rules = [requiredRule("Giris"), requiredRule("Kaynaklar")]) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const withBibliography = normalizeBibliographySemantics(sectioned, rules);
  const withCitations = normalizeCitationSemantics(withBibliography);

  return normalizeCitationBibliographyLinkSemantics(withCitations);
}

function consistencyRule() {
  return {
    id: "synthetic.citation-bibliography-consistency",
    type: "CITATION_BIBLIOGRAPHY_CONSISTENCY",
    title: "Citation Bibliography Consistency",
    description: "",
    category: "citation",
    expected: true,
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function requiredRule(section) {
  return {
    id: `required.${section}`,
    type: "REQUIRED_SECTION",
    title: `${section} required`,
    description: "",
    category: "structure",
    expected: { section, required: true },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function wrapDocumentXml(content) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}</w:body></w:document>`;
}

function heading(text) {
  return paragraph(text);
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, expectedPart, label) {
  if (!String(actual).includes(expectedPart)) {
    throw new Error(`${label}: expected ${JSON.stringify(actual)} to include ${JSON.stringify(expectedPart)}`);
  }
}

function assertNotIncludes(actual, expectedPart, label) {
  if (String(actual).includes(expectedPart)) {
    throw new Error(`${label}: expected ${JSON.stringify(actual)} not to include ${JSON.stringify(expectedPart)}`);
  }
}

main();



