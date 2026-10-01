require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
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

const OBJECT_RULE_IDS = [
  "comu.engineering.computer-engineering.bachelor.table-caption-placement",
  "comu.engineering.computer-engineering.bachelor.figure-caption-placement",
  "comu.engineering.computer-engineering.bachelor.table-caption-format",
  "comu.engineering.computer-engineering.bachelor.figure-caption-format",
  "comu.engineering.computer-engineering.bachelor.table-object-alignment",
  "comu.engineering.computer-engineering.bachelor.figure-object-alignment",
];

function main() {
  assertCorrectObjectRulesPass();
  assertPlacementFailures();
  assertCaptionFontSizeFailures();
  assertAlignmentFailures();
  assertFigureIdentityProtections();
  assertGenericRuleTypeWorksAcrossNamespace();
  assertBaselines();

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringObjectRulesRegression.cjs",
    result: "PASS",
    productionObjectRules: OBJECT_RULE_IDS.length,
    figureLevel3: "DECLARED_ASSOCIATED_FIGURES_ONLY",
  }, null, 2));
}

function assertCorrectObjectRulesPass() {
  const { results } = validateObjectRules(createObjectDocument());

  for (const ruleId of OBJECT_RULE_IDS) {
    assertStatus(results, ruleId, "PASSED", `${ruleId} correct object rule pass`);
  }
}

function assertPlacementFailures() {
  assertStatus(
    validateObjectRules(createObjectDocument({ tableCaptionPosition: "after" })).results,
    "comu.engineering.computer-engineering.bachelor.table-caption-placement",
    "FAILED",
    "table caption below fails",
  );
  assertStatus(
    validateObjectRules(createObjectDocument({ figureCaptionPosition: "before" })).results,
    "comu.engineering.computer-engineering.bachelor.figure-caption-placement",
    "FAILED",
    "figure caption above fails",
  );
}

function assertCaptionFontSizeFailures() {
  const correct = validateObjectRules(createObjectDocument()).results;
  assertStatus(correct, "comu.engineering.computer-engineering.bachelor.table-caption-format",
    "PASSED", "correct table caption 10 pt passes");
  assertStatus(correct, "comu.engineering.computer-engineering.bachelor.figure-caption-format",
    "PASSED", "correct figure caption 10 pt passes");

  assertStatus(
    validateObjectRules(createObjectDocument({ tableCaptionFontSize: 11 })).results,
    "comu.engineering.computer-engineering.bachelor.table-caption-format",
    "FAILED",
    "wrong table caption font size fails",
  );
  assertStatus(
    validateObjectRules(createObjectDocument({ figureCaptionFontSize: 11 })).results,
    "comu.engineering.computer-engineering.bachelor.figure-caption-format",
    "FAILED",
    "wrong figure caption font size fails",
  );
}

function assertAlignmentFailures() {
  assertStatus(
    validateObjectRules(createObjectDocument({ tableAlignment: "left" })).results,
    "comu.engineering.computer-engineering.bachelor.table-object-alignment",
    "FAILED",
    "wrong table object alignment fails",
  );
  assertStatus(
    validateObjectRules(createObjectDocument({ figureAlignment: "left" })).results,
    "comu.engineering.computer-engineering.bachelor.figure-object-alignment",
    "FAILED",
    "wrong figure object alignment fails",
  );
  assertStatus(
    validateObjectRules(createObjectDocument({ figureCaptionAlignment: "center" })).results,
    "comu.engineering.computer-engineering.bachelor.figure-caption-format",
    "FAILED",
    "wrong figure caption alignment fails",
  );
}

function assertFigureIdentityProtections() {
  const generic = validateObjectRules(createObjectDocument({ figureKind: "unknown" })).results;
  assertStatus(generic, "comu.engineering.computer-engineering.bachelor.figure-caption-placement",
    "NOT_APPLICABLE", "generic drawing does not trigger figure placement");
  assertStatus(generic, "comu.engineering.computer-engineering.bachelor.figure-caption-format",
    "NOT_APPLICABLE", "generic drawing does not trigger figure format");
  assertStatus(generic, "comu.engineering.computer-engineering.bachelor.figure-object-alignment",
    "NOT_APPLICABLE", "generic drawing does not trigger figure alignment");

  const textbox = validateObjectRules(createObjectDocument({ figureKind: "textbox" })).results;
  assertStatus(textbox, "comu.engineering.computer-engineering.bachelor.figure-caption-placement",
    "NOT_APPLICABLE", "textbox-only representation is not figure placement evidence");
  assertStatus(textbox, "comu.engineering.computer-engineering.bachelor.figure-caption-format",
    "NOT_APPLICABLE", "textbox-only representation is not figure format evidence");
  assertStatus(textbox, "comu.engineering.computer-engineering.bachelor.figure-object-alignment",
    "NOT_APPLICABLE", "textbox-only representation is not figure alignment evidence");

  const table = validateObjectRules(createObjectDocument({ figureKind: "unknown" })).document.tables.items[0];
  assertEqual(table.isNested, false, "real w:tbl table remains table semantic source");
  assertEqual(table.captionPosition, "before", "real w:tbl table caption association remains intact");
}

function assertGenericRuleTypeWorksAcrossNamespace() {
  const rules = objectRules();
  const genericRule = {
    ...rules.find((rule) => rule.id === "comu.engineering.computer-engineering.bachelor.figure-caption-format"),
    id: "second-university.engineering.software.bachelor.figure-caption-format",
  };
  const { document } = validateObjectRules(createObjectDocument());
  const [result] = new RuleEngine(new ValidatorRegistry()).run(document, [genericRule]);

  assertEqual(result.status, "PASSED", "generic OBJECT_CAPTION_FORMAT works under different namespace");
}

function assertBaselines() {
  const computerRules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const foodRules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const computerCoverage = countBy(computerRules, (rule) => metadata(rule).coverage);
  const computerTrust = countBy(computerRules, (rule) => metadata(rule).trust);
  const foodCoverage = countBy(foodRules, (rule) => metadata(rule).coverage);
  const foodTrust = countBy(foodRules, (rule) => metadata(rule).trust);

  assertEqual(computerRules.length, 45, "computer engineering rule count");
  assertCounts(computerCoverage, { COMPLETE: 33, PARTIAL: 12, SHALLOW: 0, MISSING: 0 }, "computer coverage");
  assertCounts(computerTrust, { HIGH: 33, MEDIUM: 12, LOW: 0 }, "computer trust");
  assertEqual(foodRules.length, 46, "food technology rule count");
  assertCounts(foodCoverage, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(foodTrust, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function validateObjectRules(bodyXml) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const document = normalizeAcademicDocumentScopes(parsed, computerRules());
  const results = new RuleEngine(new ValidatorRegistry()).run(document, objectRules());

  return { document, results };
}

function createObjectDocument(options = {}) {
  const tableCaption = captionParagraph("Tablo 1. Veri tablosu", options.tableCaptionFontSize ?? 10,
    options.tableCaptionAlignment ?? "center");
  const table = tableXml(options.tableAlignment ?? "center");
  const figureCaption = captionParagraph("\u015Eekil 1. Mimari cizim", options.figureCaptionFontSize ?? 10,
    options.figureCaptionAlignment ?? "justify");
  const figure = figureParagraph(options.figureAlignment ?? "center", options.figureKind ?? "picture");
  const tableBlocks = options.tableCaptionPosition === "after"
    ? [table, tableCaption]
    : [tableCaption, table];
  const figureBlocks = options.figureCaptionPosition === "before"
    ? [figureCaption, figure]
    : [figure, figureCaption];

  return [
    ...tableBlocks,
    paragraph("Metinde Tablo 1 kullanilmistir."),
    ...figureBlocks,
    paragraph("Metinde \u015Eekil 1 kullanilmistir."),
  ].join("");
}

function captionParagraph(text, fontSize, alignment) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:r><w:rPr><w:sz w:val="${fontSize * 2}"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

function tableXml(alignment) {
  return `<w:tbl><w:tblPr><w:jc w:val="${alignment}"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Hücre</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
}

function figureParagraph(alignment, kind) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:r>${drawingXml(kind)}</w:r></w:p>`;
}

function drawingXml(kind) {
  const graphicData = kind === "picture"
    ? '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData>'
    : kind === "textbox"
      ? '<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx/></a:graphicData>'
      : '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/unknown"><a:sp/></a:graphicData>';
  return '<w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' +
    `<wp:inline><wp:extent cx="3429000" cy="914400"/><a:graphic>${graphicData}</a:graphic></wp:inline>` +
    "</w:drawing>";
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    content +
    "</w:body></w:document>";
}

function objectRules() {
  return computerRules().filter((rule) => OBJECT_RULE_IDS.includes(rule.id));
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

main();
