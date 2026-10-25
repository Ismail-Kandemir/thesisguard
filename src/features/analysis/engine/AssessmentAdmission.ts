import { AssessmentReadinessGate } from "./AssessmentReadinessGate";
import type { CandidateReadiness } from "./AssessmentReadinessGate";
import { createAssessmentReport } from "../report/AssessmentReport";
import type { AssessmentAcademicScope, AssessmentReportAdmission, AssessmentReportBinding,
  AssessmentReportSource, AssessmentSourceVerification } from "../report/AssessmentReport";

export interface AssessmentAdmissionCandidate extends AssessmentReportBinding {
  readonly academicScope: AssessmentAcademicScope;
  readonly source: Extract<AssessmentReportSource, { kind: "frozen-source" }>;
  readonly readiness: CandidateReadiness;
  // Verification/authorization are outputs, never applicant assertions.
  readonly admission?: never;
}

export interface AssessmentAdmissionRequest {
  readonly purpose: "assessment-only";
  readonly academicScope: AssessmentAcademicScope;
  readonly candidates: readonly AssessmentAdmissionCandidate[];
  readonly sourceArtifacts?: readonly { readonly url: string; readonly pdfBytes: Uint8Array }[];
}

export interface AdmittedAssessmentBinding extends AssessmentReportBinding {
  readonly academicScope: AssessmentAcademicScope;
  readonly source: Extract<AssessmentReportSource, { kind: "frozen-source" }>;
  readonly admission: AssessmentReportAdmission & { readonly readiness: "assessment-ready" };
}

export interface AssessmentAdmission {
  readonly schemaVersion: "assessment-admission/v1";
  readonly purpose: "assessment-only";
  readonly productionAuthorization: "not-granted";
  readonly bindings: readonly AdmittedAssessmentBinding[];
}

export type AssessmentAdmissionErrorCode =
  | "production-not-authorized" | "missing-academic-scope" | "scope-mismatch"
  | "duplicate-inventory-id" | "duplicate-execution-id" | "duplicate-readiness-metadata"
  | "unknown-execution-id" | "not-assessment-ready" | "contract-mismatch"
  | "provenance-mismatch" | "source-hash-mismatch" | "invalid-metadata";

export class AssessmentAdmissionError extends TypeError {
  constructor(readonly code: AssessmentAdmissionErrorCode, message: string) {
    super(`Assessment admission denied: ${message}`);
    this.name = "AssessmentAdmissionError";
  }
}

/**
 * Opt-in metadata boundary, not an executor, registry or production authorization.
 * The independently reviewed policy is the authority; the request is not a policy.
 * Empty policy denies all IDs. Neither a URL nor a registered hash proves source
 * authenticity or academic scope. Supplied PDF bytes are hashed independently.
 */
export async function admitAssessmentBatch(
  request: AssessmentAdmissionRequest,
  trustedPolicy: readonly AssessmentAdmissionCandidate[] = [],
): Promise<AssessmentAdmission> {
  requireAdmission(request?.purpose === "assessment-only", "production-not-authorized", "Only controlled assessment is supported; production requires separate authorization.");
  const snapshot = structuredClone({ request, trustedPolicy });
  const { academicScope, candidates, sourceArtifacts = [] } = snapshot.request;
  requireScope(academicScope);
  validateCandidates(snapshot.trustedPolicy);
  validateCandidates(candidates);
  requireAdmission(Array.isArray(sourceArtifacts), "invalid-metadata", "Source artifacts must be an array.");
  const gate = new AssessmentReadinessGate(snapshot.trustedPolicy.map((candidate) => ({
    inventoryId: candidate.inventoryId, readiness: candidate.readiness, rule: candidate.contract,
  })));
  // Complete admission validation precedes hashing or any caller execution.
  for (const candidate of candidates) {
    const expected = snapshot.trustedPolicy.find((item) => item.executionId === candidate.executionId);
    requireAdmission(expected !== undefined, "unknown-execution-id", candidate.executionId);
    requireAdmission(sameData(academicScope, expected.academicScope) && sameData(candidate.academicScope, expected.academicScope),
      "scope-mismatch", `Scope differs from the explicit policy for ${candidate.executionId}.`);
    requireAdmission(candidate.inventoryId === expected.inventoryId, "contract-mismatch", "Inventory/execution binding differs from policy.");
    requireAdmission(candidate.readiness === expected.readiness, "not-assessment-ready", "Readiness cannot be promoted by the request.");
    const rejection = gate.check(candidate.contract);
    requireAdmission(rejection === null, rejection?.code === "not-assessment-ready" ? "not-assessment-ready" : "contract-mismatch",
      rejection?.message ?? "Contract is not admitted.");
    requireAdmission(candidate.readiness === "assessment-ready", "not-assessment-ready", "Only assessment-ready candidates can be admitted.");
    requireAdmission(sameData(candidate.source, expected.source), "provenance-mismatch", "Source URL, frozen hash, claim and normative references must match policy.");
  }
  const verificationByUrl = new Map<string, string>();
  for (const artifact of sourceArtifacts) {
    requireAdmission(artifact !== null && typeof artifact === "object" &&
      candidates.some((candidate) => candidate.source.url === artifact.url) && !verificationByUrl.has(artifact.url) &&
      artifact.pdfBytes instanceof Uint8Array && artifact.pdfBytes.length >= 5 &&
      new TextDecoder().decode(artifact.pdfBytes.subarray(0, 5)) === "%PDF-",
    "invalid-metadata", "Each source artifact must be a unique, requested URL with explicit PDF bytes.");
    const bytes = new Uint8Array(artifact.pdfBytes);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
    requireAdmission(candidates.filter((candidate) => candidate.source.url === artifact.url)
      .every((candidate) => candidate.source.frozenSourceSha256 === hash), "source-hash-mismatch", "Supplied PDF bytes do not match the registered frozen hash.");
    verificationByUrl.set(artifact.url, hash);
  }
  const bindings = candidates.map((candidate): AdmittedAssessmentBinding => {
    const hash = verificationByUrl.get(candidate.source.url);
    const sourceVerification: AssessmentSourceVerification = hash === undefined
      ? { state: "registered-hash-only" } : { state: "supplied-pdf-hash-match", sha256: hash };
    return { inventoryId: candidate.inventoryId, executionId: candidate.executionId, contract: candidate.contract,
      source: candidate.source, academicScope: candidate.academicScope,
      admission: { readiness: "assessment-ready", productionAuthorization: "not-granted", sourceVerification } };
  });
  return freezeSnapshot({ schemaVersion: "assessment-admission/v1", purpose: "assessment-only", productionAuthorization: "not-granted", bindings });
}

function validateCandidates(candidates: readonly AssessmentAdmissionCandidate[]): void {
  requireAdmission(Array.isArray(candidates), "invalid-metadata", "Explicit candidate metadata is required.");
  const inventoryIds = new Set<string>();
  const executionIds = new Set<string>();
  for (const candidate of candidates) {
    requireAdmission(candidate !== null && typeof candidate === "object", "invalid-metadata", "Candidate metadata is missing.");
    requireScope(candidate.academicScope);
    requireAdmission(candidate.admission === undefined &&
      ["assessment-ready", "deferred", "production-ready"].includes(candidate.readiness), "invalid-metadata", "Recognized readiness is required; verification/authorization cannot be asserted by applicants.");
    requireAdmission(!(inventoryIds.has(candidate.inventoryId) && executionIds.has(candidate.executionId)), "duplicate-readiness-metadata", "Repeated inventory/execution readiness binding.");
    requireAdmission(!inventoryIds.has(candidate.inventoryId), "duplicate-inventory-id", candidate.inventoryId);
    requireAdmission(!executionIds.has(candidate.executionId), "duplicate-execution-id", candidate.executionId);
    requireAdmission(candidate.source?.kind === "frozen-source", "provenance-mismatch", "Admission requires normative frozen-source provenance.");
    inventoryIds.add(candidate.inventoryId);
    executionIds.add(candidate.executionId);
  }
  // Reuse the report boundary for mapping, normative source and scope shape.
  try { createAssessmentReport([], candidates); }
  catch { throw new AssessmentAdmissionError("invalid-metadata", "Candidate mapping, academic scope or source provenance is incomplete."); }
}

function requireScope(scope: AssessmentAcademicScope): void {
  requireAdmission(scope !== null && typeof scope === "object" &&
    [scope.university, scope.faculty, scope.department, scope.programLevel, scope.workType].every((identity) =>
      identity !== null && typeof identity === "object" && typeof identity.id === "string" && identity.id.trim().length > 0),
  "missing-academic-scope", "University, faculty, department, program level and work type must be explicitly supplied.");
}

function sameData(first: unknown, second: unknown): boolean {
  const canonical = (value: unknown) => JSON.stringify(value, (_key: string, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);
  return canonical(first) === canonical(second);
}

function requireAdmission(condition: boolean, code: AssessmentAdmissionErrorCode, message: string): asserts condition {
  if (!condition) throw new AssessmentAdmissionError(code, message);
}

function freezeSnapshot<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child: unknown) => freezeSnapshot(child));
    Object.freeze(value);
  }
  return value;
}
