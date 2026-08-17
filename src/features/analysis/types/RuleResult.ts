import type { RuleSeverity } from "./index";

export type RuleResultValue = string | number | boolean | null;
export type RuleResultStatus = "PASSED" | "FAILED" | "NOT_APPLICABLE";

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  status: RuleResultStatus;
  /** @deprecated Prefer status. Kept for backward compatibility. */
  passed: boolean;
  severity: RuleSeverity;
  expected: RuleResultValue;
  actual: RuleResultValue;
  message: string;
}
