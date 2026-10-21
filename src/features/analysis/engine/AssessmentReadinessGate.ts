import type { RuleDefinition } from "../types";

/** Admission metadata, independent of any per-document assessment decision. */
export type CandidateReadiness = "assessment-ready" | "deferred" | "production-ready";

export type AssessmentCandidateReadiness = {
  readonly inventoryId: string;
} & (
  | { readonly readiness: "assessment-ready"; readonly rule: RuleDefinition }
  | { readonly readiness: "deferred" | "production-ready"; readonly rule?: RuleDefinition }
);

export interface AssessmentReadinessRejection {
  readonly kind: "rejected";
  readonly ruleId: string;
  readonly inventoryId?: string;
  readonly code:
    | "unknown-rule"
    | "missing-readiness"
    | "not-assessment-ready"
    | "ambiguous-readiness"
    | "rule-contract-mismatch";
  readonly message: string;
}

interface RegisteredReadiness {
  readonly inventoryId: string;
  readonly readiness: CandidateReadiness;
  readonly contract: string;
}

/** Snapshot the explicit policy; caller mutations cannot promote a candidate. */
export class AssessmentReadinessGate {
  private readonly byRuleId = new Map<string, RegisteredReadiness[]>();

  constructor(candidates: readonly AssessmentCandidateReadiness[] = []) {
    for (const candidate of candidates) {
      if (!candidate.rule) continue;
      const entries = this.byRuleId.get(candidate.rule.id) ?? [];
      entries.push({ inventoryId: candidate.inventoryId, readiness: candidate.readiness, contract: ruleContract(candidate.rule) });
      this.byRuleId.set(candidate.rule.id, entries);
    }
  }

  check(rule: RuleDefinition): AssessmentReadinessRejection | null {
    const entries = this.byRuleId.get(rule.id);
    const reject = (code: AssessmentReadinessRejection["code"], message: string): AssessmentReadinessRejection => ({
      kind: "rejected", ruleId: rule.id, code, message,
      ...(entries?.length === 1 ? { inventoryId: entries[0].inventoryId } : {}),
    });
    if (!entries) return reject("unknown-rule", "The execution rule ID is not in the explicit readiness policy.");
    if (entries.length !== 1) return reject("ambiguous-readiness", "Multiple readiness records identify this execution rule.");
    const entry = entries[0];
    if (typeof entry.inventoryId !== "string" || entry.inventoryId.trim().length === 0 ||
      !["assessment-ready", "deferred", "production-ready"].includes(entry.readiness)) {
      return reject("missing-readiness", "Complete, recognized readiness metadata is required.");
    }
    if (entry.readiness !== "assessment-ready") {
      return reject("not-assessment-ready", `Candidate readiness is ${entry.readiness}; assessment execution is not permitted.`);
    }
    if (entry.contract !== ruleContract(rule)) {
      return reject("rule-contract-mismatch", "The requested rule differs from its explicitly admitted contract.");
    }
    return null;
  }
}

/** Compare data contracts independently of object property insertion order. */
function ruleContract(rule: RuleDefinition): string {
  return JSON.stringify(rule, (_key: string, value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([first], [second]) => first.localeCompare(second)));
  });
}
