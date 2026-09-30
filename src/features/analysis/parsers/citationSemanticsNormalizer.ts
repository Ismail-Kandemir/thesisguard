import type {
  AcademicSectionOccurrence,
  CitationAuthorKind,
  CitationItem,
  CitationItemParseEvidence,
  CitationOccurrence,
  CitationOccurrenceEvidence,
  DocumentCitationSemantics,
  NormalizedDocument,
  Paragraph,
} from "../types";
import { isBibliographySectionIdentity } from "./bibliographySemanticsNormalizer";
import { normalizeSectionName } from "./documentSectionsParser";

const CITATION_CANDIDATE_PATTERN =
  /\(([^()]{1,160}?\b(?:18|19|20)\d{2}[a-z]?\b[^()]*)\)/giu;
const AUTHOR_MARKER_PATTERN =
  /(?:\p{Lu}[\p{L}'’-]{2,}|[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ]{2,}|anonim|anonymous|vd\.|ve\s+ark\.|ve\s+diğ\.)/iu;
const YEAR_PATTERN = /\b(?:18|19|20)\d{2}[a-z]?\b/iu;
const YEAR_WITH_SUFFIX_PATTERN = /\b((?:18|19|20)\d{2})([a-z])?\b/iu;
const SINGLE_AUTHOR_PATTERN = /^[\p{Lu}][\p{L}'’-]{1,}$/u;
const TWO_AUTHOR_VE_PATTERN =
  /^([\p{Lu}][\p{L}'’-]{1,})\s+ve\s+([\p{Lu}][\p{L}'’-]{1,})$/u;
const ET_AL_AUTHOR_PATTERN =
  /^([\p{Lu}][\p{L}'’-]{1,})\s+(?:vd\.|ve\s+diğ\.|ve\s+ark\.)$/iu;
const ANONYMOUS_AUTHOR_PATTERN = /^(?:anonim|anonymous)$/iu;
const ORGANIZATION_MARKER_PATTERN =
  /(?:üniversitesi|bakanlığı|kurumu|enstitüsü|komitesi|kurulu|\b(?:university|ministry|institute|association|organization|organisation|council|committee|who|unesco|fao)\b)/iu;
const LIST_SECTION_IDENTITIES = [
  "İçindekiler",
  "Tablolar Listesi",
  "Şekiller Listesi",
  "Simgeler ve Kısaltmalar Listesi",
  "Kısaltmalar",
  "Özet",
  "Abstract",
];

export function createEmptyCitationSemantics(): DocumentCitationSemantics {
  return {
    occurrences: [],
    excludedParagraphIds: [],
  };
}

export function normalizeCitationSemantics(
  document: Readonly<NormalizedDocument>,
): NormalizedDocument {
  return {
    ...document,
    citationSemantics: buildDocumentCitationSemantics(document),
  };
}

export function buildDocumentCitationSemantics(
  document: Readonly<NormalizedDocument>,
): DocumentCitationSemantics {
  const excludedParagraphIds = collectExcludedParagraphIds(document);
  const occurrences: CitationOccurrence[] = [];

  for (const [paragraphIndex, paragraph] of document.paragraphs.entries()) {
    if (!isCandidateParagraph(document, paragraph, paragraphIndex, excludedParagraphIds)) {
      continue;
    }

    CITATION_CANDIDATE_PATTERN.lastIndex = 0;
    for (const match of paragraph.text.matchAll(CITATION_CANDIDATE_PATTERN)) {
      const matchedText = match[0];
      const innerText = match[1];
      const matchStart = match.index;

      if (!isConservativeCitationCandidate(innerText)) {
        continue;
      }

      const occurrenceId = `citation-occurrence-${occurrences.length + 1}`;

      occurrences.push({
        id: occurrenceId,
        paragraphId: paragraph.id,
        paragraphIndex,
        blockIndex: findBlockIndexByParagraphId(document, paragraph.id),
        rawText: paragraph.text,
        normalizedText: normalizeCitationText(paragraph.text),
        matchedText,
        normalizedMatchedText: normalizeCitationText(matchedText),
        matchStart,
        matchEnd: matchStart + matchedText.length,
        scope: document.academicScopes.paragraphs[paragraphIndex]?.scope === "main-content"
          ? "body"
          : "unknown",
        confidence: "medium",
        evidence: createOccurrenceEvidence(document, paragraphIndex),
        items: parseCitationItems(occurrenceId, innerText),
      });
    }
  }

  return {
    occurrences,
    excludedParagraphIds: [...excludedParagraphIds].sort(),
  };
}

function parseCitationItems(
  occurrenceId: string,
  innerText: string,
): CitationItem[] {
  const parts = splitCitationGroup(innerText);

  return parts.flatMap((part, index) => {
    const parsed = parseCitationItem(occurrenceId, part, index, parts.length > 1);

    return parsed ? [parsed] : [];
  });
}

function splitCitationGroup(innerText: string): string[] {
  if (!innerText.includes(";")) {
    return [innerText.trim()];
  }

  return innerText
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseCitationItem(
  occurrenceId: string,
  rawItemText: string,
  itemIndex: number,
  isMultipleGroup: boolean,
): CitationItem | null {
  const normalizedItemText = normalizeCitationText(rawItemText);
  const yearMatch = YEAR_WITH_SUFFIX_PATTERN.exec(rawItemText);

  if (!yearMatch) {
    return null;
  }

  const authorSegment = rawItemText.slice(0, yearMatch.index).replace(/[,\s]+$/u, "").trim();
  const authorIdentity = parseCitationAuthor(authorSegment);

  if (authorIdentity.authorKind === "unknown") {
    return null;
  }

  const year = yearMatch[1];
  const yearSuffix = yearMatch[2]?.toLocaleLowerCase("tr-TR") ?? null;
  const evidence: CitationItemParseEvidence[] = [
    "parenthetical-citation-group",
    ...(isMultipleGroup ? ["semicolon-item-separator" as const] : []),
    "author-year-separator",
    ...authorIdentity.evidence,
    "year-pattern",
    ...(yearSuffix !== null ? ["year-suffix" as const] : []),
  ];

  return {
    id: `${occurrenceId}-item-${itemIndex + 1}`,
    occurrenceId,
    authors: authorIdentity.authors,
    authorKind: authorIdentity.authorKind,
    year,
    yearSuffix,
    context: "parenthetical",
    rawText: rawItemText.trim(),
    normalizedText: normalizedItemText,
    confidence: authorIdentity.authorKind === "organization" ? "medium" : "high",
    parseEvidence: dedupeItemEvidence(evidence),
  };
}

function parseCitationAuthor(authorSegment: string): {
  authors: string[];
  authorKind: CitationAuthorKind;
  evidence: CitationItemParseEvidence[];
} {
  const normalizedAuthorSegment = authorSegment.replace(/\s+/g, " ").trim();

  if (normalizedAuthorSegment.length === 0) {
    return {
      authors: [],
      authorKind: "unknown",
      evidence: ["ambiguous-author"],
    };
  }

  if (ANONYMOUS_AUTHOR_PATTERN.test(normalizedAuthorSegment)) {
    return {
      authors: [normalizedAuthorSegment],
      authorKind: "anonymous",
      evidence: ["anonymous-author-marker"],
    };
  }

  if (ORGANIZATION_MARKER_PATTERN.test(normalizedAuthorSegment)) {
    return {
      authors: [normalizedAuthorSegment],
      authorKind: "organization",
      evidence: ["organization-author-marker"],
    };
  }

  const twoAuthorMatch = TWO_AUTHOR_VE_PATTERN.exec(normalizedAuthorSegment);
  if (twoAuthorMatch) {
    return {
      authors: [twoAuthorMatch[1], twoAuthorMatch[2]],
      authorKind: "named",
      evidence: ["two-author-ve-pattern"],
    };
  }

  const etAlMatch = ET_AL_AUTHOR_PATTERN.exec(normalizedAuthorSegment);
  if (etAlMatch) {
    return {
      authors: [etAlMatch[1]],
      authorKind: "named",
      evidence: ["et-al-pattern"],
    };
  }

  if (SINGLE_AUTHOR_PATTERN.test(normalizedAuthorSegment)) {
    return {
      authors: [normalizedAuthorSegment],
      authorKind: "named",
      evidence: ["single-author-pattern"],
    };
  }

  return {
    authors: [],
    authorKind: "unknown",
    evidence: ["ambiguous-author"],
  };
}

function dedupeItemEvidence(
  values: readonly CitationItemParseEvidence[],
): CitationItemParseEvidence[] {
  return [...new Set(values)];
}

function isCandidateParagraph(
  document: Readonly<NormalizedDocument>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  excludedParagraphIds: ReadonlySet<string>,
): boolean {
  if (
    paragraph.isEmpty ||
    paragraph.text.trim().length === 0 ||
    paragraph.contentScope !== "document" ||
    paragraph.isTableOfContentsEntry ||
    paragraph.isInTableCell ||
    excludedParagraphIds.has(paragraph.id)
  ) {
    return false;
  }

  return document.academicScopes.paragraphs[paragraphIndex]?.scope === "main-content";
}

function collectExcludedParagraphIds(
  document: Readonly<NormalizedDocument>,
): Set<string> {
  return new Set([
    ...collectAcademicSectionBoundaryParagraphIds(document),
    ...collectBibliographyParagraphIds(document),
    ...document.captions.items.map((caption) => caption.paragraphId),
    ...document.objectSemantics.captions.map((caption) => caption.paragraphId),
    ...document.headings.map((heading) => heading.paragraphId),
    ...document.sections
      .filter((section) => section.isRuleDefinedHeading)
      .map((section) => section.paragraphId),
    ...collectListSectionParagraphIds(document),
    ...collectFrontMatterParagraphIds(document),
  ]);
}

function collectAcademicSectionBoundaryParagraphIds(
  document: Readonly<NormalizedDocument>,
): string[] {
  return document.academicSections.occurrences.map(
    (occurrence) => occurrence.headingParagraphId,
  );
}

function collectBibliographyParagraphIds(
  document: Readonly<NormalizedDocument>,
): string[] {
  const bibliography = document.bibliography;

  if (bibliography) {
    return [
      ...(bibliography.sectionHeadingParagraphId ? [bibliography.sectionHeadingParagraphId] : []),
      ...bibliography.entries.flatMap((entry) => entry.paragraphIds),
      ...bibliography.unresolvedParagraphIds,
    ];
  }

  return document.academicSections.occurrences
    .filter((occurrence) => isBibliographySectionIdentity(occurrence.identity))
    .flatMap((occurrence) => paragraphIdsInBoundary(document, occurrence));
}

function collectListSectionParagraphIds(
  document: Readonly<NormalizedDocument>,
): string[] {
  const listSectionIdentities = new Set(
    LIST_SECTION_IDENTITIES.map((name) => normalizeSectionName(name)),
  );

  return document.academicSections.occurrences
    .filter((occurrence) =>
      occurrence.identity !== null && listSectionIdentities.has(occurrence.identity),
    )
    .flatMap((occurrence) => paragraphIdsInBoundary(document, occurrence));
}

function collectFrontMatterParagraphIds(
  document: Readonly<NormalizedDocument>,
): string[] {
  return document.paragraphs
    .filter((_, paragraphIndex) =>
      document.academicScopes.paragraphs[paragraphIndex]?.scope === "front-matter",
    )
    .map((paragraph) => paragraph.id);
}

function paragraphIdsInBoundary(
  document: Readonly<NormalizedDocument>,
  occurrence: Readonly<AcademicSectionOccurrence>,
): string[] {
  return document.paragraphs
    .filter((_, paragraphIndex) =>
      paragraphIndex >= occurrence.headingParagraphIndex &&
      paragraphIndex <= occurrence.boundary.endParagraphIndex,
    )
    .map((paragraph) => paragraph.id);
}

function isConservativeCitationCandidate(innerText: string): boolean {
  const normalized = normalizeCitationText(innerText);

  if (!YEAR_PATTERN.test(normalized) || !AUTHOR_MARKER_PATTERN.test(normalized)) {
    return false;
  }

  return /[,;]/u.test(normalized) || /\b(?:ve|and|vd\.|ve\s+ark\.|ve\s+diğ\.)\b/iu.test(normalized);
}

function createOccurrenceEvidence(
  document: Readonly<NormalizedDocument>,
  paragraphIndex: number,
): CitationOccurrenceEvidence[] {
  return [
    "visible-document-paragraph",
    ...(document.academicScopes.paragraphs[paragraphIndex]?.scope === "main-content"
      ? ["body-academic-scope" as const]
      : []),
    "author-year-parenthetical-pattern",
    "citation-marker-preserved",
  ];
}

function normalizeCitationText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
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
