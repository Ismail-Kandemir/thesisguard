import type {
  AcademicSectionOccurrence,
  BibliographyEntryBoundaryStatus,
  BibliographyEntryOccurrence,
  DocumentBibliography,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
} from "../types";
import { findDeclaredAcademicSectionOccurrencesByNames } from "../rules/academicSectionLookup";
import { normalizeSectionName } from "./documentSectionsParser";
import { EffectiveFormattingResolver } from "./effectiveFormattingResolver";

const BIBLIOGRAPHY_SECTION_NAMES = ["Kaynaklar"];

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
  return identity === normalizeSectionName("Kaynaklar");
}
