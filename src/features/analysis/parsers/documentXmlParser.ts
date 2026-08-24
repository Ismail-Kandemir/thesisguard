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
import { getLegacyExplicitFont, parseRunFontFamilyReference } from "./runFontsParser";

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
      bold: null,
      italic: null,
      underline: null,
      lineSpacing: null,
      alignment: null,
      paragraphFormatting: createEmptyParagraphFormatting(),
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
    headings: [],
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
        paragraphFormatting: parseParagraphFormatting(paragraphElement),
        styleId: parseParagraphStyleId(paragraphElement),
        numbering: parseDirectNumbering(paragraphElement),
        isTableOfContentsEntry: isTableOfContentsEntry(paragraphElement),
        isInTableCell: hasAncestor(paragraphElement, "tc"),
        isEmpty: runs.every((run) => run.text.length === 0),
      };
    },
  );
}

function parseParagraphFormatting(paragraphElement: Element) {
  const paragraphProperties = getFirstDescendant(paragraphElement, "pPr");
  const indentation = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "ind")
    : null;
  const spacing = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "spacing")
    : null;

  return {
    indentation: {
      leftTwips: parseAliasedNumericWordAttribute(indentation, "start", "left"),
      rightTwips: parseAliasedNumericWordAttribute(indentation, "end", "right"),
      firstLineTwips: parseNumericWordAttributeOrNull(indentation, "firstLine"),
      hangingTwips: parseNumericWordAttributeOrNull(indentation, "hanging"),
      leftChars: parseAliasedNumericWordAttribute(indentation, "startChars", "leftChars"),
      rightChars: parseAliasedNumericWordAttribute(indentation, "endChars", "rightChars"),
      firstLineChars: parseNumericWordAttributeOrNull(indentation, "firstLineChars"),
      hangingChars: parseNumericWordAttributeOrNull(indentation, "hangingChars"),
    },
    spacing: {
      beforeTwips: parseNumericWordAttributeOrNull(spacing, "before"),
      afterTwips: parseNumericWordAttributeOrNull(spacing, "after"),
      beforeLines: parseNumericWordAttributeOrNull(spacing, "beforeLines"),
      afterLines: parseNumericWordAttributeOrNull(spacing, "afterLines"),
    },
  };
}

function createEmptyParagraphFormatting() {
  return {
    indentation: {
      leftTwips: null, rightTwips: null, firstLineTwips: null, hangingTwips: null,
      leftChars: null, rightChars: null, firstLineChars: null, hangingChars: null,
    },
    spacing: { beforeTwips: null, afterTwips: null, beforeLines: null, afterLines: null },
  };
}

function parseNumericWordAttributeOrNull(element: Element | null, name: string): number | null {
  return element ? parseNumericWordAttribute(element, name) : null;
}

function parseAliasedNumericWordAttribute(
  element: Element | null,
  preferred: string,
  legacy: string,
): number | null {
  return parseNumericWordAttributeOrNull(element, preferred) ??
    parseNumericWordAttributeOrNull(element, legacy);
}

function hasAncestor(element: Element, localName: string): boolean {
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.namespaceURI === WORD_NAMESPACE && ancestor.localName === localName) return true;
    ancestor = ancestor.parentElement;
  }
  return false;
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
    styleId: parseRunStyleId(runElement),
    ...style,
  };
}

function parseRunStyleId(runElement: Element): string | null {
  const runProperties = getFirstDescendant(runElement, "rPr");
  const runStyle = runProperties ? getFirstDescendant(runProperties, "rStyle") : null;

  return runStyle ? getWordAttribute(runStyle, "val") : null;
}

function parseRunStyle(runElement: Element): Omit<Run, "text"> {
  const runProperties = getFirstDescendant(runElement, "rPr");
  const fontFamilyReference = parseRunFontFamilyReference(runProperties);

  return {
    bold: parseToggleProperty(runProperties, "b"),
    italic: parseToggleProperty(runProperties, "i"),
    underline: parseUnderline(runProperties),
    fontFamily: getLegacyExplicitFont(fontFamilyReference),
    fontFamilyReference,
    fontSize: parseRunFontSize(runProperties),
  };
}

function parseRunText(runElement: Element): string {
  return Array.from(runElement.getElementsByTagNameNS(WORD_NAMESPACE, "t"))
    .map((textElement) => textElement.textContent ?? "")
    .join("");
}

function parseToggleProperty(runProperties: Element | null, propertyName: string): boolean | null {
  if (!runProperties) {
    return null;
  }

  const property = getFirstDescendant(runProperties, propertyName);

  if (!property) {
    return null;
  }

  const value = getWordAttribute(property, "val")?.toLowerCase();

  return value !== "false" && value !== "0" && value !== "off";
}

function parseUnderline(runProperties: Element | null): boolean | null {
  if (!runProperties) {
    return null;
  }

  const underline = getFirstDescendant(runProperties, "u");

  if (!underline) {
    return null;
  }

  const value = getWordAttribute(underline, "val")?.toLowerCase();

  return value !== "none" && value !== "false" && value !== "0" && value !== "off";
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
