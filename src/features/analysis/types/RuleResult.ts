import type { RuleSeverity } from "./index";

export type RuleResultValue = string | number | boolean | null;

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  severity: RuleSeverity;
  expected: RuleResultValue;
  actual: RuleResultValue;
  message: string;
}
