import type {
  NormalizedDocument,
  PageMargins,
  Paragraph,
  ParagraphAlignment,
  ParagraphNumbering,
  Run,
} from "../types";
import { parseTableOfContents } from "./tableOfContentsXmlParser";
import { parseDocumentSections } from "./documentSectionsParser";
import { normalizeDocumentCaptions } from "./documentCaptionsNormalizer";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TWIPS_PER_INCH = 1440;
const CENTIMETERS_PER_INCH = 2.54;

export function parseDocumentXml(documentXml: string): NormalizedDocument {
  const xmlDocument = new DOMParser().parseFromString(documentXml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error("document.xml gecerli XML degil.");
  }

  const paragraphs = parseParagraphs(xmlDocument);
  const visualStructure = normalizeDocumentCaptions(xmlDocument, paragraphs);

  return {
    paragraphs,
    styles: [],
    documentDefaults: {
      fontFamily: null,
      fontSize: null,
      lineSpacing: null,
    },
    pageMargins: parsePageMargins(xmlDocument),
    pageNumbering: {
      hasPageNumbers: false,
      fields: [],
      sections: parsePageNumberSections(xmlDocument),
    },
    tableOfContents: parseTableOfContents(xmlDocument),
    tables: visualStructure.tables,
    figures: visualStructure.figures,
    blocks: visualStructure.blocks,
    captions: visualStructure.captions,
    objectReferences: { items: [] },
    abbreviations: {
      items: [],
      count: 0,
      hasAbbreviations: false,
    },
    numberingDefinitions: [],
    sections: parseDocumentSections(paragraphs),
  };
}

function parsePageMargins(xmlDocument: Document): PageMargins {
  const sectionProperties = Array.from(
    xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "sectPr"),
  ).at(-1);
  const pageMarginElement = sectionProperties
    ? getFirstDescendant(sectionProperties, "pgMar")
    : null;

  return {
    left: parseMarginInCentimeters(pageMarginElement, "left"),
    right: parseMarginInCentimeters(pageMarginElement, "right"),
    top: parseMarginInCentimeters(pageMarginElement, "top"),
    bottom: parseMarginInCentimeters(pageMarginElement, "bottom"),
  };
}

function parseMarginInCentimeters(
  pageMarginElement: Element | null,
  marginName: keyof PageMargins,
): number | null {
  if (!pageMarginElement) {
    return null;
  }

  const twipsValue = getWordAttribute(pageMarginElement, marginName);

  if (twipsValue === null) {
    return null;
  }

  const parsedTwips = Number(twipsValue);

  if (!Number.isFinite(parsedTwips)) {
    return null;
  }

  return roundToTwoDecimals((parsedTwips / TWIPS_PER_INCH) * CENTIMETERS_PER_INCH);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseParagraphs(xmlDocument: Document): Paragraph[] {
  return getBodyDescendants(xmlDocument, "p").map(
    (paragraphElement, index) => {
      const runs = parseRuns(paragraphElement);

      return {
        id: `paragraph-${index + 1}`,
        text: getParagraphText(runs),
        runs,
        alignment: parseAlignment(paragraphElement),
        lineSpacing: parseLineSpacing(paragraphElement),
        styleId: parseParagraphStyleId(paragraphElement),
        numbering: parseDirectNumbering(paragraphElement),
        isTableOfContentsEntry: isTableOfContentsEntry(paragraphElement),
        isEmpty: runs.every((run) => run.text.length === 0),
      };
    },
  );
}

function parsePageNumberSections(xmlDocument: Document) {
  const body = xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "body").item(0);

  if (!body) {
    return [];
  }

  const paragraphs = Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, "p"));
  const sections = paragraphs.flatMap((paragraph, paragraphIndex) => {
    const paragraphProperties = Array.from(paragraph.children).find(
      (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === "pPr",
    );
    const sectionProperties = paragraphProperties
      ? Array.from(paragraphProperties.children).find(
          (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === "sectPr",
        )
      : null;

    return sectionProperties
      ? [parsePageNumberSection(sectionProperties, paragraphIndex)]
      : [];
  });
  const finalSectionProperties = Array.from(body.children).find(
    (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === "sectPr",
  );

  if (finalSectionProperties) {
    sections.push(
      parsePageNumberSection(finalSectionProperties, Math.max(paragraphs.length - 1, 0)),
    );
  }

  return sections;
}

function parsePageNumberSection(sectionProperties: Element, endParagraphIndex: number) {
  const pageNumberType = Array.from(sectionProperties.children).find(
    (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === "pgNumType",
  );

  return {
    endParagraphIndex,
    format: pageNumberType ? getWordAttribute(pageNumberType, "fmt") : null,
    start: pageNumberType ? parseNumericWordAttribute(pageNumberType, "start") : null,
  };
}

function parseDirectNumbering(paragraphElement: Element): ParagraphNumbering {
  const paragraphProperties = getFirstDescendant(paragraphElement, "pPr");
  const numberingProperties = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "numPr")
    : null;
  const numIdElement = numberingProperties
    ? getFirstDescendant(numberingProperties, "numId")
    : null;
  const levelElement = numberingProperties
    ? getFirstDescendant(numberingProperties, "ilvl")
    : null;
  const numId = numIdElement ? getWordAttribute(numIdElement, "val") : null;
  const levelValue = levelElement ? getWordAttribute(levelElement, "val") : null;
  const level = levelValue === null ? 0 : Number(levelValue);

  if (numId === null || numId === "0" || !Number.isInteger(level) || level < 0) {
    return { source: "none", numId: null, level: null, visibleLabel: null };
  }

  return { source: "word", numId, level, visibleLabel: null };
}

function isTableOfContentsEntry(paragraphElement: Element): boolean {
  const styleId = parseParagraphStyleId(paragraphElement)?.toLocaleLowerCase("en-US");

  if (styleId?.startsWith("toc")) {
    return true;
  }

  let ancestor = paragraphElement.parentElement;

  while (ancestor) {
    if (ancestor.localName === "sdt") {
      const gallery = getFirstDescendant(ancestor, "docPartGallery");
      const value = gallery ? getWordAttribute(gallery, "val") : null;

      if (value?.toLocaleLowerCase("en-US").includes("table of contents")) {
        return true;
      }
    }

    ancestor = ancestor.parentElement;
  }

  return false;
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
    case "start":
      return "left";
    case "right":
    case "end":
      return "right";
    case "center":
      return value;
    case "both":
    case "justify":
      return "justify";
    default:
      return null;
  }
}

function parseLineSpacing(paragraphElement: Element): number | null {
  const paragraphProperties = getFirstDescendant(paragraphElement, "pPr");
  const spacingElement = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "spacing")
    : null;

  return spacingElement ? parseNumericWordAttribute(spacingElement, "line") : null;
}

function parseNumericWordAttribute(element: Element, localName: string): number | null {
  const value = getWordAttribute(element, localName);

  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
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

function getBodyDescendants(xmlDocument: Document, localName: string): Element[] {
  const body = xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "body").item(0);

  if (!body) {
    return [];
  }

  return Array.from(body.getElementsByTagNameNS(WORD_NAMESPACE, localName));
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
