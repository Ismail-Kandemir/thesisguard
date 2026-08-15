import type {
  DocumentSection,
  NormalizedDocument,
  Paragraph,
} from "../types";

export function getSectionContentParagraphs(
  document: Readonly<NormalizedDocument>,
  heading: Readonly<DocumentSection>,
): readonly Paragraph[] {
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

  return document.paragraphs.slice(contentStartIndex, contentEndIndex);
}
