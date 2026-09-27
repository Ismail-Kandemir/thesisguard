require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");

const PAGE_SIZE_RULE_ID = "comu.engineering.computer-engineering.bachelor.page-size";
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
  assertPageSize("exact A4 portrait", bodySection(pgSz(11906, 16838)), "PASSED");
  assertPageSize("rounded A4 portrait", bodySection(pgSz(11907, 16839)), "PASSED");
  assertPageSize("A4 landscape orientation", bodySection(pgSz(16838, 11906, "landscape")), "FAILED");
  assertPageSize("US Letter", bodySection(pgSz(12240, 15840)), "FAILED");
  assertPageSize("clearly wrong", bodySection(pgSz(10000, 10000)), "FAILED");
  assertPageSize("missing pgSz", bodySection(""), "FAILED");
  assertPageSize("malformed pgSz", bodySection('<w:pgSz w:w="bad" w:h="16838"/>'), "FAILED");
  assertPageSize(
    "multi-section all A4",
    paragraphSection("bir", pgSz(11906, 16838)) + bodySection(pgSz(11907, 16839)),
    "PASSED",
  );
  assertPageSize(
    "multi-section one non-A4",
    paragraphSection("bir", pgSz(11906, 16838)) + bodySection(pgSz(12240, 15840)),
    "FAILED",
  );
  assertCrossNamespaceRegistryDispatch();
  assertMalformedExpectedDoesNotPassSilently();
  assertComputerEngineeringOnboarding();
  assertFoodTechnologyBaseline();

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringPageSizeRegression.cjs",
    result: "PASS",
    ruleType: "PAGE_SIZE",
    normalization: "w:pgSz twips/dxa to millimeters",
    toleranceMm: pageSizeRule().expected.toleranceMm,
    multiSectionPolicy: "all parsed Word sections must satisfy expected page size",
  }, null, 2));
}

function assertPageSize(label, bodyXml, expectedStatus) {
  const [result] = new RuleEngine(new ValidatorRegistry()).run(
    parseDocumentXml(wrapDocumentXml(bodyXml)),
    [pageSizeRule()],
  );

  assertEqual(result.status, expectedStatus, `${label} status`);
  assertEqual(result.passed, expectedStatus === "PASSED", `${label} passed flag`);
}

function assertCrossNamespaceRegistryDispatch() {
  const validator = new ValidatorRegistry().getValidator({
    ...pageSizeRule(),
    id: "second-university.engineering.software.bachelor.page-size",
  });

  assertEqual(
    validator?.constructor.name,
    "PageSizeValidator",
    "cross namespace PAGE_SIZE dispatch",
  );
}

function assertMalformedExpectedDoesNotPassSilently() {
  const malformedRule = {
    ...pageSizeRule(),
    id: "comu.engineering.computer-engineering.bachelor.malformed-page-size",
    expected: { widthMm: 210, heightMm: 297, toleranceMm: -1 },
  };

  assertThrows(
    () => new RuleEngine(new ValidatorRegistry()).run(
      parseDocumentXml(wrapDocumentXml(bodySection(pgSz(11906, 16838)))),
      [malformedRule],
    ),
    "PAGE_SIZE kuralı",
    "malformed expected does not pass silently",
  );
}

function assertComputerEngineeringOnboarding() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const rule = rules.find((candidate) => candidate.id === PAGE_SIZE_RULE_ID);

  assert(rule, "computer engineering page size rule resolved");
  assertEqual(rule.type, "PAGE_SIZE", "computer page size rule type");
  assertEqual(rule.validation.coverage, "COMPLETE", "computer page size coverage");
  assertEqual(rule.validation.trust, "HIGH", "computer page size trust");
}

function assertFoodTechnologyBaseline() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 46, "food technology rule count");
  assertCounts(coverageCounts, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(trustCounts, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function pageSizeRule() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const rule = rules.find((candidate) => candidate.id === PAGE_SIZE_RULE_ID);

  if (!rule) {
    throw new Error(`Rule not resolved: ${PAGE_SIZE_RULE_ID}`);
  }

  return rule;
}

function paragraphSection(text, sectionProperties) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r><w:pPr><w:sectPr>${sectionProperties}</w:sectPr></w:pPr></w:p>`;
}

function bodySection(sectionProperties) {
  return `<w:p><w:r><w:t>metin</w:t></w:r></w:p><w:sectPr>${sectionProperties}</w:sectPr>`;
}

function pgSz(widthTwips, heightTwips, orientation = "portrait") {
  return `<w:pgSz w:w="${widthTwips}" w:h="${heightTwips}" w:orient="${orientation}"/>`;
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>';
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

function assertThrows(fn, expectedMessagePart, message) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessagePart)) {
      return;
    }

    throw new Error(`${message}: unexpected error ${error}`);
  }

  throw new Error(`${message}: expected throw`);
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
