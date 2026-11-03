import { ValidatorRegistry } from "../../src/features/analysis/rules/ValidatorRegistry";
import { decideRuleAssessment } from "../../src/features/analysis/rules/ruleAssessment";
import type { NormalizedDocument, RuleDefinition } from "../../src/features/analysis/types";
import { classifySectionEvidence } from "./sectionEvidenceClassifier";

/** Test-only candidate. No production module imports or grants this policy. */
export type ReadinessReason =
  | "section-extraction-open"
  | "section-evidence-unverified"
  | "margin-coverage-open"
  | "margin-evidence-unavailable"
  | "assessment-unavailable";

export interface ReadinessIssue {
  readonly reason: ReadinessReason;
  readonly ruleId?: string;
}

export type AnalysisReadiness =
  | { readonly kind: "ready" }
  | { readonly kind: "deferred"; readonly issues: readonly ReadinessIssue[] };

export const readinessMessage = "Belgenin sayfa düzeni bilgileri güvenilir biçimde doğrulanamadığı için analiz tamamlanamadı. Lütfen DOCX dosyasını yeniden kaydedip tekrar deneyin.";

export class AnalysisReadinessDeferredError extends Error {
  constructor(readonly issues: readonly ReadinessIssue[]) {
    super(readinessMessage);
    this.name = "AnalysisReadinessDeferredError";
  }
}

/**
 * Test-only gate. With raw evidence, Sprint 45 classifies section structure
 * independently of general text extraction. Without it the Sprint 44
 * conservative baseline is retained for historical regression/comparison.
 * This technical decision is never mapped to a legacy RuleResult or score.
 */
export function evaluateAnalysisReadiness(
  document: NormalizedDocument,
  rules: readonly RuleDefinition[],
  registry = new ValidatorRegistry(),
  documentXml?: string | null,
): AnalysisReadiness {
  const requested = rules.filter((rule) => rule.enabled && rule.category === "margin");
  if (requested.length === 0) return { kind: "ready" };

  const issues: ReadinessIssue[] = [];
  if (documentXml !== undefined) {
    const evidence = classifySectionEvidence(document, documentXml);
    if (evidence.boundaries !== "reliable" || evidence.sectionCoverage !== "closed" || evidence.marginEvidence !== "complete") {
      issues.push({ reason: "section-evidence-unverified" });
    }
  } else if (document.sectionExtractionCoverage?.population !== "closed") {
    issues.push({ reason: "section-extraction-open" });
  }
  for (const rule of requested) {
    const validator = registry.getValidator(rule);
    if (!validator?.assess) {
      issues.push({ reason: "assessment-unavailable", ruleId: rule.id });
      continue;
    }
    const assessment = validator.assess(document, rule);
    if (assessment.coverage?.population !== "closed") {
      issues.push({ reason: "margin-coverage-open", ruleId: rule.id });
    }
    // A proven violation elsewhere must not hide a missing observation.
    if (decideRuleAssessment(assessment) === "undetermined" ||
      !assessment.observations?.length ||
      assessment.observations.some((observation) => observation.state !== "confirmed")) {
      issues.push({ reason: "margin-evidence-unavailable", ruleId: rule.id });
    }
  }
  return issues.length ? { kind: "deferred", issues } : { kind: "ready" };
}

/** Pilot orchestration seam: the callback owns engine AND report/scoring work. */
export function runReadinessGatePilot<T>(
  document: NormalizedDocument,
  rules: readonly RuleDefinition[],
  executeAnalysis: () => T,
  documentXml?: string | null,
): T {
  const readiness = evaluateAnalysisReadiness(document, rules, undefined, documentXml);
  if (readiness.kind === "deferred") throw new AnalysisReadinessDeferredError(readiness.issues);
  return executeAnalysis();
}
