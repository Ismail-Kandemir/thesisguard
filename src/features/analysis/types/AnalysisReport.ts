import type { RuleResult } from "./RuleResult";

export interface AnalysisReport {
  totalRules: number;
  evaluatedRules: number;
  passedRules: number;
  failedRules: number;
  notApplicableRules: number;
  score: number;
  results: RuleResult[];
}
