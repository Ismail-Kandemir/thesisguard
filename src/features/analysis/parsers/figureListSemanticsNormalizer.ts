import type {
  AcademicSectionOccurrence,
  CaptionOccurrence,
  DocumentFigureList,
  FigureListEntryAssociation,
  FigureListEntryOccurrence,
  FigureListFigureAssociation,
  NormalizedDocument,
  ObjectRepresentationOccurrence,
  RuleDefinition,
} from "../types";
import { findDeclaredAcademicSectionOccurrencesByNames } from "../rules/academicSectionLookup";
import { getDeclaredAcademicFigures } from "../rules/objectApplicability";
import { normalizeSectionName } from "./documentSectionsParser";

const FIGURE_LIST_SECTION_NAMES = ["Şekiller Listesi"];
const FIGURE_LIST_ENTRY_PATTERN = /^\s*şekil\s+((?:\d+\.)*\d+)\.?\s*(.*?)\s*$/iu;
const TRAILING_PAGE_SUFFIX_PATTERN = /(?:[\s.\u00a0]*\d+)\s*$/u;

interface FigureIdentity {
  objectId: string;
  captionId: string;
  number: string;
  representation: ObjectRepresentationOccurrence;
  caption: CaptionOccurrence;
}

export function normalizeFigureListSemantics(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  return {
    ...document,
    figureList: buildDocumentFigureList(document, rules),
  };
}

export function getDocumentFigureList(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentFigureList {
  return document.figureList ?? buildDocumentFigureList(document, rules);
}

export function buildDocumentFigureList(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentFigureList {
  const section = findFigureListSection(document, rules);

  if (!section) {
    return {
      sectionOccurrenceId: null,
      sectionIdentity: null,
      sectionHeadingParagraphId: null,
      sectionHeadingParagraphIndex: null,
      sectionBoundary: null,
      status: "LIST_SECTION_MISSING",
      entries: [],
      figureAssociations: buildFigureAssociations(document, []),
      entryAssociations: [],
      unresolvedParagraphIds: [],
    };
  }

  const entries = collectFigureListEntries(document, section);
  const unresolvedParagraphIds = collectUnresolvedParagraphIds(document, section, entries);
  const status = entries.length > 0
    ? unresolvedParagraphIds.length > 0
      ? "LIST_SECTION_PRESENT_UNRESOLVED"
      : "LIST_SECTION_PRESENT_WITH_ENTRIES"
    : "LIST_SECTION_PRESENT_EMPTY";

  return {
    sectionOccurrenceId: section.id,
    sectionIdentity: section.identity,
    sectionHeadingParagraphId: section.headingParagraphId,
    sectionHeadingParagraphIndex: section.headingParagraphIndex,
    sectionBoundary: section.boundary,
    status,
    entries,
    figureAssociations: buildFigureAssociations(document, entries),
    entryAssociations: buildEntryAssociations(document, entries),
    unresolvedParagraphIds,
  };
}

function findFigureListSection(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): AcademicSectionOccurrence | null {
  return (
    findDeclaredAcademicSectionOccurrencesByNames(
      document,
      rules,
      FIGURE_LIST_SECTION_NAMES,
    )[0] ?? null
  );
}

function collectFigureListEntries(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
): FigureListEntryOccurrence[] {
  const blockIndexByParagraphId = new Map(
    document.blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );
  const entries: FigureListEntryOccurrence[] = [];

  for (const [paragraphIndex, paragraph] of document.paragraphs.entries()) {
    if (!isEntryCandidate(document, section, paragraphIndex)) {
      continue;
    }

    const parsed = parseFigureListEntryText(paragraph.text);

    if (!parsed) {
      continue;
    }

    entries.push({
      id: `figure-list-entry-${entries.length + 1}`,
      sectionOccurrenceId: section.id,
      paragraphId: paragraph.id,
      paragraphIndex,
      blockIndex: blockIndexByParagraphId.get(paragraph.id) ?? null,
      rawText: paragraph.text,
      normalizedText: normalizeListEntryText(paragraph.text),
      label: "Şekil",
      number: parsed.number,
      title: parsed.title,
      entryIndex: entries.length + 1,
      confidence: parsed.title === null ? "low" : "high",
      evidence: [
        "academic-section-boundary",
        "visible-document-paragraph",
        "figure-list-entry-pattern",
        ...(parsed.pageSuffixIgnored ? ["page-number-suffix-ignored"] : []),
      ],
    });
  }

  return entries;
}

function collectUnresolvedParagraphIds(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
  entries: readonly FigureListEntryOccurrence[],
): string[] {
  const entryParagraphIds = new Set(entries.map((entry) => entry.paragraphId));

  return document.paragraphs
    .filter((paragraph, paragraphIndex) =>
      isEntryCandidate(document, section, paragraphIndex) &&
      !paragraph.isEmpty &&
      paragraph.text.trim().length > 0 &&
      !entryParagraphIds.has(paragraph.id)
    )
    .map((paragraph) => paragraph.id);
}

function isEntryCandidate(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
  paragraphIndex: number,
): boolean {
  const paragraph = document.paragraphs[paragraphIndex];

  if (!paragraph) {
    return false;
  }

  if (
    paragraphIndex < section.boundary.startParagraphIndex ||
    paragraphIndex > section.boundary.endParagraphIndex
  ) {
    return false;
  }

  if (
    paragraph.contentScope !== "document" ||
    paragraph.isTableOfContentsEntry ||
    paragraph.isInTableCell ||
    paragraph.isEmpty ||
    paragraph.id === section.headingParagraphId
  ) {
    return false;
  }

  return !document.academicSections.occurrences.some(
    (occurrence) => occurrence.headingParagraphId === paragraph.id,
  );
}

function parseFigureListEntryText(
  text: string,
): { number: string; title: string | null; pageSuffixIgnored: boolean } | null {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const match = FIGURE_LIST_ENTRY_PATTERN.exec(normalized);

  if (!match) {
    return null;
  }

  const titleWithPage = match[2].trim();
  const withoutPage = titleWithPage.replace(TRAILING_PAGE_SUFFIX_PATTERN, "").trim();
  const pageSuffixIgnored = withoutPage !== titleWithPage;
  const title = withoutPage.length > 0 ? withoutPage.replace(/[.\s]+$/u, "").trim() : null;

  return {
    number: match[1],
    title: title && title.length > 0 ? title : null,
    pageSuffixIgnored,
  };
}

function buildFigureAssociations(
  document: Readonly<NormalizedDocument>,
  entries: readonly FigureListEntryOccurrence[],
): FigureListFigureAssociation[] {
  const figureIdentities = getFigureIdentities(document);
  const entryByNumber = groupBy(entries, (entry) => entry.number);
  const figureCountByNumber = countBy(figureIdentities, (identity) => identity.number);

  return figureIdentities.map((identity) => {
    const matchingEntries = entryByNumber.get(identity.number) ?? [];
    const duplicateFigureNumber = (figureCountByNumber.get(identity.number) ?? 0) > 1;
    const status = duplicateFigureNumber || matchingEntries.length > 1
      ? "AMBIGUOUS"
      : matchingEntries.length === 1
        ? "MATCHED"
        : "MISSING_LIST_ENTRY";

    return {
      objectId: identity.objectId,
      captionId: identity.captionId,
      number: identity.number,
      listEntryIds: matchingEntries.map((entry) => entry.id),
      status,
      evidence: [
        "academic-object-resolution",
        "semantic-caption-number-identity",
        ...(duplicateFigureNumber ? ["duplicate-caption-number"] : []),
        ...(matchingEntries.length > 1 ? ["duplicate-list-entry-number"] : []),
      ],
    };
  });
}

function buildEntryAssociations(
  document: Readonly<NormalizedDocument>,
  entries: readonly FigureListEntryOccurrence[],
): FigureListEntryAssociation[] {
  const figureIdentities = getFigureIdentities(document);
  const figuresByNumber = groupBy(figureIdentities, (identity) => identity.number);
  const entryCountByNumber = countBy(entries, (entry) => entry.number);

  return entries.map((entry) => {
    const matchingFigures = figuresByNumber.get(entry.number) ?? [];
    const duplicateEntryNumber = (entryCountByNumber.get(entry.number) ?? 0) > 1;
    const status = matchingFigures.length === 0
      ? "ORPHAN_LIST_ENTRY"
      : duplicateEntryNumber || matchingFigures.length > 1
        ? "AMBIGUOUS"
        : "MATCHED";

    return {
      listEntryId: entry.id,
      objectIds: matchingFigures.map((identity) => identity.objectId),
      captionIds: matchingFigures.map((identity) => identity.captionId),
      number: entry.number,
      status,
      evidence: [
        "figure-list-entry-number-identity",
        ...(duplicateEntryNumber ? ["duplicate-list-entry-number"] : []),
        ...(matchingFigures.length > 1 ? ["duplicate-caption-number"] : []),
      ],
    };
  });
}

function getFigureIdentities(
  document: Readonly<NormalizedDocument>,
): FigureIdentity[] {
  return getDeclaredAcademicFigures(document).flatMap((figure) => {
    const semantic = figure.semanticCaption?.semantic;

    if (
      !figure.semanticCaption ||
      semantic?.status !== "declared" ||
      semantic.academicType !== "figure"
    ) {
      return [];
    }

    return [{
      objectId: figure.representation.id,
      captionId: figure.semanticCaption.id,
      number: semantic.number,
      representation: figure.representation,
      caption: figure.semanticCaption,
    }];
  });
}

function normalizeListEntryText(text: string): string {
  return text.normalize("NFC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function groupBy<TItem>(
  items: readonly TItem[],
  getKey: (item: TItem) => string,
): Map<string, TItem[]> {
  const grouped = new Map<string, TItem[]>();

  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

function countBy<TItem>(
  items: readonly TItem[],
  getKey: (item: TItem) => string,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export function isFigureListSectionIdentity(identity: string | null): boolean {
  return identity === normalizeSectionName("Şekiller Listesi");
}
