import type {
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
} from "../types";
import { ValidatorRegistry } from "../rules/ValidatorRegistry";

export class RuleEngine {
  private readonly validatorRegistry: ValidatorRegistry;

  constructor(validatorRegistry = createDefaultValidatorRegistry()) {
    this.validatorRegistry = validatorRegistry;
  }

  run(document: NormalizedDocument, rules: RuleDefinition[]): RuleResult[] {
    return rules
      .filter((rule) => rule.enabled)
      .map((rule) => {
        const validator = this.validatorRegistry.getValidator(rule);

        if (!validator) {
          return createMissingValidatorResult(rule);
        }

        const result = validator.validate(document, rule);

        return enrichRuleResult(result, rule);
      });
  }
}

function createDefaultValidatorRegistry(): ValidatorRegistry {
  return new ValidatorRegistry();
}

function enrichRuleResult(
  result: RuleResult,
  rule: RuleDefinition,
): RuleResult {
  return {
    ...result,
    category: rule.category,
    solution: rule.solution,
  };
}

function createMissingValidatorResult(rule: RuleDefinition): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status: "FAILED",
    passed: false,
    severity: rule.severity,
    category: rule.category,
    solution: rule.solution,
    expected: getExpectedValue(rule.expected),
    actual: null,
    message: "Bu kural için kayıtlı validator bulunamadı.",
  };
}

function getExpectedValue(
  expected: RuleDefinition["expected"],
): string | number | boolean {
  return typeof expected === "object"
    ? "value" in expected
      ? expected.value
      : JSON.stringify(expected)
    : expected;
}
