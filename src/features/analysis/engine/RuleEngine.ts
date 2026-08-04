import type { NormalizedDocument, RuleDefinition, RuleResult } from "../types";
import { ValidatorRegistry } from "../rules/ValidatorRegistry";
import { FontFamilyValidator } from "../rules/validators/FontFamilyValidator";
import { FontSizeValidator } from "../rules/validators/FontSizeValidator";

const FONT_FAMILY_RULE_ID = "comu.bachelor.typography.font-family";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";

export class RuleEngine {
  private readonly validatorRegistry: ValidatorRegistry;

  constructor(validatorRegistry = createDefaultValidatorRegistry()) {
    this.validatorRegistry = validatorRegistry;
  }

  run(document: NormalizedDocument, rules: RuleDefinition[]): RuleResult[] {
    return rules
      .filter((rule) => rule.enabled)
      .map((rule) => {
        const validator = this.validatorRegistry.getValidator(rule.id);

        if (!validator) {
          return createMissingValidatorResult(rule);
        }

        return validator.validate(document, rule);
      });
  }
}

function createDefaultValidatorRegistry(): ValidatorRegistry {
  const registry = new ValidatorRegistry();

  registry.register(FONT_FAMILY_RULE_ID, new FontFamilyValidator());
  registry.register(FONT_SIZE_RULE_ID, new FontSizeValidator());

  return registry;
}

function createMissingValidatorResult(rule: RuleDefinition): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    passed: false,
    severity: rule.severity,
    expected: getExpectedValue(rule.expected),
    actual: null,
    message: "Bu kural icin kayitli validator bulunamadi.",
  };
}

function getExpectedValue(expected: RuleDefinition["expected"]): string | number | boolean {
  return typeof expected === "object" ? expected.value : expected;
}
