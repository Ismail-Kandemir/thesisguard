import type {
  CaptionKind,
  CaptionPosition,
  DocumentBlock,
  DocumentCaption,
  DocumentCaptions,
  DocumentFigureOccurrence,
  DocumentFigures,
  DocumentTableOccurrence,
  DocumentTables,
  FigureDrawingType,
  ObjectAlignment,
  ObjectAlignmentSource,
  Paragraph,
  ParagraphAlignment,
} from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WORDPROCESSING_DRAWING_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const CAPTION_PATTERN = /^\s*(tablo|şekil)\s+((?:\d+\.)*\d+)\.\s*(.*)$/u;

export interface DocumentVisualStructure {
  blocks: DocumentBlock[];
  captions: DocumentCaptions;
  tables: DocumentTables;
  figures: DocumentFigures;
}

export function normalizeDocumentCaptions(
  xmlDocument: Document,
  paragraphs: readonly Paragraph[],
): DocumentVisualStructure {
  const body = xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "body").item(0);

  if (!body) {
    return createEmptyStructure();
  }

  const paragraphElements = Array.from(
    body.getElementsByTagNameNS(WORD_NAMESPACE, "p"),
  );
  const paragraphIndexByElement = new Map(
    paragraphElements.map((element, index) => [element, index]),
  );
  const directChildren = Array.from(body.children).filter(
    (element) =>
      element.namespaceURI === WORD_NAMESPACE &&
      (element.localName === "p" || element.localName === "tbl"),
  );
  const tableIdByElement = new Map(
    Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, "tbl")).map(
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
  const figureItems = parseFigures(
    body,
    paragraphIndexByElement,
    paragraphs,
    blocks,
  );
  const associated = associateCaptionOccurrences(
    tableItems,
    figureItems,
    captions,
    paragraphs,
    blocks,
  );
  const associatedCaptionIds = new Set(
    [...associated.tables, ...associated.figures]
      .map((item) => item.captionId)
      .filter((captionId): captionId is string => captionId !== null),
  );

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
    figures: {
      count: associated.figures.length,
      hasFigures: associated.figures.length > 0,
      items: associated.figures,
    },
  };
}

function createEmptyStructure(): DocumentVisualStructure {
  return {
    blocks: [],
    captions: { items: [], orphanCaptionIds: [] },
    tables: { count: 0, hasTables: false, items: [] },
    figures: { count: 0, hasFigures: false, items: [] },
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

export function parseCaptionText(
  text: string,
): Pick<DocumentCaption, "kind" | "label" | "number"> | null {
  const match = CAPTION_PATTERN.exec(text.toLocaleLowerCase("tr-TR"));

  if (!match) {
    return null;
  }

  const kind: CaptionKind = match[1].toLocaleLowerCase("tr-TR") === "tablo"
    ? "table"
    : "figure";

  return {
    kind,
    label: kind === "table" ? "Tablo" : "Şekil",
    number: match[2],
  };
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

  return Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, "tbl")).map(
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

function parseFigures(
  body: Element,
  paragraphIndexByElement: ReadonlyMap<Element, number>,
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): DocumentFigureOccurrence[] {
  const blockIndexByParagraphId = new Map(
    blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );
  const drawingCountByParagraph = new Map<Element, number>();

  for (const drawing of Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, "drawing"))) {
    const paragraphElement = findAncestor(drawing, "p");

    if (paragraphElement) {
      drawingCountByParagraph.set(
        paragraphElement,
        (drawingCountByParagraph.get(paragraphElement) ?? 0) + 1,
      );
    }
  }

  return Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, "drawing")).map(
    (drawing, index) => {
      const paragraphElement = findAncestor(drawing, "p");
      const paragraphIndex = paragraphElement
        ? paragraphIndexByElement.get(paragraphElement) ?? -1
        : -1;
      const paragraph = paragraphs[paragraphIndex];

      return {
        id: `figure-${index + 1}`,
        paragraphId: paragraph?.id ?? `unresolved-figure-paragraph-${index + 1}`,
        paragraphIndex,
        blockIndex: paragraph ? blockIndexByParagraphId.get(paragraph.id) ?? null : null,
        drawingType: getDrawingType(drawing),
        ...parseFigureAlignment(
          drawing,
          paragraph,
          paragraphElement ? drawingCountByParagraph.get(paragraphElement) ?? 0 : 0,
        ),
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

function parseFigureAlignment(
  drawing: Element,
  paragraph: Paragraph | undefined,
  drawingCountInParagraph: number,
): { alignment: ObjectAlignment; alignmentSource: ObjectAlignmentSource } {
  if (!paragraph || getDrawingType(drawing) !== "inline" || drawingCountInParagraph !== 1 || !paragraph.isEmpty) {
    return { alignment: "unknown", alignmentSource: "unknown" };
  }

  const alignment = toObjectAlignment(paragraph.alignment);

  return {
    alignment,
    alignmentSource: alignment === "unknown" ? "unknown" : "paragraph",
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
  figures: readonly DocumentFigureOccurrence[],
  captions: readonly DocumentCaption[],
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): { tables: DocumentTableOccurrence[]; figures: DocumentFigureOccurrence[] } {
  const captionByBlock = new Map(captions.map((caption) => [caption.blockIndex, caption]));
  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const proposals = [
    ...tables.map((item) => createProposal("table", item, captionByBlock, paragraphById, blocks)),
    ...figures.map((item) => createProposal("figure", item, captionByBlock, paragraphById, blocks)),
  ];
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
    tables: resolved.slice(0, tables.length) as DocumentTableOccurrence[],
    figures: resolved.slice(tables.length) as DocumentFigureOccurrence[],
  };
}

function createProposal<TItem extends DocumentTableOccurrence | DocumentFigureOccurrence>(
  kind: CaptionKind,
  item: TItem,
  captionByBlock: ReadonlyMap<number, DocumentCaption>,
  paragraphById: ReadonlyMap<string, Paragraph>,
  blocks: readonly DocumentBlock[],
): TItem {
  if (item.blockIndex === null || ("drawingType" in item && item.drawingType === "anchor")) {
    return {
      ...item,
      captionPosition: "drawingType" in item && item.drawingType === "anchor"
        ? "ambiguous"
        : "none",
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

function getDrawingType(drawing: Element): FigureDrawingType {
  if (drawing.getElementsByTagNameNS(WORDPROCESSING_DRAWING_NAMESPACE, "anchor").length > 0) {
    return "anchor";
  }

  if (drawing.getElementsByTagNameNS(WORDPROCESSING_DRAWING_NAMESPACE, "inline").length > 0) {
    return "inline";
  }

  return "unknown";
}

function findAncestor(element: Element, localName: string): Element | null {
  let current = element.parentElement;

  while (current) {
    if (current.namespaceURI === WORD_NAMESPACE && current.localName === localName) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getFirstDirectChild(element: Element, localName: string): Element | null {
  return Array.from(element.children).find(
    (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === localName,
  ) ?? null;
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
