import type { RuleEvaluationCoverage, RuleResult } from "../types";

export type RuleCoveragePresentationState =
  | "partial"
  | "not-evaluable";

export interface RuleCoveragePresentation {
  state: RuleCoveragePresentationState;
  label: string;
  summary: string;
  detail: string;
  requiresReview: boolean;
  evaluatedCountText: string;
}

export function toRuleCoveragePresentation(
  result: Readonly<RuleResult>,
): RuleCoveragePresentation | null {
  const coverage = result.coverage;

  if (!coverage) {
    return null;
  }

  if (coverage.status === "partial") {
    return {
      state: "partial",
      label: "Kısmi değerlendirme",
      summary: getPartialCoverageSummary(result, coverage),
      detail: [
        formatCoverageEvaluationCount(coverage),
        "Bu kural yalnızca otomatik olarak değerlendirilebilen nesneler üzerinde kontrol edildi.",
      ].join(" "),
      requiresReview: true,
      evaluatedCountText: formatCoverageEvaluationCount(coverage),
    };
  }

  if (
    result.status === "NOT_APPLICABLE" &&
    coverage.status === "none" &&
    coverage.relevantCount > 0
  ) {
    return {
      state: "not-evaluable",
      label: "Otomatik doğrulanamadı",
      summary: "İlgili nesne bulundu ancak bu kural otomatik olarak doğrulanamadı.",
      detail: formatCoverageEvaluationCount(coverage),
      requiresReview: true,
      evaluatedCountText: formatCoverageEvaluationCount(coverage),
    };
  }

  return null;
}

export function hasCoverageTrustQualification(
  results: readonly RuleResult[],
): boolean {
  return results.some((result) => toRuleCoveragePresentation(result) !== null);
}

export function getCoverageTrustMessage(
  results: readonly RuleResult[],
): string | null {
  if (!hasCoverageTrustQualification(results)) {
    return null;
  }

  return "Bazı kurallar yalnızca otomatik olarak değerlendirilebilen nesneler üzerinde kontrol edildi. İlgili fakat doğrulanamayan nesneler için manuel inceleme gerekebilir.";
}

export function formatCoverageEvaluationCount(
  coverage: Readonly<RuleEvaluationCoverage>,
): string {
  if (coverage.evaluatedCount === 0) {
    return `${formatObjectCount(coverage.relevantCount)}den hiçbiri otomatik olarak değerlendirilemedi.`;
  }

  return `${formatObjectCount(coverage.relevantCount)}den ${formatEvaluatedCount(coverage.evaluatedCount)} otomatik olarak değerlendirildi.`;
}

function getPartialCoverageSummary(
  result: Readonly<RuleResult>,
  coverage: Readonly<RuleEvaluationCoverage>,
): string {
  const unevaluatedText = `${formatObjectCount(coverage.unevaluatedCount)} otomatik olarak doğrulanamadı.`;

  if (result.status === "PASSED") {
    return `Değerlendirilebilen nesnelerde ihlal bulunmadı; ${unevaluatedText}`;
  }

  if (result.status === "FAILED") {
    return `Kural başarısız; ayrıca ${unevaluatedText}`;
  }

  return unevaluatedText;
}

function formatObjectCount(count: number): string {
  return `${count} ilgili nesne`;
}

function formatEvaluatedCount(count: number): string {
  return `${count}${getTurkishPossessiveSuffix(count)}`;
}

function getTurkishPossessiveSuffix(count: number): string {
  const lastDigit = Math.abs(count) % 10;

  if (lastDigit === 1 || lastDigit === 5 || lastDigit === 8) {
    return "'i";
  }

  if (lastDigit === 2 || lastDigit === 7) {
    return "'si";
  }

  if (lastDigit === 3 || lastDigit === 4) {
    return "'ü";
  }

  return "'ı";
}
