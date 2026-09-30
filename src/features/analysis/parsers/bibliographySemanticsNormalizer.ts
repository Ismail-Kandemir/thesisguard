import type {
  AcademicSectionOccurrence,
  BibliographyAuthorKind,
  BibliographyEntryBoundaryStatus,
  BibliographyEntryIdentity,
  BibliographyEntryIdentityEvidence,
  BibliographyEntryIdentityParseStatus,
  BibliographyEntryOccurrence,
  DocumentBibliography,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
} from "../types";
import { findDeclaredAcademicSectionOccurrencesByNames } from "../rules/academicSectionLookup";
import { normalizeSectionName } from "./documentSectionsParser";
import { EffectiveFormattingResolver } from "./effectiveFormattingResolver";

const BIBLIOGRAPHY_SECTION_NAMES = ["Kaynaklar", "References"];
const YEAR_WITH_SUFFIX_PATTERN = /\b((?:18|19|20)\d{2})([a-z])?\b/iu;
const NAMED_AUTHOR_PATTERN = /[\p{Lu}][\p{L}'’-]+,\s*(?:[\p{Lu}]\.?\s*)+/gu;
const ANONYMOUS_AUTHOR_PATTERN = /^(?:anonim|anonymous)$/iu;
const ORGANIZATION_MARKER_PATTERN =
  /(?:üniversitesi|bakanlığı|kurumu|enstitüsü|komitesi|kurulu|\b(?:university|ministry|institute|association|organization|organisation|council|committee|who|unesco|fao)\b)/iu;

export function normalizeBibliographySemantics(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  return {
    ...document,
    bibliography: buildDocumentBibliography(document, rules),
  };
}

export function getDocumentBibliography(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentBibliography {
  return document.bibliography ?? buildDocumentBibliography(document, rules);
}

export function buildDocumentBibliography(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentBibliography {
  const section = findBibliographySection(document, rules);

  if (!section) {
    return {
      sectionOccurrenceId: null,
      sectionIdentity: null,
      sectionHeadingParagraphId: null,
      sectionHeadingParagraphIndex: null,
      sectionBoundary: null,
      status: "SECTION_MISSING",
      entries: [],
      unresolvedParagraphIds: [],
    };
  }

  const entries = collectBibliographyEntries(document, section);
  const unresolvedParagraphIds = entries
    .filter((entry) => entry.boundaryStatus !== "DEFINITE_ENTRY")
    .flatMap((entry) => entry.paragraphIds);
  const status = entries.length > 0
    ? unresolvedParagraphIds.length > 0
      ? "SECTION_PRESENT_UNRESOLVED_CONTENT"
      : "SECTION_PRESENT_WITH_ENTRIES"
    : "SECTION_PRESENT_EMPTY";

  return {
    sectionOccurrenceId: section.id,
    sectionIdentity: section.identity,
    sectionHeadingParagraphId: section.headingParagraphId,
    sectionHeadingParagraphIndex: section.headingParagraphIndex,
    sectionBoundary: section.boundary,
    status,
    entries,
    unresolvedParagraphIds,
  };
}

function findBibliographySection(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): AcademicSectionOccurrence | null {
  return (
    findDeclaredAcademicSectionOccurrencesByNames(
      document,
      rules,
      BIBLIOGRAPHY_SECTION_NAMES,
    )[0] ?? null
  );
}

function collectBibliographyEntries(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
): BibliographyEntryOccurrence[] {
  const resolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
    document.themeFonts ?? null,
  );
  const candidateParagraphs = document.paragraphs
    .map((paragraph, paragraphIndex) => ({ paragraph, paragraphIndex }))
    .filter(({ paragraph, paragraphIndex }) =>
      isBibliographyEntryCandidate(document, section, paragraph, paragraphIndex),
    );

  return candidateParagraphs.map(({ paragraph, paragraphIndex }, index) => {
    const blockIndex = findBlockIndexByParagraphId(document, paragraph.id);
    const boundaryStatus = classifyEntryBoundary(paragraph, index);

    return {
      id: `bibliography-entry-${index + 1}`,
      sectionOccurrenceId: section.id,
      paragraphIds: [paragraph.id],
      paragraphIndexes: [paragraphIndex],
      blockStart: blockIndex,
      blockEnd: blockIndex,
      visibleText: paragraph.text,
      normalizedText: normalizeEntryText(paragraph.text),
      entryIndex: index + 1,
      boundaryStatus,
      confidence: boundaryStatus === "DEFINITE_ENTRY" ? "high" : "low",
      identity: parseBibliographyEntryIdentity(paragraph.text, boundaryStatus),
      formatting: {
        paragraphStyleId: paragraph.styleId,
        alignment: resolver.resolveParagraphAlignment(
          paragraph.styleId,
          paragraph.alignment,
        ),
        lineSpacing: resolver.resolveParagraphLineSpacing(
          paragraph.styleId,
          paragraph.lineSpacing,
        ),
        paragraphFormatting: resolver.resolveParagraphFormatting(
          paragraph.styleId,
          paragraph.paragraphFormatting,
        ),
      },
      evidence: createEntryEvidence(paragraph, boundaryStatus),
    };
  });
}

function parseBibliographyEntryIdentity(
  text: string,
  boundaryStatus: BibliographyEntryBoundaryStatus,
): BibliographyEntryIdentity {
  const normalizedText = normalizeVisibleText(text);
  const yearMatch = YEAR_WITH_SUFFIX_PATTERN.exec(normalizedText);
  const evidence: BibliographyEntryIdentityEvidence[] = [];

  if (!yearMatch) {
    return createIdentity({
      authors: [],
      authorKind: "unknown",
      year: null,
      yearSuffix: null,
      title: null,
      parseStatus: "unresolved",
      evidence: ["missing-year"],
      boundaryStatus,
    });
  }

  const year = yearMatch[1];
  const yearSuffix = yearMatch[2]?.toLocaleLowerCase("tr-TR") ?? null;
  evidence.push("year-pattern");
  if (yearSuffix !== null) {
    evidence.push("year-suffix");
  }

  const authorSegment = normalizeAuthorSegment(
    normalizedText.slice(0, yearMatch.index),
  );
  const authorIdentity = parseAuthorIdentity(authorSegment);
  evidence.push(...authorIdentity.evidence);

  const title = parseTitleAfterYear(
    normalizedText.slice(yearMatch.index + yearMatch[0].length),
  );
  evidence.push(title === null ? "missing-title" : "title-after-year");

  const parseStatus = determineIdentityParseStatus(
    authorIdentity.authorKind,
    year,
    title,
  );

  return createIdentity({
    authors: authorIdentity.authors,
    authorKind: authorIdentity.authorKind,
    year,
    yearSuffix,
    title,
    parseStatus,
    evidence,
    boundaryStatus,
  });
}

function parseAuthorIdentity(authorSegment: string): {
  authors: string[];
  authorKind: BibliographyAuthorKind;
  evidence: BibliographyEntryIdentityEvidence[];
} {
  if (authorSegment.length === 0) {
    return {
      authors: [],
      authorKind: "unknown",
      evidence: ["missing-author"],
    };
  }

  if (ANONYMOUS_AUTHOR_PATTERN.test(authorSegment)) {
    return {
      authors: [authorSegment],
      authorKind: "anonymous",
      evidence: ["author-segment-before-year", "anonymous-author-marker"],
    };
  }

  if (ORGANIZATION_MARKER_PATTERN.test(authorSegment)) {
    return {
      authors: [authorSegment],
      authorKind: "organization",
      evidence: ["author-segment-before-year", "organization-author-marker"],
    };
  }

  const namedAuthors = [...authorSegment.matchAll(NAMED_AUTHOR_PATTERN)]
    .map((match) => normalizeAuthorName(match[0]))
    .filter((author) => author.length > 0);

  if (namedAuthors.length > 0) {
    return {
      authors: namedAuthors,
      authorKind: "named",
      evidence: ["author-segment-before-year", "named-author-pattern"],
    };
  }

  return {
    authors: [],
    authorKind: "unknown",
    evidence: ["author-segment-before-year", "ambiguous-author"],
  };
}

function createIdentity(params: {
  authors: string[];
  authorKind: BibliographyAuthorKind;
  year: string | null;
  yearSuffix: string | null;
  title: string | null;
  parseStatus: BibliographyEntryIdentityParseStatus;
  evidence: readonly BibliographyEntryIdentityEvidence[];
  boundaryStatus: BibliographyEntryBoundaryStatus;
}): BibliographyEntryIdentity {
  return {
    authors: params.authors,
    authorKind: params.authorKind,
    year: params.year,
    yearSuffix: params.yearSuffix,
    title: params.title,
    parseStatus: params.parseStatus,
    confidence: determineIdentityConfidence(
      params.parseStatus,
      params.boundaryStatus,
    ),
    parseEvidence: dedupeIdentityEvidence(params.evidence),
  };
}

function determineIdentityParseStatus(
  authorKind: BibliographyAuthorKind,
  year: string | null,
  title: string | null,
): BibliographyEntryIdentityParseStatus {
  if (authorKind !== "unknown" && year !== null && title !== null) {
    return "parsed";
  }

  if (year !== null && (authorKind !== "unknown" || title !== null)) {
    return "partial";
  }

  return "unresolved";
}

function determineIdentityConfidence(
  parseStatus: BibliographyEntryIdentityParseStatus,
  boundaryStatus: BibliographyEntryBoundaryStatus,
): BibliographyEntryIdentity["confidence"] {
  if (boundaryStatus !== "DEFINITE_ENTRY") {
    return "low";
  }

  if (parseStatus === "parsed") {
    return "high";
  }

  if (parseStatus === "partial") {
    return "medium";
  }

  return "low";
}

function normalizeAuthorSegment(text: string): string {
  return text
    .replace(/[\s(]+$/u, "")
    .replace(/^[\s[(]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthorName(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[,\s]+$/u, "").trim();
}

function parseTitleAfterYear(text: string): string | null {
  const title = text.replace(/^[\s).,;:]+/u, "").replace(/\s+/g, " ").trim();

  return title.length > 0 ? title : null;
}

function normalizeVisibleText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function dedupeIdentityEvidence(
  values: readonly BibliographyEntryIdentityEvidence[],
): BibliographyEntryIdentityEvidence[] {
  return [...new Set(values)];
}

function isBibliographyEntryCandidate(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
): boolean {
  if (
    paragraphIndex < section.boundary.startParagraphIndex ||
    paragraphIndex > section.boundary.endParagraphIndex
  ) {
    return false;
  }

  if (
    paragraph.isEmpty ||
    paragraph.text.trim().length === 0 ||
    paragraph.contentScope !== "document" ||
    paragraph.isTableOfContentsEntry ||
    paragraph.isInTableCell
  ) {
    return false;
  }

  if (paragraph.id === section.headingParagraphId) {
    return false;
  }

  return !document.academicSections.occurrences.some(
    (occurrence) => occurrence.headingParagraphId === paragraph.id,
  );
}

function classifyEntryBoundary(
  paragraph: Readonly<Paragraph>,
  index: number,
): BibliographyEntryBoundaryStatus {
  const text = paragraph.text.trim();

  if (text.length === 0) {
    return "UNRESOLVED";
  }

  if (index > 0 && startsLikeContinuation(text)) {
    return "POSSIBLE_CONTINUATION";
  }

  return "DEFINITE_ENTRY";
}

function startsLikeContinuation(text: string): boolean {
  const firstCharacter = text.trimStart().charAt(0);

  return firstCharacter.length > 0 && firstCharacter === firstCharacter.toLocaleLowerCase("tr-TR") &&
    firstCharacter !== firstCharacter.toLocaleUpperCase("tr-TR");
}

function createEntryEvidence(
  paragraph: Readonly<Paragraph>,
  boundaryStatus: BibliographyEntryBoundaryStatus,
): string[] {
  return [
    "academic-section-boundary",
    "visible-document-paragraph",
    ...(paragraph.numbering.source !== "none" ? ["word-numbering"] : []),
    ...(boundaryStatus === "POSSIBLE_CONTINUATION"
      ? ["possible-continuation-paragraph"]
      : []),
  ];
}

function normalizeEntryText(text: string): string {
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

export function isBibliographySectionIdentity(identity: string | null): boolean {
  return identity !== null &&
    BIBLIOGRAPHY_SECTION_NAMES.some((name) => identity === normalizeSectionName(name));
}
