import type {
  CaptionKind,
  CaptionPosition,
  DocumentBlock,
  DocumentCaption,
  DocumentCaptions,
  DocumentObjectSemantics,
  DocumentTableOccurrence,
  DocumentTables,
  ObjectAlignment,
  ObjectAlignmentSource,
  Paragraph,
  ParagraphAlignment,
} from "../types";
import { normalizeObjectSemantics } from "./objectSemanticsNormalizer";
import { parseCaptionText } from "./captionTextParser";
import {
  getSemanticChildElements,
  getSemanticDescendantsByTagNameNS,
} from "./markupCompatibilityResolver";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export interface DocumentVisualStructure {
  blocks: DocumentBlock[];
  captions: DocumentCaptions;
  tables: DocumentTables;
  objectSemantics: DocumentObjectSemantics;
}

export function normalizeDocumentCaptions(
  xmlDocument: Document,
  paragraphs: readonly Paragraph[],
): DocumentVisualStructure {
  const body = xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "body").item(0);

  if (!body) {
    return createEmptyStructure();
  }

  const paragraphElements = getSemanticDescendantsByTagNameNS(body, WORD_NAMESPACE, "p");
  const paragraphIndexByElement = new Map(
    paragraphElements.map((element, index) => [element, index]),
  );
  const directChildren = getSemanticChildElements(body).filter(
    (element) =>
      element.namespaceURI === WORD_NAMESPACE &&
      (element.localName === "p" || element.localName === "tbl"),
  );
  const tableIdByElement = new Map(
    getSemanticDescendantsByTagNameNS(body, WORD_NAMESPACE, "tbl").map(
      (element, index) => [element, `table-${index + 1}`],
    ),
  );
  const directTableIdByElement = new Map<Element, string>();
  const blocks: DocumentBlock[] = [];

  for (const [blockIndex, element] of directChildren.entries()) {
    if (element.localName === "p") {
      const paragraphIndex = paragraphIndexByElement.get(element);

      if (paragraphIndex !== undefined) {
        blocks.push({
          id: `block-${blockIndex + 1}`,
          blockIndex,
          type: "paragraph",
          paragraphId: paragraphs[paragraphIndex].id,
        });
      }
    } else {
      const tableId = tableIdByElement.get(element) ?? `table-unresolved-${blockIndex + 1}`;
      directTableIdByElement.set(element, tableId);
      blocks.push({ id: `block-${blockIndex + 1}`, blockIndex, type: "table", tableId });
    }
  }

  const captions = parseCaptions(paragraphs, blocks);
  const tableItems = parseTables(body, tableIdByElement, directTableIdByElement, blocks);
  const associated = associateCaptionOccurrences(
    tableItems,
    captions,
    paragraphs,
    blocks,
  );
  const associatedCaptionIds = new Set(
    associated.tables
      .map((item) => item.captionId)
      .filter((captionId): captionId is string => captionId !== null),
  );
  const objectSemantics = normalizeObjectSemantics(xmlDocument, paragraphs, blocks);

  return {
    blocks,
    captions: {
      items: captions,
      orphanCaptionIds: captions
        .filter((caption) => !associatedCaptionIds.has(caption.id))
        .map((caption) => caption.id),
    },
    tables: {
      count: associated.tables.length,
      hasTables: associated.tables.length > 0,
      items: associated.tables,
    },
    objectSemantics,
  };
}

function createEmptyStructure(): DocumentVisualStructure {
  return {
    blocks: [],
    captions: { items: [], orphanCaptionIds: [] },
    tables: { count: 0, hasTables: false, items: [] },
    objectSemantics: { representations: [], captions: [], associations: [], resolutions: [] },
  };
}

function parseCaptions(
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): DocumentCaption[] {
  const blockIndexByParagraphId = new Map(
    blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );

  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const blockIndex = blockIndexByParagraphId.get(paragraph.id);

    if (blockIndex === undefined || paragraph.isEmpty || paragraph.isTableOfContentsEntry) {
      return [];
    }

    const parsed = parseCaptionText(paragraph.text);

    if (!parsed) {
      return [];
    }

    return [{
      id: `caption-${paragraphIndex + 1}`,
      paragraphId: paragraph.id,
      paragraphIndex,
      blockIndex,
      text: paragraph.text,
      kind: parsed.kind,
      label: parsed.label,
      number: parsed.number,
    }];
  });
}

function parseTables(
  body: Element,
  tableIdByElement: ReadonlyMap<Element, string>,
  directTableIdByElement: ReadonlyMap<Element, string>,
  blocks: readonly DocumentBlock[],
): DocumentTableOccurrence[] {
  const blockIndexByTableId = new Map(
    blocks
      .filter((block) => block.type === "table")
      .map((block) => [block.tableId, block.blockIndex]),
  );

  return getSemanticDescendantsByTagNameNS(body, WORD_NAMESPACE, "tbl").map(
    (element, index) => {
      const directId = directTableIdByElement.get(element);
      const id = tableIdByElement.get(element) ?? `table-${index + 1}`;

      return {
        id,
        blockIndex: directId ? blockIndexByTableId.get(directId) ?? null : null,
        isNested: directId === undefined,
        tableStyleId: parseTableStyleId(element),
        ...parseTableAlignment(element),
        captionId: null,
        captionPosition: "none",
      };
    },
  );
}

function parseTableStyleId(tableElement: Element): string | null {
  const tableProperties = getFirstDirectChild(tableElement, "tblPr");
  const tableStyle = tableProperties ? getFirstDirectChild(tableProperties, "tblStyle") : null;

  return tableStyle ? getWordAttribute(tableStyle, "val") : null;
}

function parseTableAlignment(
  tableElement: Element,
): { alignment: ObjectAlignment; alignmentSource: ObjectAlignmentSource } {
  const tableProperties = getFirstDirectChild(tableElement, "tblPr");
  const alignmentElement = tableProperties ? getFirstDirectChild(tableProperties, "jc") : null;
  const alignment = alignmentElement
    ? toObjectAlignment(getWordAttribute(alignmentElement, "val"))
    : "unknown";

  return {
    alignment,
    alignmentSource: alignment === "unknown" ? "unknown" : "direct",
  };
}

function toObjectAlignment(value: ParagraphAlignment | string | null): ObjectAlignment {
  switch (value) {
    case "left":
    case "start":
      return "left";
    case "right":
    case "end":
      return "right";
    case "center":
      return "center";
    default:
      return "unknown";
  }
}

export function associateCaptionOccurrences(
  tables: readonly DocumentTableOccurrence[],
  captions: readonly DocumentCaption[],
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): { tables: DocumentTableOccurrence[] } {
  const captionByBlock = new Map(captions.map((caption) => [caption.blockIndex, caption]));
  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const proposals = tables.map((item) => createProposal("table", item, captionByBlock, paragraphById, blocks));
  const proposalCountByCaptionId = new Map<string, number>();

  for (const proposal of proposals) {
    if (proposal.captionId) {
      proposalCountByCaptionId.set(
        proposal.captionId,
        (proposalCountByCaptionId.get(proposal.captionId) ?? 0) + 1,
      );
    }
  }

  const resolved = proposals.map((proposal) =>
    proposal.captionId && (proposalCountByCaptionId.get(proposal.captionId) ?? 0) > 1
      ? { ...proposal, captionId: null, captionPosition: "ambiguous" as const }
      : proposal,
  );

  return {
    tables: resolved,
  };
}

function createProposal(
  kind: CaptionKind,
  item: DocumentTableOccurrence,
  captionByBlock: ReadonlyMap<number, DocumentCaption>,
  paragraphById: ReadonlyMap<string, Paragraph>,
  blocks: readonly DocumentBlock[],
): DocumentTableOccurrence {
  if (item.blockIndex === null) {
    return {
      ...item,
      captionPosition: "none",
    };
  }

  const before = collectCandidates(
    kind,
    item.blockIndex,
    -1,
    captionByBlock,
    paragraphById,
    blocks,
  );
  const after = collectCandidates(
    kind,
    item.blockIndex,
    1,
    captionByBlock,
    paragraphById,
    blocks,
  );
  const candidates = [...before, ...after];

  if (candidates.length !== 1) {
    return {
      ...item,
      captionId: null,
      captionPosition: candidates.length > 1 ? "ambiguous" : "none",
    };
  }

  return {
    ...item,
    captionId: candidates[0].caption.id,
    captionPosition: candidates[0].position,
  };
}

function collectCandidates(
  kind: CaptionKind,
  originBlockIndex: number,
  direction: -1 | 1,
  captionByBlock: ReadonlyMap<number, DocumentCaption>,
  paragraphById: ReadonlyMap<string, Paragraph>,
  blocks: readonly DocumentBlock[],
): Array<{ caption: DocumentCaption; position: Exclude<CaptionPosition, "none" | "ambiguous"> }> {
  const candidates: Array<{
    caption: DocumentCaption;
    position: "before" | "after";
  }> = [];

  for (let index = originBlockIndex + direction; index >= 0 && index < blocks.length; index += direction) {
    const block = blocks[index];

    if (block.type !== "paragraph") {
      break;
    }

    const paragraph = paragraphById.get(block.paragraphId);

    if (!paragraph || paragraph.isEmpty) {
      continue;
    }

    const caption = captionByBlock.get(block.blockIndex);

    if (!caption || caption.kind !== kind) {
      break;
    }

    candidates.push({ caption, position: direction === -1 ? "before" : "after" });
  }

  return candidates;
}

function getFirstDirectChild(element: Element, localName: string): Element | null {
  return Array.from(element.children).find(
    (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === localName,
  ) ?? null;
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
