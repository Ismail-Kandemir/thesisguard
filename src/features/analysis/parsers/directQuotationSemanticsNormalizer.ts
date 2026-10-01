import type {
  AcademicSectionOccurrence,
  CitationOccurrence,
  DirectQuotationDelimiterEvidence,
  DirectQuotationDelimiterKind,
  DirectQuotationExclusionEvidence,
  DirectQuotationOccurrence,
  DirectQuotationCitationEvidence,
  DirectQuotationCitationAssociationMethod,
  DirectQuotationCitationAmbiguityReason,
  DirectQuotationPageEvidence,
  DocumentDirectQuotationSemantics,
  NormalizedDocument,
  Paragraph,
} from "../types";
import { countWords } from "../rules/wordCount";
import { isBibliographySectionIdentity } from "./bibliographySemanticsNormalizer";
import { normalizeSectionName } from "./documentSectionsParser";
import { createParagraphTextSpan } from "./textSpan";

const SHORT_QUOTATION_WORD_LIMIT = 40;
const PAGE_MARKER_PATTERN = /\b(ss?\.)\s*(\d+)(?:\s*[-–]\s*(\d+))?\b/iu;
const LIST_SECTION_IDENTITIES = [
  "İçindekiler",
  "Tablolar Listesi",
  "Şekiller Listesi",
  "Simgeler ve Kısaltmalar Listesi",
  "Kısaltmalar",
  "Özet",
  "Abstract",
];

interface DelimiterToken {
  character: string;
  kind: DirectQuotationDelimiterKind;
  offset: number;
}

interface OpenDelimiter {
  token: DelimiterToken;
  nested: boolean;
}

export function createEmptyDirectQuotationSemantics(): DocumentDirectQuotationSemantics {
  return {
    occurrences: [],
    excludedParagraphIds: [],
  };
}

export function normalizeDirectQuotationSemantics(
  document: Readonly<NormalizedDocument>,
): NormalizedDocument {
  return {
    ...document,
    directQuotations: buildDirectQuotationSemantics(document),
  };
}

export function buildDirectQuotationSemantics(
  document: Readonly<NormalizedDocument>,
): DocumentDirectQuotationSemantics {
  const excludedParagraphIds = collectExcludedParagraphIds(document);
  const occurrences: DirectQuotationOccurrence[] = [];

  for (const [paragraphIndex, paragraph] of document.paragraphs.entries()) {
    if (paragraph.text.length === 0 || paragraph.isEmpty) {
      continue;
    }

    const paragraphExclusions = getParagraphExclusions(
      document,
      paragraph,
      paragraphIndex,
      excludedParagraphIds,
    );

    const paragraphOccurrences = scanParagraph(
      document,
      paragraph,
      paragraphIndex,
      paragraphExclusions,
      occurrences.length,
    );

    occurrences.push(
      ...withCitationEvidence(document.citationSemantics.occurrences, paragraphOccurrences),
    );
  }

  return {
    occurrences,
    excludedParagraphIds: [...excludedParagraphIds].sort(),
  };
}

function scanParagraph(
  document: Readonly<NormalizedDocument>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  paragraphExclusions: readonly DirectQuotationExclusionEvidence[],
  existingCount: number,
): DirectQuotationOccurrence[] {
  const tokens = collectDelimiterTokens(paragraph.text);
  const occurrences: DirectQuotationOccurrence[] = [];
  let open: OpenDelimiter | null = null;

  for (const token of tokens) {
    if (isOpeningDelimiter(token, open)) {
      if (open !== null) {
        open = { ...open, nested: true };
      } else {
        open = { token, nested: false };
      }
      continue;
    }

    if (open === null) {
      occurrences.push(createAmbiguousDelimiterOccurrence(
        document,
        paragraph,
        paragraphIndex,
        token,
        "unmatched-delimiter",
        existingCount + occurrences.length,
        paragraphExclusions,
      ));
      continue;
    }

    occurrences.push(createDelimitedOccurrence(
      document,
      paragraph,
      paragraphIndex,
      open,
      token,
      existingCount + occurrences.length,
      paragraphExclusions,
    ));
    open = null;
  }

  if (open !== null) {
    occurrences.push(createAmbiguousDelimiterOccurrence(
      document,
      paragraph,
      paragraphIndex,
      open.token,
      open.nested ? "nested-double-quote" : "unmatched-delimiter",
      existingCount + occurrences.length,
      paragraphExclusions,
    ));
  }

  return occurrences;
}

function createDelimitedOccurrence(
  document: Readonly<NormalizedDocument>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  open: OpenDelimiter,
  close: DelimiterToken,
  occurrenceIndex: number,
  paragraphExclusions: readonly DirectQuotationExclusionEvidence[],
): DirectQuotationOccurrence {
  const contentStart = open.token.offset + open.token.character.length;
  const contentEnd = close.offset;
  const textSpan = createParagraphTextSpan(paragraph, contentStart, contentEnd) ??
    createParagraphTextSpan(paragraph, open.token.offset, close.offset + close.character.length);
  const rawText = textSpan?.text ?? "";
  const wordCount = countWords([rawText]);
  const exclusionEvidence = dedupeExclusions([
    ...paragraphExclusions,
    ...(open.nested ? ["nested-double-quote" as const] : []),
    ...(rawText.trim().length === 0 ? ["empty-quoted-span" as const] : []),
    ...(wordCount >= SHORT_QUOTATION_WORD_LIMIT ? ["word-count-not-short-quote" as const] : []),
  ]);
  const isHighConfidence =
    exclusionEvidence.length === 0 &&
    rawText.trim().length > 0 &&
    wordCount < SHORT_QUOTATION_WORD_LIMIT;

  return {
    id: `direct-quotation-${occurrenceIndex + 1}`,
    kind: open.nested ? "ambiguous" : "inline",
    paragraphIds: [paragraph.id],
    textSpan: textSpan ?? fallbackEmptySpan(paragraph),
    rawText,
    normalizedText: normalizeQuotationText(rawText),
    wordCount,
    delimiterEvidence: [
      createDelimiterEvidence(paragraph, open.token, "opening"),
      createDelimiterEvidence(paragraph, close, "closing"),
    ],
    citationOccurrenceIds: [],
    citationEvidence: [],
    scope: document.academicScopes.paragraphs[paragraphIndex]?.scope === "main-content"
      ? "body"
      : "unknown",
    confidence: isHighConfidence ? "high" : "low",
    exclusionEvidence,
  };
}

function createAmbiguousDelimiterOccurrence(
  document: Readonly<NormalizedDocument>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  token: DelimiterToken,
  reason: DirectQuotationExclusionEvidence,
  occurrenceIndex: number,
  paragraphExclusions: readonly DirectQuotationExclusionEvidence[],
): DirectQuotationOccurrence {
  const span = createParagraphTextSpan(
    paragraph,
    token.offset,
    token.offset + token.character.length,
  ) ?? fallbackEmptySpan(paragraph);

  return {
    id: `direct-quotation-${occurrenceIndex + 1}`,
    kind: "ambiguous",
    paragraphIds: [paragraph.id],
    textSpan: span,
    rawText: span.text,
    normalizedText: normalizeQuotationText(span.text),
    wordCount: 0,
    delimiterEvidence: [createDelimiterEvidence(paragraph, token, "ambiguous")],
    citationOccurrenceIds: [],
    citationEvidence: [],
    scope: document.academicScopes.paragraphs[paragraphIndex]?.scope === "main-content"
      ? "body"
      : "unknown",
    confidence: "low",
    exclusionEvidence: dedupeExclusions([...paragraphExclusions, reason]),
  };
}

function collectDelimiterTokens(text: string): DelimiterToken[] {
  const tokens: DelimiterToken[] = [];

  for (let offset = 0; offset < text.length; offset += 1) {
    const character = text[offset];
    const kind = classifyDelimiter(character);

    if (kind !== null) {
      tokens.push({ character, kind, offset });
    }
  }

  return tokens;
}

function classifyDelimiter(character: string): DirectQuotationDelimiterKind | null {
  switch (character) {
    case "\"":
      return "straight-double";
    case "“":
      return "smart-left-double";
    case "”":
      return "smart-right-double";
    default:
      return null;
  }
}

function isOpeningDelimiter(token: Readonly<DelimiterToken>, open: OpenDelimiter | null): boolean {
  if (token.kind === "smart-left-double") {
    return true;
  }

  if (token.kind === "smart-right-double") {
    return false;
  }

  return open === null;
}

function createDelimiterEvidence(
  paragraph: Readonly<Paragraph>,
  token: Readonly<DelimiterToken>,
  role: DirectQuotationDelimiterEvidence["role"],
): DirectQuotationDelimiterEvidence {
  return {
    character: token.character,
    kind: token.kind,
    role,
    span: createParagraphTextSpan(
      paragraph,
      token.offset,
      token.offset + token.character.length,
    ) ?? fallbackEmptySpan(paragraph),
  };
}

function withCitationEvidence(
  occurrences: readonly CitationOccurrence[],
  quotations: readonly DirectQuotationOccurrence[],
): DirectQuotationOccurrence[] {
  const byParagraphId = new Map<string, CitationOccurrence[]>();

  for (const occurrence of occurrences) {
    const paragraphOccurrences = byParagraphId.get(occurrence.paragraphId) ?? [];
    paragraphOccurrences.push(occurrence);
    byParagraphId.set(occurrence.paragraphId, paragraphOccurrences);
  }

  const quotationsByParagraphId = new Map<string, DirectQuotationOccurrence[]>();
  for (const quotation of quotations) {
    const paragraphQuotations = quotationsByParagraphId.get(quotation.paragraphIds[0]) ?? [];
    paragraphQuotations.push(quotation);
    quotationsByParagraphId.set(quotation.paragraphIds[0], paragraphQuotations);
  }

  return quotations.map((quotation) => {
    const paragraphId = quotation.paragraphIds[0];
    const paragraphQuotations = quotationsByParagraphId.get(paragraphId) ?? [];
    const paragraphCitations = (byParagraphId.get(paragraphId) ?? [])
      .sort((first, second) => first.matchStart - second.matchStart);
    const citationEvidence = associateQuotationCitation(
      quotation,
      paragraphQuotations,
      paragraphCitations,
    );
    const citationOccurrenceIds = citationEvidence
      .flatMap((evidence) => evidence.citationOccurrenceId ? [evidence.citationOccurrenceId] : []);
    const associationExclusions = citationEvidence.flatMap((evidence) => {
      if (evidence.associationStatus === "associated") {
        return [];
      }

      return evidence.associationStatus === "ambiguous"
        ? ["citation-association-ambiguous" as const]
        : ["citation-association-missing" as const];
    });
    const exclusionEvidence = dedupeExclusions([
      ...quotation.exclusionEvidence,
      ...associationExclusions,
    ]);
    const confidence = exclusionEvidence.length === 0 ? "high" : "low";

    return {
      ...quotation,
      citationOccurrenceIds,
      citationEvidence,
      exclusionEvidence,
      confidence,
    };
  });
}

function associateQuotationCitation(
  quotation: Readonly<DirectQuotationOccurrence>,
  paragraphQuotations: readonly DirectQuotationOccurrence[],
  paragraphCitations: readonly CitationOccurrence[],
): DirectQuotationCitationEvidence[] {
  if (quotation.kind !== "inline") {
    return [unresolvedCitationEvidence("ambiguous-quotation")];
  }

  const followingCitations = paragraphCitations.filter(
    (citation) => citation.matchStart >= quotation.textSpan.endOffset,
  );
  const precedingCitations = paragraphCitations.filter(
    (citation) => citation.matchEnd <= quotation.textSpan.startOffset,
  );

  if (followingCitations.length === 0) {
    return [unresolvedCitationEvidence(
      precedingCitations.length > 0 ? "citation-before-quote" : "no-following-citation",
    )];
  }

  if (paragraphQuotations.length === 1) {
    if (followingCitations.length === 1) {
      return [associatedCitationEvidence(
        followingCitations[0],
        "same-paragraph-single-following-citation",
      )];
    }

    return [ambiguousCitationEvidence("multiple-candidate-citations")];
  }

  if (paragraphCitations.length === 1) {
    return [ambiguousCitationEvidence("multiple-quotes-one-citation")];
  }

  const orderedQuotations = [...paragraphQuotations]
    .filter((candidate) => candidate.kind === "inline")
    .sort((first, second) => first.textSpan.startOffset - second.textSpan.startOffset);
  const orderedCitations = [...paragraphCitations]
    .sort((first, second) => first.matchStart - second.matchStart);
  const quotationIndex = orderedQuotations.findIndex((candidate) => candidate.id === quotation.id);
  const candidateCitation = orderedCitations[quotationIndex];
  const nextQuotation = orderedQuotations[quotationIndex + 1] ?? null;

  if (
    quotationIndex < 0 ||
    !candidateCitation ||
    candidateCitation.matchStart < quotation.textSpan.endOffset ||
    (nextQuotation !== null && candidateCitation.matchStart > nextQuotation.textSpan.startOffset)
  ) {
    return [ambiguousCitationEvidence("multiple-quotes-citations-not-sequential")];
  }

  return [associatedCitationEvidence(
    candidateCitation,
    "same-paragraph-sequential-following-citation",
  )];
}

function associatedCitationEvidence(
  citation: Readonly<CitationOccurrence>,
  method: DirectQuotationCitationAssociationMethod,
): DirectQuotationCitationEvidence {
  return {
    citationOccurrenceId: citation.id,
    associationStatus: "associated",
    associationMethod: method,
    pageEvidence: parsePageEvidence(citation.matchedText),
    confidence: "high",
    ambiguityReason: null,
  };
}

function unresolvedCitationEvidence(
  reason: DirectQuotationCitationAmbiguityReason,
): DirectQuotationCitationEvidence {
  return {
    citationOccurrenceId: null,
    associationStatus: "unresolved",
    associationMethod: null,
    pageEvidence: createMissingPageEvidence(),
    confidence: "low",
    ambiguityReason: reason,
  };
}

function ambiguousCitationEvidence(
  reason: DirectQuotationCitationAmbiguityReason,
): DirectQuotationCitationEvidence {
  return {
    citationOccurrenceId: null,
    associationStatus: "ambiguous",
    associationMethod: null,
    pageEvidence: createMissingPageEvidence(),
    confidence: "low",
    ambiguityReason: reason,
  };
}

function parsePageEvidence(citationText: string): DirectQuotationPageEvidence {
  const match = PAGE_MARKER_PATTERN.exec(citationText);

  if (!match) {
    return createMissingPageEvidence();
  }

  return {
    hasPageMarker: true,
    marker: match[1].toLocaleLowerCase("tr-TR") === "ss." ? "ss." : "s.",
    rawText: match[0],
    pageStart: match[2],
    pageEnd: match[3] ?? null,
    confidence: "high",
  };
}

function createMissingPageEvidence(): DirectQuotationPageEvidence {
  return {
    hasPageMarker: false,
    marker: null,
    rawText: null,
    pageStart: null,
    pageEnd: null,
    confidence: "low",
  };
}

function getParagraphExclusions(
  document: Readonly<NormalizedDocument>,
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  excludedParagraphIds: ReadonlySet<string>,
): DirectQuotationExclusionEvidence[] {
  return dedupeExclusions([
    ...(document.academicScopes.paragraphs[paragraphIndex]?.scope === "main-content"
      ? []
      : ["non-main-content-scope" as const]),
    ...(paragraph.isEmpty ? ["empty-paragraph" as const] : []),
    ...(paragraph.contentScope === "textbox" ? ["textbox-excluded" as const] : []),
    ...(paragraph.isInTableCell ? ["table-cell-excluded" as const] : []),
    ...(paragraph.isTableOfContentsEntry ? ["toc-excluded" as const] : []),
    ...([...excludedParagraphIds].includes(paragraph.id)
      ? getKnownExclusionReasons(document, paragraph.id)
      : []),
  ]);
}

function collectExcludedParagraphIds(
  document: Readonly<NormalizedDocument>,
): Set<string> {
  return new Set([
    ...document.academicSections.occurrences.map((occurrence) => occurrence.headingParagraphId),
    ...collectBibliographyParagraphIds(document),
    ...document.captions.items.map((caption) => caption.paragraphId),
    ...document.objectSemantics.captions.map((caption) => caption.paragraphId),
    ...document.headings.map((heading) => heading.paragraphId),
    ...document.sections
      .filter((section) => section.isRuleDefinedHeading)
      .map((section) => section.paragraphId),
    ...collectListSectionParagraphIds(document),
  ]);
}

function getKnownExclusionReasons(
  document: Readonly<NormalizedDocument>,
  paragraphId: string,
): DirectQuotationExclusionEvidence[] {
  return dedupeExclusions([
    ...(document.academicSections.occurrences.some((occurrence) =>
      occurrence.headingParagraphId === paragraphId
    ) ? ["academic-section-boundary-excluded" as const] : []),
    ...(isBibliographyParagraph(document, paragraphId) ? ["bibliography-section-excluded" as const] : []),
    ...(document.captions.items.some((caption) => caption.paragraphId === paragraphId) ||
      document.objectSemantics.captions.some((caption) => caption.paragraphId === paragraphId)
      ? ["caption-excluded" as const]
      : []),
    ...(document.headings.some((heading) => heading.paragraphId === paragraphId) ||
      document.sections.some((section) => section.isRuleDefinedHeading && section.paragraphId === paragraphId)
      ? ["heading-excluded" as const]
      : []),
    ...(isListSectionParagraph(document, paragraphId) ? ["list-section-excluded" as const] : []),
  ]);
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

function collectListSectionParagraphIds(document: Readonly<NormalizedDocument>): string[] {
  const listSectionIdentities = new Set(
    LIST_SECTION_IDENTITIES.map((name) => normalizeSectionName(name)),
  );

  return document.academicSections.occurrences
    .filter((occurrence) =>
      occurrence.identity !== null && listSectionIdentities.has(occurrence.identity),
    )
    .flatMap((occurrence) => paragraphIdsInBoundary(document, occurrence));
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

function isBibliographyParagraph(
  document: Readonly<NormalizedDocument>,
  paragraphId: string,
): boolean {
  return collectBibliographyParagraphIds(document).includes(paragraphId);
}

function isListSectionParagraph(
  document: Readonly<NormalizedDocument>,
  paragraphId: string,
): boolean {
  return collectListSectionParagraphIds(document).includes(paragraphId);
}

function fallbackEmptySpan(paragraph: Readonly<Paragraph>) {
  return {
    paragraphId: paragraph.id,
    startOffset: 0,
    endOffset: 0,
    offsetUnit: "utf16-code-unit" as const,
    runSegments: [],
    text: "",
  };
}

function normalizeQuotationText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function dedupeExclusions(
  values: readonly DirectQuotationExclusionEvidence[],
): DirectQuotationExclusionEvidence[] {
  return [...new Set(values)];
}
