const path = require("path");

require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
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
  normalizeDirectQuotationSemantics,
} = require("../../src/features/analysis/parsers/directQuotationSemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");

const RULE = {
  id: "synthetic.direct-quotation-page-locator",
  type: "DIRECT_QUOTATION_PAGE_LOCATOR",
  title: "Direct quotation page locator",
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

function main() {
  assertPassSinglePage();
  assertPassPageRange();
  assertFailMissingLocator();
  assertFailMalformedLocator();
  assertAmbiguousAssociationDoesNotFail();
  assertUnresolvedAssociationDoesNotFail();
  assertNoEvaluableQuotationDoesNotFail();
  assertMultipleValidQuotesPass();
  assertMixedValidAndMissingFails();
  assertWordBoundaries();
  assertExistingCitationSemanticsUnchanged();
  assertExistingCitationBibliographyLinksUnchanged();
  assertRegistryDispatch();
  assertProductionBaselines();

  console.log(JSON.stringify({
    audit: path.basename(__filename),
    result: "PASS",
    ruleType: "DIRECT_QUOTATION_PAGE_LOCATOR",
    ceRules: 45,
    foodTechnologyRules: 46,
  }, null, 2));
}

function assertPassSinglePage() {
  assertResult(
    analyze(heading("Giris") + paragraph('"Alinti" (Yilmaz, 2024, s. 95).')),
    "PASSED",
    "single page locator",
  );
}

function assertPassPageRange() {
  assertResult(
    analyze(heading("Giris") + paragraph('"Alinti" (Yilmaz, 2024, ss. 95-97).')),
    "PASSED",
    "page range locator",
  );
}

function assertFailMissingLocator() {
  assertResult(
    analyze(heading("Giris") + paragraph('"Alinti" (Yilmaz, 2024).')),
    "FAILED",
    "missing locator",
  );
}

function assertFailMalformedLocator() {
  assertResult(
    analyze(heading("Giris") + paragraph('"Alinti" (Yilmaz, 2024, s. abc).')),
    "FAILED",
    "malformed locator",
  );
}

function assertAmbiguousAssociationDoesNotFail() {
  assertResult(
    analyze(heading("Giris") + paragraph('"Bir" ve "iki" (Yilmaz, 2024).')),
    "NOT_APPLICABLE",
    "ambiguous association",
  );
}

function assertUnresolvedAssociationDoesNotFail() {
  assertResult(
    analyze(heading("Giris") + paragraph('(Yilmaz, 2024, s. 95) yazarina gore "Alinti".')),
    "NOT_APPLICABLE",
    "unresolved association",
  );
}

function assertNoEvaluableQuotationDoesNotFail() {
  assertResult(
    analyze(heading("Giris") + paragraph("Alinti olmayan metin.")),
    "NOT_APPLICABLE",
    "no evaluable quotation",
  );
}

function assertMultipleValidQuotesPass() {
  assertResult(
    analyze(
      heading("Giris") +
        paragraph('"Bir" (Yilmaz, 2024, s. 11). "Iki" (Demir, 2023, ss. 12-13).'),
    ),
    "PASSED",
    "multiple valid quotations",
  );
}

function assertMixedValidAndMissingFails() {
  assertResult(
    analyze(
      heading("Giris") +
        paragraph('"Bir" (Yilmaz, 2024, s. 11). "Iki" (Demir, 2023).'),
    ),
    "FAILED",
    "mixed valid and missing locator",
  );
}

function assertWordBoundaries() {
  assertResult(
    analyze(heading("Giris") + paragraph(`"${words(39)}" (Yilmaz, 2024, s. 95).`)),
    "PASSED",
    "39-word high-confidence evaluable",
  );
  assertResult(
    analyze(heading("Giris") + paragraph(`"${words(40)}" (Yilmaz, 2024).`)),
    "NOT_APPLICABLE",
    "40-word non-fail",
  );
  assertResult(
    analyze(heading("Giris") + paragraph(`"${words(41)}" (Yilmaz, 2024).`)),
    "NOT_APPLICABLE",
    "41-word non-fail",
  );
}

function assertExistingCitationSemanticsUnchanged() {
  const before = citationDocument(heading("Giris") + paragraph('"Alinti" (Yilmaz, 2024, s. 95).'));
  const citationSnapshot = JSON.stringify(before.citationSemantics);
  const after = normalizeDirectQuotationSemantics(before);

  assertEqual(JSON.stringify(after.citationSemantics), citationSnapshot, "citation semantics unchanged");
}

function assertExistingCitationBibliographyLinksUnchanged() {
  const before = citationLinkedDocument(
    heading("Giris") +
      paragraph('"Alinti" (Yilmaz, 2024, s. 95).') +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );
  const linkSnapshot = JSON.stringify(before.citationBibliographyLinks);
  const after = normalizeDirectQuotationSemantics(before);

  assertEqual(JSON.stringify(after.citationBibliographyLinks), linkSnapshot,
    "citation bibliography links unchanged");
}

function assertRegistryDispatch() {
  const validator = new ValidatorRegistry().getValidator(RULE);

  assertEqual(validator?.constructor.name, "DirectQuotationPageLocatorValidator",
    "registry dispatch");
}

function assertProductionBaselines() {
  const computerRules = new RuleResolver().resolve(new RuleSetSelector().select({
    universityId: "comu",
    facultyId: "engineering",
    departmentId: "computer-engineering",
    thesisTypeId: "bachelor",
  }));
  const foodRules = new RuleResolver().resolve(new RuleSetSelector().select({
    universityId: "comu",
    facultyId: "applied-sciences",
    departmentId: "food-technology",
    thesisTypeId: "bachelor",
    studyTypeId: "experimental",
  }));

  assertEqual(computerRules.length, 45, "CE rule count");
  assertEqual(foodRules.length, 46, "food rule count");
  assertEqual(countBy(computerRules, (rule) => rule.validation.coverage).PARTIAL, 12,
    "CE partial count");
  assertEqual(countBy(computerRules, (rule) => rule.validation.trust).MEDIUM, 12,
    "CE medium count");
}

function analyze(bodyXml) {
  const document = normalizeDirectQuotationSemantics(citationDocument(bodyXml));
  const [result] = new RuleEngine().run(document, [RULE]);

  return result;
}

function citationLinkedDocument(bodyXml) {
  return normalizeCitationBibliographyLinkSemantics(citationDocument(bodyXml));
}

function citationDocument(bodyXml) {
  const rules = defaultRules();
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const withBibliography = normalizeBibliographySemantics(sectioned, rules);

  return normalizeCitationSemantics(withBibliography);
}

function defaultRules() {
  return [requiredRule("Giris"), requiredRule("Kaynaklar")];
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

function words(count) {
  return Array.from({ length: count }, (_, index) => `kelime${index + 1}`).join(" ");
}

function countBy(items, getKey) {
  const counts = {};

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
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

function assertResult(result, expectedStatus, label) {
  assertEqual(result.status, expectedStatus, label);
  assertEqual(result.passed, expectedStatus === "PASSED", `${label} passed flag`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main();

