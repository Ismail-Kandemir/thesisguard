import { ValidatorRegistry } from "../rules/ValidatorRegistry";
import { decideRuleAssessment } from "../rules/ruleAssessment";
import type { NormalizedDocument, RuleDefinition } from "../types";
import { classifySectionEvidence } from "./sectionEvidenceClassifier";
import { readDocxAnalysisXmlParts } from "../readers/docxPackageReader";
import { normalizeDocxParts } from "../normalizeDocxParts";
import { assertValidUploadFile } from "../../upload/utils";

/** Technical acquisition readiness; never an academic RuleResult. */
export type ReadinessReason =
  | "section-evidence-unverified"
  | "margin-coverage-open"
  | "margin-evidence-unavailable"
  | "assessment-unavailable";

export interface ReadinessIssue {
  readonly reason: ReadinessReason;
  readonly ruleId?: string;
}

export const readinessMessage = "Belgenin sayfa düzeni bilgileri güvenilir biçimde doğrulanamadığı için analiz tamamlanamadı. Lütfen DOCX dosyasını yeniden kaydedip tekrar deneyin.";

export class AnalysisReadinessDeferredError extends Error {
  constructor(readonly issues: readonly ReadinessIssue[]) {
    super(readinessMessage);
    this.name = "AnalysisReadinessDeferredError";
  }
}

/** Acquire both facts and raw evidence from one package, without exposing a
 * replaceable document/evidence pair or accepting caller-supplied provenance.
 */
export async function readReadyDocxDocument(
  file: File,
  rules: readonly RuleDefinition[],
): Promise<NormalizedDocument> {
  assertValidUploadFile(file);
  const parts = await readDocxAnalysisXmlParts(file);
  const document = normalizeDocxParts(parts);
  assertAnalysisReadiness(document, rules, parts.documentXml);
  return document;
}

function assertAnalysisReadiness(
  document: NormalizedDocument,
  rules: readonly RuleDefinition[],
  documentXml: string,
): void {
  const registry = new ValidatorRegistry();
  const requested = rules.filter((rule) => rule.enabled && rule.category === "margin");
  if (requested.length === 0) return;

  const issues: ReadinessIssue[] = [];
  const evidence = classifySectionEvidence(document, documentXml);
  if (evidence.boundaries !== "reliable" || evidence.sectionCoverage !== "closed" || evidence.marginEvidence !== "complete") {
    issues.push({ reason: "section-evidence-unverified" });
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
  if (issues.length) throw new AnalysisReadinessDeferredError(issues);
}
