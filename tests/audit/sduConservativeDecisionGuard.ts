import { AssessmentExecutionService } from "../../src/features/analysis/engine/AssessmentExecutionService";
import { AssessmentReadinessGate } from "../../src/features/analysis/engine/AssessmentReadinessGate";
import { createAssessmentReport } from "../../src/features/analysis/report/AssessmentReport";
import type { AssessmentReport, AssessmentReportBinding } from "../../src/features/analysis/report/AssessmentReport";
import { normalizeAcademicSections, qualifyAcademicSectionIdentity } from "../../src/features/analysis/parsers/academicSectionsNormalizer";
import { normalizeSectionName } from "../../src/features/analysis/parsers/documentSectionsParser";
import { parseDocumentXml } from "../../src/features/analysis/parsers/documentXmlParser";
import { markRequiredSectionHeadings } from "../../src/features/analysis/rules/markRequiredSectionHeadings";
import { readDocxAnalysisXmlParts } from "../../src/features/analysis/readers/docxPackageReader";
import type { NormalizedDocument, RuleDefinition } from "../../src/features/analysis/types";
import type { RuleAssessmentDecision } from "../../src/features/analysis/types/RuleAssessment";
import { sduSectionPresenceAssessmentPilot as sections, readSduSectionPresencePilotDocx } from "./sduSectionPresenceAssessmentPilot";
import { sduMarginAssessmentPilot as margins } from "./sduMarginAssessmentPilot";

// Test-only policy. No production imports this module or grants an SDU scope.
const candidates = structuredClone([...sections.candidates, ...margins.candidates]);
const gate = new AssessmentReadinessGate(candidates);
const policyVersion = "sdu-conservative-decision/v1" as const;
const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const policyBindings: readonly AssessmentReportBinding[] = candidates.map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    source: { kind: "frozen-source", title: source.title, url: source.url, claim: source.claim,
      frozenSourceSha256: source.frozenSourceSha256,
      references: "references" in candidate ? candidate.references : [{ section: margins.source.section, printedPage: margins.source.printedPage }] } };
});

export type GuardReason = "decision-preserved" | "existing-applicability" | "identity-equivalence-unapproved"
  | "partial-identity-unresolved" | "precision-unapproved" | "evidence-unavailable";
export interface GuardMetadata {
  readonly executionId: string;
  readonly originalDecision: RuleAssessmentDecision;
  readonly guardedDecision: RuleAssessmentDecision;
  readonly reasonCode: GuardReason;
  readonly policyVersion: typeof policyVersion;
  readonly evidenceReference: {
    readonly reportRecord: string;
    readonly part: "word/document.xml";
    readonly rawValues: readonly (string | null)[];
  };
  readonly uncertainty: "none" | "identity" | "precision" | "missing-evidence" | "existing";
  readonly originalProvenance: AssessmentReportBinding;
}
export interface GuardedPilotReport {
  readonly schemaVersion: "sdu-guarded-pilot/v1";
  readonly productionAuthorization: "not-granted";
  readonly enabled: boolean;
  /** Unmodified v1 report; guarded decisions are explicitly separate from execution. */
  readonly originalReport: AssessmentReport;
  readonly guardMetadata: readonly GuardMetadata[];
}

/** Explicit pilot runner: default off, no admission policy or production registration. */
export async function runSduConservativeDecisionPilot(file: File, options: {
  readonly enabled?: boolean;
  readonly rules?: readonly RuleDefinition[];
  readonly bindings?: readonly AssessmentReportBinding[];
} = {}): Promise<GuardedPilotReport> {
  if (options.enabled !== undefined && typeof options.enabled !== "boolean") {
    throw new TypeError("Guard opt-in must be a boolean.");
  }
  const rules = structuredClone(options.rules ?? candidates.map((candidate) => candidate.rule));
  const bindings = structuredClone(options.bindings ?? policyBindings);
  validatePolicy(rules, bindings);
  const { documentXml } = await readDocxAnalysisXmlParts(file);
  const document = normalizeAcademicSections(markRequiredSectionHeadings(await readSduSectionPresencePilotDocx(file), rules), rules);
  const entries = new AssessmentExecutionService(undefined, candidates).run(document, rules);
  return guardSduAssessmentReport(createAssessmentReport(entries, bindings), document, documentXml, options.enabled === true);
}

/** Typed pilot boundary, not an untrusted report importer. Invalid metadata rejects the batch. */
export function guardSduAssessmentReport(report: AssessmentReport, document: NormalizedDocument,
  documentXml: string | null, enabled = false): GuardedPilotReport {
  if (typeof enabled !== "boolean" || report.schemaVersion !== "assessment-report/v1" ||
    report.scoring.mode !== "unscored" || report.scoring.legacyContribution !== "none") {
    throw new TypeError("Guard requires an explicit boolean option and an unscored AssessmentReport v1.");
  }
  validatePolicy(report.records.map((record) => record.contract), report.records);
  const originalReport = createAssessmentReport(report.records.map((record) => record.execution), report.records);
  const snapshot = structuredClone(document);
  let rawValid = false;
  let xml: Document | null = null;
  if (enabled && documentXml !== null) {
    // Bind raw lexical evidence to current parser records, never to caller scenario labels.
    const parsed = parseDocumentXml(documentXml);
    rawValid = same(parsed.paragraphs.map((item) => [item.id, item.text]), snapshot.paragraphs.map((item) => [item.id, item.text])) &&
      same(parsed.pageSections, snapshot.pageSections) && same(parsed.sectionExtractionCoverage, snapshot.sectionExtractionCoverage);
    xml = new DOMParser().parseFromString(documentXml, "application/xml");
  }
  const guardMetadata = enabled ? originalReport.records.flatMap((record): GuardMetadata[] => {
    const entry = record.execution;
    if (entry.kind !== "assessment") return []; // Rejection/error is never an academic violation.
    let reasonCode: GuardReason = "decision-preserved";
    let uncertainty: GuardMetadata["uncertainty"] = entry.decision === "undetermined" ? "existing" : "none";
    let rawValues: (string | null)[] = [];
    const uncertain = (reason: GuardReason, classification: GuardMetadata["uncertainty"]) => {
      reasonCode = reason; uncertainty = classification;
    };
    if (entry.decision === "not-applicable") {
      // createAssessmentReport already validates existing applicability evidence.
      reasonCode = "existing-applicability";
    } else if (!rawValid || xml === null) {
      uncertain("evidence-unavailable", "missing-evidence");
    } else if (record.contract.type === "MARGIN_TOP" || record.contract.type === "MARGIN_BOTTOM") {
      const side = record.contract.type === "MARGIN_TOP" ? "top" : "bottom";
      const rawSections = Array.from(xml.getElementsByTagNameNS(word, "sectPr"));
      // Extra/hidden/nested sections cannot silently shift the raw section mapping.
      const mappingValid = rawSections.length === snapshot.pageSections.length && rawSections.length > 0 &&
        rawSections.every((element, index) => {
          const parent = element.parentElement;
          return snapshot.pageSections[index].index === index &&
            (snapshot.pageSections[index].source === "body" ? parent?.localName === "body" :
              parent?.localName === "pPr" && parent.parentElement?.localName === "p");
        });
      rawValues = rawSections.map((section) => {
        const values = Array.from(section.children).filter((child) => child.namespaceURI === word && child.localName === "pgMar");
        return values.length === 1 ? values[0].getAttributeNS(word, side) : null;
      });
      if (!mappingValid) uncertain("evidence-unavailable", "missing-evidence");
      else {
        // Only exact decimal cm proof is accepted here. This introduces no tolerance,
        // unit alias or quantization policy. Other representations stay uncertain.
        const exactCm = rawValues.map((raw) => raw !== null && /^-?\d+(?:\.\d+)?cm$/.test(raw) ? Number(raw.slice(0, -2)) : null);
        const confirmedViolation = exactCm.some((value, index) => value !== null && Number.isFinite(value) &&
          value !== 2.5 && snapshot.pageSections[index].pageMargins[side] !== null &&
          snapshot.pageSections[index].pageMargins[side] !== 2.5);
        if (entry.decision === "violation" && confirmedViolation) { /* preserve proven counterexample, even with open coverage */ }
        else if (!rawValues.every((raw) => raw !== null && /^2\.50*cm$/.test(raw))) {
          const missing = rawValues.some((value, index) => value === null || snapshot.pageSections[index].pageMargins[side] === null);
          uncertain(missing ? "evidence-unavailable" : "precision-unapproved", missing ? "missing-evidence" : "precision");
        }
      }
      if (entry.decision === "compliant" && snapshot.sectionExtractionCoverage?.population !== "closed") {
        uncertain("evidence-unavailable", "missing-evidence");
      }
    } else if (record.inventoryId === "SDU-INV-SEC-19") {
      const expectedValue = record.contract.expected;
      if (typeof expectedValue !== "object" || !("section" in expectedValue) || typeof expectedValue.section !== "string") {
        throw new TypeError("SEC-19 requires its admitted section contract.");
      }
      const exact = expectedValue.section;
      const expected = normalizeSectionName(exact);
      const fragments = exact.split("/").map(normalizeSectionName);
      // This is uncertainty screening, NEVER an academic alias/identity detector.
      const candidates = snapshot.paragraphs.filter((paragraph) => {
        const normalized = normalizeSectionName(paragraph.text);
        return normalized.length > 0 && (normalized.includes(expected) || expected.includes(normalized) ||
          fragments.some((fragment) => normalized.includes(fragment)));
      });
      rawValues = candidates.map((paragraph) => paragraph.text);
      const structuralProof = snapshot.academicSections.occurrences.some((occurrence) =>
        snapshot.paragraphs[occurrence.headingParagraphIndex]?.text.normalize("NFC") === exact.normalize("NFC") &&
        qualifyAcademicSectionIdentity(snapshot, occurrence).certainty === "confirmed");
      if (rawValues.some((raw) => raw?.normalize("NFC") !== exact.normalize("NFC"))) {
        uncertain(entry.decision === "violation" ? "partial-identity-unresolved" : "identity-equivalence-unapproved", "identity");
      } else if (entry.decision === "compliant" && (!structuralProof || rawValues.length === 0)) {
        uncertain("evidence-unavailable", "missing-evidence");
      }
      // Confirmed structural identity and closed coverage remain the producer's
      // authority. A raw exact string cannot upgrade undetermined to compliant.
    }
    const guardedDecision = reasonCode === "decision-preserved" || reasonCode === "existing-applicability"
      ? entry.decision : "undetermined";
    return [{ executionId: record.executionId, originalDecision: entry.decision, guardedDecision,
      reasonCode, policyVersion, uncertainty, evidenceReference: { reportRecord: record.executionId,
        part: "word/document.xml", rawValues }, originalProvenance: {
        inventoryId: record.inventoryId, executionId: record.executionId, contract: record.contract,
        source: record.source, ...(record.academicScope ? { academicScope: record.academicScope } : {}),
        ...(record.admission ? { admission: record.admission } : {}),
      } }];
  }) : [];
  return freeze({ schemaVersion: "sdu-guarded-pilot/v1", productionAuthorization: "not-granted", enabled,
    originalReport, guardMetadata });
}

function validatePolicy(rules: readonly RuleDefinition[], bindings: readonly AssessmentReportBinding[]): void {
  createAssessmentReport([], bindings); // Reuse provenance and duplicate-binding validation.
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new TypeError(`Duplicate execution ID: ${rule.id}`);
    seen.add(rule.id);
    const rejection = gate.check(rule);
    if (rejection) throw new TypeError(`${rejection.code}: ${rule.id}`);
  }
  for (const binding of bindings) {
    const expected = policyBindings.find((item) => item.executionId === binding.executionId);
    if (!expected || binding.inventoryId !== expected.inventoryId || !same(binding.contract, expected.contract) ||
      !same(binding.source, expected.source)) throw new TypeError(`Guard policy/provenance mismatch: ${binding.executionId}`);
  }
}

function same(first: unknown, second: unknown): boolean {
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);
  return canonical(first) === canonical(second);
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child: unknown) => freeze(child));
    Object.freeze(value);
  }
  return value;
}
