import type { References } from "../types";

const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseReferences(xmlDocument: Document): References {
  return {
    hasSection: Array.from(
      xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "p"),
    ).some((paragraph) => {
      const paragraphText = Array.from(
        paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "t"),
      )
        .map((textElement) => textElement.textContent ?? "")
        .join("");

      return normalizeSectionTitle(paragraphText) === "kaynaklar";
    }),
  };
}

function normalizeSectionTitle(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
