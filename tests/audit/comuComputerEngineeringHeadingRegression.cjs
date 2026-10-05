require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
const {
  normalizeDocumentNumbering,
} = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");

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

const HEADING_RULE_IDS = [
  "comu.engineering.computer-engineering.bachelor.heading-numbering",
  "comu.engineering.computer-engineering.bachelor.main-heading-format",
  "comu.engineering.computer-engineering.bachelor.main-heading-alignment",
  "comu.engineering.computer-engineering.bachelor.subheading-level-1-format",
  "comu.engineering.computer-engineering.bachelor.subheading-level-2-format",
  "comu.engineering.computer-engineering.bachelor.subheading-level-3-format",
  "comu.engineering.computer-engineering.bachelor.subheading-level-4-format",
];

function main() {
  assertCorrectHeadingRulesPass();
  assertMainHeadingFormattingFailures();
  assertMainHeadingUppercaseValidation();
  assertUppercaseIsOptIn();
  assertNestedNumbering();
  assertSubheadingFormatting();
  assertTocDeletedAndTextboxProtections();
  assertGenericRuleTypeWorksAcrossNamespace();
  assertBaselines();

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringHeadingRegression.cjs",
    result: "PASS",
    productionHeadingRules: HEADING_RULE_IDS.length,
    unsupported: ["heading indentation"],
  }, null, 2));
}

function assertCorrectHeadingRulesPass() {
  const { results } = validateHeadingRules(createHeadingDocument());

  for (const ruleId of HEADING_RULE_IDS) {
    assertStatus(results, ruleId, "PASSED", `${ruleId} correct heading pass`);
  }
}

function assertMainHeadingFormattingFailures() {
  assertStatus(
    validateHeadingRules(createHeadingDocument({ mainFontSize: 11 })).results,
    "comu.engineering.computer-engineering.bachelor.main-heading-format",
    "FAILED",
    "wrong main heading font size fails",
  );
  assertStatus(
    validateHeadingRules(createHeadingDocument({ mainBold: false })).results,
    "comu.engineering.computer-engineering.bachelor.main-heading-format",
    "FAILED",
    "main heading not bold fails",
  );
  assertStatus(
    validateHeadingRules(createHeadingDocument({ mainAlignment: "left" })).results,
    "comu.engineering.computer-engineering.bachelor.main-heading-alignment",
    "FAILED",
    "main heading wrong alignment fails",
  );
}

function assertMainHeadingUppercaseValidation() {
  const correct = validateHeadingRules(createHeadingDocument({
    extraMainHeadings: [
      "5. MATERYAL VE YÖNTEM",
      "6. İSTATİSTİKSEL DEĞERLENDİRME",
      "7. BÖLÜM 1: DEĞERLENDİRME",
    ],
  }));

  assertStatus(
    correct.results,
    "comu.engineering.computer-engineering.bachelor.main-heading-format",
    "PASSED",
    "Turkish uppercase, numbers, and punctuation pass",
  );
  assert(
    correct.document.headings.some((heading) => heading.text === "GİRİŞ"),
    "manual numbering prefix is excluded from semantic heading text",
  );

  for (const text of [
    "5. Giriş",
    "5. MATERYAL VE Yöntem",
    "5. İstatistiksel Değerlendirme",
    "5. TÜRKÇE şĞÜÖÇ BAŞLIK",
  ]) {
    assertStatus(
      validateHeadingRules(createHeadingDocument({ extraMainHeadings: [text] })).results,
      "comu.engineering.computer-engineering.bachelor.main-heading-format",
      "FAILED",
      `${text} lowercase main heading fails`,
    );
  }
}

function assertUppercaseIsOptIn() {
  const configuredRule = headingRules().find(
    (rule) => rule.id === "comu.engineering.computer-engineering.bachelor.main-heading-format",
  );
  const expectedWithoutUppercase = { ...configuredRule.expected };
  delete expectedWithoutUppercase.uppercase;
  const ruleWithoutUppercase = {
    ...configuredRule,
    id: "audit.heading-level-format.without-uppercase",
    expected: expectedWithoutUppercase,
  };
  const { document } = validateHeadingRules(createHeadingDocument({
    extraMainHeadings: ["5. Giriş"],
  }));
  const [result] = new RuleEngine(new ValidatorRegistry()).run(document, [ruleWithoutUppercase]);

  assertEqual(result.status, "PASSED", "HEADING_LEVEL_FORMAT without uppercase remains unchanged");
}

function assertNestedNumbering() {
  assertStatus(
    validateHeadingRules(createHeadingDocument()).results,
    "comu.engineering.computer-engineering.bachelor.heading-numbering",
    "PASSED",
    "correct nested numbering passes",
  );
  assertStatus(
    validateHeadingRules(createHeadingDocument({ level1Label: "2.1" })).results,
    "comu.engineering.computer-engineering.bachelor.heading-numbering",
    "FAILED",
    "wrong nested numbering fails",
  );
}

function assertSubheadingFormatting() {
  const correct = validateHeadingRules(createHeadingDocument()).results;
  assertStatus(correct, "comu.engineering.computer-engineering.bachelor.subheading-level-1-format",
    "PASSED", "correct level 1 subheading formatting passes");
  assertStatus(correct, "comu.engineering.computer-engineering.bachelor.subheading-level-2-format",
    "PASSED", "correct level 2 subheading formatting passes");

  assertStatus(
    validateHeadingRules(createHeadingDocument({ level1Bold: false })).results,
    "comu.engineering.computer-engineering.bachelor.subheading-level-1-format",
    "FAILED",
    "wrong level 1 bold fails",
  );
  assertStatus(
    validateHeadingRules(createHeadingDocument({ level2Italic: false })).results,
    "comu.engineering.computer-engineering.bachelor.subheading-level-2-format",
    "FAILED",
    "wrong level 2 italic fails",
  );
}

function assertTocDeletedAndTextboxProtections() {
  const { document, results } = validateHeadingRules(createHeadingDocument({
    includeTocCollision: true,
    includeDeletedCollision: true,
    includeTextboxCollision: true,
  }));

  assert(
    !document.headings.some((heading) => heading.paragraphId === "paragraph-1"),
    "TOC heading occurrence is not production heading evidence",
  );
  assert(
    !document.headings.some((heading) => heading.text.includes("Silinen") || heading.text.includes("Textbox")),
    "deleted/textbox false-positive heading protections are preserved",
  );
  for (const ruleId of HEADING_RULE_IDS) {
    assertStatus(results, ruleId, "PASSED", `${ruleId} ignores protected collisions`);
  }
}

function assertGenericRuleTypeWorksAcrossNamespace() {
  const rules = headingRules();
  const genericRule = {
    ...rules.find((rule) => rule.id === "comu.engineering.computer-engineering.bachelor.main-heading-format"),
    id: "second-university.engineering.software.bachelor.main-heading-format",
  };
  const { document } = validateHeadingRules(createHeadingDocument());
  const [result] = new RuleEngine(new ValidatorRegistry()).run(document, [genericRule]);

  assertEqual(result.status, "PASSED", "generic HEADING_LEVEL_FORMAT works under different namespace");
}

function assertBaselines() {
  const computerRules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const foodRules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const computerCoverage = countBy(computerRules, (rule) => metadata(rule).coverage);
  const computerTrust = countBy(computerRules, (rule) => metadata(rule).trust);
  const foodCoverage = countBy(foodRules, (rule) => metadata(rule).coverage);
  const foodTrust = countBy(foodRules, (rule) => metadata(rule).trust);

  assertEqual(computerRules.length, 47, "computer engineering rule count");
  assertCounts(computerCoverage, { COMPLETE: 33, PARTIAL: 14, SHALLOW: 0, MISSING: 0 }, "computer coverage");
  assertCounts(computerTrust, { HIGH: 33, MEDIUM: 14, LOW: 0 }, "computer trust");
  assertEqual(foodRules.length, 46, "food technology rule count");
  assertCounts(foodCoverage, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(foodTrust, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function validateHeadingRules(bodyXml) {
  const rules = computerRules();
  const selectedRules = headingRules();
  const parsedStyles = parseStylesXml(stylesXml());
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const formatted = {
    ...parsed,
    styles: parsedStyles.styles,
    documentDefaults: parsedStyles.documentDefaults,
  };
  const numbered = normalizeDocumentNumbering(formatted);
  const marked = markRequiredSectionHeadings(numbered, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const document = normalizeAcademicSections(scoped, rules);
  const results = new RuleEngine(new ValidatorRegistry()).run(document, selectedRules);

  return { document, results };
}

function createHeadingDocument(options = {}) {
  const mainFontSize = options.mainFontSize ?? 12;
  const mainBold = options.mainBold ?? true;
  const mainAlignment = options.mainAlignment ?? "center";
  const level1Label = options.level1Label ?? "1.1";
  const parts = [
    ...(options.includeTocCollision ? [tocHeading("1. Giriş")] : []),
    ...(options.includeDeletedCollision ? [deletedHeading("2. Silinen")] : []),
    ...(options.includeTextboxCollision ? [textboxHeading("2. Textbox")] : []),
    heading("1. GİRİŞ", "Heading1", mainAlignment, mainFontSize, mainBold, false),
    heading(`${level1Label} Kapsam`, "Heading2", "left", 12, options.level1Bold ?? true, false),
    heading("1.1.1 Ayrıntı", "Heading3", "left", 12, false, options.level2Italic ?? true),
    heading("1.1.1.1 Derinlik", "Heading4", "left", 12, false, true),
    heading("1.1.1.1.1 En Alt", "Heading5", "left", 12, false, true),
    ...(options.extraMainHeadings ?? []).map((text) =>
      heading(text, "Heading1", mainAlignment, mainFontSize, mainBold, false)
    ),
    paragraph("Akademik gövde metni."),
    heading("2. SONUÇLAR", "Heading1", mainAlignment, mainFontSize, mainBold, false),
    paragraph("Sonuç metni."),
    heading("3. KAYNAKLAR", "Heading1", mainAlignment, mainFontSize, mainBold, false),
    paragraph("Kaynak metni."),
    heading("4. EKLER", "Heading1", mainAlignment, mainFontSize, mainBold, false),
  ];

  return parts.join("");
}

function heading(text, styleId, alignment, fontSize, bold, italic) {
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/><w:jc w:val="${alignment}"/></w:pPr>` +
    `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}<w:sz w:val="${fontSize * 2}"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

function tocHeading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:jc w:val="left"/></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

function deletedHeading(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function textboxHeading(text) {
  return `<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function stylesXml() {
  return '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    style("Heading1", "heading 1") +
    style("Heading2", "heading 2") +
    style("Heading3", "heading 3") +
    style("Heading4", "heading 4") +
    style("Heading5", "heading 5") +
    style("TOC1", "toc 1") +
    "</w:styles>";
}

function style(styleId, name) {
  return `<w:style w:type="paragraph" w:styleId="${styleId}"><w:name w:val="${name}"/></w:style>`;
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    content +
    "</w:body></w:document>";
}

function headingRules() {
  return computerRules().filter((rule) => HEADING_RULE_IDS.includes(rule.id));
}

function computerRules() {
  return new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
}

function metadata(rule) {
  if (!rule.validation) {
    throw new Error(`${rule.id}: validation metadata missing`);
  }

  return rule.validation;
}

function countBy(items, getKey) {
  const counts = {};

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function assertStatus(results, ruleId, expectedStatus, message) {
  const result = results.find((candidate) => candidate.ruleId === ruleId);

  if (!result) {
    throw new Error(`Result not found: ${ruleId}`);
  }

  assertEqual(result.status, expectedStatus, message);
}

function assertCounts(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assertEqual(actual[key] ?? 0, value, `${label}.${key}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main();
