import { isPossibleAbbreviation } from "../parsers/documentAbbreviationsNormalizer";
import type { Paragraph } from "../types";

const ENTRY_PATTERN = /^\s*([\p{Lu}\p{N}]+(?:-[\p{Lu}\p{N}]+)*)(?:[ \t]{2,}|\t+|[ \t]+-[ \t]+|[ \t]*:[ \t]*)(\S.*)$/u;

export function parseAbbreviationListEntries(
  paragraphs: readonly Paragraph[],
): string[] {
  const entries = new Set<string>();

  for (const paragraph of paragraphs) {
    const candidate = ENTRY_PATTERN.exec(paragraph.text)?.[1];

    if (candidate && isPossibleAbbreviation(candidate)) {
      entries.add(candidate);
    }
  }

  return [...entries];
}
