require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  parseHeaderFooterPageNumbering,
} = require("../../src/features/analysis/parsers/headerFooterXmlParser.ts");
const {
  normalizePageNumberingSemantics,
} = require("../../src/features/analysis/parsers/pageNumberingSemantics.ts");
const {
  EffectiveFormattingResolver,
} = require("../../src/features/analysis/parsers/effectiveFormattingResolver.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
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
const FRONT_TO_MAIN_RULE_ID = "comu.engineering.computer-engineering.bachelor.page-number-front-to-main";
const MAIN_TO_FINAL_RULE_ID = "comu.engineering.computer-engineering.bachelor.page-number-main-to-final";

function main() {
  assertThreePhasePass();
  assertWrongNumberingFormatFails();
  assertMissingExplicitRestartFails();
  assertMissingPageFieldFails();
  assertWrongFooterAlignmentFails();
  assertTitlePageHiddenFirstPageSemantics();
  assertHeadingWithoutNumberingTransitionDoesNotPass();
  assertMalformedNumberingEvidenceFails();
  assertCrossNamespaceGenericConfiguration();
  assertComputerEngineeringOnboarding();
  assertFoodTechnologyBaseline();

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringPageNumberingRegression.cjs",
    result: "PASS",
    ruleType: "PAGE_NUMBER_SEQUENCE",
    phases: ["lowerRoman-front", "decimal-main", "upperRoman-final"],
    rendererBoundary: "physical page placement is not asserted",
  }, null, 2));
}

function assertThreePhasePass() {
  const results = runPageNumberRules(createThreePhaseDocument());

  assertStatus(results, FRONT_TO_MAIN_RULE_ID, "PASSED", "front to main pass");
  assertStatus(results, MAIN_TO_FINAL_RULE_ID, "PASSED", "main to final pass");
}

function assertWrongNumberingFormatFails() {
  const results = runPageNumberRules(createThreePhaseDocument({
    finalFormat: "lowerRoman",
  }));

  assertStatus(results, MAIN_TO_FINAL_RULE_ID, "FAILED", "wrong final format fails");
}

function assertMissingExplicitRestartFails() {
  const results = runPageNumberRules(createThreePhaseDocument({
    mainStart: undefined,
  }));

  assertStatus(results, FRONT_TO_MAIN_RULE_ID, "FAILED", "missing main restart fails");
}

function assertMissingPageFieldFails() {
  const results = runPageNumberRules(createThreePhaseDocument({
    mainFooterContent: paragraph("2"),
  }));

  assertStatus(results, FRONT_TO_MAIN_RULE_ID, "FAILED", "missing main PAGE field fails");
}

function assertWrongFooterAlignmentFails() {
  const results = runPageNumberRules(createThreePhaseDocument({
    mainFooterContent: simplePageField("center"),
  }));

  assertStatus(results, FRONT_TO_MAIN_RULE_ID, "FAILED", "wrong main alignment fails");
}

function assertTitlePageHiddenFirstPageSemantics() {
  const hidden = runPageNumberRules(createThreePhaseDocument({ frontTitlePg: true }));
  const visibleOrUnknown = runPageNumberRules(createThreePhaseDocument({ frontTitlePg: false }));

  assertStatus(hidden, FRONT_TO_MAIN_RULE_ID, "PASSED", "titlePg without first footer hides inner cover number");
  assertStatus(visibleOrUnknown, FRONT_TO_MAIN_RULE_ID, "FAILED", "missing titlePg does not prove hidden inner cover number");
}

function assertHeadingWithoutNumberingTransitionDoesNotPass() {
  const results = runPageNumberRules(createThreePhaseDocument({
    finalFormat: undefined,
    finalStart: undefined,
  }));

  assertStatus(results, MAIN_TO_FINAL_RULE_ID, "FAILED", "heading alone does not prove final numbering transition");
}

function assertMalformedNumberingEvidenceFails() {
  const results = runPageNumberRules(createThreePhaseDocument({
    finalFormat: "madeUpFormat",
  }));

  assertStatus(results, MAIN_TO_FINAL_RULE_ID, "FAILED", "malformed final numbering evidence fails");
}

function assertCrossNamespaceGenericConfiguration() {
  const rule = {
    ...mainToFinalRule(),
    id: "second-university.engineering.software.bachelor.final-page-numbering",
  };
  const [result] = new RuleEngine(new ValidatorRegistry()).run(
    createThreePhaseDocument(),
    [rule],
  );

  assertEqual(result.status, "PASSED", "same generic configuration under different namespace");
}

function assertComputerEngineeringOnboarding() {
  const rules = computerRules();
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 23, "computer engineering rule count");
  assertCounts(coverageCounts, { COMPLETE: 20, PARTIAL: 3, SHALLOW: 0, MISSING: 0 }, "computer coverage");
  assertCounts(trustCounts, { HIGH: 20, MEDIUM: 3, LOW: 0 }, "computer trust");
}

function assertFoodTechnologyBaseline() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 46, "food technology rule count");
  assertCounts(coverageCounts, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(trustCounts, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function runPageNumberRules(document) {
  return new RuleEngine(new ValidatorRegistry()).run(document, [
    frontToMainRule(),
    mainToFinalRule(),
  ]);
}

function createThreePhaseDocument(options = {}) {
  const {
    frontFormat = "lowerRoman",
    mainFormat = "decimal",
    finalFormat = "upperRoman",
    frontTitlePg = true,
    mainFooterContent = simplePageField("right"),
    finalFooterContent = simplePageField("center"),
  } = options;
  const mainStart = Object.hasOwn(options, "mainStart") ? options.mainStart : 1;
  const finalStart = Object.hasOwn(options, "finalStart") ? options.finalStart : 1;
  const bodyXml =
    heading("İçindekiler") +
    paragraph("front") +
    sectionBreakParagraph("front break", {
      format: frontFormat,
      footerId: "rFooterFront",
      titlePg: frontTitlePg,
    }) +
    heading("Giriş") +
    paragraph("main") +
    sectionBreakParagraph("main break", {
      format: mainFormat,
      start: mainStart,
      footerId: "rFooterMain",
    }) +
    heading("Ekler") +
    paragraph("final") +
    bodySectPr({
      format: finalFormat,
      start: finalStart,
      footerId: "rFooterFinal",
    });

  return semanticDocumentFromXml(
    bodyXml,
    relationshipsXml([
      relationship("rFooterFront", "footer-front.xml", "footer"),
      relationship("rFooterMain", "footer-main.xml", "footer"),
      relationship("rFooterFinal", "footer-final.xml", "footer"),
    ]),
    [
      footerPart("word/footer-front.xml", simplePageField("center")),
      footerPart("word/footer-main.xml", mainFooterContent),
      footerPart("word/footer-final.xml", finalFooterContent),
    ],
    stylesXml(""),
  );
}

function semanticDocumentFromXml(bodyXml, documentRelationshipsXml, headerFooterXmlParts, styles) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const resolveParagraphAlignment = createAlignmentResolver(styles);
  const pageNumbering = normalizePageNumberingSemantics(
    {
      ...parseHeaderFooterPageNumbering(headerFooterXmlParts, resolveParagraphAlignment),
      sections: parsed.pageNumbering.sections,
    },
    documentRelationshipsXml,
  );
  const withPageNumbering = { ...parsed, pageNumbering };
  const marked = markRequiredSectionHeadings(withPageNumbering, computerRules());
  const headed = normalizeDocumentHeadings(marked, computerRules());
  const scoped = normalizeAcademicDocumentScopes(headed, computerRules());

  return normalizeAcademicSections(scoped, computerRules());
}

function frontToMainRule() {
  return ruleById(FRONT_TO_MAIN_RULE_ID);
}

function mainToFinalRule() {
  return ruleById(MAIN_TO_FINAL_RULE_ID);
}

function ruleById(ruleId) {
  const rule = computerRules().find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error(`Rule not resolved: ${ruleId}`);
  }

  return rule;
}

function computerRules() {
  return new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + content + "</w:body></w:document>";
}

function heading(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function sectionBreakParagraph(text, options) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r><w:pPr>${sectPr(options)}</w:pPr></w:p>`;
}

function bodySectPr(options) {
  return sectPr(options);
}

function sectPr(options) {
  return `<w:sectPr>${options.titlePg ? "<w:titlePg/>" : ""}${options.footerId ? `<w:footerReference w:type="default" r:id="${options.footerId}"/>` : ""}${pgNumType(options)}</w:sectPr>`;
}

function pgNumType(options) {
  const attributes = [
    options.format ? `w:fmt="${options.format}"` : "",
    options.start !== undefined ? `w:start="${options.start}"` : "",
  ].filter(Boolean).join(" ");

  return attributes ? `<w:pgNumType ${attributes}/>` : "";
}

function relationshipsXml(items) {
  return '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + items.join("") + "</Relationships>";
}

function relationship(id, target, location) {
  return `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${location}" Target="${target}"/>`;
}

function footerPart(path, content) {
  return {
    path,
    location: "footer",
    xml: `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${content}</w:ftr>`,
  };
}

function createAlignmentResolver(styles) {
  const parsedStyles = parseStylesXml(styles);
  const resolver = new EffectiveFormattingResolver(
    parsedStyles.styles,
    parsedStyles.documentDefaults,
  );

  return (paragraphStyleId, directAlignment) =>
    resolver.resolveParagraphAlignment(paragraphStyleId, directAlignment);
}

function stylesXml(styles) {
  return '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + styles + "</w:styles>";
}

function simplePageField(alignment) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:fldSimple w:instr=" PAGE \\\\* MERGEFORMAT "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>`;
}

function assertStatus(results, ruleId, expectedStatus, message) {
  const result = results.find((candidate) => candidate.ruleId === ruleId);

  if (!result) {
    throw new Error(`Result not found: ${ruleId}`);
  }

  assertEqual(result.status, expectedStatus, message);
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
