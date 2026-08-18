import type { DocumentSection, Paragraph } from "../types";

export function parseDocumentSections(paragraphs: readonly Paragraph[]): DocumentSection[] {
  const sections: DocumentSection[] = [];

  for (const [index, paragraph] of paragraphs.entries()) {
    if (paragraph.isTableOfContentsEntry) {
      continue;
    }

    const displayName = paragraph.text.trim();
    const normalizedName = normalizeSectionName(displayName);

    if (normalizedName.length > 0) {
      sections.push({
        normalizedName,
        displayName,
        paragraphId: `paragraph-${index + 1}`,
        paragraphIndex: index,
        isRuleDefinedHeading: false,
        isObjectReferenceExcluded: false,
      });
    }
  }

  return sections;
}

export function normalizeSectionName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
