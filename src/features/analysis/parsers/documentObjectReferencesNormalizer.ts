import type {
  CaptionKind,
  DocumentObjectReference,
  DocumentObjectReferences,
  NormalizedDocument,
} from "../types";
import { getSectionContentParagraphs } from "../rules/sectionContent";

const REFERENCE_PATTERN = /(?<![\p{L}\p{N}_])(tablo|şekil)\s+((?:\d+\.)*\d+)(?=$|[\s.,;:!?"'’()[\]{}-])/gu;

export function normalizeDocumentObjectReferences(
  document: Readonly<NormalizedDocument>,
): DocumentObjectReferences {
  const excludedParagraphIds = getExcludedParagraphIds(document);
  const blockIndexByParagraphId = new Map(
    document.blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );
  const items: DocumentObjectReference[] = [];

  for (const [paragraphIndex, paragraph] of document.paragraphs.entries()) {
    const blockIndex = blockIndexByParagraphId.get(paragraph.id);

    if (
      blockIndex === undefined ||
      paragraph.isEmpty ||
      paragraph.isTableOfContentsEntry ||
      excludedParagraphIds.has(paragraph.id)
    ) {
      continue;
    }

    const normalizedText = paragraph.text.toLocaleLowerCase("tr-TR");

    for (const match of normalizedText.matchAll(REFERENCE_PATTERN)) {
      const start = match.index;
      const matchedText = paragraph.text.slice(start, start + match[0].length);
      const kind: CaptionKind = match[1] === "tablo" ? "table" : "figure";

      items.push({
        kind,
        number: match[2],
        paragraphId: paragraph.id,
        paragraphIndex,
        blockIndex,
        matchedText,
      });
    }
  }

  return { items };
}

function getExcludedParagraphIds(
  document: Readonly<NormalizedDocument>,
): Set<string> {
  const excluded = new Set(document.captions.items.map((caption) => caption.paragraphId));

  for (const section of document.sections) {
    if (section.isRuleDefinedHeading) {
      excluded.add(section.paragraphId);
    }

    if (section.isObjectReferenceExcluded) {
      for (const paragraph of getSectionContentParagraphs(document, section)) {
        excluded.add(paragraph.id);
      }
    }
  }

  return excluded;
}
