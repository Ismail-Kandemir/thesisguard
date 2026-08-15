const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function countWords(texts: readonly string[]): number {
  const visibleText = texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join(" ")
    .replace(/\s+/g, " ");

  return visibleText.match(WORD_PATTERN)?.length ?? 0;
}
