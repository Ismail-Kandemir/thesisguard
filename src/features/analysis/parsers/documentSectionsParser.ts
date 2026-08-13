import type { DocumentSection } from "../types";

const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseDocumentSections(
  xmlDocument: Document,
): DocumentSection[] {
  const sections = new Map<string, DocumentSection>();

  for (const paragraph of Array.from(
    xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "p"),
  )) {
    const displayName = Array.from(
      paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "t"),
    )
      .map((textElement) => textElement.textContent ?? "")
      .join("")
      .trim();
    const normalizedName = normalizeSectionName(displayName);

    if (normalizedName.length > 0 && !sections.has(normalizedName)) {
      sections.set(normalizedName, { normalizedName, displayName });
    }
  }

  return Array.from(sections.values());
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
