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
const WIDTH_RULE_ID = "comu.engineering.computer-engineering.bachelor.figure-minimum-width";

function main() {
  assertWidth(emuForCm(9), "PASSED", "exactly 9.0 cm academic picture passes");
  assertWidth(emuForCm(9.5), "PASSED", "greater than 9 cm academic picture passes");
  assertWidth(emuForCm(8.99), "FAILED", "less than 9 cm academic picture fails");
  assertWidth(emuForCm(9) + 1, "PASSED", "rounding boundary just above 9 cm passes");
  assertWidth(emuForCm(9) - 1, "FAILED", "rounding boundary just below 9 cm fails");
  assertMultipleFigures();
  assertMissingAndMalformedExtent();
  assertApplicabilityProtections();
  assertGenericRuleTypeWorksAcrossNamespace();
  assertBaselines();

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringFigureWidthRegression.cjs",
    result: "PASS",
    unit: "wp:extent EMU, 360000 EMU per centimeter",
    minimumWidthCm: 9,
  }, null, 2));
}

function assertWidth(widthEmu, expectedStatus, message) {
  const result = validateWidth(figureDocument([picture(widthEmu, 1)])).result;

  assertEqual(result.status, expectedStatus, message);
}

function assertMultipleFigures() {
  assertEqual(
    validateWidth(figureDocument([picture(emuForCm(9), 1), picture(emuForCm(10), 2)])).result.status,
    "PASSED",
    "multiple compliant figures pass",
  );
  assertEqual(
    validateWidth(figureDocument([picture(emuForCm(9), 1), picture(emuForCm(8.5), 2)])).result.status,
    "FAILED",
    "one narrow figure fails among multiple figures",
  );
}

function assertMissingAndMalformedExtent() {
  assertEqual(
    validateWidth(figureDocument([picture(null, 1)])).result.status,
    "FAILED",
    "missing extent does not false pass",
  );
  assertEqual(
    validateWidth(figureDocument([picture("bad", 1)])).result.status,
    "FAILED",
    "malformed extent does not false pass",
  );
}

function assertApplicabilityProtections() {
  assertEqual(
    validateWidth(figureDocument([picture(emuForCm(5), 1, "unknown")])).result.status,
    "NOT_APPLICABLE",
    "generic unknown drawing is not figure evidence",
  );
  assertEqual(
    validateWidth(figureDocument([picture(emuForCm(5), 1, "textbox")])).result.status,
    "NOT_APPLICABLE",
    "textbox-only representation is not figure evidence",
  );
  assertEqual(
    validateWidth(figureDocument([picture(emuForCm(5), 1, "textbox")])).document.objectSemantics.resolutions[0]?.status,
    "excluded",
    "textbox-only representation remains excluded AcademicObjectResolution",
  );
  assertEqual(
    validateWidth(
      unknownDrawing(emuForCm(5)) +
        paragraph("Ara metin") +
        figureDocument([picture(emuForCm(9), 1)]),
    ).result.status,
    "PASSED",
    "unrelated drawing width is not used for associated figure",
  );
  assertEqual(
    validateWidth(drawingParagraph(emuForCm(5), "picture") + paragraph("Ara metin") + caption(1)).result.status,
    "NOT_APPLICABLE",
    "wrong caption association does not use unrelated drawing width",
  );
}

function assertGenericRuleTypeWorksAcrossNamespace() {
  const genericRule = {
    ...widthRule(),
    id: "second-university.engineering.software.bachelor.figure-minimum-width",
  };
  const document = validateWidth(figureDocument([picture(emuForCm(9), 1)])).document;
  const [result] = new RuleEngine(new ValidatorRegistry()).run(document, [genericRule]);

  assertEqual(result.status, "PASSED", "same OBJECT_MIN_WIDTH type works under different namespace");
}

function assertBaselines() {
  const computerRules = computerRulesResolved();
  const foodRules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const computerCoverage = countBy(computerRules, (rule) => metadata(rule).coverage);
  const computerTrust = countBy(computerRules, (rule) => metadata(rule).trust);
  const foodCoverage = countBy(foodRules, (rule) => metadata(rule).coverage);
  const foodTrust = countBy(foodRules, (rule) => metadata(rule).trust);

  assertEqual(computerRules.length, 44, "computer engineering rule count");
  assertCounts(computerCoverage, { COMPLETE: 33, PARTIAL: 11, SHALLOW: 0, MISSING: 0 }, "computer coverage");
  assertCounts(computerTrust, { HIGH: 33, MEDIUM: 11, LOW: 0 }, "computer trust");
  assertEqual(foodRules.length, 46, "food technology rule count");
  assertCounts(foodCoverage, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(foodTrust, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function validateWidth(bodyXml) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const document = normalizeAcademicDocumentScopes(parsed, computerRulesResolved());
  const [result] = new RuleEngine(new ValidatorRegistry()).run(document, [widthRule()]);

  return { document, result };
}

function figureDocument(figures) {
  return figures.join(paragraph("Ara metin"));
}

function picture(widthEmu, number, kind = "picture") {
  return drawingParagraph(widthEmu, kind) + caption(number);
}

function drawingParagraph(widthEmu, kind) {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${drawingXml(widthEmu, kind)}</w:r></w:p>`;
}

function unknownDrawing(widthEmu) {
  return drawingParagraph(widthEmu, "unknown");
}

function drawingXml(widthEmu, kind) {
  const extent = widthEmu === null
    ? ""
    : `<wp:extent cx="${widthEmu}" cy="${emuForCm(3)}"/>`;
  const graphicData = kind === "picture"
    ? '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData>'
    : kind === "textbox"
      ? '<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx/></a:graphicData>'
      : '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/unknown"><a:sp/></a:graphicData>';

  return '<w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' +
    `<wp:inline>${extent}<a:graphic>${graphicData}</a:graphic></wp:inline>` +
    "</w:drawing>";
}

function caption(number) {
  return `<w:p><w:r><w:t>\u015Eekil ${number}. Genislik testi</w:t></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    content +
    "</w:body></w:document>";
}

function emuForCm(value) {
  return Math.round(value * 360000);
}

function widthRule() {
  const rule = computerRulesResolved().find((candidate) => candidate.id === WIDTH_RULE_ID);
  if (!rule) throw new Error(`Rule not resolved: ${WIDTH_RULE_ID}`);
  return rule;
}

function computerRulesResolved() {
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
