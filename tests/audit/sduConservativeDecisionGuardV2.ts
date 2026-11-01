import { guardSduAssessmentReport, runSduConservativeDecisionPilot } from "./sduConservativeDecisionGuard";
import type { GuardMetadata, GuardedPilotReport } from "./sduConservativeDecisionGuard";
import { normalizeAcademicSections, qualifyAcademicSectionIdentity } from "../../src/features/analysis/parsers/academicSectionsNormalizer";
import { normalizeSectionName } from "../../src/features/analysis/parsers/documentSectionsParser";
import { parseDocumentXml } from "../../src/features/analysis/parsers/documentXmlParser";
import { resolveHeadingStyleProvenance } from "../../src/features/analysis/parsers/headingStyleProvenance";
import { markRequiredSectionHeadings } from "../../src/features/analysis/rules/markRequiredSectionHeadings";
import { readDocxAnalysisXmlParts } from "../../src/features/analysis/readers/docxPackageReader";
import { readSduSectionPresencePilotDocx } from "./sduSectionPresenceAssessmentPilot";
import type { AssessmentReport, AssessmentReportRecord } from "../../src/features/analysis/report/AssessmentReport";
import type { NormalizedDocument, Paragraph } from "../../src/features/analysis/types";

export const experimentalPolicyVersion = "sdu-conservative-decision/v2-experimental" as const;
type PilotOptions = NonNullable<Parameters<typeof runSduConservativeDecisionPilot>[1]>;
type V2Reason = GuardMetadata["reasonCode"] | "candidate-noise-filtered" | "integer-violation-preserved"
  | "coverage-incomplete" | "v2-runtime-error";
export interface CandidateEvidence {
  readonly paragraphId: string;
  readonly raw: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
  readonly completeComponents: readonly string[];
  readonly boundaryUnresolved: boolean;
  readonly splitComponent?: string;
  readonly heading: ReturnType<typeof resolveHeadingStyleProvenance>;
  readonly selected: boolean;
  readonly role: "structural-candidate" | "unresolved-identity" | "excluded-noise";
}
export interface IntegerInterval {
  readonly sectionIndex: number;
  readonly rawTwips: string;
  readonly model: "one-twip-plus-half-parser-step";
  readonly lowerCm: string;
  readonly upperCm: string;
  readonly targetCm: "360000/144000";
  readonly excludesTarget: boolean;
}
export interface ExperimentalGuardMetadata extends Omit<GuardMetadata, "policyVersion" | "reasonCode"> {
  readonly policyVersion: typeof experimentalPolicyVersion;
  readonly reasonCode: V2Reason;
  readonly v1Decision: GuardMetadata["guardedDecision"];
  readonly candidates: readonly CandidateEvidence[];
  readonly intervals: readonly IntegerInterval[];
  readonly failure?: string;
}
export interface ExperimentalGuardedReport extends Omit<GuardedPilotReport, "guardMetadata"> {
  readonly guardMetadata: readonly ExperimentalGuardMetadata[];
}

/** Separate test-only selector. Omitted version delegates to v1 byte-for-byte. */
export async function runSduVersionedConservativePilot(file: File, options: PilotOptions & {
  readonly version?: "v1" | "v2-experimental";
} = {}): Promise<GuardedPilotReport | ExperimentalGuardedReport> {
  if (options.version !== undefined && options.version !== "v1" && options.version !== "v2-experimental") {
    throw new TypeError("Unknown conservative guard version.");
  }
  const baseline = await runSduConservativeDecisionPilot(file, options);
  if (options.version !== "v2-experimental" || !baseline.enabled) return baseline;
  const { documentXml } = await readDocxAnalysisXmlParts(file);
  const rules = baseline.originalReport.records.map((record) => record.contract);
  const document = normalizeAcademicSections(markRequiredSectionHeadings(await readSduSectionPresencePilotDocx(file), rules), rules);
  return refine(baseline, document, documentXml);
}

/** Reuse v1's exact eleven-contract/provenance/report boundary; no admission grant. */
export function guardSduAssessmentReportV2(report: AssessmentReport, document: NormalizedDocument,
  documentXml: string | null, enabled = false): ExperimentalGuardedReport {
  const baseline = guardSduAssessmentReport(report, document, documentXml, enabled);
  if (!enabled) return freeze({ ...baseline, guardMetadata: [] });
  return refine(baseline, document, documentXml);
}

function refine(baseline: GuardedPilotReport, document: NormalizedDocument, raw: string | null): ExperimentalGuardedReport {
  const current = structuredClone(document);
  let trusted = false;
  if (raw !== null) {
    const parsed = parseDocumentXml(raw);
    // Bind text AND source placement/style/outline metadata to the current raw XML.
    const projection = (doc: NormalizedDocument) => ({ paragraphs: doc.paragraphs.map((p) => ({
      id: p.id, text: p.text, style: p.styleId, outline: p.outlineLevel, context: p.sectionContext,
      scope: p.contentScope, table: p.isInTableCell,
    })), sections: doc.pageSections, coverage: doc.sectionExtractionCoverage });
    trusted = JSON.stringify(projection(parsed)) === JSON.stringify(projection(current));
  }
  const metadata = baseline.guardMetadata.map((original): ExperimentalGuardMetadata => {
    const record = baseline.originalReport.records.find((item) => item.executionId === original.executionId);
    const result: ExperimentalGuardMetadata = { ...original, policyVersion: experimentalPolicyVersion,
      v1Decision: original.guardedDecision, candidates: [], intervals: [] };
    if (!record || record.execution.kind !== "assessment") throw new TypeError("Missing original assessment binding.");
    if (record.execution.decision === "not-applicable") return result;
    if (!trusted || original.reasonCode === "evidence-unavailable") {
      return { ...result, guardedDecision: "undetermined", reasonCode: "evidence-unavailable", uncertainty: "missing-evidence" };
    }
    try {
      if (record.inventoryId === "SDU-INV-SEC-19") return refineSection(result, record, current);
      if (record.contract.type === "MARGIN_TOP" || record.contract.type === "MARGIN_BOTTOM") {
        return refineMargin(result, record, current);
      }
      return result;
    } catch (error: unknown) {
      return { ...result, guardedDecision: "undetermined", reasonCode: "v2-runtime-error", uncertainty: "missing-evidence",
        failure: error instanceof Error ? error.message : "Unknown experimental guard failure." };
    }
  });
  return freeze({ ...baseline, guardMetadata: metadata });
}

function tokens(raw: string): string[] {
  return (raw.normalize("NFC").match(/[\p{L}\p{N}]+/gu) ?? []).map(normalizeSectionName);
}

function candidateEvidence(document: NormalizedDocument, paragraph: Paragraph, exact: string): CandidateEvidence {
  const normalized = normalizeSectionName(paragraph.text);
  const rawTokens = tokens(paragraph.text);
  const components = exact.split("/");
  const completeComponents = components.filter((component) => {
    const expectedTokens = tokens(component);
    return rawTokens.some((_token, index) => expectedTokens.every((token, offset) => rawTokens[index + offset] === token));
  });
  const heading = resolveHeadingStyleProvenance(document, paragraph);
  const currentBody = paragraph.sectionContext?.revision === "current" && paragraph.sectionContext.placement === "body" &&
    paragraph.contentScope === "document" && !paragraph.isInTableCell && !paragraph.isTableOfContentsEntry &&
    !paragraph.sectionContext.isTocResult && !document.captions.items.some((item) => item.paragraphId === paragraph.id);
  const fullIdentity = normalized === normalizeSectionName(exact);
  const boundaryUnresolved = components.some((component) => normalizeSectionName(component) === normalized && !completeComponents.includes(component));
  const hasNumbering = paragraph.numbering.visibleLabel !== null && paragraph.numbering.level !== null;
  const structural = heading.certainty === "confirmed" || hasNumbering;
  const unresolvedStyle = heading.certainty === "unresolved" || heading.certainty === "ambiguous";
  // This selects uncertainty candidates only. It never establishes academic identity.
  const selected = currentBody && (fullIdentity || ((completeComponents.length > 0 || boundaryUnresolved) && (structural || unresolvedStyle)));
  return { paragraphId: paragraph.id, raw: paragraph.text, normalized, tokens: rawTokens, completeComponents, boundaryUnresolved, heading, selected,
    role: !selected ? "excluded-noise" : structural ? "structural-candidate" : "unresolved-identity" };
}

function sectionCandidates(document: NormalizedDocument, exact: string): CandidateEvidence[] {
  const evidence = document.paragraphs.map((p) => candidateEvidence(document, p, exact));
  // A complete component split over adjacent, independently confirmed headings
  // remains uncertainty. No group establishes a new AcademicSectionOccurrence.
  const components = exact.split("/");
  for (let start = 0; start < evidence.length; start++) {
    for (const component of components) {
      const expectedTokens = tokens(component);
      for (let size = 2; size <= expectedTokens.length && start + size <= evidence.length; size++) {
        const group = evidence.slice(start, start + size);
        const combined = group.flatMap((item) => item.tokens);
        if (combined.length !== expectedTokens.length || !combined.every((token, index) => token === expectedTokens[index])) continue;
        const paragraphs = document.paragraphs.slice(start, start + size);
        const level = group[0].heading.level;
        const blocks = paragraphs.map((p) => document.blocks.find((block) => block.type === "paragraph" && block.paragraphId === p.id)?.blockIndex);
        const reliable = group.every((item, index) => item.heading.certainty === "confirmed" && item.heading.level === level &&
          paragraphs[index].sectionContext?.revision === "current" && paragraphs[index].sectionContext?.placement === "body" &&
          !paragraphs[index].isInTableCell && !paragraphs[index].isTableOfContentsEntry &&
          !paragraphs[index].sectionContext?.isTocResult && paragraphs[index].contentScope === "document" &&
          !document.captions.items.some((caption) => caption.paragraphId === paragraphs[index].id) &&
          blocks[index] !== undefined && (index === 0 || blocks[index] === (blocks[index - 1] ?? -2) + 1));
        if (reliable) group.forEach((item, offset) => {
          evidence[start + offset] = { ...item, selected: true, role: "unresolved-identity", splitComponent: component };
        });
      }
    }
  }
  return evidence;
}

function refineSection(metadata: ExperimentalGuardMetadata, record: AssessmentReportRecord,
  document: NormalizedDocument): ExperimentalGuardMetadata {
  const execution = record.execution;
  const expected = record.contract.expected;
  if (execution.kind !== "assessment" || typeof expected !== "object" || !("section" in expected) || typeof expected.section !== "string") {
    throw new TypeError("Missing SEC-19 contract.");
  }
  const exact = expected.section;
  const candidates = sectionCandidates(document, exact);
  const selected = candidates.filter((candidate) => candidate.selected);
  const result = { ...metadata, candidates, evidenceReference: { ...metadata.evidenceReference, rawValues: selected.map((candidate) => candidate.raw) } };
  if (execution.decision === "undetermined") return { ...result, uncertainty: "existing",
    reasonCode: selected.length === 0 && metadata.reasonCode === "identity-equivalence-unapproved" ? "candidate-noise-filtered" : metadata.reasonCode };
  if (execution.assessment.coverage?.population !== "closed" || document.sectionExtractionCoverage?.population !== "closed") {
    return { ...result, guardedDecision: "undetermined", reasonCode: "coverage-incomplete", uncertainty: "existing" };
  }
  if (selected.some((candidate) => candidate.raw.normalize("NFC") !== exact.normalize("NFC")) ||
    (execution.decision === "violation" && selected.length > 0)) {
    return { ...result, guardedDecision: "undetermined", reasonCode: execution.decision === "violation"
      ? "partial-identity-unresolved" : "identity-equivalence-unapproved", uncertainty: "identity" };
  }
  if (execution.decision === "compliant") {
    const exactProof = document.academicSections.occurrences.some((occurrence) =>
      document.paragraphs[occurrence.headingParagraphIndex]?.text.normalize("NFC") === exact.normalize("NFC") &&
      qualifyAcademicSectionIdentity(document, occurrence).certainty === "confirmed" &&
      execution.assessment.observations?.some((observation) => observation.state === "confirmed" && observation.finding === "compliant" &&
        observation.identity.certainty === "confirmed" && observation.subject.kind === "academic-section" && observation.subject.occurrenceId === occurrence.id));
    if (!exactProof) return { ...result, guardedDecision: "undetermined", reasonCode: "evidence-unavailable", uncertainty: "missing-evidence" };
  }
  return { ...result, guardedDecision: execution.decision,
    reasonCode: metadata.guardedDecision !== execution.decision ? "candidate-noise-filtered" : metadata.reasonCode, uncertainty: "none" };
}

function refineMargin(metadata: ExperimentalGuardMetadata, record: AssessmentReportRecord,
  document: NormalizedDocument): ExperimentalGuardMetadata {
  const execution = record.execution;
  if (execution.kind !== "assessment") throw new TypeError("Missing margin assessment.");
  const side = record.contract.type === "MARGIN_TOP" ? "top" : "bottom";
  const values = metadata.evidenceReference.rawValues;
  if (execution.assessment.coverage?.population !== "closed" || document.sectionExtractionCoverage?.population !== "closed") {
    return { ...metadata, guardedDecision: "undetermined", reasonCode: "coverage-incomplete", uncertainty: "existing" };
  }
  const intervals: IntegerInterval[] = [];
  let counterexample = false;
  const allReliable = values.length === document.pageSections.length && values.length > 0 && values.every((raw, index) => {
    const parsed = document.pageSections[index].pageMargins[side];
    if (raw === null || parsed === null || !Number.isFinite(parsed)) return false;
    const integer = raw.replace(/^[\x20\t\r\n]+|[\x20\t\r\n]+$/g, "");
    if (/^[+-]?\d+$/.test(integer) && Number.isSafeInteger(Number(integer))) {
      // Experimental representation envelope, NEVER an academic tolerance:
      // ±1 twip (floor/ceil/nearest overbound) + ±0.005cm parser-rounding overbound.
      // Exact rational denominator 144000: one twip=254, half parser step=720.
      const center = BigInt(integer) * 254n;
      const lower = center - 974n;
      const upper = center + 974n;
      const excludesTarget = upper < 360000n || lower > 360000n;
      intervals.push({ sectionIndex: index, rawTwips: raw, model: "one-twip-plus-half-parser-step",
        lowerCm: `${lower}/144000`, upperCm: `${upper}/144000`, targetCm: "360000/144000", excludesTarget });
      counterexample ||= excludesTarget;
      return true;
    }
    const cm = /^-?\d+(?:\.\d+)?cm$/.test(raw) ? Number(raw.slice(0, -2)) : null;
    if (cm === null || !Number.isFinite(cm)) return false;
    // Keep the v1 explicit-cm counterexample boundary; rounded near-target cm is U.
    counterexample ||= cm !== 2.5 && parsed !== 2.5;
    return true;
  });
  if (!allReliable) return { ...metadata, intervals, guardedDecision: "undetermined", reasonCode: "evidence-unavailable", uncertainty: "missing-evidence" };
  if (execution.decision === "violation" && counterexample) return { ...metadata, intervals, guardedDecision: "violation",
    reasonCode: metadata.guardedDecision === "violation" ? metadata.reasonCode : "integer-violation-preserved", uncertainty: "none" };
  // Interval overlap can NEVER authorize compliance or produce a new violation.
  return { ...metadata, intervals };
}

function freeze<T>(value: T): T {
  const copy = structuredClone(value);
  const visit = (item: unknown): void => {
    if (item !== null && typeof item === "object") { Object.values(item).forEach(visit); Object.freeze(item); }
  };
  visit(copy);
  return copy;
}
