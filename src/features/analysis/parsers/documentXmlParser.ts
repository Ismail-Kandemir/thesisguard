import type {
  NormalizedDocument,
  Paragraph,
  ParagraphAlignment,
  Run,
} from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseDocumentXml(documentXml: string): NormalizedDocument {
  const xmlDocument = new DOMParser().parseFromString(documentXml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error("document.xml gecerli XML degil.");
  }

  return {
    paragraphs: parseParagraphs(xmlDocument),
    styles: [],
  };
}

function parseParagraphs(xmlDocument: Document): Paragraph[] {
  return Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "p")).map(
    (paragraphElement, index) => {
      const runs = parseRuns(paragraphElement);

      return {
        id: `paragraph-${index + 1}`,
        text: getParagraphText(runs),
        runs,
        alignment: parseAlignment(paragraphElement),
        styleId: parseParagraphStyleId(paragraphElement),
        isEmpty: runs.every((run) => run.text.length === 0),
      };
    },
  );
}

function parseRuns(paragraphElement: Element): Run[] {
  return Array.from(paragraphElement.getElementsByTagNameNS(WORD_NAMESPACE, "r"))
    .map(parseRun);
}

function parseRun(runElement: Element): Run {
  const style = parseRunStyle(runElement);

  return {
    text: parseRunText(runElement),
    ...style,
  };
}

function parseRunStyle(runElement: Element): Omit<Run, "text"> {
  const runProperties = getFirstDescendant(runElement, "rPr");

  return {
    bold: parseToggleProperty(runProperties, "b"),
    italic: parseToggleProperty(runProperties, "i"),
    underline: parseUnderline(runProperties),
    fontFamily: parseRunFontFamily(runProperties),
    fontSize: parseRunFontSize(runProperties),
  };
}

function parseRunText(runElement: Element): string {
  return Array.from(runElement.getElementsByTagNameNS(WORD_NAMESPACE, "t"))
    .map((textElement) => textElement.textContent ?? "")
    .join("");
}

function parseToggleProperty(runProperties: Element | null, propertyName: string): boolean {
  if (!runProperties) {
    return false;
  }

  const property = getFirstDescendant(runProperties, propertyName);

  if (!property) {
    return false;
  }

  const value = getWordAttribute(property, "val")?.toLowerCase();

  return value !== "false" && value !== "0" && value !== "off";
}

function parseUnderline(runProperties: Element | null): boolean {
  if (!runProperties) {
    return false;
  }

  const underline = getFirstDescendant(runProperties, "u");

  if (!underline) {
    return false;
  }

  const value = getWordAttribute(underline, "val")?.toLowerCase();

  return value !== "none" && value !== "false" && value !== "0" && value !== "off";
}

function parseRunFontFamily(runProperties: Element | null): string | null {
  const runFonts = runProperties ? getFirstDescendant(runProperties, "rFonts") : null;

  if (!runFonts) {
    return null;
  }

  return (
    getWordAttribute(runFonts, "ascii") ??
    getWordAttribute(runFonts, "hAnsi") ??
    getWordAttribute(runFonts, "cs") ??
    getWordAttribute(runFonts, "eastAsia")
  );
}

function parseRunFontSize(runProperties: Element | null): number | null {
  const sizeElement = runProperties ? getFirstDescendant(runProperties, "sz") : null;
  const halfPointValue = sizeElement ? getWordAttribute(sizeElement, "val") : null;

  if (halfPointValue === null) {
    return null;
  }

  const parsedValue = Number(halfPointValue);

  return Number.isFinite(parsedValue) ? parsedValue / 2 : null;
}

function parseAlignment(paragraphElement: Element): ParagraphAlignment | null {
  const paragraphProperties = getFirstDescendant(paragraphElement, "pPr");
  const alignmentElement = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "jc")
    : null;
  const value = alignmentElement ? getWordAttribute(alignmentElement, "val") : null;

  switch (value) {
    case "left":
    case "right":
    case "center":
    case "justify":
      return value;
    default:
      return null;
  }
}

function parseParagraphStyleId(paragraphElement: Element): string | null {
  const paragraphProperties = getFirstDescendant(paragraphElement, "pPr");
  const styleElement = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "pStyle")
    : null;

  return styleElement ? getWordAttribute(styleElement, "val") : null;
}

function getParagraphText(runs: Run[]): string {
  return runs.map((run) => run.text).join("");
}

function getFirstDescendant(element: Element, localName: string): Element | null {
  return element.getElementsByTagNameNS(WORD_NAMESPACE, localName).item(0);
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
