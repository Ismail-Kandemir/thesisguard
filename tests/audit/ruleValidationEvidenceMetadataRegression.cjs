require("../golden/experimentalGoldenRegression.cjs");

const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const {
  getRuleValidationMetadata,
} = require("../../src/features/analysis/rules/ruleValidationMetadata.ts");

const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

const PAGE_NUMBER_RULE_ID = "comu.applied-sciences.food-technology.bachelor.page-number";
const PAGE_NUMBER_SEQUENCE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.page-number-sequence";

function main() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 46, "production rule count");
  assertEqual(
    rules.filter((rule) => rule.validationEvidence).length,
    46,
    "production explicit validation evidence count",
  );
  assertCounts(coverageCounts, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "coverage");
  assertCounts(trustCounts, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "trust");
  assertRuleMetadata(rules, PAGE_NUMBER_RULE_ID, "PARTIAL", "MEDIUM");
  assertRuleMetadata(rules, PAGE_NUMBER_SEQUENCE_RULE_ID, "COMPLETE", "HIGH");
  assertSyntheticConservativeDefault();
  assertSyntheticExplicitEvidence();
  assertParentEvidenceResolution();
  assertOverrideDoesNotInheritParentEvidence();
  assertMalformedEvidenceFallback();

  console.log(JSON.stringify({
    audit: "ruleValidationEvidenceMetadataRegression.cjs",
    result: "PASS",
    productionRules: rules.length,
    explicitProductionEvidence: 46,
    coverageCounts,
    trustCounts,
    syntheticMissingEvidence: "MISSING_LOW",
    syntheticExplicitEvidence: "COMPLETE_HIGH",
    overrideInheritance: "NO_PARENT_TRUST_LEAK",
    malformedEvidence: "MISSING_LOW",
  }, null, 2));
}

function assertSyntheticConservativeDefault() {
  const metadata = getRuleValidationMetadata(createRule({
    id: "second-university.engineering.software.bachelor.font-size",
    type: "FONT_SIZE",
  }));

  assertEqual(metadata.coverage, "MISSING", "synthetic missing coverage");
  assertEqual(metadata.trust, "LOW", "synthetic missing trust");
}

function assertSyntheticExplicitEvidence() {
  const metadata = getRuleValidationMetadata(createRule({
    id: "second-university.engineering.software.bachelor.font-size",
    type: "FONT_SIZE",
    validationEvidence: { coverage: "COMPLETE", trust: "HIGH" },
  }));

  assertEqual(metadata.coverage, "COMPLETE", "synthetic explicit coverage");
  assertEqual(metadata.trust, "HIGH", "synthetic explicit trust");
}

function assertParentEvidenceResolution() {
  const [resolvedRule] = new RuleResolver().resolve([
    createRuleSet("synthetic.parent", [
      createRule({
        id: "synthetic.parent.font-size",
        type: "FONT_SIZE",
        validationEvidence: { coverage: "COMPLETE", trust: "HIGH" },
      }),
    ]),
    createRuleSet("synthetic.child", [], [{ id: "synthetic.parent", scopeLevel: "university" }]),
  ]);

  assertEqual(resolvedRule.id, "synthetic.parent.font-size", "parent resolved rule id");
  assertEqual(metadata(resolvedRule).coverage, "COMPLETE", "parent coverage");
  assertEqual(metadata(resolvedRule).trust, "HIGH", "parent trust");
}

function assertOverrideDoesNotInheritParentEvidence() {
  const [resolvedRule] = new RuleResolver().resolve([
    createRuleSet("synthetic.parent", [
      createRule({
        id: "synthetic.parent.font-size",
        type: "FONT_SIZE",
        validationEvidence: { coverage: "COMPLETE", trust: "HIGH" },
      }),
    ]),
    createRuleSet("synthetic.child", [
      createRule({
        id: "synthetic.child.font-size",
        type: "FONT_SIZE",
        overrides: [{ ruleId: "synthetic.parent.font-size" }],
      }),
    ], [{ id: "synthetic.parent", scopeLevel: "university" }]),
  ]);

  assertEqual(resolvedRule.id, "synthetic.child.font-size", "override resolved rule id");
  assertEqual(metadata(resolvedRule).coverage, "MISSING", "override coverage");
  assertEqual(metadata(resolvedRule).trust, "LOW", "override trust");
}

function assertMalformedEvidenceFallback() {
  const metadata = getRuleValidationMetadata(createRule({
    id: "second-university.engineering.software.bachelor.malformed-evidence",
    validationEvidence: { coverage: "TOTAL", trust: "CERTAIN" },
  }));

  assertEqual(metadata.coverage, "MISSING", "malformed coverage fallback");
  assertEqual(metadata.trust, "LOW", "malformed trust fallback");
}

function createRuleSet(id, rules, extensions = undefined) {
  return {
    id,
    metadata: {
      university: { id: "synthetic", name: "Synthetic University", slug: "synthetic" },
      thesisType: { id: "bachelor", name: "Bachelor", slug: "bachelor" },
      version: "1.1.0",
    },
    ...(extensions ? { extends: extensions } : {}),
    rules,
  };
}

function createRule(overrides = {}) {
  return {
    id: "synthetic.rule",
    type: "REQUIRED_SECTION",
    title: "Synthetic Rule",
    description: "Synthetic validation evidence rule.",
    category: "structure",
    expected: { section: "Synthetic Section", required: true },
    severity: "error",
    score: 10,
    message: "Synthetic failure.",
    solution: "Fix the synthetic rule.",
    enabled: true,
    version: "1.1.0",
    ...overrides,
  };
}

function assertRuleMetadata(rules, ruleId, coverage, trust) {
  const rule = rules.find((item) => item.id === ruleId);

  if (!rule) {
    throw new Error(`Rule not resolved: ${ruleId}`);
  }

  assertEqual(metadata(rule).coverage, coverage, `${ruleId}: coverage`);
  assertEqual(metadata(rule).trust, trust, `${ruleId}: trust`);
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
