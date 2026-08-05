import type {
  DocumentDefaults,
  ParagraphAlignment,
  StyleDefinition,
} from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

interface StyleProperties {
  fontFamily: string | null;
  fontSize: number | null;
  bold: boolean | null;
  italic: boolean | null;
  underline: boolean | null;
  lineSpacing: number | null;
  alignment: ParagraphAlignment | null;
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
    fontSize: parseFontSize(runProperties),
    lineSpacing: parseSpacing(paragraphProperties),
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
    name: parseElementValue(styleElement, "name"),
    basedOn: parseElementValue(styleElement, "basedOn"),
    nextStyle: parseElementValue(styleElement, "next"),
    ...parseStyleProperties(styleElement),
  };
}

function parseStyleProperties(styleElement: Element): StyleProperties {
  const runProperties = getFirstDescendant(styleElement, "rPr");
  const paragraphProperties = getFirstDescendant(styleElement, "pPr");

  return {
    fontFamily: parseFont(runProperties),
    fontSize: parseFontSize(runProperties),
    bold: parseToggleProperty(runProperties, "b"),
    italic: parseToggleProperty(runProperties, "i"),
    underline: parseUnderline(runProperties),
    lineSpacing: parseSpacing(paragraphProperties),
    alignment: parseAlignment(paragraphProperties),
  };
}

function parseFont(runProperties: Element | null): string | null {
  const fontsElement = runProperties ? getFirstDescendant(runProperties, "rFonts") : null;

  if (!fontsElement) {
    return null;
  }

  return (
    getWordAttribute(fontsElement, "ascii") ??
    getWordAttribute(fontsElement, "hAnsi") ??
    getWordAttribute(fontsElement, "cs") ??
    getWordAttribute(fontsElement, "eastAsia")
  );
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

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
