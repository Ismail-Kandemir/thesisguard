import type {
  CoverBoundaryEvidence,
  CoverDateFacts,
  CoverFieldEvidenceKind,
  CoverFieldKind,
  CoverFieldOccurrence,
  CoverOccurrence,
  CoverScopeKind,
  DocumentCoverSemantics,
  NormalizedDocument,
  Paragraph,
} from "../types";
import { normalizeSectionName } from "./documentSectionsParser";
import { isInsideInvisibleCurrentDocumentRevision } from "./revisionVisibility";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

interface CoverCandidateRange {
  startParagraphIndex: number;
  endParagraphIndex: number;
  boundaryEvidenceIds: string[];
  scope: CoverScopeKind;
  evidence: string[];
}

interface FieldCandidate {
  field: CoverFieldKind;
  value: string;
  confidence: CoverFieldOccurrence["confidence"];
  evidence: CoverFieldEvidenceKind[];
  dateFacts?: CoverDateFacts;
}

interface FieldDetectionContext {
  paragraphs: readonly Paragraph[];
  range: CoverCandidateRange;
  paragraphIndex: number;
  seenFields: ReadonlySet<CoverFieldKind>;
}

const TURKISH_MONTHS = new Map<string, number>([
  ["ocak", 1],
  ["subat", 2],
  ["mart", 3],
  ["nisan", 4],
  ["mayis", 5],
  ["haziran", 6],
  ["temmuz", 7],
  ["agustos", 8],
  ["eylul", 9],
  ["ekim", 10],
  ["kasim", 11],
  ["aralik", 12],
]);

const LABEL_PATTERNS: ReadonlyArray<{
  field: CoverFieldKind;
  labels: readonly RegExp[];
}> = [
  {
    field: "institution",
    labels: [
      /^(university|institution|institute|school)\b/i,
      /^(universite|universitesi|kurum|enstitu|fakulte)\b/i,
    ],
  },
  {
    field: "title",
    labels: [/^(title|thesis title|project title)\b/i, /^(baslik|tez basligi|proje basligi)\b/i],
  },
  {
    field: "author",
    labels: [/^(author|student|prepared by|submitted by)\b/i, /^(yazar|ogrenci|hazirlayan|sunan)\b/i],
  },
  {
    field: "advisor",
    labels: [/^(advisor|supervisor|thesis advisor)\b/i, /^(danisman|tez danismani)\b/i],
  },
  {
    field: "work-type",
    labels: [/^(work type|degree|program)\b/i, /^(calisma turu|tez turu|derece|program)\b/i],
  },
  {
    field: "date",
    labels: [/^(date|year)\b/i, /^(tarih|yil)\b/i],
  },
  {
    field: "publication-place",
    labels: [/^(place|publication place|city)\b/i, /^(yer|yayim yeri|sehir)\b/i],
  },
];

export function createEmptyCoverSemantics(): DocumentCoverSemantics {
  return {
    occurrences: [],
    fields: [],
    boundaryEvidence: [],
  };
}

export function normalizeCoverSemantics(
  document: Readonly<NormalizedDocument>,
  documentXml: string,
): NormalizedDocument {
  const xmlDocument = new DOMParser().parseFromString(documentXml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    return {
      ...document,
      coverSemantics: createEmptyCoverSemantics(),
    };
  }

  return {
    ...document,
    coverSemantics: buildCoverSemantics(document, xmlDocument),
  };
}

export function buildCoverSemantics(
  document: Readonly<NormalizedDocument>,
  xmlDocument: Document,
): DocumentCoverSemantics {
  const boundaryEvidence = parseCoverBoundaryEvidence(xmlDocument);
  const candidateRanges = createCoverCandidateRanges(document.paragraphs, boundaryEvidence);
  const fields: CoverFieldOccurrence[] = [];
  const occurrences: CoverOccurrence[] = [];

  for (const [index, range] of candidateRanges.entries()) {
    const occurrenceId = `cover-${index + 1}`;
    const rangeFields = extractCoverFields(document.paragraphs, range, occurrenceId);

    if (range.scope === "unknown" && rangeFields.length === 0) {
      continue;
    }

    fields.push(...rangeFields);
    occurrences.push({
      id: occurrenceId,
      scope: range.scope,
      confidence: range.scope === "unknown" ? "unknown" : "high",
      startParagraphIndex: range.startParagraphIndex,
      endParagraphIndex: range.endParagraphIndex,
      boundaryEvidenceIds: range.boundaryEvidenceIds,
      fieldOccurrenceIds: rangeFields.map((field) => field.id),
      evidence: range.evidence,
      sourcePart: "word/document.xml",
    });
  }

  return {
    occurrences,
    fields,
    boundaryEvidence,
  };
}

function parseCoverBoundaryEvidence(xmlDocument: Document): CoverBoundaryEvidence[] {
  const body = xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "body").item(0);

  if (!body) {
    return [];
  }

  const paragraphs = getBodyParagraphs(body);
  const evidence: CoverBoundaryEvidence[] = [];

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    if (isExcludedParagraph(paragraph)) {
      continue;
    }

    const hasPageBreak = getVisiblePageBreaks(paragraph).length > 0;
    if (hasPageBreak) {
      evidence.push({
        id: `cover-boundary-${evidence.length + 1}`,
        kind: "explicit-page-break",
        paragraphId: paragraphId(paragraphIndex),
        paragraphIndex,
        beforeParagraphIndex: paragraphIndex,
        afterParagraphIndex: paragraphIndex + 1,
        confidence: "high",
        sourcePart: "word/document.xml",
      });
    }

    const paragraphProperties = getDirectChild(paragraph, "pPr");
    const sectionProperties = paragraphProperties
      ? getDirectChild(paragraphProperties, "sectPr")
      : null;

    if (sectionProperties) {
      evidence.push({
        id: `cover-boundary-${evidence.length + 1}`,
        kind: "paragraph-section-break",
        paragraphId: paragraphId(paragraphIndex),
        paragraphIndex,
        beforeParagraphIndex: paragraphIndex,
        afterParagraphIndex: paragraphIndex + 1,
        confidence: "high",
        sourcePart: "word/document.xml",
      });
    }
  }

  const bodySectionProperties = getDirectChild(body, "sectPr");
  if (bodySectionProperties) {
    evidence.push({
      id: `cover-boundary-${evidence.length + 1}`,
      kind: "body-section-break",
      paragraphId: null,
      paragraphIndex: null,
      beforeParagraphIndex: Math.max(paragraphs.length - 1, 0),
      afterParagraphIndex: null,
      confidence: "high",
      sourcePart: "word/document.xml",
    });
  }

  return evidence;
}

function createCoverCandidateRanges(
  paragraphs: readonly Paragraph[],
  boundaryEvidence: readonly CoverBoundaryEvidence[],
): CoverCandidateRange[] {
  const usableBoundaries = boundaryEvidence
    .filter((evidence) => evidence.afterParagraphIndex !== null)
    .sort((first, second) =>
      (first.afterParagraphIndex ?? 0) - (second.afterParagraphIndex ?? 0),
    );

  if (paragraphs.length === 0) {
    return [];
  }

  if (usableBoundaries.length === 0) {
    return [{
      startParagraphIndex: 0,
      endParagraphIndex: Math.min(paragraphs.length - 1, 12),
      boundaryEvidenceIds: [],
      scope: "unknown",
      evidence: ["missing-explicit-cover-boundary"],
    }];
  }

  const ranges: CoverCandidateRange[] = [];
  let startParagraphIndex = 0;

  for (const [index, boundary] of usableBoundaries.slice(0, 2).entries()) {
    const endParagraphIndex = Math.min(
      boundary.beforeParagraphIndex ?? boundary.afterParagraphIndex ?? startParagraphIndex,
      paragraphs.length - 1,
    );

    if (startParagraphIndex <= endParagraphIndex) {
      ranges.push({
        startParagraphIndex,
        endParagraphIndex,
        boundaryEvidenceIds: [boundary.id],
        scope: index === 0 ? "outer-cover" : "inner-cover",
        evidence: [boundary.kind],
      });
    }

    startParagraphIndex = Math.min(boundary.afterParagraphIndex ?? startParagraphIndex, paragraphs.length);
  }

  if (usableBoundaries.length === 1 && startParagraphIndex < paragraphs.length) {
    ranges.push({
      startParagraphIndex,
      endParagraphIndex: Math.min(paragraphs.length - 1, startParagraphIndex + 12),
      boundaryEvidenceIds: [usableBoundaries[0].id],
      scope: "unknown",
      evidence: ["single-boundary-open-ended-cover-candidate"],
    });
  }

  return ranges;
}

function extractCoverFields(
  paragraphs: readonly Paragraph[],
  range: CoverCandidateRange,
  coverOccurrenceId: string,
): CoverFieldOccurrence[] {
  const fields: CoverFieldOccurrence[] = [];
  const seenFields = new Set<CoverFieldKind>();

  for (
    let paragraphIndex = range.startParagraphIndex;
    paragraphIndex <= range.endParagraphIndex;
    paragraphIndex += 1
  ) {
    const paragraph = paragraphs[paragraphIndex];

    if (!paragraph || !isCoverParagraphCandidate(paragraph)) {
      continue;
    }

    for (const candidate of detectFieldCandidates(paragraph.text, {
      paragraphs,
      range,
      paragraphIndex,
      seenFields,
    })) {
      if (seenFields.has(candidate.field)) {
        continue;
      }

      seenFields.add(candidate.field);
      fields.push({
        id: `${coverOccurrenceId}-field-${fields.length + 1}`,
        field: candidate.field,
        value: candidate.value,
        normalizedValue: normalizeCoverValue(candidate.value),
        paragraphId: paragraph.id,
        paragraphIndex,
        coverOccurrenceId,
        confidence: candidate.confidence,
        evidence: candidate.evidence,
        ...(candidate.dateFacts ? { dateFacts: candidate.dateFacts } : {}),
        sourcePart: "word/document.xml",
      });
    }
  }

  return fields;
}

function detectFieldCandidates(
  text: string,
  context: FieldDetectionContext,
): FieldCandidate[] {
  const trimmed = normalizeVisibleWhitespace(text);

  if (trimmed.length === 0) {
    return [];
  }

  const explicit = detectExplicitLabelField(trimmed);
  if (explicit) {
    return [explicit];
  }

  const inferred = detectStrongPatternField(trimmed, context);
  return inferred ? [inferred] : [];
}

function detectExplicitLabelField(text: string): FieldCandidate | null {
  const match = text.match(/^([^:]{2,48}):\s*(\S.*)$/u);

  if (!match) {
    return null;
  }

  const label = normalizeAsciiTurkish(match[1]);
  const value = match[2].trim();

  if (value.length === 0) {
    return null;
  }

  for (const pattern of LABEL_PATTERNS) {
    if (pattern.labels.some((candidate) => candidate.test(label))) {
      const dateFacts = pattern.field === "date"
        ? parseCoverDateFacts(value)
        : null;

      return {
        field: pattern.field,
        value,
        confidence: "high",
        evidence: [
          "explicit-label",
          ...(dateFacts?.detectionStrategy === "turkish-month-year"
            ? ["turkish-month-year-pattern" as const]
            : []),
          ...(dateFacts &&
            dateFacts.detectionStrategy !== "turkish-month-year"
            ? ["date-pattern" as const]
            : []),
        ],
        ...(dateFacts ? { dateFacts: { ...dateFacts, confidence: "high" } } : {}),
      };
    }
  }

  return null;
}

function detectStrongPatternField(
  text: string,
  context: FieldDetectionContext,
): FieldCandidate | null {
  const normalized = normalizeAsciiTurkish(text);

  if (/\b(university|universitesi|universite)\b/i.test(normalized)) {
    return {
      field: "institution",
      value: text,
      confidence: "medium",
      evidence: ["institution-pattern"],
    };
  }

  if (/\b(thesis|tez|dissertation|project|proje[a-z]*)\b/i.test(normalized)) {
    return {
      field: "work-type",
      value: text,
      confidence: "medium",
      evidence: ["academic-work-type-pattern"],
    };
  }

  const placeDate = text.match(/^([^0-9,/-][^0-9,/-]{1,39})\s*[,/-]\s*((?:19|20)\d{2})$/u);
  if (placeDate) {
    return {
      field: "publication-place",
      value: placeDate[1].trim(),
      confidence: "medium",
      evidence: ["place-date-pattern"],
    };
  }

  const dateFacts = parseCoverDateFacts(text);
  if (dateFacts) {
    return {
      field: "date",
      value: text,
      confidence: "medium",
      evidence: [
        dateFacts.detectionStrategy === "turkish-month-year"
          ? "turkish-month-year-pattern"
          : "date-pattern",
      ],
      dateFacts,
    };
  }

  if (isTerminalPublicationPlaceCandidate(text, context)) {
    return {
      field: "publication-place",
      value: text,
      confidence: "medium",
      evidence: ["terminal-place-date-proximity"],
    };
  }

  return null;
}

function parseCoverDateFacts(text: string): CoverDateFacts | null {
  const trimmed = normalizeVisibleWhitespace(text);
  const yearOnly = /^((?:19|20)\d{2})$/u.exec(trimmed);
  if (yearOnly) {
    return {
      month: null,
      year: yearOnly[1],
      rawText: trimmed,
      confidence: "medium",
      detectionStrategy: "year-only",
      precision: "year",
    };
  }

  const numericMonthYear = /^(0?[1-9]|1[0-2])[./-]((?:19|20)\d{2})$/u.exec(trimmed);
  if (numericMonthYear) {
    return {
      month: Number(numericMonthYear[1]),
      year: numericMonthYear[2],
      rawText: trimmed,
      confidence: "medium",
      detectionStrategy: "numeric-month-year",
      precision: "month-year",
    };
  }

  const turkishMonthYear = /^([\p{L}]+)\s*,?\s*((?:19|20)\d{2})$/u.exec(trimmed);
  if (!turkishMonthYear) {
    return null;
  }

  const month = TURKISH_MONTHS.get(normalizeMonthName(turkishMonthYear[1]));
  if (!month) {
    return null;
  }

  return {
    month,
    year: turkishMonthYear[2],
    rawText: trimmed,
    confidence: "medium",
    detectionStrategy: "turkish-month-year",
    precision: "month-year",
  };
}

function isTerminalPublicationPlaceCandidate(
  text: string,
  context: FieldDetectionContext,
): boolean {
  const trimmed = normalizeVisibleWhitespace(text);

  if (
    context.seenFields.has("publication-place") ||
    trimmed.length < 3 ||
    trimmed.length > 40 ||
    /[0-9:]/u.test(trimmed) ||
    /\s/u.test(trimmed) ||
    !/^\p{L}+$/u.test(trimmed) ||
    detectStrongNonPlaceText(trimmed)
  ) {
    return false;
  }

  const terminalDistance = context.range.endParagraphIndex - context.paragraphIndex;
  if (terminalDistance > 2) {
    return false;
  }

  return hasCoverDateNearParagraph(context) &&
    hasNonPlaceCoverEvidenceBeforeParagraph(context);
}

function hasCoverDateNearParagraph(context: FieldDetectionContext): boolean {
  const start = Math.max(context.range.startParagraphIndex, context.paragraphIndex - 2);
  const end = context.paragraphIndex - 1;

  for (let index = start; index <= end; index += 1) {
    const paragraph = context.paragraphs[index];
    if (paragraph && parseCoverDateFacts(paragraph.text) !== null) {
      return true;
    }
  }

  return false;
}

function hasNonPlaceCoverEvidenceBeforeParagraph(context: FieldDetectionContext): boolean {
  for (
    let index = context.range.startParagraphIndex;
    index < context.paragraphIndex;
    index += 1
  ) {
    const paragraph = context.paragraphs[index];
    if (!paragraph || !isCoverParagraphCandidate(paragraph)) {
      continue;
    }

    const explicit = detectExplicitLabelField(paragraph.text);
    if (explicit && explicit.field !== "publication-place") {
      return true;
    }

    const normalized = normalizeAsciiTurkish(paragraph.text);
    if (
      /\b(university|universitesi|universite)\b/i.test(normalized) ||
      /\b(thesis|tez|dissertation|project|proje[a-z]*)\b/i.test(normalized)
    ) {
      return true;
    }
  }

  return false;
}

function detectStrongNonPlaceText(text: string): boolean {
  const normalized = normalizeAsciiTurkish(text);

  return /\b(university|universitesi|universite|faculty|fakulte|project|proje|tez|title|baslik|author|yazar|advisor|danisman)\b/i
    .test(normalized);
}

function isCoverParagraphCandidate(paragraph: Paragraph): boolean {
  return (
    paragraph.contentScope === "document" &&
    !paragraph.isTableOfContentsEntry &&
    !paragraph.isInTableCell &&
    !paragraph.isEmpty
  );
}

function getBodyParagraphs(body: Element): Element[] {
  return Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, "p")).filter(
    (paragraph) => !hasAncestor(paragraph, "txbxContent"),
  );
}

function isExcludedParagraph(paragraph: Element): boolean {
  return (
    hasAncestor(paragraph, "txbxContent") ||
    hasAncestor(paragraph, "tc") ||
    isInsideInvisibleCurrentDocumentRevision(paragraph)
  );
}

function getVisiblePageBreaks(paragraph: Element): Element[] {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "br")).filter(
    (element) =>
      !isInsideInvisibleCurrentDocumentRevision(element) &&
      getWordAttribute(element, "type") === "page",
  );
}

function getDirectChild(element: Element, localName: string): Element | null {
  return Array.from(element.children).find(
    (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === localName,
  ) ?? null;
}

function hasAncestor(element: Element, localName: string): boolean {
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.namespaceURI === WORD_NAMESPACE && ancestor.localName === localName) {
      return true;
    }
    ancestor = ancestor.parentElement;
  }
  return false;
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}

function paragraphId(paragraphIndex: number): string {
  return `paragraph-${paragraphIndex + 1}`;
}

function normalizeCoverValue(value: string): string {
  return normalizeSectionName(value);
}

function normalizeVisibleWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAsciiTurkish(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeMonthName(value: string): string {
  return normalizeAsciiTurkish(value)
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u");
}
