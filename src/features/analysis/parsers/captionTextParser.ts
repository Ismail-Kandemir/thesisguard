import type { CaptionKind, DocumentCaption } from "../types";

const CAPTION_PATTERN = /^\s*(tablo|şekil)\s+((?:\d+\.)*\d+)\.\s*(.*)$/u;

export function parseCaptionText(
  text: string,
): Pick<DocumentCaption, "kind" | "label" | "number"> | null {
  const match = CAPTION_PATTERN.exec(text.toLocaleLowerCase("tr-TR"));

  if (!match) return null;

  const kind: CaptionKind = match[1].toLocaleLowerCase("tr-TR") === "tablo"
    ? "table"
    : "figure";

  return {
    kind,
    label: kind === "table" ? "Tablo" : "Şekil",
    number: match[2],
  };
}
