import type {
  AcademicObjectResolution,
  CaptionOccurrence,
  CaptionSemantic,
  DocumentBlock,
  DocumentObjectSemantics,
  FigureDrawingType,
  ObjectCaptionAssociation,
  ObjectRepresentationKind,
  ObjectRepresentationOccurrence,
  ObjectRepresentationScope,
  Paragraph,
} from "../types";
import {
  getSemanticChildElements,
  getSemanticDescendantsByTagNameNS,
} from "./markupCompatibilityResolver";
import { parseCaptionText } from "./captionTextParser";
import { isInsideInvisibleCurrentDocumentRevision } from "./revisionVisibility";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WORDPROCESSING_DRAWING_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const WORDPROCESSING_SHAPE_NAMESPACE =
  "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";
const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PICTURE_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const CHART_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const DIAGRAM_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/diagram";
const WORDPROCESSING_GROUP_NAMESPACE =
  "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup";
const VML_NAMESPACE = "urn:schemas-microsoft-com:vml";
const OFFICE_NAMESPACE = "urn:schemas-microsoft-com:office:office";
const MATH_NAMESPACE = "http://schemas.openxmlformats.org/officeDocument/2006/math";

interface LocationIndexes {
  paragraphIndexByElement: ReadonlyMap<Element, number>;
  blockIndexByParagraphId: ReadonlyMap<string, number>;
  blockIndexByTableElement: ReadonlyMap<Element, number>;
}

interface CaptionCandidate {
  caption: CaptionOccurrence;
  position: "before" | "after";
  distanceInBlocks: number;
}

export function normalizeObjectSemantics(
  xmlDocument: Document,
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): DocumentObjectSemantics {
  const body = xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "body").item(0);

  if (!body) {
    return { representations: [], captions: [], associations: [], resolutions: [] };
  }

  const indexes = createLocationIndexes(body, paragraphs, blocks);
  const representations = parseRepresentations(body, paragraphs, indexes);
  const captionFacts = parseCaptionOccurrences(body, paragraphs, blocks, indexes);
  const associations = associateObjectCaptions(representations, captionFacts, paragraphs, blocks);
  const associatedCaptionIds = new Set(
    associations.flatMap((association) => association.captionId ? [association.captionId] : []),
  );
  const captions = captionFacts.map((caption) => ({
    ...caption,
    isOrphan: !associatedCaptionIds.has(caption.id),
  }));

  return {
    representations,
    captions,
    associations,
    resolutions: resolveAcademicObjects(representations, captions, associations),
  };
}

function createLocationIndexes(
  body: Element,
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): LocationIndexes {
  const paragraphElements = getSemanticDescendantsByTagNameNS(body, WORD_NAMESPACE, "p");
  const paragraphIndexByElement = new Map(
    paragraphElements.map((element, index) => [element, index]),
  );
  const blockIndexByParagraphId = new Map(
    blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );
  const directTables = new Map<Element, number>();

  for (const child of getSemanticChildElements(body)) {
    if (child.namespaceURI === WORD_NAMESPACE && child.localName === "tbl") {
      const tableBlock = blocks.find(
        (block) => block.type === "table" && block.blockIndex === getDirectChildBlockIndex(body, child),
      );
      if (tableBlock) directTables.set(child, tableBlock.blockIndex);
    }
  }

  // Paragraph identity comes from the shared parser; shadow facts never create a second text model.
  for (const [element, index] of paragraphIndexByElement) {
    if (!paragraphs[index]) paragraphIndexByElement.delete(element);
  }

  return { paragraphIndexByElement, blockIndexByParagraphId, blockIndexByTableElement: directTables };
}

function getDirectChildBlockIndex(body: Element, target: Element): number {
  return getSemanticChildElements(body)
    .filter((element) =>
      element.namespaceURI === WORD_NAMESPACE &&
      (element.localName === "p" || element.localName === "tbl"),
    )
    .indexOf(target);
}

function parseRepresentations(
  body: Element,
  paragraphs: readonly Paragraph[],
  indexes: LocationIndexes,
): ObjectRepresentationOccurrence[] {
  const occurrences: Omit<ObjectRepresentationOccurrence, "id" | "xmlOrder">[] = [];
  const semanticElements = getSemanticDescendantsByTagNameNS(body, "*", "*")
    .filter((element) => !isInsideInvisibleCurrentDocumentRevision(element));

  for (const element of semanticElements) {
    const kind = classifyRepresentationRoot(element);
    if (!kind) continue;

    const paragraphElement = findAncestor(element, WORD_NAMESPACE, "p");
    const paragraphIndex = paragraphElement
      ? indexes.paragraphIndexByElement.get(paragraphElement) ?? null
      : null;
    const paragraph = paragraphIndex === null ? undefined : paragraphs[paragraphIndex];
    const tableBlockIndex = kind === "table"
      ? indexes.blockIndexByTableElement.get(element) ?? null
      : null;

    occurrences.push({
      kind,
      sourcePart: "word/document.xml",
      blockIndex: tableBlockIndex ?? (paragraph
        ? indexes.blockIndexByParagraphId.get(paragraph.id) ?? null
        : null),
      paragraphId: paragraph?.id ?? null,
      paragraphIndex,
      scope: getRepresentationScope(element),
      academicScope: createUnknownAcademicScope("missing-main-boundary"),
      drawingType: element.namespaceURI === WORD_NAMESPACE && element.localName === "drawing"
        ? getDrawingType(element)
        : null,
      evidence: getRepresentationEvidence(element, kind),
    });
  }

  return occurrences.map((occurrence, index) => ({
    id: `object-representation-${index + 1}`,
    xmlOrder: index,
    ...occurrence,
  }));
}

function createUnknownAcademicScope(
  reason: ObjectRepresentationOccurrence["academicScope"]["reason"],
): ObjectRepresentationOccurrence["academicScope"] {
  return {
    scope: "unknown",
    reason,
    boundaryParagraphId: null,
    boundaryParagraphIndex: null,
  };
}

function classifyRepresentationRoot(element: Element): ObjectRepresentationKind | null {
  if (element.namespaceURI === WORD_NAMESPACE && element.localName === "drawing") {
    if (hasDescendant(element, WORDPROCESSING_SHAPE_NAMESPACE, "txbx") ||
        hasDescendant(element, WORD_NAMESPACE, "txbxContent")) return "textbox";
    if (hasDescendant(element, PICTURE_NAMESPACE, "pic")) return "picture";
    if (hasDescendant(element, CHART_NAMESPACE, "chart") || hasGraphicDataUri(element, "/chart")) return "chart";
    if (hasDescendant(element, DIAGRAM_NAMESPACE, "relIds") || hasGraphicDataUri(element, "/diagram")) return "diagram";
    if (hasDescendant(element, WORDPROCESSING_GROUP_NAMESPACE, "wgp") || hasGraphicDataUri(element, "wordprocessingGroup")) return "group";
    return "unknown-drawing";
  }

  if (element.namespaceURI === WORD_NAMESPACE && element.localName === "tbl") return "table";
  if (element.namespaceURI === WORD_NAMESPACE && element.localName === "object" &&
      hasDescendant(element, OFFICE_NAMESPACE, "OLEObject")) return "ole";

  if (element.namespaceURI === WORD_NAMESPACE && element.localName === "pict" &&
      !findAncestor(element, WORD_NAMESPACE, "object")) {
    if (hasDescendant(element, WORD_NAMESPACE, "txbxContent")) return "textbox";
    if (hasDescendant(element, VML_NAMESPACE, "imagedata")) return "vml-image";
  }

  if (element.namespaceURI === MATH_NAMESPACE && element.localName === "oMathPara") return "equation";
  if (element.namespaceURI === MATH_NAMESPACE && element.localName === "oMath" &&
      !findAncestor(element, MATH_NAMESPACE, "oMathPara")) return "equation";
  return null;
}

function getRepresentationEvidence(element: Element, kind: ObjectRepresentationKind): string[] {
  const root = `${element.prefix ?? ""}${element.prefix ? ":" : ""}${element.localName}`;
  const evidence = [root];
  const graphicData = getSemanticDescendantsByTagNameNS(element, DRAWINGML_NAMESPACE, "graphicData").at(0);
  const uri = graphicData?.getAttribute("uri");
  if (uri) evidence.push(`a:graphicData@uri=${uri}`);

  const markerByKind: Partial<Record<ObjectRepresentationKind, string>> = {
    picture: "pic:pic",
    chart: "c:chart",
    diagram: "dgm:relIds",
    group: "wpg:wgp",
    textbox: "w:txbxContent|wps:txbx",
    "vml-image": "v:imagedata",
    ole: "o:OLEObject",
    equation: "m:oMath|m:oMathPara",
    table: "w:tbl",
  };
  const marker = markerByKind[kind];
  if (marker) evidence.push(marker);
  return evidence;
}

function parseCaptionOccurrences(
  body: Element,
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
  indexes: LocationIndexes,
): CaptionOccurrence[] {
  const paragraphElementByIndex = new Map(
    [...indexes.paragraphIndexByElement].map(([element, index]) => [index, element]),
  );
  const blockIndexByParagraphId = new Map(
    blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => [block.paragraphId, block.blockIndex]),
  );

  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const blockIndex = blockIndexByParagraphId.get(paragraph.id);
    if (blockIndex === undefined || paragraph.isEmpty || paragraph.isTableOfContentsEntry ||
        paragraph.contentScope !== "document" || paragraph.isInTableCell) return [];

    const semantic = classifyCaptionSemantic(paragraph.text);
    if (!semantic) return [];
    const paragraphElement = paragraphElementByIndex.get(paragraphIndex);

    return [{
      id: `caption-occurrence-${paragraphIndex + 1}`,
      rawText: paragraph.text,
      normalizedText: normalizeCaptionText(paragraph.text),
      paragraphId: paragraph.id,
      paragraphIndex,
      blockIndex,
      sourcePart: "word/document.xml" as const,
      scope: "body" as const,
      semantic,
      fieldEvidence: paragraphElement
        ? getSemanticDescendantsByTagNameNS(paragraphElement, WORD_NAMESPACE, "instrText")
            .filter((field) => !isInsideInvisibleCurrentDocumentRevision(field))
            .map((field) => ({ instruction: (field.textContent ?? "").trim() }))
            .filter((field) => field.instruction.length > 0)
        : [],
      isOrphan: true,
    }];
  });
}

function classifyCaptionSemantic(text: string): CaptionSemantic | null {
  const parsed = parseCaptionText(text);
  if (parsed) {
    return {
      status: "declared",
      academicType: parsed.kind,
      label: parsed.label,
      number: parsed.number,
    };
  }

  const normalized = normalizeCaptionText(text);
  const labelMatch = /^(tablo|şekil)\b/u.exec(normalized);
  if (!labelMatch) return null;
  const candidateLabel = labelMatch[1] === "tablo" ? "Tablo" : "Şekil";
  const remainder = normalized.slice(labelMatch[0].length).trim();

  return remainder.length === 0
    ? { status: "unnumbered", academicType: null, candidateLabel, reason: "caption-label-without-number" }
    : { status: "malformed", academicType: null, candidateLabel, reason: "unsupported-caption-syntax" };
}

function normalizeCaptionText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function associateObjectCaptions(
  representations: readonly ObjectRepresentationOccurrence[],
  captions: readonly CaptionOccurrence[],
  paragraphs: readonly Paragraph[],
  blocks: readonly DocumentBlock[],
): ObjectCaptionAssociation[] {
  const captionByBlock = new Map(captions.map((caption) => [caption.blockIndex, caption]));
  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const proposals = representations.map((representation) =>
    createAssociationProposal(representation, captionByBlock, paragraphById, blocks),
  );
  const claims = new Map<string, number>();

  for (const proposal of proposals) {
    if (proposal.status === "matched" && proposal.captionId) {
      claims.set(proposal.captionId, (claims.get(proposal.captionId) ?? 0) + 1);
    }
  }

  return proposals.map((proposal) =>
    proposal.captionId && (claims.get(proposal.captionId) ?? 0) > 1
      ? {
          ...proposal,
          status: "ambiguous",
          captionId: null,
          position: null,
          distanceInBlocks: null,
          reasons: ["caption-claimed-by-multiple-objects"],
        }
      : proposal,
  );
}

function createAssociationProposal(
  representation: ObjectRepresentationOccurrence,
  captionByBlock: ReadonlyMap<number, CaptionOccurrence>,
  paragraphById: ReadonlyMap<string, Paragraph>,
  blocks: readonly DocumentBlock[],
): ObjectCaptionAssociation {
  if (representation.kind === "textbox" || representation.scope === "textbox") {
    return emptyAssociation(representation.id, "not-attempted", "textbox-scope-excluded");
  }
  if (representation.blockIndex === null || representation.drawingType === "anchor") {
    return emptyAssociation(representation.id, "ambiguous", "object-position-not-deterministic");
  }

  const candidates = [
    ...collectCaptionCandidates(representation.blockIndex, -1, captionByBlock, paragraphById, blocks),
    ...collectCaptionCandidates(representation.blockIndex, 1, captionByBlock, paragraphById, blocks),
  ];
  if (candidates.length === 0) return emptyAssociation(representation.id, "missing", "no-adjacent-caption");

  const expectedType = representation.kind === "table" ? "table" : "figure";
  const declared = candidates.filter((candidate) => candidate.caption.semantic.status === "declared");
  const matching = declared.filter((candidate) =>
    candidate.caption.semantic.status === "declared" &&
    candidate.caption.semantic.academicType === expectedType,
  );

  if (matching.length === 1 && declared.length === 1 && candidates.length === 1) {
    const match = matching[0];
    return {
      objectId: representation.id,
      status: "matched",
      captionId: match.caption.id,
      candidateCaptionIds: [match.caption.id],
      position: match.position,
      distanceInBlocks: match.distanceInBlocks,
      reasons: ["single-adjacent-declared-caption"],
    };
  }

  const candidateCaptionIds = candidates.map((candidate) => candidate.caption.id);
  if (declared.length > 0 && matching.length === 0) {
    return {
      ...emptyAssociation(representation.id, "conflicting", "declared-caption-type-conflicts-with-representation"),
      candidateCaptionIds,
    };
  }

  return {
    ...emptyAssociation(representation.id, "ambiguous", "multiple-or-unusable-caption-candidates"),
    candidateCaptionIds,
  };
}

function collectCaptionCandidates(
  originBlockIndex: number,
  direction: -1 | 1,
  captionByBlock: ReadonlyMap<number, CaptionOccurrence>,
  paragraphById: ReadonlyMap<string, Paragraph>,
  blocks: readonly DocumentBlock[],
): CaptionCandidate[] {
  const candidates: CaptionCandidate[] = [];
  for (let index = originBlockIndex + direction; index >= 0 && index < blocks.length; index += direction) {
    const block = blocks[index];
    if (block.type !== "paragraph") break;
    const paragraph = paragraphById.get(block.paragraphId);
    if (!paragraph || paragraph.isEmpty) continue;
    const caption = captionByBlock.get(block.blockIndex);
    if (!caption) break;
    candidates.push({
      caption,
      position: direction === -1 ? "before" : "after",
      distanceInBlocks: Math.abs(block.blockIndex - originBlockIndex),
    });
  }
  return candidates;
}

function emptyAssociation(
  objectId: string,
  status: Exclude<ObjectCaptionAssociation["status"], "matched">,
  reason: string,
): ObjectCaptionAssociation {
  return {
    objectId,
    status,
    captionId: null,
    candidateCaptionIds: [],
    position: null,
    distanceInBlocks: null,
    reasons: [reason],
  };
}

function resolveAcademicObjects(
  representations: readonly ObjectRepresentationOccurrence[],
  captions: readonly CaptionOccurrence[],
  associations: readonly ObjectCaptionAssociation[],
): AcademicObjectResolution[] {
  const captionById = new Map(captions.map((caption) => [caption.id, caption]));
  const associationByObjectId = new Map(associations.map((association) => [association.objectId, association]));

  return representations.map((representation) => {
    const association = associationByObjectId.get(representation.id);
    if (representation.kind === "textbox" || representation.scope === "textbox") {
      return resolution(representation.id, "excluded", null, null, "textbox-scope-not-academic-object");
    }
    if (!association || association.status === "missing" || association.status === "not-attempted") {
      return resolution(representation.id, "unresolved", null, null, "no-usable-associated-caption");
    }
    if (association.status === "ambiguous" || association.status === "conflicting") {
      return resolution(representation.id, "ambiguous", null, null, `association-${association.status}`);
    }

    const caption = association.captionId ? captionById.get(association.captionId) : undefined;
    if (!caption || caption.semantic.status !== "declared") {
      return resolution(representation.id, "unresolved", null, null, "caption-does-not-declare-academic-type");
    }
    return resolution(
      representation.id,
      "declared",
      caption.semantic.academicType,
      caption.id,
      "deterministically-associated-declared-caption",
    );
  });
}

function resolution(
  objectId: string,
  status: AcademicObjectResolution["status"],
  academicType: AcademicObjectResolution["academicType"],
  captionId: string | null,
  reason: string,
): AcademicObjectResolution {
  return { objectId, status, academicType, captionId, reasons: [reason] };
}

function getRepresentationScope(element: Element): ObjectRepresentationScope {
  if (findAncestor(element, WORD_NAMESPACE, "txbxContent")) return "textbox";
  if (findAncestor(element, WORD_NAMESPACE, "tc")) return "table-cell";
  return "body";
}

function hasGraphicDataUri(element: Element, suffix: string): boolean {
  return getSemanticDescendantsByTagNameNS(element, DRAWINGML_NAMESPACE, "graphicData")
    .some((graphicData) => graphicData.getAttribute("uri")?.endsWith(suffix) ?? false);
}

function hasDescendant(element: Element, namespaceURI: string, localName: string): boolean {
  return getSemanticDescendantsByTagNameNS(element, namespaceURI, localName).length > 0;
}

function getDrawingType(drawing: Element): FigureDrawingType {
  if (hasDescendant(drawing, WORDPROCESSING_DRAWING_NAMESPACE, "anchor")) return "anchor";
  if (hasDescendant(drawing, WORDPROCESSING_DRAWING_NAMESPACE, "inline")) return "inline";
  return "unknown";
}

function findAncestor(element: Element, namespaceURI: string, localName: string): Element | null {
  let current = element.parentElement;
  while (current) {
    if (current.namespaceURI === namespaceURI && current.localName === localName) return current;
    current = current.parentElement;
  }
  return null;
}
