require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const {
  RequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/RequiredSectionValidator.ts");

const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

const EXPECTED_REGISTERED_RULE_TYPES = 31;
const MISSING_VALIDATOR_MESSAGE = "Bu kural için kayıtlı validator bulunamadı.";

function main() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));
  const registry = new ValidatorRegistry();
  const resolved = rules.map((rule) => ({
    rule,
    validator: registry.getValidator(rule),
  }));
  const missing = resolved.filter((item) => !item.validator);

  assertEqual(rules.length, 46, "production rule count");
  assertEqual(missing.length, 0, "production missing validator count");
  assertEqual(
    registry.getRegisteredRuleTypeCount(),
    EXPECTED_REGISTERED_RULE_TYPES,
    "registered rule type count",
  );
  assertValidator(resolved, "comu.bachelor.typography.font-family", "FontFamilyValidator");
  assertValidator(resolved, "comu.bachelor.typography.font-size", "FontSizeValidator");
  assertValidator(resolved, "comu.bachelor.spacing.line-height", "LineSpacingValidator");
  assertValidator(resolved, "comu.bachelor.format.alignment", "AlignmentValidator");
  assertValidator(resolved, "comu.bachelor.margin.left", "MarginValidator", "left");
  assertValidator(resolved, "comu.bachelor.margin.right", "MarginValidator", "right");
  assertValidator(resolved, "comu.bachelor.margin.bottom", "MarginValidator", "bottom");
  assertValidator(
    resolved,
    "comu.applied-sciences.food-technology.bachelor.margin.top",
    "MarginValidator",
    "top",
  );
  assertValidator(resolved, "comu.bachelor.heading.heading2", "HeadingValidator");
  assertValidator(
    resolved,
    "comu.applied-sciences.food-technology.bachelor.references",
    "BibliographyReferencesValidator",
  );
  assertValidator(
    resolved,
    "comu.applied-sciences.food-technology.bachelor.summary-tr",
    "RequiredSectionValidator",
  );
  assertValidator(
    resolved,
    "comu.applied-sciences.food-technology.bachelor.page-number",
    "PageNumberValidator",
  );
  assertValidator(
    resolved,
    "comu.applied-sciences.food-technology.bachelor.page-number-sequence",
    "PageNumberSequenceValidator",
  );
  assertValidator(
    resolved,
    "comu.applied-sciences.food-technology.bachelor.experimental.section-order",
    "SectionOrderValidator",
  );
  assertSyntheticCoverFieldDispatch(registry);
  assertSyntheticCoverFieldFormatDispatch(registry);
  assertSyntheticCitationBibliographyConsistencyDispatch(registry);
  assertSyntheticDirectQuotationPageLocatorDispatch(registry);

  assertDuplicateRegistration();
  assertInvalidRegistration();
  assertSyntheticCrossUniversityDispatch(registry);
  assertUnsupportedRuleType(registry);

  console.log(JSON.stringify({
    audit: "validatorRegistryTypeDispatchRegression.cjs",
    result: "PASS",
    productionRules: rules.length,
    missingValidators: missing.length,
    registeredRuleTypes: registry.getRegisteredRuleTypeCount(),
    syntheticCrossUniversity: "PASS",
    unsupportedRuleType: "FAILED_WITH_MISSING_VALIDATOR",
  }, null, 2));
}

function assertDuplicateRegistration() {
  const registry = new ValidatorRegistry();

  assertThrows(
    () => registry.register("REQUIRED_SECTION", new RequiredSectionValidator()),
    "Duplicate validator registration",
    "duplicate registration",
  );
}

function assertInvalidRegistration() {
  const registry = new ValidatorRegistry();

  assertThrows(
    () => registry.register("UNKNOWN_RULE_TYPE", new RequiredSectionValidator()),
    "Unsupported rule type registration",
    "invalid registration",
  );
}

function assertSyntheticCrossUniversityDispatch(registry) {
  const validator = registry.getValidator({
    ...createBaseRule(),
    id: "second-university.engineering.software-engineering.bachelor.page-number",
    type: "PAGE_NUMBER",
  });

  assertEqual(
    validator?.constructor.name,
    "PageNumberValidator",
    "synthetic cross-university PAGE_NUMBER validator",
  );
}

function assertSyntheticCoverFieldDispatch(registry) {
  const validator = registry.getValidator({
    ...createBaseRule(),
    id: "second-university.engineering.software-engineering.bachelor.inner-cover-work-type",
    type: "COVER_FIELD_PRESENCE",
    expected: {
      coverScope: "inner-cover",
      field: "work-type",
      required: true,
      minConfidence: "medium",
    },
  });

  assertEqual(
    validator?.constructor.name,
    "CoverFieldPresenceValidator",
    "synthetic cross-university COVER_FIELD_PRESENCE validator",
  );
}

function assertSyntheticCoverFieldFormatDispatch(registry) {
  const validator = registry.getValidator({
    ...createBaseRule(),
    id: "second-university.engineering.software-engineering.bachelor.inner-cover-work-type-format",
    type: "COVER_FIELD_FORMAT",
    expected: {
      coverScope: "inner-cover",
      field: "work-type",
      minConfidence: "medium",
      fontFamily: "Times New Roman",
      fontSize: 12,
      bold: true,
    },
  });

  assertEqual(
    validator?.constructor.name,
    "CoverFieldFormatValidator",
    "synthetic cross-university COVER_FIELD_FORMAT validator",
  );
}

function assertSyntheticCitationBibliographyConsistencyDispatch(registry) {
  const validator = registry.getValidator({
    ...createBaseRule(),
    id: "second-university.engineering.software-engineering.bachelor.citation-bibliography-consistency",
    type: "CITATION_BIBLIOGRAPHY_CONSISTENCY",
    category: "citation",
    expected: true,
  });

  assertEqual(
    validator?.constructor.name,
    "CitationBibliographyConsistencyValidator",
    "synthetic cross-university CITATION_BIBLIOGRAPHY_CONSISTENCY validator",
  );
}

function assertSyntheticDirectQuotationPageLocatorDispatch(registry) {
  const validator = registry.getValidator({
    ...createBaseRule(),
    id: "second-university.engineering.software-engineering.bachelor.direct-quotation-page-locator",
    type: "DIRECT_QUOTATION_PAGE_LOCATOR",
    category: "citation",
    expected: true,
  });

  assertEqual(
    validator?.constructor.name,
    "DirectQuotationPageLocatorValidator",
    "synthetic cross-university DIRECT_QUOTATION_PAGE_LOCATOR validator",
  );
}

function assertUnsupportedRuleType(registry) {
  const unsupportedRule = {
    ...createBaseRule(),
    id: "second-university.engineering.software-engineering.bachelor.unsupported",
    type: "UNSUPPORTED_RULE_TYPE",
  };
  const validator = registry.getValidator(unsupportedRule);

  assertEqual(validator, undefined, "unsupported type direct resolution");

  const [result] = new RuleEngine(registry).run({}, [unsupportedRule]);

  assertEqual(result.status, "FAILED", "unsupported type status");
  assertEqual(result.passed, false, "unsupported type passed flag");
  assertEqual(result.message, MISSING_VALIDATOR_MESSAGE, "unsupported type message");
}

function assertValidator(resolved, ruleId, validatorName, marginSide) {
  const item = resolved.find((candidate) => candidate.rule.id === ruleId);

  if (!item) {
    throw new Error(`Rule not resolved: ${ruleId}`);
  }

  assertEqual(
    item.validator?.constructor.name,
    validatorName,
    `${ruleId}: validator`,
  );

  if (marginSide) {
    assertEqual(item.validator.side, marginSide, `${ruleId}: margin side`);
  }
}

function createBaseRule() {
  return {
    id: "synthetic.rule",
    type: "REQUIRED_SECTION",
    title: "Synthetic Rule",
    description: "Synthetic registry regression rule.",
    category: "structure",
    expected: { required: true, section: "Synthetic Section" },
    severity: "error",
    score: 10,
    message: "Synthetic failure.",
    solution: "Fix the synthetic rule.",
    enabled: true,
    version: "1.1.0",
  };
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

main();
