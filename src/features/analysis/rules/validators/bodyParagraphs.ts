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

interface BodyParagraphOptions {
  excludeCaptions?: boolean;
}

export function getBodyParagraphs(
  document: Readonly<NormalizedDocument>,
  options: BodyParagraphOptions = {},
): readonly Paragraph[] {
  const stylesById = new Map(
    document.styles.map((style) => [style.id, style]),
  );
  const sectionHeadingParagraphIds = new Set(
    document.sections
      .filter((section) => section.isRuleDefinedHeading)
      .map((section) => section.paragraphId),
  );
  const captionParagraphIds = options.excludeCaptions
    ? new Set(document.captions.items.map((caption) => caption.paragraphId))
    : new Set<string>();

  return document.paragraphs.filter(
    (paragraph) =>
      !paragraph.isEmpty &&
      !isHeadingParagraph(paragraph.styleId, stylesById) &&
      !sectionHeadingParagraphIds.has(paragraph.id) &&
      !captionParagraphIds.has(paragraph.id),
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
