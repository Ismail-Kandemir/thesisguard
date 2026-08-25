import type {
  DocumentAbbreviation,
  DocumentAbbreviations,
  NormalizedDocument,
} from "../types";
import { getBodyParagraphs } from "../rules/validators/bodyParagraphs";

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;
const ABBREVIATION_PATTERN = /^[\p{Lu}\p{N}]+(?:-[\p{Lu}\p{N}]+)*$/u;

export function normalizeDocumentAbbreviations(
  document: Readonly<NormalizedDocument>,
): DocumentAbbreviations {
  const items = detectAbbreviations(
    getBodyParagraphs(document, {
      excludeCaptions: true,
      excludeTableCells: true,
      excludeLists: true,
      excludeTableOfContents: true,
      excludeFigureCarriers: true,
    }).map((paragraph) => paragraph.text),
  );

  return {
    items,
    count: items.length,
    hasAbbreviations: items.length > 0,
  };
}

export function detectAbbreviations(
  texts: readonly string[],
): DocumentAbbreviation[] {
  const occurrencesByValue = new Map<string, number>();

  for (const text of texts) {
    for (const token of text.match(TOKEN_PATTERN) ?? []) {
      if (isPossibleAbbreviation(token)) {
        occurrencesByValue.set(token, (occurrencesByValue.get(token) ?? 0) + 1);
      }
    }
  }

  return Array.from(occurrencesByValue, ([value, occurrences]) => ({
    value,
    occurrences,
  }));
}

export function isPossibleAbbreviation(token: string): boolean {
  const characters = Array.from(token);
  const uppercaseLetterCount = characters.filter((character) =>
    /\p{Lu}/u.test(character),
  ).length;

  return (
    characters.length >= 2 &&
    uppercaseLetterCount >= 2 &&
    ABBREVIATION_PATTERN.test(token)
  );
}
