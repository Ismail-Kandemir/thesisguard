import type {
  NormalizedDocument,
  Paragraph,
  StyleDefinition,
} from "../../types";

const BODY_EXCLUDED_HEADING_NAMES = new Set([
  "heading1",
  "heading2",
  "heading3",
]);

export function getBodyParagraphs(
  document: NormalizedDocument,
): readonly Paragraph[] {
  const stylesById = new Map(
    document.styles.map((style) => [style.id, style]),
  );

  return document.paragraphs.filter(
    (paragraph) =>
      !paragraph.isEmpty &&
      !isHeadingParagraph(paragraph.styleId, stylesById),
  );
}

function isHeadingParagraph(
  styleId: string | null,
  stylesById: ReadonlyMap<string, StyleDefinition>,
): boolean {
  if (!styleId) {
    return false;
  }

  const style = stylesById.get(styleId);

  return (
    isSupportedHeadingName(styleId) ||
    (style?.name !== null &&
      style?.name !== undefined &&
      isSupportedHeadingName(style.name))
  );
}

function isSupportedHeadingName(value: string): boolean {
  return BODY_EXCLUDED_HEADING_NAMES.has(normalizeStyleName(value));
}

function normalizeStyleName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
