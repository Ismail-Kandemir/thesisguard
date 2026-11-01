import { admitAssessmentBatch, AssessmentAdmissionError } from "../../src/features/analysis/engine/AssessmentAdmission";
import type { AssessmentAdmission, AssessmentAdmissionCandidate, AssessmentAdmissionRequest } from "../../src/features/analysis/engine/AssessmentAdmission";
import { AssessmentExecutionService } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { AssessmentExecutionEntry } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { AssessmentCandidateReadiness } from "../../src/features/analysis/engine/AssessmentReadinessGate";
import { createAssessmentReport } from "../../src/features/analysis/report/AssessmentReport";
import type { AssessmentReport } from "../../src/features/analysis/report/AssessmentReport";
import { normalizeAcademicSections } from "../../src/features/analysis/parsers/academicSectionsNormalizer";
import { markRequiredSectionHeadings } from "../../src/features/analysis/rules/markRequiredSectionHeadings";
import { readDocxAnalysisXmlParts } from "../../src/features/analysis/readers/docxPackageReader";
import type { RuleAssessmentDecision } from "../../src/features/analysis/types/RuleAssessment";
import { guardSduAssessmentReport } from "./sduConservativeDecisionGuard";
import type { GuardedPilotReport, GuardMetadata } from "./sduConservativeDecisionGuard";
import { sduSectionPresenceAssessmentPilot as sections, readSduSectionPresencePilotDocx } from "./sduSectionPresenceAssessmentPilot";
import { sduMarginAssessmentPilot as margins } from "./sduMarginAssessmentPilot";

// Explicit synthetic scope only. Not a real department/program admission policy.
const syntheticScope = {
  university: { id: "sdu" }, faculty: { id: "synthetic-faculty" }, department: { id: "synthetic-department" },
  programLevel: { id: "synthetic-level" }, workType: { id: "synthetic-work" },
};
const syntheticPolicy: readonly AssessmentAdmissionCandidate[] = structuredClone([...sections.candidates, ...margins.candidates]).map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    readiness: candidate.readiness, academicScope: syntheticScope,
    source: { kind: "frozen-source", title: source.title, url: source.url, claim: source.claim,
      frozenSourceSha256: source.frozenSourceSha256,
      references: "references" in candidate ? candidate.references : [{ section: margins.source.section, printedPage: margins.source.printedPage }] } };
});

export function createSyntheticGuardedBatchRequest(): AssessmentAdmissionRequest {
  return structuredClone({ purpose: "assessment-only", academicScope: syntheticScope, candidates: syntheticPolicy });
}

interface BatchFailure {
  readonly code: string;
  readonly message: string;
}
export interface GuardedBatchDecision {
  readonly executionId: string;
  readonly inventoryId: string;
  readonly originalDecision: RuleAssessmentDecision;
  readonly guardedDecision: RuleAssessmentDecision;
  readonly reasonCode: GuardMetadata["reasonCode"] | "guard-failure" | "guard-disabled";
  readonly coverage: "closed" | "open" | null;
  readonly identityCertainty: readonly string[];
  readonly evidenceReference: GuardMetadata["evidenceReference"] | null;
  readonly policyVersion: GuardMetadata["policyVersion"] | null;
}
export interface ControlledGuardedBatch {
  readonly schemaVersion: "sdu-guarded-batch/v1";
  readonly productionAuthorization: "not-granted";
  readonly status: "completed" | "admission-rejected" | "batch-rejected";
  readonly guardEnabled: boolean;
  readonly admission: { readonly kind: "admitted"; readonly value: AssessmentAdmission }
    | { readonly kind: "rejected"; readonly error: BatchFailure };
  /** Valid, unchanged v1 report. Never substitute a guarded decision into it. */
  readonly originalReport: AssessmentReport | null;
  readonly originalAssessmentResults: readonly Extract<AssessmentExecutionEntry, { kind: "assessment" }>[];
  readonly guardedAssessmentResults: readonly GuardedBatchDecision[];
  readonly executionErrors: readonly Extract<AssessmentExecutionEntry, { kind: "error" }>[];
  readonly rejectedRecords: readonly Extract<AssessmentExecutionEntry, { kind: "rejected" }>[];
  readonly guardMetadata: readonly GuardMetadata[];
  readonly guardErrors: readonly (BatchFailure & { readonly executionId: string })[];
  readonly batchError: BatchFailure | null;
}

export interface GuardedBatchOptions {
  readonly guardEnabled?: boolean;
  /** Omitted means the real admission boundary's empty, default-deny policy. */
  readonly admissionPolicy?: "synthetic-pilot";
  readonly request?: AssessmentAdmissionRequest;
  /** Controlled fault injection only; not an alternative academic policy. */
  readonly hooks?: {
    readonly createExecutor?: (readiness: readonly AssessmentCandidateReadiness[]) => Pick<AssessmentExecutionService, "run">;
    readonly transformGuardOutput?: (executionId: string, output: GuardedPilotReport) => unknown;
  };
}

/** Test-only integration. Admission precedes reading, producer calls and guard work. */
export async function runSduGuardedAssessmentBatch(file: File, options: GuardedBatchOptions = {}): Promise<ControlledGuardedBatch> {
  if (options.guardEnabled !== undefined && typeof options.guardEnabled !== "boolean") throw new TypeError("Guard opt-in must be boolean.");
  const enabled = options.guardEnabled === true;
  const request = structuredClone(options.request ?? createSyntheticGuardedBatchRequest());
  const hooks = { ...options.hooks };
  let admission: AssessmentAdmission;
  try {
    admission = await admitAssessmentBatch(request, options.admissionPolicy === "synthetic-pilot" ? syntheticPolicy : []);
  } catch (error: unknown) {
    return snapshot({ ...emptyBatch(enabled), status: "admission-rejected",
      admission: { kind: "rejected", error: failure(error, "admission-error") } });
  }

  const base = { ...emptyBatch(enabled), admission: { kind: "admitted", value: admission } as const };
  let originalReport: AssessmentReport;
  let document: Awaited<ReturnType<typeof readSduSectionPresencePilotDocx>>;
  let documentXml: string;
  try {
    ({ documentXml } = await readDocxAnalysisXmlParts(file));
    const rules = admission.bindings.map((binding) => binding.contract);
    document = normalizeAcademicSections(markRequiredSectionHeadings(await readSduSectionPresencePilotDocx(file), rules), rules);
    const readiness = admission.bindings.map((binding) => ({ inventoryId: binding.inventoryId,
      readiness: binding.admission.readiness, rule: binding.contract }));
    const executor = hooks.createExecutor?.(readiness) ?? new AssessmentExecutionService(undefined, readiness);
    const entries = executor.run(document, rules); // One execution batch for all admitted pilots.
    originalReport = createIsolatedExecutionReport(entries, admission);
  } catch (error: unknown) {
    // Batch contract/duplicate failures remain non-academic. No fabricated RuleResults.
    return snapshot({ ...base, status: "batch-rejected", batchError: failure(error, "batch-error") });
  }

  const originalAssessmentResults: Extract<AssessmentExecutionEntry, { kind: "assessment" }>[] = [];
  const guardedAssessmentResults: GuardedBatchDecision[] = [];
  const executionErrors: Extract<AssessmentExecutionEntry, { kind: "error" }>[] = [];
  const rejectedRecords: Extract<AssessmentExecutionEntry, { kind: "rejected" }>[] = [];
  const guardMetadata: GuardMetadata[] = [];
  const guardErrors: (BatchFailure & { executionId: string })[] = [];

  for (const record of originalReport.records) {
    const execution = record.execution;
    if (execution.kind === "error") { executionErrors.push(execution); continue; }
    if (execution.kind === "rejected") { rejectedRecords.push(execution); continue; }
    originalAssessmentResults.push(execution);
    let metadata: GuardMetadata | undefined;
    if (enabled) {
      let phase: "guard-runtime-error" | "invalid-guard-output" = "guard-runtime-error";
      try {
        const singleReport = createAssessmentReport([execution], [record]);
        const expected = guardSduAssessmentReport(singleReport, document, documentXml, true);
        const output = hooks.transformGuardOutput
          ? hooks.transformGuardOutput(record.executionId, structuredClone(expected)) : expected;
        phase = "invalid-guard-output";
        // The existing guard is the semantic authority. A test seam cannot invent
        // decisions, omit evidence, change policy version or replace provenance.
        if (expected.guardMetadata.length !== 1 || !sameData(output, expected)) {
          throw new TypeError("Guard output does not preserve the canonical metadata, evidence and decision.");
        }
        metadata = expected.guardMetadata[0];
        guardMetadata.push(metadata);
      } catch (error: unknown) {
        guardErrors.push({ executionId: record.executionId, code: phase, message: describe(error) });
      }
    }
    guardedAssessmentResults.push({ executionId: record.executionId, inventoryId: record.inventoryId,
      originalDecision: execution.decision,
      guardedDecision: enabled ? metadata?.guardedDecision ?? "undetermined" : execution.decision,
      reasonCode: enabled ? metadata?.reasonCode ?? "guard-failure" : "guard-disabled",
      coverage: execution.assessment.coverage?.population ?? null,
      identityCertainty: [...new Set(execution.assessment.observations?.map((item) => item.identity.certainty) ?? [])],
      evidenceReference: metadata?.evidenceReference ?? null, policyVersion: metadata?.policyVersion ?? null });
  }
  return snapshot({ ...base, status: "completed", originalReport, originalAssessmentResults,
    guardedAssessmentResults, executionErrors, rejectedRecords, guardMetadata, guardErrors });
}

function createIsolatedExecutionReport(entries: readonly AssessmentExecutionEntry[], admission: AssessmentAdmission): AssessmentReport {
  // Reuse v1's batch ID/mapping checks BEFORE isolating malformed single entries.
  // These non-academic probes never become returned execution results.
  const mapping = createAssessmentReport(entries.map((entry) => ({ kind: "error", ruleId: entry.ruleId,
    code: "invalid-assessment", message: "Execution identity preflight only." })), admission.bindings);
  if (mapping.records.length !== admission.bindings.length) throw new TypeError("Incomplete execution batch.");
  const checked: AssessmentExecutionEntry[] = entries.map((entry) => {
    try { return createAssessmentReport([entry], admission.bindings).records[0].execution; }
    catch (error: unknown) {
      // No malformed decision is admitted to v1. Preserve its peer records and
      // report the invalid producer output as an execution error, never violation.
      return { kind: "error", ruleId: entry.ruleId, code: "invalid-assessment", message: describe(error) };
    }
  });
  return createAssessmentReport(checked, admission.bindings);
}

function emptyBatch(enabled: boolean): ControlledGuardedBatch {
  return { schemaVersion: "sdu-guarded-batch/v1", productionAuthorization: "not-granted", status: "admission-rejected",
    guardEnabled: enabled, admission: { kind: "rejected", error: { code: "not-admitted", message: "No admission." } },
    originalReport: null, originalAssessmentResults: [], guardedAssessmentResults: [], executionErrors: [],
    rejectedRecords: [], guardMetadata: [], guardErrors: [], batchError: null };
}

function failure(error: unknown, fallback: string): BatchFailure {
  const code = error instanceof AssessmentAdmissionError ? error.code
    : error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : fallback;
  return { code, message: describe(error) };
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown controlled batch error.";
}

function sameData(first: unknown, second: unknown): boolean {
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);
  return canonical(first) === canonical(second);
}

function snapshot<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item !== null && typeof item === "object") {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  };
  freeze(copy);
  return copy;
}
