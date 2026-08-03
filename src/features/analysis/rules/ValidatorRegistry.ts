import type { RuleValidator } from "./validators/RuleValidator";

export class ValidatorRegistry {
  private readonly validators = new Map<string, RuleValidator>();

  register(ruleId: string, validator: RuleValidator): void {
    this.validators.set(ruleId, validator);
  }

  getValidator(ruleId: string): RuleValidator | undefined {
    return this.validators.get(ruleId);
  }
}
