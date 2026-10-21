import { getHeadingStyleLevel } from "../parsers/documentHeadingsNormalizer";
import { normalizeSectionName, parseDocumentSections } from "../parsers/documentSectionsParser";
import { sectionMatchesAnyExpectedName } from "../parsers/sectionNameMatcher";
import { StyleInheritanceResolver } from "../parsers/styleInheritanceResolver";
import type { DocumentHeadingOccurrence, NormalizedDocument, RuleDefinition } from "../types";
import type {
  AssessmentCoverage,
  AssessmentObservation,
  AssessmentSubject,
  CertainAssessmentIdentity,
  RuleAssessment,
} from "../types/RuleAssessment";
import { createDocumentFormatEvidence, createHeadingEvidence, createParagraphEvidence } from "./ruleEvidence";

/** Qualifies existing records; a rule-defined name/anchor is not structural proof. */
export function hasStructuralHeadingEvidence(document: NormalizedDocument, paragraphId: string): boolean {
  const paragraph = document.paragraphs.find((item) => item.id === paragraphId);
  if (!paragraph || paragraph.contentScope !== "document" || paragraph.isEmpty ||
    paragraph.isTableOfContentsEntry || paragraph.isInTableCell ||
    document.captions.items.some((caption) => caption.paragraphId === paragraphId)) return false;

  return getHeadingStyleLevel(paragraph.styleId, new StyleInheritanceResolver(document.styles)) !== null ||
    (paragraph.numbering.level !== null && paragraph.numbering.visibleLabel !== null &&
      (paragraph.numbering.source === "text" ||
        (paragraph.numbering.source === "word" && paragraph.numbering.numId !== null)));
}

/** Extraction closure and qualification closure are separate requirements. */
export function getSectionQualificationCoverage(
  document: NormalizedDocument,
  expectedNames: readonly string[] = [],
): AssessmentCoverage {
  const extraction = document.sectionExtractionCoverage;
  const excludedSubjects = [...(extraction?.excludedSubjects ?? [])];
  const captionIds = new Set(document.captions.items.map((caption) => caption.paragraphId));
  const candidates = parseDocumentSections(document.paragraphs).filter((item) => !captionIds.has(item.paragraphId));
  const unresolvedSubjects: AssessmentSubject[] = candidates.filter((candidate) =>
    !document.sections.some((section) => section.paragraphId === candidate.paragraphId &&
      section.paragraphIndex === candidate.paragraphIndex && section.normalizedName === candidate.normalizedName),
  ).map((candidate) => ({ kind: "paragraph", paragraphId: candidate.paragraphId }));
  if (!extraction || extraction.population === "open") {
    unresolvedSubjects.push(...(extraction?.unresolvedSubjects ?? [{ kind: "document" as const }]));
  }
  const styleResolver = new StyleInheritanceResolver(document.styles);
  document.paragraphs.forEach((paragraph, index) => {
    if ((!paragraph.isInTableCell && paragraph.contentScope === "document") ||
      paragraph.text.trim().length === 0 || paragraph.isTableOfContentsEntry) return;
    const subject = { kind: "paragraph", paragraphId: paragraph.id } as const;
    const nameMatch = sectionMatchesAnyExpectedName({
      displayName: paragraph.text, normalizedName: normalizeSectionName(paragraph.text),
      paragraphId: paragraph.id, paragraphIndex: index, isRuleDefinedHeading: false, isObjectReferenceExcluded: false,
    }, expectedNames);
    // Style/numbering here is only a possible heading signal in an unsupported
    // carrier. It cannot establish the structural identity used by observations.
    const possibleHeading = getHeadingStyleLevel(paragraph.styleId, styleResolver) !== null ||
      paragraph.numbering.level !== null;
    if (nameMatch || possibleHeading) unresolvedSubjects.push(subject);
    else excludedSubjects.push({
      subject, reason: "Extracted excluded-carrier text has no relevant section name or heading signal.",
      evidence: [createParagraphEvidence(paragraph, index)],
    });
  });
  for (const section of document.sections) {
    if (document.paragraphs[section.paragraphIndex]?.id !== section.paragraphId) {
      unresolvedSubjects.push({ kind: "paragraph", paragraphId: section.paragraphId });
    }
  }
  // Empty inputs do not prove that a document was fully parsed/normalized.
  if (document.paragraphs.length === 0) unresolvedSubjects.push({ kind: "document" });
  return unresolvedSubjects.length > 0
    ? { population: "open", excludedSubjects, unresolvedSubjects, reason: "Section extraction or candidate qualification coverage is incomplete." }
    : { population: "closed", excludedSubjects };
}

/** No target reconstruction: missing anchor-dependent records remain uncertainty. */
export function assessQualifiedHeadingTargets(
  document: NormalizedDocument,
  rule: RuleDefinition,
  targets: readonly DocumentHeadingOccurrence[],
  evaluate: (heading: DocumentHeadingOccurrence, identity: CertainAssessmentIdentity) => AssessmentObservation,
  missingTargets: readonly AssessmentSubject[] = [],
): RuleAssessment {
  const sectionCoverage = getSectionQualificationCoverage(document);
  const unresolvedSubjects: AssessmentSubject[] = [
    ...(sectionCoverage.population === "open" ? sectionCoverage.unresolvedSubjects : []), ...missingTargets,
  ];
  const anchors = document.headings.filter((heading) => heading.isRuleDefinedSection &&
    hasStructuralHeadingEvidence(document, heading.paragraphId));
  if (anchors.length === 0) unresolvedSubjects.push({ kind: "document" });

  const styleResolver = new StyleInheritanceResolver(document.styles);
  document.paragraphs.forEach((paragraph, index) => {
    if (getHeadingStyleLevel(paragraph.styleId, styleResolver) === null ||
      !hasStructuralHeadingEvidence(document, paragraph.id) ||
      document.academicScopes.paragraphs[index]?.scope === "front-matter") return;
    if (!document.headings.some((heading) => heading.paragraphId === paragraph.id)) {
      unresolvedSubjects.push({ kind: "paragraph", paragraphId: paragraph.id });
    }
  });
  const observations: AssessmentObservation[] = targets.map((heading) => {
    const subject = { kind: "paragraph", paragraphId: heading.paragraphId } as const;
    if (!hasStructuralHeadingEvidence(document, heading.paragraphId) ||
      document.paragraphs[heading.paragraphIndex]?.id !== heading.paragraphId) {
      return {
        state: "undetermined", subject,
        identity: { certainty: "unresolved", reason: "Heading name/anchor lacks structural paragraph evidence." },
        evidence: { certainty: "sufficient", items: [createHeadingEvidence(heading)] },
      };
    }
    return evaluate(heading, { certainty: "confirmed", evidence: [createHeadingEvidence(heading)] });
  });
  if (targets.length === 0) {
    unresolvedSubjects.push({ kind: "document" });
    observations.push({
      state: "undetermined", subject: { kind: "document" }, identity: { certainty: "not-required" },
      evidence: { certainty: "missing", reason: "No confirmed heading targets; missing anchors do not prove non-applicability." },
    });
  }
  const coverage: AssessmentCoverage = unresolvedSubjects.length > 0
    ? { population: "open", excludedSubjects: [], unresolvedSubjects, reason: "Heading anchors or target coverage are incomplete." }
    : { population: "closed", excludedSubjects: [] };
  const reference = { kind: "rule", id: rule.id } as const;
  if (!rule.enabled) return {
    reference, applicability: { state: "undetermined", reason: "The rule is not enabled." }, coverage, observations: [],
  };
  return {
    reference,
    applicability: { state: "applicable", evidence: [createDocumentFormatEvidence(`${rule.id}: heading requirement`, { expected: JSON.stringify(rule.expected) })] },
    coverage, observations,
  };
}
