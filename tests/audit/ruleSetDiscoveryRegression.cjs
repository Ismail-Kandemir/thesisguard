require("../golden/experimentalGoldenRegression.cjs");

const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const {
  RuleSetLoadError,
  loadAvailableRuleSets,
  loadDiscoveredRuleSets,
} = require("../../src/features/analysis/rules/RuleLoader.ts");

const PRODUCTION_SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

function main() {
  const productionRuleSets = loadAvailableRuleSets();
  const productionIds = productionRuleSets.map((ruleSet) => ruleSet.id).sort();
  const selectedIds = new RuleSetSelector(undefined, productionRuleSets)
    .select(PRODUCTION_SELECTION)
    .map((ruleSet) => ruleSet.id)
    .sort();

  assertDeepEqual(productionIds, [
    "comu.applied-sciences.food-technology.bachelor",
    "comu.applied-sciences.food-technology.bachelor.experimental",
    "comu.applied-sciences.food-technology.bachelor.source-research",
    "comu.bachelor",
  ], "production discovered rule set ids");
  assertDeepEqual(selectedIds, [
    "comu.applied-sciences.food-technology.bachelor",
    "comu.applied-sciences.food-technology.bachelor.experimental",
    "comu.bachelor",
  ], "production selection resolved rule set ids");

  assertSyntheticDiscovery();
  assertDuplicateSelectionFails();
  assertMalformedCandidateFails();

  console.log(JSON.stringify({
    audit: "ruleSetDiscoveryRegression.cjs",
    result: "PASS",
    productionRuleSets: productionRuleSets.length,
    productionSelection: selectedIds,
    syntheticDiscovery: "PASS",
    duplicateSelection: "FAILED_SAFELY",
    malformedCandidate: "FAILED_SAFELY",
  }, null, 2));
}

function assertSyntheticDiscovery() {
  const parent = createRuleSet("second-university.bachelor", {
    university: entity("second-university", "Second University"),
    thesisType: entity("bachelor", "Lisans"),
    version: "1.1.0",
  });
  const child = createRuleSet("second-university.engineering.software.bachelor", {
    university: entity("second-university", "Second University"),
    faculty: entity("engineering", "Engineering Faculty"),
    department: entity("software", "Software Engineering"),
    thesisType: entity("bachelor", "Lisans"),
    version: "1.1.0",
  }, [{ id: parent.id, scopeLevel: "university", version: "1.1.0" }]);
  const discovered = loadDiscoveredRuleSets({
    "synthetic/second-university/bachelor.json": parent,
    "synthetic/second-university/engineering/software/bachelor.json": child,
  });
  const selected = new RuleSetSelector([
    {
      university: child.metadata.university,
      faculty: child.metadata.faculty,
      department: child.metadata.department,
      thesisType: child.metadata.thesisType,
    },
  ], discovered).select({
    universityId: "second-university",
    facultyId: "engineering",
    departmentId: "software",
    thesisTypeId: "bachelor",
  });

  assertDeepEqual(
    selected.map((ruleSet) => ruleSet.id).sort(),
    [parent.id, child.id],
    "synthetic discovered selection",
  );
}

function assertDuplicateSelectionFails() {
  const metadata = {
    university: entity("duplicate-u", "Duplicate University"),
    thesisType: entity("bachelor", "Lisans"),
    version: "1.1.0",
  };

  assertThrows(
    () => loadDiscoveredRuleSets({
      "synthetic/duplicate-a.json": createRuleSet("duplicate-u.bachelor.a", metadata),
      "synthetic/duplicate-b.json": createRuleSet("duplicate-u.bachelor.b", metadata),
    }),
    RuleSetLoadError,
    "Aynı academic selection",
    "duplicate selection",
  );
}

function assertMalformedCandidateFails() {
  assertThrows(
    () => loadDiscoveredRuleSets({
      "synthetic/malformed.json": {
        id: "malformed.rule-set",
        metadata: {
          university: entity("malformed-u", "Malformed University"),
        },
        rules: [],
      },
    }),
    RuleSetLoadError,
    "metadata.thesisType",
    "malformed discovered candidate",
  );
}

function createRuleSet(id, metadata, extensions = undefined) {
  return {
    id,
    metadata,
    ...(extensions ? { extends: extensions } : {}),
    rules: [createRule(`${id}.required-section`)],
  };
}

function createRule(id) {
  return {
    id,
    type: "REQUIRED_SECTION",
    title: "Synthetic Required Section",
    description: "Synthetic required section rule.",
    category: "structure",
    expected: { section: "Synthetic Section", required: true },
    severity: "error",
    score: 10,
    message: "Synthetic section missing.",
    solution: "Add the synthetic section.",
    enabled: true,
    version: "1.1.0",
  };
}

function entity(id, name) {
  return { id, name, slug: id };
}

function assertThrows(fn, errorClass, expectedMessagePart, message) {
  try {
    fn();
  } catch (error) {
    if (
      error instanceof errorClass &&
      error.message.includes(expectedMessagePart)
    ) {
      return;
    }

    throw new Error(`${message}: unexpected error ${error}`);
  }

  throw new Error(`${message}: expected throw`);
}

function assertDeepEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    throw new Error(`${message}: expected ${expectedText}, received ${actualText}`);
  }
}

main();
