require("../golden/experimentalGoldenRegression.cjs");

const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const {
  FontFamilyValidator,
} = require("../../src/features/analysis/rules/validators/FontFamilyValidator.ts");
const {
  FontSizeValidator,
} = require("../../src/features/analysis/rules/validators/FontSizeValidator.ts");
const {
  LineSpacingValidator,
} = require("../../src/features/analysis/rules/validators/LineSpacingValidator.ts");

const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

const PAGE_NUMBER_RULE_ID = "comu.applied-sciences.food-technology.bachelor.page-number";
const PAGE_NUMBER_SEQUENCE_RULE_ID = "comu.applied-sciences.food-technology.bachelor.page-number-sequence";
const CONDITIONAL_LIST_RULE_IDS = new Set([
  "comu.applied-sciences.food-technology.bachelor.list-of-tables",
  "comu.applied-sciences.food-technology.bachelor.list-of-figures",
  "comu.applied-sciences.food-technology.bachelor.list-of-abbreviations",
]);

function main() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));
  const registry = createProductionRegistry();
  const duplicateIds = findDuplicateIds(rules);
  const missingValidators = rules.filter((rule) => !registry.getValidator(rule.id));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 46, "resolved rule count");
  assertEqual(duplicateIds.length, 0, "duplicate rule ids");
  assertEqual(missingValidators.length, 0, "missing validators");
  assertCounts(coverageCounts, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "coverage");
  assertCounts(trustCounts, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "trust");
  assertMetadata(rules, PAGE_NUMBER_RULE_ID, "PARTIAL", "MEDIUM");
  assertMetadata(rules, PAGE_NUMBER_SEQUENCE_RULE_ID, "COMPLETE", "HIGH");

  for (const ruleId of CONDITIONAL_LIST_RULE_IDS) {
    assertMetadata(rules, ruleId, "COMPLETE", "HIGH");
  }

  console.log(JSON.stringify({
    phase: "4F-11",
    result: "PASS",
    audit: "coveragePromotionConsistencyAudit.cjs",
    resolvedRules: rules.length,
    missingValidators: missingValidators.length,
    duplicateIds: duplicateIds.length,
    coverageCounts,
    trustCounts,
  }, null, 2));
}

function createProductionRegistry() {
  const registry = new ValidatorRegistry();
  registry.register("comu.bachelor.typography.font-family", new FontFamilyValidator());
  registry.register("comu.bachelor.typography.font-size", new FontSizeValidator());
  registry.register("comu.bachelor.spacing.line-height", new LineSpacingValidator());

  return registry;
}

function metadata(rule) {
  if (!rule.validation) {
    throw new Error(`${rule.id}: validation metadata missing`);
  }

  return rule.validation;
}

function assertMetadata(rules, ruleId, coverage, trust) {
  const rule = rules.find((item) => item.id === ruleId);

  if (!rule) {
    throw new Error(`Rule not resolved: ${ruleId}`);
  }

  assertEqual(metadata(rule).coverage, coverage, `${ruleId}: coverage`);
  assertEqual(metadata(rule).trust, trust, `${ruleId}: trust`);
}

function findDuplicateIds(rules) {
  const seen = new Set();
  const duplicates = [];

  for (const rule of rules) {
    if (seen.has(rule.id)) {
      duplicates.push(rule.id);
    }
    seen.add(rule.id);
  }

  return duplicates;
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
