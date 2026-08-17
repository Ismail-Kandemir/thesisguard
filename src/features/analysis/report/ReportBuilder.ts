import type { AnalysisReport, RuleResult } from "../types";

export class ReportBuilder {
  build(results: RuleResult[]): AnalysisReport {
    const totalRules = results.length;
    const passedRules = countRules(results, "PASSED");
    const failedRules = countRules(results, "FAILED");
    const notApplicableRules = countRules(results, "NOT_APPLICABLE");
    const evaluatedRules = passedRules + failedRules;

    return {
      totalRules,
      evaluatedRules,
      passedRules,
      failedRules,
      notApplicableRules,
      score: calculateScore(passedRules, evaluatedRules),
      results,
    };
  }
}

function countRules(
  results: readonly RuleResult[],
  status: RuleResult["status"],
): number {
  return results.filter((result) => result.status === status).length;
}

function calculateScore(passedRules: number, evaluatedRules: number): number {
  if (evaluatedRules === 0) {
    return 0;
  }

  return Math.round((passedRules / evaluatedRules) * 100);
}
