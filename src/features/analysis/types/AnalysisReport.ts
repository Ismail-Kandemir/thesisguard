import type { RuleResult } from "./RuleResult";

export interface AnalysisReport {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  score: number;
  results: RuleResult[];
}
