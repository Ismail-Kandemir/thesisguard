import type { NormalizedDocument, Paragraph, Run } from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseDocumentXml(documentXml: string): NormalizedDocument {
  const xmlDocument = new DOMParser().parseFromString(documentXml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error("document.xml gecerli XML degil.");
  }

  return {
    paragraphs: parseParagraphs(xmlDocument),
  };
}

function parseParagraphs(xmlDocument: Document): Paragraph[] {
  return Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "p")).map(
    (paragraphElement, index) => {
      const runs = parseRuns(paragraphElement);

      return {
        id: `paragraph-${index + 1}`,
        text: runs.map((run) => run.text).join(""),
        runs,
      };
    },
  );
}

function parseRuns(paragraphElement: Element): Run[] {
  return Array.from(paragraphElement.getElementsByTagNameNS(WORD_NAMESPACE, "r"))
    .map(parseRun)
    .filter((run) => run.text.length > 0);
}

function parseRun(runElement: Element): Run {
  return {
    text: parseRunText(runElement),
    bold: hasRunProperty(runElement, "b"),
    italic: hasRunProperty(runElement, "i"),
    fontFamily: parseRunFontFamily(runElement),
  };
}

function parseRunText(runElement: Element): string {
  return Array.from(runElement.getElementsByTagNameNS(WORD_NAMESPACE, "t"))
    .map((textElement) => textElement.textContent ?? "")
    .join("");
}

function hasRunProperty(runElement: Element, propertyName: string): boolean {
  const runProperties = runElement.getElementsByTagNameNS(WORD_NAMESPACE, "rPr").item(0);

  if (!runProperties) {
    return false;
  }

  const property = runProperties.getElementsByTagNameNS(WORD_NAMESPACE, propertyName).item(0);

  if (!property) {
    return false;
  }

  return property.getAttributeNS(WORD_NAMESPACE, "val") !== "false";
}

function parseRunFontFamily(runElement: Element): string | undefined {
  const runProperties = runElement.getElementsByTagNameNS(WORD_NAMESPACE, "rPr").item(0);

  if (!runProperties) {
    return undefined;
  }

  const runFonts = runProperties.getElementsByTagNameNS(WORD_NAMESPACE, "rFonts").item(0);

  if (!runFonts) {
    return undefined;
  }

  return (
    runFonts.getAttributeNS(WORD_NAMESPACE, "ascii") ??
    runFonts.getAttributeNS(WORD_NAMESPACE, "hAnsi") ??
    runFonts.getAttributeNS(WORD_NAMESPACE, "cs") ??
    runFonts.getAttributeNS(WORD_NAMESPACE, "eastAsia") ??
    undefined
  );
}
