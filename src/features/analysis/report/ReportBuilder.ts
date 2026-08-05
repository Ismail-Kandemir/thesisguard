import type { AnalysisReport, RuleResult } from "../types";

export class ReportBuilder {
  build(results: RuleResult[]): AnalysisReport {
    const totalRules = results.length;
    const passedRules = countPassedRules(results);

    return {
      totalRules,
      passedRules,
      failedRules: totalRules - passedRules,
      score: calculateScore(passedRules, totalRules),
      results,
    };
  }
}

function countPassedRules(results: RuleResult[]): number {
  return results.filter((result) => result.passed).length;
}

function calculateScore(passedRules: number, totalRules: number): number {
  if (totalRules === 0) {
    return 0;
  }

  return Math.round((passedRules / totalRules) * 100);
}
