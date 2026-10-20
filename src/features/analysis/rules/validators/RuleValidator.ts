import type { NormalizedDocument, RuleDefinition, RuleResult } from "../../types";
import type { RuleAssessment } from "../../types/RuleAssessment";

export interface RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult;

  /** Opt-in, unscored capability. RuleEngine continues to call only validate. */
  assess?(document: NormalizedDocument, rule: RuleDefinition): RuleAssessment;
}
