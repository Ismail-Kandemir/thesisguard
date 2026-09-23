import type {
  AcademicSectionOccurrence,
  DocumentCaption,
  DocumentTableList,
  NormalizedDocument,
  RuleDefinition,
  TableListEntryOccurrence,
  TableListEntryAssociation,
  TableListTableAssociation,
} from "../types";
import { findDeclaredAcademicSectionOccurrencesByNames } from "../rules/academicSectionLookup";
import { normalizeSectionName } from "./documentSectionsParser";

const TABLE_LIST_SECTION_NAMES = ["Tablolar Listesi"];
const TABLE_LIST_ENTRY_PATTERN = /^\s*tablo\s+((?:\d+\.)*\d+)\.?\s*(.*?)\s*$/iu;
const TRAILING_PAGE_SUFFIX_PATTERN = /(?:[\s.\u00a0]*\d+)\s*$/u;

export function normalizeTableListSemantics(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  return {
    ...document,
    tableList: buildDocumentTableList(document, rules),
  };
}

export function getDocumentTableList(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentTableList {
  return document.tableList ?? buildDocumentTableList(document, rules);
}

export function buildDocumentTableList(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): DocumentTableList {
  const section = findTableListSection(document, rules);

  if (!section) {
    return {
      sectionOccurrenceId: null,
      sectionIdentity: null,
      sectionHeadingParagraphId: null,
      sectionHeadingParagraphIndex: null,
      sectionBoundary: null,
      status: "LIST_SECTION_MISSING",
      entries: [],
      tableAssociations: buildTableAssociations(document, []),
      entryAssociations: [],
      unresolvedParagraphIds: [],
    };
  }

  const entries = collectTableListEntries(document, section);
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
    tableAssociations: buildTableAssociations(document, entries),
    entryAssociations: buildEntryAssociations(document, entries),
    unresolvedParagraphIds,
  };
}

function findTableListSection(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): AcademicSectionOccurrence | null {
  return (
    findDeclaredAcademicSectionOccurrencesByNames(
      document,
      rules,
      TABLE_LIST_SECTION_NAMES,
    )[0] ?? null
  );
}

function collectTableListEntries(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
): TableListEntryOccurrence[] {
  const blockIndexByParagraphId = new Map(
    document.blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );
  const entries: TableListEntryOccurrence[] = [];

  for (const [paragraphIndex, paragraph] of document.paragraphs.entries()) {
    if (!isEntryCandidate(document, section, paragraphIndex)) {
      continue;
    }

    const parsed = parseTableListEntryText(paragraph.text);

    if (!parsed) {
      continue;
    }

    entries.push({
      id: `table-list-entry-${entries.length + 1}`,
      sectionOccurrenceId: section.id,
      paragraphId: paragraph.id,
      paragraphIndex,
      blockIndex: blockIndexByParagraphId.get(paragraph.id) ?? null,
      rawText: paragraph.text,
      normalizedText: normalizeListEntryText(paragraph.text),
      label: "Tablo",
      number: parsed.number,
      title: parsed.title,
      entryIndex: entries.length + 1,
      confidence: parsed.title === null ? "low" : "high",
      evidence: [
        "academic-section-boundary",
        "visible-document-paragraph",
        "table-list-entry-pattern",
        ...(parsed.pageSuffixIgnored ? ["page-number-suffix-ignored"] : []),
      ],
    });
  }

  return entries;
}

function collectUnresolvedParagraphIds(
  document: Readonly<NormalizedDocument>,
  section: Readonly<AcademicSectionOccurrence>,
  entries: readonly TableListEntryOccurrence[],
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

function parseTableListEntryText(
  text: string,
): { number: string; title: string | null; pageSuffixIgnored: boolean } | null {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const match = TABLE_LIST_ENTRY_PATTERN.exec(normalized);

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

function buildTableAssociations(
  document: Readonly<NormalizedDocument>,
  entries: readonly TableListEntryOccurrence[],
): TableListTableAssociation[] {
  const tableIdentities = getTableIdentities(document);
  const entryByNumber = groupBy(entries, (entry) => entry.number);
  const tableCountByNumber = countBy(tableIdentities, (identity) => identity.number);

  return tableIdentities.map((identity) => {
    const matchingEntries = entryByNumber.get(identity.number) ?? [];
    const duplicateTableNumber = (tableCountByNumber.get(identity.number) ?? 0) > 1;
    const status = duplicateTableNumber || matchingEntries.length > 1
      ? "AMBIGUOUS"
      : matchingEntries.length === 1
        ? "MATCHED"
        : "MISSING_LIST_ENTRY";

    return {
      tableId: identity.tableId,
      captionId: identity.caption.id,
      number: identity.number,
      listEntryIds: matchingEntries.map((entry) => entry.id),
      status,
      evidence: [
        "structural-table-occurrence",
        "caption-number-identity",
        ...(duplicateTableNumber ? ["duplicate-caption-number"] : []),
        ...(matchingEntries.length > 1 ? ["duplicate-list-entry-number"] : []),
      ],
    };
  });
}

function buildEntryAssociations(
  document: Readonly<NormalizedDocument>,
  entries: readonly TableListEntryOccurrence[],
): TableListEntryAssociation[] {
  const tableIdentities = getTableIdentities(document);
  const tablesByNumber = groupBy(tableIdentities, (identity) => identity.number);
  const entryCountByNumber = countBy(entries, (entry) => entry.number);

  return entries.map((entry) => {
    const matchingTables = tablesByNumber.get(entry.number) ?? [];
    const duplicateEntryNumber = (entryCountByNumber.get(entry.number) ?? 0) > 1;
    const status = matchingTables.length === 0
      ? "ORPHAN_LIST_ENTRY"
      : duplicateEntryNumber || matchingTables.length > 1
        ? "AMBIGUOUS"
        : "MATCHED";

    return {
      listEntryId: entry.id,
      tableIds: matchingTables.map((identity) => identity.tableId),
      captionIds: matchingTables.map((identity) => identity.caption.id),
      number: entry.number,
      status,
      evidence: [
        "table-list-entry-number-identity",
        ...(duplicateEntryNumber ? ["duplicate-list-entry-number"] : []),
        ...(matchingTables.length > 1 ? ["duplicate-caption-number"] : []),
      ],
    };
  });
}

function getTableIdentities(
  document: Readonly<NormalizedDocument>,
): Array<{ tableId: string; caption: DocumentCaption; number: string }> {
  const captionById = new Map(document.captions.items.map((caption) => [caption.id, caption]));

  return document.tables.items.flatMap((table) => {
    if (table.isNested || table.captionId === null) {
      return [];
    }

    const caption = captionById.get(table.captionId);

    return caption && caption.kind === "table"
      ? [{ tableId: table.id, caption, number: caption.number }]
      : [];
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

export function isTableListSectionIdentity(identity: string | null): boolean {
  return identity === normalizeSectionName("Tablolar Listesi");
}
