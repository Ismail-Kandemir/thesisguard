import type { NormalizedDocument, RuleDefinition, RuleResult } from "../types";
import { ValidatorRegistry } from "../rules/ValidatorRegistry";
import { FontFamilyValidator } from "../rules/validators/FontFamilyValidator";

const FONT_FAMILY_RULE_ID = "comu.bachelor.typography.font-family";

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

  return registry;
}

function createMissingValidatorResult(rule: RuleDefinition): RuleResult {
  return {
    ruleId: rule.id,
    title: rule.title,
    passed: false,
    severity: "warning",
    score: 0,
    message: "Bu kural icin kayitli validator bulunamadi.",
    solution: "Ilgili validator eklendikten sonra kural calistirilabilir.",
    details: [],
  };
}
