import type { AssessmentExecutionEntry, AssessmentExecutionErrorCode } from "../engine/AssessmentExecutionService";
import type { AssessmentReadinessRejection, CandidateReadiness } from "../engine/AssessmentReadinessGate";
import { decideRuleAssessment } from "../rules/ruleAssessment";
import type { Department, Faculty, RuleDefinition, StudyType, ThesisType, University } from "../types";

/** Explicit identity scope; no wildcard, inherited scope or inferred department. */
export interface AssessmentAcademicScope {
  readonly university: Readonly<Pick<University, "id">>;
  readonly faculty: Readonly<Pick<Faculty, "id">>;
  readonly department: Readonly<Pick<Department, "id">>;
  readonly programLevel: Readonly<Pick<ThesisType, "id">>;
  readonly workType: Readonly<Pick<StudyType, "id">>;
}

export type AssessmentSourceVerification =
  | { readonly state: "registered-hash-only" }
  | { readonly state: "supplied-pdf-hash-match"; readonly sha256: string };

export interface AssessmentReportAdmission {
  readonly readiness: CandidateReadiness;
  readonly productionAuthorization: "not-granted";
  /** Hash matching supplied bytes does not authenticate their download origin. */
  readonly sourceVerification: AssessmentSourceVerification;
}

export interface AssessmentSourceReference {
  readonly section: string;
  readonly printedPage: number;
  readonly item?: number;
}

export type AssessmentReportSource =
  | {
      readonly kind: "frozen-source";
      readonly title: string;
      readonly url: string;
      /** Previously frozen provenance, never a fresh-download assertion. */
      readonly frozenSourceSha256: string;
      readonly claim: string;
      readonly references: readonly AssessmentSourceReference[];
    }
  | {
      readonly kind: "synthetic-transport";
      /** Explicit test provenance; cannot stand in for an academic source. */
      readonly label: string;
    };

/** Caller-supplied provenance, not an admission policy or a source authenticity check. */
export interface AssessmentReportBinding {
  readonly inventoryId: string;
  readonly executionId: string;
  readonly contract: Readonly<RuleDefinition>;
  readonly source: AssessmentReportSource;
  /** Additive v1 metadata; older report callers need not claim an admission. */
  readonly academicScope?: AssessmentAcademicScope;
  readonly admission?: AssessmentReportAdmission;
}

export type AssessmentReportExecution =
  | Extract<AssessmentExecutionEntry, { kind: "assessment" }>
  | (Exclude<AssessmentExecutionEntry, { kind: "assessment" }> & {
      readonly assessment?: never;
      readonly decision?: never;
    });

export interface AssessmentReportRecord extends AssessmentReportBinding {
  readonly execution: AssessmentReportExecution;
}

/** Separate from AnalysisReport/RuleResult: no legacy result counts or percentage. */
export interface AssessmentReport {
  readonly schemaVersion: "assessment-report/v1";
  readonly scoring: { readonly mode: "unscored"; readonly legacyContribution: "none" };
  readonly records: readonly AssessmentReportRecord[];
}

export type AssessmentReportContractErrorCode =
  | "duplicate-execution-id"
  | "invalid-mapping"
  | "missing-inventory-mapping"
  | "invalid-provenance"
  | "invalid-execution"
  | "invalid-assessment";

export class AssessmentReportContractError extends TypeError {
  constructor(readonly code: AssessmentReportContractErrorCode, message: string) {
    super(`Invalid AssessmentReport: ${message}`);
    this.name = "AssessmentReportContractError";
  }
}

/**
 * Opt-in adapter for typed executor output, not an untrusted JSON importer.
 * Fails the whole report on invalid input; never drops entries, invents metadata,
 * executes validators, changes admission, maps legacy statuses or calculates scores.
 * Successful output is a frozen snapshot; caller mutation cannot change its proof.
 */
export function createAssessmentReport(
  entries: readonly AssessmentExecutionEntry[],
  bindings: readonly AssessmentReportBinding[],
): AssessmentReport {
  requireReport(Array.isArray(entries) && Array.isArray(bindings), "invalid-execution", "Entry and binding arrays are required.");
  const snapshot = structuredClone({ entries, bindings });
  const byExecutionId = new Map<string, AssessmentReportBinding>();
  for (const binding of snapshot.bindings) {
    requireReport(binding !== null && typeof binding === "object" && nonEmpty(binding.inventoryId) &&
      nonEmpty(binding.executionId) && binding.contract !== null && typeof binding.contract === "object" &&
      binding.contract.id === binding.executionId, "invalid-mapping", "Each binding requires an inventory ID and a matching execution contract ID.");
    requireReport(!byExecutionId.has(binding.executionId), "duplicate-execution-id", `Duplicate binding: ${binding.executionId}.`);
    validateSource(binding.source);
    validateAdmissionMetadata(binding);
    byExecutionId.set(binding.executionId, binding);
  }
  const seen = new Set<string>();
  const records = snapshot.entries.map((execution): AssessmentReportRecord => {
    requireReport(execution !== null && typeof execution === "object" && nonEmpty(execution.ruleId),
      "invalid-execution", "An execution rule ID is required.");
    requireReport(!seen.has(execution.ruleId), "duplicate-execution-id", `Duplicate execution: ${execution.ruleId}.`);
    seen.add(execution.ruleId);
    const binding = byExecutionId.get(execution.ruleId);
    requireReport(binding !== undefined, "missing-inventory-mapping", `No binding for ${execution.ruleId}; provenance cannot be inferred.`);
    validateExecution(execution, binding);
    return { inventoryId: binding.inventoryId, executionId: binding.executionId,
      contract: binding.contract, source: binding.source,
      ...(binding.academicScope !== undefined ? { academicScope: binding.academicScope } : {}),
      ...(binding.admission !== undefined ? { admission: binding.admission } : {}), execution };
  });
  return freezeSnapshot({ schemaVersion: "assessment-report/v1", scoring: { mode: "unscored", legacyContribution: "none" }, records });
}

function validateAdmissionMetadata(binding: AssessmentReportBinding): void {
  if (binding.academicScope !== undefined) {
    const scope = binding.academicScope;
    requireReport(scope !== null && typeof scope === "object" &&
      [scope.university, scope.faculty, scope.department, scope.programLevel, scope.workType].every((identity) =>
        identity !== null && typeof identity === "object" && nonEmpty(identity.id)),
    "invalid-mapping", "Academic scope requires university, faculty, department, program level and work type identities.");
  }
  if (binding.admission !== undefined) {
    const admission = binding.admission;
    requireReport(binding.academicScope !== undefined && admission !== null && typeof admission === "object" &&
      ["assessment-ready", "deferred", "production-ready"].includes(admission.readiness) &&
      admission.productionAuthorization === "not-granted", "invalid-mapping", "Admission metadata requires scope and cannot authorize production.");
    const verification = admission.sourceVerification;
    requireReport(binding.source.kind === "frozen-source" && verification !== null && typeof verification === "object" &&
      (verification.state === "registered-hash-only" ||
        (verification.state === "supplied-pdf-hash-match" && verification.sha256 === binding.source.frozenSourceSha256)),
    "invalid-provenance", "Source verification must distinguish a registered hash from matching supplied PDF bytes.");
  }
}

function validateSource(source: AssessmentReportSource): void {
  requireReport(source !== null && typeof source === "object", "invalid-provenance", "Explicit source provenance is required.");
  if (source.kind === "synthetic-transport") {
    requireReport(nonEmpty(source.label), "invalid-provenance", "Synthetic transport provenance requires a label.");
    return;
  }
  requireReport(source.kind === "frozen-source" && nonEmpty(source.title) && nonEmpty(source.claim) && nonEmpty(source.url) &&
    typeof source.frozenSourceSha256 === "string" && /^[a-f0-9]{64}$/i.test(source.frozenSourceSha256) &&
    Array.isArray(source.references) && source.references.length > 0,
  "invalid-provenance", "Frozen source title, URL, SHA-256, claim and normative references are required.");
  let url: URL;
  try { url = new URL(source.url); }
  catch { throw new AssessmentReportContractError("invalid-provenance", "Source URL is invalid."); }
  requireReport(url.protocol === "https:" || url.protocol === "http:", "invalid-provenance", "Source URL must use HTTP(S).");
  for (const reference of source.references) {
    requireReport(reference !== null && typeof reference === "object" && nonEmpty(reference.section) &&
      positiveInteger(reference.printedPage) && (reference.item === undefined || positiveInteger(reference.item)),
    "invalid-provenance", "Each normative reference requires a section and positive printed page/item values.");
  }
}

const errorCodes = {
  "missing-validator": true, "missing-assess": true, "invalid-assessment": true, "runtime-error": true,
} satisfies Record<AssessmentExecutionErrorCode, true>;
const rejectionCodes = {
  "unknown-rule": true, "missing-readiness": true, "not-assessment-ready": true,
  "ambiguous-readiness": true, "rule-contract-mismatch": true,
} satisfies Record<AssessmentReadinessRejection["code"], true>;

function validateExecution(execution: AssessmentExecutionEntry, binding: AssessmentReportBinding): void {
  if (execution.kind === "assessment") {
    requireOnlyKeys(execution, ["kind", "ruleId", "assessment", "decision"]);
    try {
      const assessment = execution.assessment;
      requireReport(assessment.reference.kind === "rule" && assessment.reference.id === execution.ruleId &&
        decideRuleAssessment(assessment) === execution.decision,
      "invalid-assessment", "Assessment reference and decision must agree with the executor output.");
    } catch (error: unknown) {
      if (error instanceof AssessmentReportContractError) throw error;
      throw new AssessmentReportContractError("invalid-assessment", "Assessment violates the existing RuleAssessment contract.");
    }
    return;
  }
  requireReport(execution.kind === "error" || execution.kind === "rejected", "invalid-execution", "Unknown execution kind.");
  requireOnlyKeys(execution, execution.kind === "error"
    ? ["kind", "ruleId", "code", "message"] : ["kind", "ruleId", "inventoryId", "code", "message"]);
  requireReport(nonEmpty(execution.message) && typeof execution.code === "string" &&
    Object.hasOwn(execution.kind === "error" ? errorCodes : rejectionCodes, execution.code),
  "invalid-execution", "Execution error/rejection requires its recognized code and message, never an academic finding.");
  if (execution.kind === "rejected" && execution.inventoryId !== undefined) {
    requireReport(execution.inventoryId === binding.inventoryId, "invalid-mapping", "Rejected execution inventory ID disagrees with its binding.");
  }
}

function requireOnlyKeys(value: object, keys: readonly string[]): void {
  requireReport(Object.keys(value).every((key) => keys.includes(key)), "invalid-execution", "Execution contains fields outside its discriminated contract.");
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function requireReport(condition: boolean, code: AssessmentReportContractErrorCode, message: string): asserts condition {
  if (!condition) throw new AssessmentReportContractError(code, message);
}

function freezeSnapshot<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child: unknown) => freezeSnapshot(child));
    Object.freeze(value);
  }
  return value;
}
