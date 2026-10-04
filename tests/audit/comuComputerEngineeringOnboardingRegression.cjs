require("../golden/experimentalGoldenRegression.cjs");

const fs = require("node:fs");
const path = require("node:path");

const {
  ACADEMIC_CATALOG,
} = require("../../src/features/analysis/catalog/AcademicCatalog.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");

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

const COMPUTER_RULE_SET_ID = "comu.engineering.computer-engineering.bachelor";
const MISSING_VALIDATOR_MESSAGE = "Bu kural için kayıtlı validator bulunamadı.";

function main() {
  const availableRuleSets = loadAvailableRuleSets();
  const catalogEntry = ACADEMIC_CATALOG.find((entry) =>
    entry.university.id === "comu" &&
    entry.faculty?.id === "engineering" &&
    entry.department?.id === "computer-engineering" &&
    entry.thesisType.id === "bachelor"
  );

  assert(catalogEntry, "computer engineering catalog entry discovered");
  assertEqual(catalogEntry.studyTypes, undefined, "computer engineering study types");

  const selectedRuleSets = new RuleSetSelector(ACADEMIC_CATALOG, availableRuleSets)
    .select(COMPUTER_SELECTION);
  assertDeepEqual(
    selectedRuleSets.map((ruleSet) => ruleSet.id),
    [COMPUTER_RULE_SET_ID],
    "computer engineering selection",
  );

  const rules = new RuleResolver().resolve(selectedRuleSets);
  const registry = new ValidatorRegistry();
  const missingValidators = rules.filter((rule) => !registry.getValidator(rule));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);
  const ruleTypes = Array.from(new Set(rules.map((rule) => rule.type))).sort();

  assertEqual(rules.length, 47, "computer engineering rule count");
  assertEqual(missingValidators.length, 0, "computer engineering missing validator count");
  assertCounts(coverageCounts, { COMPLETE: 33, PARTIAL: 14, SHALLOW: 0, MISSING: 0 }, "computer coverage");
  assertCounts(trustCounts, { HIGH: 33, MEDIUM: 14, LOW: 0 }, "computer trust");
  assertNoProgramSpecificRegistryBranch();
  assertFoodTechnologyBaseline();
  assertUnsupportedRequirementIsNotSilentPass();
  assertNoUnmodeledRequirementRule(rules);

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringOnboardingRegression.cjs",
    result: "PASS",
    ruleSetId: COMPUTER_RULE_SET_ID,
    selectedRuleSets: selectedRuleSets.map((ruleSet) => ruleSet.id),
    computerRules: rules.length,
    ruleTypes,
    coverageCounts,
    trustCounts,
    foodTechnologyBaseline: "46_RULES_COMPLETE_45_PARTIAL_1_HIGH_45_MEDIUM_1",
    programSpecificRegistryBranch: "NOT_REQUIRED",
    unsupportedRequirement: "FAILED_WITH_MISSING_VALIDATOR",
  }, null, 2));
}

function assertFoodTechnologyBaseline() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 46, "food technology rule count");
  assertCounts(coverageCounts, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(trustCounts, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function assertNoProgramSpecificRegistryBranch() {
  const registrySource = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/features/analysis/rules/ValidatorRegistry.ts",
    ),
    "utf8",
  );

  assert(
    !registrySource.includes("computer-engineering") &&
      !registrySource.includes("Bilgisayar M"),
    "ValidatorRegistry must not contain computer engineering specific registration",
  );
}

function assertUnsupportedRequirementIsNotSilentPass() {
  const unsupportedRule = {
    id: "comu.engineering.computer-engineering.bachelor.paper-size",
    type: "PAPER_SIZE",
    title: "Kagit Standardi",
    description: "A4 kagit standardi henuz production validator ile modellenmemistir.",
    category: "format",
    expected: "A4",
    severity: "error",
    score: 10,
    message: "Kagit standardi dogrulanamadi.",
    solution: "A4 validator destegi eklendiginde bu requirement modellenmelidir.",
    enabled: true,
    version: "1.1.0",
  };
  const [result] = new RuleEngine(new ValidatorRegistry()).run({}, [unsupportedRule]);

  assertEqual(result.status, "FAILED", "unsupported requirement status");
  assertEqual(result.passed, false, "unsupported requirement passed flag");
  assertEqual(result.message, MISSING_VALIDATOR_MESSAGE, "unsupported requirement message");
}

function assertNoUnmodeledRequirementRule(rules) {
  const unsupportedIds = new Set([
    "comu.engineering.computer-engineering.bachelor.paper-size",
    "comu.engineering.computer-engineering.bachelor.page-number",
    "comu.engineering.computer-engineering.bachelor.citation-reference-matching",
  ]);

  for (const rule of rules) {
    assert(!unsupportedIds.has(rule.id), `unmodeled requirement promoted to rule: ${rule.id}`);
  }
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main();
