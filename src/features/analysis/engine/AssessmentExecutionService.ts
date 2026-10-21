import { ValidatorRegistry } from "../rules/ValidatorRegistry";
import { decideRuleAssessment } from "../rules/ruleAssessment";
import type { NormalizedDocument, RuleDefinition } from "../types";
import type { RuleAssessment, RuleAssessmentDecision } from "../types/RuleAssessment";
import { AssessmentReadinessGate } from "./AssessmentReadinessGate";
import type { AssessmentCandidateReadiness, AssessmentReadinessRejection } from "./AssessmentReadinessGate";

export type AssessmentExecutionErrorCode =
  | "missing-validator"
  | "missing-assess"
  | "invalid-assessment"
  | "runtime-error";

/** Execution entries are unscored and cannot be used as legacy RuleResults. */
export type AssessmentExecutionEntry =
  | AssessmentReadinessRejection
  | {
      readonly kind: "assessment";
      readonly ruleId: string;
      readonly assessment: RuleAssessment;
      readonly decision: RuleAssessmentDecision;
    }
  | {
      readonly kind: "error";
      readonly ruleId: string;
      readonly code: AssessmentExecutionErrorCode;
      readonly message: string;
    };

/** Explicit, gated opt-in execution; no discovery, normalization or production promotion. */
export class AssessmentExecutionService {
  private readonly readinessGate: AssessmentReadinessGate;

  constructor(
    private readonly validatorRegistry = new ValidatorRegistry(),
    candidates: readonly AssessmentCandidateReadiness[] = [],
  ) {
    this.readinessGate = new AssessmentReadinessGate(candidates);
  }

  run(document: NormalizedDocument, rules: readonly RuleDefinition[]): readonly AssessmentExecutionEntry[] {
    return rules.flatMap((rule) => {
      const entry = this.executeRule(document, rule);
      return entry === null ? [] : [entry];
    });
  }

  private executeRule(document: NormalizedDocument, rule: RuleDefinition): AssessmentExecutionEntry | null {
    let assessment: RuleAssessment;
    try {
      // Always validate the requested list at the service boundary, before lookup
      // or producer calls. There is no ungated execution option or fallback.
      const rejection = this.readinessGate.check(rule);
      if (rejection) return rejection;
      if (!rule.enabled) return null;
      const validator = this.validatorRegistry.getValidator(rule);
      if (!validator) return failure(rule.id, "missing-validator", "No validator is available for the requested rule.");
      if (typeof validator.assess !== "function") {
        return failure(rule.id, "missing-assess", "The validator does not support opt-in assessment.");
      }
      assessment = validator.assess(document, rule);
    } catch (error: unknown) {
      return failure(rule.id, "runtime-error", describeError(error));
    }

    try {
      const decision = decideRuleAssessment(assessment);
      if (assessment.reference.kind !== "rule" || assessment.reference.id !== rule.id) {
        return failure(rule.id, "invalid-assessment", "Assessment reference must identify the requested rule.");
      }
      return { kind: "assessment", ruleId: rule.id, assessment, decision };
    } catch (error: unknown) {
      return failure(rule.id, "invalid-assessment", describeError(error));
    }
  }
}

function failure(ruleId: string, code: AssessmentExecutionErrorCode, message: string): AssessmentExecutionEntry {
  return { kind: "error", ruleId, code, message };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === "string" ? error : "A non-Error value was thrown.";
}
