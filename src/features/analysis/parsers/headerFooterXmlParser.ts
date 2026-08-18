import type {
  HeaderFooterXmlPart,
  PageNumberField,
  PageNumbering,
  ParagraphAlignment,
} from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const PAGE_INSTRUCTION_PATTERN = /^PAGE(?:\s|$)/i;

export function parseHeaderFooterPageNumbering(
  parts: HeaderFooterXmlPart[],
): PageNumbering {
  const fields = parts.flatMap(parsePartPageNumberFields);

  return {
    hasPageNumbers: fields.length > 0,
    fields,
    sections: [],
  };
}

function parsePartPageNumberFields(part: HeaderFooterXmlPart): PageNumberField[] {
  const xmlDocument = new DOMParser().parseFromString(part.xml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error(`${part.path} gecerli XML degil.`);
  }

  const simpleFields = Array.from(
    xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "fldSimple"),
  )
    .filter((element) => isPageInstruction(getWordAttribute(element, "instr")))
    .map((element) => createPageNumberField(part, element, "fldSimple"));

  const instructionTextFields = Array.from(
    xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "instrText"),
  )
    .filter((element) => isPageInstruction(element.textContent))
    .map((element) => createPageNumberField(part, element, "instrText"));

  return [...simpleFields, ...instructionTextFields];
}

function isPageInstruction(instruction: string | null): boolean {
  return instruction !== null && PAGE_INSTRUCTION_PATTERN.test(instruction.trim());
}

function createPageNumberField(
  part: HeaderFooterXmlPart,
  fieldElement: Element,
  structure: PageNumberField["structure"],
): PageNumberField {
  return {
    sourcePath: part.path,
    location: part.location,
    alignment: parseContainingParagraphAlignment(fieldElement),
    fieldType: "PAGE",
    structure,
  };
}

function parseContainingParagraphAlignment(element: Element): ParagraphAlignment | null {
  const paragraph = findAncestor(element, "p");
  const paragraphProperties = paragraph
    ? paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "pPr").item(0)
    : null;
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
