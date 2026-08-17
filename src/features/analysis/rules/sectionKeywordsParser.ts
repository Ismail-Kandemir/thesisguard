import type { Paragraph } from "../types";

export interface ParsedSectionKeywordLine {
  paragraphIndex: number;
  label: string;
  entries: string[];
}

export function parseSectionKeywordLines(
  paragraphs: readonly Paragraph[],
  labels: readonly string[],
  separators: readonly string[],
): ParsedSectionKeywordLine[] {
  const normalizedLabels = new Map(
    labels.map((label) => [normalizeKeywordLabel(label), label]),
  );
  const separatorPattern = createSeparatorPattern(separators);

  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const text = paragraph.text.trimStart();
    const colonIndex = text.indexOf(":");

    if (colonIndex < 0) {
      return [];
    }

    const candidate = text.slice(0, colonIndex).trim();
    const label = normalizedLabels.get(normalizeKeywordLabel(candidate));

    if (!label) {
      return [];
    }

    const value = text.slice(colonIndex + 1);
    const entries = value
      .split(separatorPattern)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return [{ paragraphIndex, label, entries }];
  });
}

function normalizeKeywordLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function createSeparatorPattern(separators: readonly string[]): RegExp {
  const alternatives = [...separators]
    .sort((first, second) => second.length - first.length)
    .map(escapeRegExp)
    .join("|");

  return new RegExp(alternatives, "u");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
