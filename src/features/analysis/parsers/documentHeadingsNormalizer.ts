import type {
  DocumentHeadingOccurrence,
  HeadingNumberingRuleExpected,
  NormalizedDocument,
  RuleDefinition,
} from "../types";
import { normalizeSectionName } from "./documentSectionsParser";
import { parseManualNumberPrefix, sectionMatchesAnyExpectedName } from "./sectionNameMatcher";
import { StyleInheritanceResolver } from "./styleInheritanceResolver";

export function normalizeDocumentHeadings(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  const expectations = rules.filter(isHeadingNumberingRule).flatMap((rule) => rule.expected.sections);
  const captionIds = new Set(document.captions.items.map((caption) => caption.paragraphId));
  const blocksByParagraphId = new Map(
    document.blocks.flatMap((block) => block.type === "paragraph" ? [[block.paragraphId, block.blockIndex] as const] : []),
  );
  const stylesById = new Map(document.styles.map((style) => [style.id, style]));
  const styleResolver = new StyleInheritanceResolver(document.styles);
  const anchorByParagraphId = new Map<string, { sectionName: string; level: number }>();

  for (const section of document.sections) {
    const expectation = expectations.find((candidate) =>
      sectionMatchesAnyExpectedName(section, [candidate.section, ...(candidate.aliases ?? [])]),
    );
    if (expectation) anchorByParagraphId.set(section.paragraphId, {
      sectionName: expectation.section,
      level: expectation.level,
    });
  }

  const anchorIndexes = document.paragraphs.flatMap((paragraph, index) =>
    anchorByParagraphId.has(paragraph.id) ? [index] : [],
  );
  const firstAnchor = anchorIndexes.length > 0 ? Math.min(...anchorIndexes) : null;
  const lastAnchor = anchorIndexes.length > 0 ? Math.max(...anchorIndexes) : null;
  const nextRuleDefinedSection = lastAnchor === null
    ? null
    : document.sections.find((section) =>
        section.isRuleDefinedHeading && section.paragraphIndex > lastAnchor,
      );
  const academicBodyEnd = nextRuleDefinedSection?.paragraphIndex ?? document.paragraphs.length;

  const headings = document.paragraphs.flatMap((paragraph, paragraphIndex) => {
    if (
      paragraph.isEmpty || paragraph.isTableOfContentsEntry || paragraph.isInTableCell ||
      captionIds.has(paragraph.id)
    ) return [];

    const anchor = anchorByParagraphId.get(paragraph.id);
    const withinAcademicBody = firstAnchor !== null && lastAnchor !== null &&
      paragraphIndex >= firstAnchor && paragraphIndex < academicBodyEnd;
    const styleLevel = getHeadingStyleLevel(paragraph.styleId, styleResolver);
    const reliableNumbering = paragraph.numbering.source !== "none" && paragraph.numbering.level !== null;

    if (!anchor && !(withinAcademicBody && styleLevel !== null && reliableNumbering)) return [];

    const manualPrefix = paragraph.numbering.source === "text"
      ? parseManualNumberPrefix(paragraph.text)
      : null;
    const text = manualPrefix?.remainder ?? paragraph.text.trim();
    const style = paragraph.styleId ? stylesById.get(paragraph.styleId) : undefined;
    const occurrence: DocumentHeadingOccurrence = {
      id: `heading-${paragraph.id}`,
      paragraphId: paragraph.id,
      paragraphIndex,
      blockIndex: blocksByParagraphId.get(paragraph.id) ?? null,
      text,
      normalizedText: normalizeSectionName(text),
      level: anchor?.level ?? paragraph.numbering.level ?? styleLevel ?? 0,
      numberingLevel: paragraph.numbering.level,
      numberingSource: paragraph.numbering.source,
      numId: paragraph.numbering.numId,
      visibleLabel: paragraph.numbering.visibleLabel,
      styleId: paragraph.styleId,
      styleName: style?.name ?? null,
      sectionName: anchor?.sectionName ?? null,
      isRuleDefinedSection: anchor !== undefined,
      isAcademicHeading: true,
    };
    return [occurrence];
  });

  return { ...document, headings };
}

function isHeadingNumberingRule(
  rule: RuleDefinition,
): rule is RuleDefinition & { type: "HEADING_NUMBERING"; expected: HeadingNumberingRuleExpected } {
  return rule.enabled && rule.type === "HEADING_NUMBERING" && typeof rule.expected === "object" &&
    rule.expected !== null && "sections" in rule.expected && Array.isArray(rule.expected.sections);
}

function getHeadingStyleLevel(
  styleId: string | null,
  resolver: StyleInheritanceResolver,
): number | null {
  if (!styleId) return null;
  for (const entry of resolver.resolve(styleId)) {
    if (entry.type !== "style") continue;
    for (const value of [entry.style.id, entry.style.name]) {
      if (!value) continue;
      const match = /heading\s*([1-9]\d*)/i.exec(value);
      if (match) return Number(match[1]) - 1;
    }
  }
  return null;
}
