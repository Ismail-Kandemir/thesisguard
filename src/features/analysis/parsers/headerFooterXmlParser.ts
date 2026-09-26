import type {
  HeaderFooterXmlPart,
  PageNumberField,
  PageNumbering,
  ParagraphAlignment,
} from "../types";
import { getSemanticDescendantsByTagNameNS } from "./markupCompatibilityResolver";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const PAGE_INSTRUCTION_PATTERN = /^PAGE(?:\s|$)/i;

export type HeaderFooterParagraphAlignmentResolver = (
  paragraphStyleId: string | null,
  directAlignment: ParagraphAlignment | null,
) => ParagraphAlignment | null;

export function parseHeaderFooterPageNumbering(
  parts: HeaderFooterXmlPart[],
  resolveParagraphAlignment?: HeaderFooterParagraphAlignmentResolver,
): PageNumbering {
  const fields = parts.flatMap((part) =>
    parsePartPageNumberFields(part, resolveParagraphAlignment),
  );

  return {
    hasPageNumbers: fields.length > 0,
    fields,
    sections: [],
  };
}

function parsePartPageNumberFields(
  part: HeaderFooterXmlPart,
  resolveParagraphAlignment: HeaderFooterParagraphAlignmentResolver | undefined,
): PageNumberField[] {
  const xmlDocument = new DOMParser().parseFromString(part.xml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error(`${part.path} gecerli XML degil.`);
  }

  const simpleFields = getSemanticDescendantsByTagNameNS(xmlDocument, WORD_NAMESPACE, "fldSimple")
    .filter((element) => isPageInstruction(getWordAttribute(element, "instr")))
    .map((element) =>
      createPageNumberField(part, element, "fldSimple", resolveParagraphAlignment),
    );

  const instructionTextFields = getSemanticDescendantsByTagNameNS(xmlDocument, WORD_NAMESPACE, "instrText")
    .filter((element) => isPageInstruction(element.textContent))
    .map((element) =>
      createPageNumberField(part, element, "instrText", resolveParagraphAlignment),
    );

  return [...simpleFields, ...instructionTextFields];
}

function isPageInstruction(instruction: string | null): boolean {
  return instruction !== null && PAGE_INSTRUCTION_PATTERN.test(instruction.trim());
}

function createPageNumberField(
  part: HeaderFooterXmlPart,
  fieldElement: Element,
  structure: PageNumberField["structure"],
  resolveParagraphAlignment: HeaderFooterParagraphAlignmentResolver | undefined,
): PageNumberField {
  return {
    sourcePath: part.path,
    location: part.location,
    alignment: parseContainingParagraphAlignment(fieldElement, resolveParagraphAlignment),
    fieldType: "PAGE",
    structure,
  };
}

function parseContainingParagraphAlignment(
  element: Element,
  resolveParagraphAlignment: HeaderFooterParagraphAlignmentResolver | undefined,
): ParagraphAlignment | null {
  const paragraph = findAncestor(element, "p");
  const directAlignment = paragraph ? parseDirectParagraphAlignment(paragraph) : null;
  const paragraphStyleId = paragraph ? parseParagraphStyleId(paragraph) : null;

  return resolveParagraphAlignment
    ? resolveParagraphAlignment(paragraphStyleId, directAlignment)
    : directAlignment;
}

function parseDirectParagraphAlignment(paragraph: Element): ParagraphAlignment | null {
  const paragraphProperties = paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "pPr").item(0);
  const alignmentElement = paragraphProperties
    ? paragraphProperties.getElementsByTagNameNS(WORD_NAMESPACE, "jc").item(0)
    : null;
  const value = alignmentElement ? getWordAttribute(alignmentElement, "val") : null;

  switch (value) {
    case "left":
    case "start":
      return "left";
    case "right":
    case "end":
      return "right";
    case "center":
      return "center";
    case "both":
    case "justify":
      return "justify";
    default:
      return null;
  }
}

function parseParagraphStyleId(paragraph: Element): string | null {
  const paragraphProperties = paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "pPr").item(0);
  const styleElement = paragraphProperties
    ? paragraphProperties.getElementsByTagNameNS(WORD_NAMESPACE, "pStyle").item(0)
    : null;

  return styleElement ? getWordAttribute(styleElement, "val") : null;
}

function findAncestor(element: Element, localName: string): Element | null {
  let ancestor = element.parentElement;

  while (ancestor) {
    if (ancestor.namespaceURI === WORD_NAMESPACE && ancestor.localName === localName) {
      return ancestor;
    }

    ancestor = ancestor.parentElement;
  }

  return null;
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
