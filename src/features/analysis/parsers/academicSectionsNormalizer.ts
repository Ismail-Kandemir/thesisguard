import type {
  AcademicSectionOccurrence,
  AcademicSectionRecognitionEvidence,
  DocumentHeadingOccurrence,
  DocumentSection,
  HeadingNumberingSource,
  NormalizedDocument,
  RuleDefinition,
  SectionOrderItem,
} from "../types";
import { normalizeSectionName } from "./documentSectionsParser";
import { parseManualNumberPrefix } from "./sectionNameMatcher";

interface AcademicSectionIdentity {
  identity: string;
  canonicalName: string;
  names: readonly string[];
}

interface SectionMatch {
  identities: readonly AcademicSectionIdentity[];
  normalizedHeadingText: string;
  evidence: AcademicSectionRecognitionEvidence[];
}

interface BoundaryCandidate {
  paragraphIndex: number;
  blockIndex: number | null;
  level: number;
}

export function normalizeAcademicSections(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  return {
    ...document,
    academicSections: buildAcademicSections(document, rules),
  };
}

export function buildAcademicSections(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
) {
  const identities = collectAcademicSectionIdentities(rules);
  const occurrencesWithoutBoundaries = document.sections
    .map((section, index) =>
      createAcademicSectionOccurrence(document, identities, section, index),
    )
    .filter((occurrence): occurrence is AcademicSectionOccurrence => occurrence !== null);
  const boundaryCandidates = createBoundaryCandidates(
    document,
    occurrencesWithoutBoundaries,
  );

  return {
    occurrences: occurrencesWithoutBoundaries.map((occurrence) => ({
      ...occurrence,
      boundary: createBoundary(occurrence, boundaryCandidates, document),
    })),
  };
}

function collectAcademicSectionIdentities(
  rules: readonly RuleDefinition[],
): AcademicSectionIdentity[] {
  const byIdentity = new Map<string, AcademicSectionIdentity>();

  for (const rule of rules) {
    for (const item of getSectionItemsFromRule(rule)) {
      const identity = normalizeSectionName(item.section);
      const existing = byIdentity.get(identity);
      const mergedNames = existing
        ? [...existing.names, item.section, ...item.aliases]
        : [item.section, ...item.aliases];

      byIdentity.set(identity, {
        identity,
        canonicalName: existing?.canonicalName ?? item.section,
        names: dedupeStrings(mergedNames),
      });
    }
  }

  return [...byIdentity.values()];
}

function getSectionItemsFromRule(
  rule: RuleDefinition,
): { section: string; aliases: string[] }[] {
  const expected = rule.expected;

  if (typeof expected !== "object" || expected === null) {
    return [];
  }

  switch (rule.type) {
    case "REQUIRED_SECTION":
    case "CONDITIONAL_REQUIRED_SECTION":
    case "SECTION_WORD_COUNT":
    case "PAGE_NUMBER_SEQUENCE":
    case "ABBREVIATION_LIST_CONSISTENCY":
      return hasSectionExpected(expected)
        ? [{ section: expected.section, aliases: expected.aliases ?? [] }]
        : [];
    case "SECTION_KEYWORDS":
      return hasSectionOnlyExpected(expected) ? [{ section: expected.section, aliases: [] }] : [];
    case "SECTION_ORDER":
      return hasSectionOrderExpected(expected)
        ? expected.sections.map((section) => ({
            section: section.section,
            aliases: section.aliases ?? [],
          }))
        : [];
    case "HEADING_NUMBERING":
    case "HEADING_LEVEL_FORMAT":
      return hasHeadingSectionsExpected(expected)
        ? expected.sections.map((section) => ({
            section: section.section,
            aliases: section.aliases ?? [],
          }))
        : [];
    default:
      return [];
  }
}

function hasSectionExpected(
  value: object,
): value is { section: string; aliases?: string[] } {
  return (
    "section" in value &&
    typeof value.section === "string" &&
    (!("aliases" in value) ||
      value.aliases === undefined ||
      (Array.isArray(value.aliases) &&
        value.aliases.every((alias) => typeof alias === "string")))
  );
}

function hasSectionOnlyExpected(value: object): value is { section: string } {
  return "section" in value && typeof value.section === "string";
}

function hasSectionOrderExpected(
  value: object,
): value is { sections: SectionOrderItem[] } {
  return (
    "sections" in value &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        typeof section === "object" &&
        section !== null &&
        "section" in section &&
        typeof section.section === "string",
    )
  );
}

function hasHeadingSectionsExpected(
  value: object,
): value is { sections: { section: string; aliases?: string[] }[] } {
  return (
    "sections" in value &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        typeof section === "object" &&
        section !== null &&
        "section" in section &&
        typeof section.section === "string" &&
        (!("aliases" in section) ||
          section.aliases === undefined ||
          (Array.isArray(section.aliases) &&
            section.aliases.every((alias) => typeof alias === "string"))),
    )
  );
}

function createAcademicSectionOccurrence(
  document: Readonly<NormalizedDocument>,
  identities: readonly AcademicSectionIdentity[],
  section: Readonly<DocumentSection>,
  index: number,
): AcademicSectionOccurrence | null {
  const match = matchSectionIdentity(section, identities);

  if (match === null) {
    return null;
  }

  const paragraph = document.paragraphs[section.paragraphIndex];

  if (!paragraph) {
    return null;
  }

  const heading = findHeadingForSection(document, section);
  const identity = match.identities.length === 1 ? match.identities[0] : null;
  const blockIndex = findBlockIndexByParagraphId(document, section.paragraphId);
  const status = identity ? "declared" : "ambiguous";
  const headingLevel =
    heading?.level ??
    parseManualNumberPrefix(section.displayName)?.level ??
    paragraph.numbering.level;

  return {
    id: `academic-section-${index + 1}`,
    identity: identity?.identity ?? null,
    canonicalName: identity?.canonicalName ?? null,
    candidateIdentities: match.identities.map((candidate) => candidate.identity),
    status,
    confidence: status === "declared" ? "high" : "ambiguous",
    headingParagraphId: section.paragraphId,
    headingParagraphIndex: section.paragraphIndex,
    blockIndex,
    normalizedHeadingText: match.normalizedHeadingText,
    displayHeadingText: section.displayName,
    headingLevel,
    numberingLevel: paragraph.numbering.level,
    numberingSource: paragraph.numbering.source as HeadingNumberingSource,
    visibleNumberingLabel: paragraph.numbering.visibleLabel,
    recognitionEvidence: dedupeEvidence([
      ...match.evidence,
      ...(paragraph.numbering.source === "word" ? ["automatic-numbering" as const] : []),
      ...(heading ? ["heading-style" as const] : []),
    ]),
    boundary: {
      startParagraphIndex: section.paragraphIndex + 1,
      endParagraphIndex: document.paragraphs.length - 1,
      startBlockIndex: blockIndex === null ? null : blockIndex + 1,
      endBlockIndex: document.blocks.at(-1)?.blockIndex ?? null,
    },
    scope: document.academicScopes?.paragraphs[section.paragraphIndex] ?? null,
  };
}

function matchSectionIdentity(
  section: Readonly<DocumentSection>,
  identities: readonly AcademicSectionIdentity[],
): SectionMatch | null {
  const manualPrefix = parseManualNumberPrefix(section.displayName);
  const normalizedCandidates = [
    {
      value: section.normalizedName,
      evidence: ["standalone-heading-text" as const],
    },
    ...(manualPrefix
      ? [
          {
            value: normalizeSectionName(manualPrefix.remainder),
            evidence: ["manual-numbering-prefix" as const],
          },
        ]
      : []),
  ];
  const matched = new Map<string, AcademicSectionIdentity>();
  const evidence: AcademicSectionRecognitionEvidence[] = [];

  for (const candidate of normalizedCandidates) {
    for (const identity of identities) {
      const nameIndex = identity.names.findIndex(
        (name) => normalizeSectionName(name) === candidate.value,
      );

      if (nameIndex >= 0) {
        matched.set(identity.identity, identity);
        evidence.push(
          identity.names[nameIndex] === identity.canonicalName
            ? "rule-expected-section"
            : "rule-alias",
          ...candidate.evidence,
        );
      }
    }
  }

  if (matched.size === 0) {
    return null;
  }

  return {
    identities: [...matched.values()],
    normalizedHeadingText: manualPrefix
      ? normalizeSectionName(manualPrefix.remainder)
      : section.normalizedName,
    evidence: dedupeEvidence(evidence),
  };
}

function findHeadingForSection(
  document: Readonly<NormalizedDocument>,
  section: Readonly<DocumentSection>,
): DocumentHeadingOccurrence | null {
  return (
    document.headings.find(
      (heading) => heading.paragraphId === section.paragraphId,
    ) ?? null
  );
}

function createBoundaryCandidates(
  document: Readonly<NormalizedDocument>,
  occurrences: readonly AcademicSectionOccurrence[],
): BoundaryCandidate[] {
  const byParagraphIndex = new Map<number, BoundaryCandidate>();

  for (const heading of document.headings) {
    byParagraphIndex.set(heading.paragraphIndex, {
      paragraphIndex: heading.paragraphIndex,
      blockIndex: heading.blockIndex,
      level: heading.level,
    });
  }

  for (const section of document.sections) {
    if (section.isRuleDefinedHeading && !byParagraphIndex.has(section.paragraphIndex)) {
      byParagraphIndex.set(section.paragraphIndex, {
        paragraphIndex: section.paragraphIndex,
        blockIndex: findBlockIndexByParagraphId(document, section.paragraphId),
        level: parseManualNumberPrefix(section.displayName)?.level ?? 0,
      });
    }
  }

  for (const occurrence of occurrences) {
    if (!byParagraphIndex.has(occurrence.headingParagraphIndex)) {
      byParagraphIndex.set(occurrence.headingParagraphIndex, {
        paragraphIndex: occurrence.headingParagraphIndex,
        blockIndex: occurrence.blockIndex,
        level: occurrence.headingLevel ?? 0,
      });
    }
  }

  return [...byParagraphIndex.values()].sort(
    (first, second) => first.paragraphIndex - second.paragraphIndex,
  );
}

function createBoundary(
  occurrence: Readonly<AcademicSectionOccurrence>,
  candidates: readonly BoundaryCandidate[],
  document: Readonly<NormalizedDocument>,
) {
  const currentLevel = occurrence.headingLevel ?? 0;
  const nextBoundary = candidates.find(
    (candidate) =>
      candidate.paragraphIndex > occurrence.headingParagraphIndex &&
      candidate.level <= currentLevel,
  );
  const endParagraphIndex = nextBoundary
    ? nextBoundary.paragraphIndex - 1
    : document.paragraphs.length - 1;

  return {
    startParagraphIndex: occurrence.headingParagraphIndex + 1,
    endParagraphIndex: Math.max(occurrence.headingParagraphIndex, endParagraphIndex),
    startBlockIndex: findBlockIndexAtOrAfterParagraph(
      document,
      occurrence.headingParagraphIndex + 1,
    ),
    endBlockIndex: findBlockIndexAtOrBeforeParagraph(document, endParagraphIndex),
  };
}

function findBlockIndexByParagraphId(
  document: Readonly<NormalizedDocument>,
  paragraphId: string,
): number | null {
  return (
    document.blocks.find(
      (block) => block.type === "paragraph" && block.paragraphId === paragraphId,
    )?.blockIndex ?? null
  );
}

function findBlockIndexAtOrAfterParagraph(
  document: Readonly<NormalizedDocument>,
  paragraphIndex: number,
): number | null {
  const paragraphIds = new Set(
    document.paragraphs.slice(paragraphIndex).map((paragraph) => paragraph.id),
  );

  return (
    document.blocks.find(
      (block) => block.type === "paragraph" && paragraphIds.has(block.paragraphId),
    )?.blockIndex ?? null
  );
}

function findBlockIndexAtOrBeforeParagraph(
  document: Readonly<NormalizedDocument>,
  paragraphIndex: number,
): number | null {
  const paragraphIds = new Set(
    document.paragraphs
      .slice(0, Math.max(0, paragraphIndex) + 1)
      .map((paragraph) => paragraph.id),
  );

  return (
    [...document.blocks]
      .reverse()
      .find((block) => block.type === "paragraph" && paragraphIds.has(block.paragraphId))
      ?.blockIndex ?? null
  );
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeEvidence(
  values: readonly AcademicSectionRecognitionEvidence[],
): AcademicSectionRecognitionEvidence[] {
  return [...new Set(values)];
}
