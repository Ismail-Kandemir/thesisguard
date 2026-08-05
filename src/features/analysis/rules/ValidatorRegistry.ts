import type { RuleValidator } from "./validators/RuleValidator";
import { AlignmentValidator } from "./validators/AlignmentValidator";

const ALIGNMENT_RULE_ID = "comu.bachelor.format.alignment";

export class ValidatorRegistry {
  private readonly validators = new Map<string, RuleValidator>([
    [ALIGNMENT_RULE_ID, new AlignmentValidator()],
  ]);

  register(ruleId: string, validator: RuleValidator): void {
    this.validators.set(ruleId, validator);
  }

  getValidator(ruleId: string): RuleValidator | undefined {
    return this.validators.get(ruleId);
  }
}
