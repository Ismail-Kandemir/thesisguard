import type {
  AcademicSectionOccurrence,
  DocumentSection,
  NormalizedDocument,
  Paragraph,
} from "../types";

export function getAcademicSectionContentParagraphs(
  document: Readonly<NormalizedDocument>,
  occurrence: Readonly<AcademicSectionOccurrence>,
): readonly Paragraph[] {
  return document.paragraphs.slice(
    occurrence.boundary.startParagraphIndex,
    occurrence.boundary.endParagraphIndex + 1,
  ).filter(isAcademicSectionBodyParagraph);
}

export function getSectionContentParagraphs(
  document: Readonly<NormalizedDocument>,
  heading: Readonly<DocumentSection>,
): readonly Paragraph[] {
  const academicOccurrence = document.academicSections?.occurrences.find(
    (occurrence) => occurrence.headingParagraphId === heading.paragraphId,
  );

  if (academicOccurrence) {
    return getAcademicSectionContentParagraphs(document, academicOccurrence);
  }

  const nextHeadingIndex = document.sections
    .filter(
      (section) =>
        section.isRuleDefinedHeading &&
        section.paragraphIndex > heading.paragraphIndex,
    )
    .reduce<number | null>(
      (nearestIndex, section) =>
        nearestIndex === null || section.paragraphIndex < nearestIndex
          ? section.paragraphIndex
          : nearestIndex,
      null,
    );

  const contentStartIndex = heading.paragraphIndex + 1;
  const contentEndIndex = nextHeadingIndex ?? document.paragraphs.length;

  return document.paragraphs
    .slice(contentStartIndex, contentEndIndex)
    .filter(isAcademicSectionBodyParagraph);
}

function isAcademicSectionBodyParagraph(paragraph: Readonly<Paragraph>): boolean {
  return (
    paragraph.contentScope === "document" &&
    !paragraph.isTableOfContentsEntry &&
    !paragraph.isInTableCell
  );
}
