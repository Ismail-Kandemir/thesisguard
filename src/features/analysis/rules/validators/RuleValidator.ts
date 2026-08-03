import type { NormalizedDocument, RuleDefinition, RuleResult } from "../../types";

export interface RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult;
}
