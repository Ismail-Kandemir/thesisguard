import type {
  DocumentDefaults,
  NumberingReference,
  ObjectAlignment,
  ParagraphAlignment,
  StyleDefinition,
} from "../types";
import { getLegacyExplicitFont, parseRunFontFamilyReference } from "./runFontsParser";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

interface StyleProperties {
  fontFamily: string | null;
  fontFamilyReference: ReturnType<typeof parseRunFontFamilyReference>;
  fontSize: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  lineSpacing: number | null;
  alignment: ParagraphAlignment | null;
  tableAlignment: ObjectAlignment | null;
  paragraphFormatting: ReturnType<typeof parseParagraphFormatting>;
}

interface ParsedStylesXml {
  styles: StyleDefinition[];
  documentDefaults: DocumentDefaults;
}

export function parseStylesXml(stylesXml: string): ParsedStylesXml {
  const xmlDocument = new DOMParser().parseFromString(stylesXml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error("styles.xml gecerli XML degil.");
  }

  return {
    styles: parseStyles(xmlDocument),
    documentDefaults: parseDocumentDefaults(xmlDocument),
  };
}

function parseDocumentDefaults(xmlDocument: Document): DocumentDefaults {
  const documentDefaults = xmlDocument
    .getElementsByTagNameNS(WORD_NAMESPACE, "docDefaults")
    .item(0);
  const runPropertiesDefault = documentDefaults
    ? getFirstDescendant(documentDefaults, "rPrDefault")
    : null;
  const runProperties = runPropertiesDefault
    ? getFirstDescendant(runPropertiesDefault, "rPr")
    : null;
  const paragraphPropertiesDefault = documentDefaults
    ? getFirstDescendant(documentDefaults, "pPrDefault")
    : null;
  const paragraphProperties = paragraphPropertiesDefault
    ? getFirstDescendant(paragraphPropertiesDefault, "pPr")
    : null;

  return {
    fontFamily: parseFont(runProperties),
    fontFamilyReference: parseRunFontFamilyReference(runProperties),
    fontSize: parseFontSize(runProperties),
    bold: parseToggleProperty(runProperties, "b"),
    italic: parseToggleProperty(runProperties, "i"),
    underline: parseUnderline(runProperties),
    lineSpacing: parseSpacing(paragraphProperties),
    alignment: parseAlignment(paragraphProperties),
    paragraphFormatting: parseParagraphFormatting(paragraphProperties),
  };
}

function parseStyles(xmlDocument: Document): StyleDefinition[] {
  return Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "style"))
    .map(parseStyle)
    .filter((style): style is StyleDefinition => style !== null);
}

function parseStyle(styleElement: Element): StyleDefinition | null {
  const id = getWordAttribute(styleElement, "styleId");

  if (!id) {
    return null;
  }

  return {
    id,
    type: parseStyleType(styleElement),
    name: parseElementValue(styleElement, "name"),
    basedOn: parseElementValue(styleElement, "basedOn"),
    nextStyle: parseElementValue(styleElement, "next"),
    numbering: parseNumberingReference(styleElement),
    ...parseStyleProperties(styleElement),
  };
}

function parseNumberingReference(styleElement: Element): NumberingReference | null {
  const paragraphProperties = getFirstDescendant(styleElement, "pPr");
  const numberingProperties = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "numPr")
    : null;
  const numId = numberingProperties
    ? parseElementValue(numberingProperties, "numId")
    : null;
  const level = numberingProperties
    ? parseNumericElementValue(numberingProperties, "ilvl") ?? 0
    : null;

  return numId !== null && numId !== "0" && level !== null
    ? { numId, level }
    : null;
}

function parseNumericElementValue(parent: Element, localName: string): number | null {
  const element = getFirstDescendant(parent, localName);

  return element ? parseNumericAttribute(element, "val") : null;
}

function parseStyleProperties(styleElement: Element): StyleProperties {
  const runProperties = getFirstDescendant(styleElement, "rPr");
  const paragraphProperties = getFirstDescendant(styleElement, "pPr");
  const tableProperties = getFirstDirectChild(styleElement, "tblPr");

  return {
    fontFamily: parseFont(runProperties),
    fontFamilyReference: parseRunFontFamilyReference(runProperties),
    fontSize: parseFontSize(runProperties),
    bold: parseToggleProperty(runProperties, "b"),
    italic: parseToggleProperty(runProperties, "i"),
    underline: parseUnderline(runProperties),
    lineSpacing: parseSpacing(paragraphProperties),
    paragraphFormatting: parseParagraphFormatting(paragraphProperties),
    alignment: parseAlignment(paragraphProperties),
    tableAlignment: parseTableAlignment(tableProperties),
  };
}

function parseParagraphFormatting(paragraphProperties: Element | null) {
  const indentation = paragraphProperties ? getFirstDescendant(paragraphProperties, "ind") : null;
  const spacing = paragraphProperties ? getFirstDescendant(paragraphProperties, "spacing") : null;
  const numeric = (element: Element | null, name: string): number | null =>
    element ? parseNumericAttribute(element, name) : null;

  return {
    indentation: {
      leftTwips: numeric(indentation, "start") ?? numeric(indentation, "left"),
      rightTwips: numeric(indentation, "end") ?? numeric(indentation, "right"),
      firstLineTwips: numeric(indentation, "firstLine"),
      hangingTwips: numeric(indentation, "hanging"),
      leftChars: numeric(indentation, "startChars") ?? numeric(indentation, "leftChars"),
      rightChars: numeric(indentation, "endChars") ?? numeric(indentation, "rightChars"),
      firstLineChars: numeric(indentation, "firstLineChars"),
      hangingChars: numeric(indentation, "hangingChars"),
    },
    spacing: {
      beforeTwips: numeric(spacing, "before"),
      afterTwips: numeric(spacing, "after"),
      beforeLines: numeric(spacing, "beforeLines"),
      afterLines: numeric(spacing, "afterLines"),
    },
  };
}

function parseStyleType(styleElement: Element): StyleDefinition["type"] {
  const type = getWordAttribute(styleElement, "type");

  switch (type) {
    case "paragraph":
    case "character":
    case "table":
    case "numbering":
      return type;
    default:
      return "unknown";
  }
}

function parseFont(runProperties: Element | null): string | null {
  return getLegacyExplicitFont(parseRunFontFamilyReference(runProperties));
}

function parseFontSize(runProperties: Element | null): number | null {
  const sizeElement = runProperties ? getFirstDescendant(runProperties, "sz") : null;
  const halfPointValue = sizeElement ? parseNumericAttribute(sizeElement, "val") : null;

  return halfPointValue === null ? null : halfPointValue / 2;
}

function parseToggleProperty(
  runProperties: Element | null,
  propertyName: string,
): boolean | null {
  const property = runProperties ? getFirstDescendant(runProperties, propertyName) : null;

  if (!property) {
    return null;
  }

  return parseToggleValue(getWordAttribute(property, "val"));
}

function parseUnderline(runProperties: Element | null): boolean | null {
  const underlineElement = runProperties ? getFirstDescendant(runProperties, "u") : null;

  if (!underlineElement) {
    return null;
  }

  const value = getWordAttribute(underlineElement, "val")?.toLowerCase();

  return value !== "none" && parseToggleValue(value);
}

function parseSpacing(paragraphProperties: Element | null): number | null {
  const spacingElement = paragraphProperties
    ? getFirstDescendant(paragraphProperties, "spacing")
    : null;

  return spacingElement ? parseNumericAttribute(spacingElement, "line") : null;
}

function parseAlignment(paragraphProperties: Element | null): ParagraphAlignment | null {
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

function parseTableAlignment(tableProperties: Element | null): ObjectAlignment | null {
  const alignmentElement = tableProperties
    ? getFirstDescendant(tableProperties, "jc")
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
    default:
      return null;
  }
}

function parseElementValue(parent: Element, localName: string): string | null {
  const element = getFirstDescendant(parent, localName);

  return element ? getWordAttribute(element, "val") : null;
}

function parseNumericAttribute(element: Element, localName: string): number | null {
  const value = getWordAttribute(element, localName);

  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseToggleValue(value: string | null | undefined): boolean {
  const normalizedValue = value?.toLowerCase();

  return normalizedValue !== "false" && normalizedValue !== "0" && normalizedValue !== "off";
}

function getFirstDescendant(element: Element, localName: string): Element | null {
  return element.getElementsByTagNameNS(WORD_NAMESPACE, localName).item(0);
}

function getFirstDirectChild(element: Element, localName: string): Element | null {
  return Array.from(element.children).find(
    (child) => child.namespaceURI === WORD_NAMESPACE && child.localName === localName,
  ) ?? null;
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
