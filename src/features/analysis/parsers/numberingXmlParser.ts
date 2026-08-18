import type {
  NumberingDefinition,
  NumberingLevelDefinition,
} from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseNumberingXml(numberingXml: string): NumberingDefinition[] {
  const xmlDocument = new DOMParser().parseFromString(numberingXml, "application/xml");

  if (xmlDocument.querySelector("parsererror")) {
    throw new Error("numbering.xml gecerli XML degil.");
  }

  const abstractDefinitions = new Map(
    Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "abstractNum"))
      .map(parseAbstractDefinition)
      .filter(
        (entry): entry is readonly [string, NumberingLevelDefinition[]] => entry !== null,
      ),
  );

  return Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "num")).flatMap(
    (numberingElement) => {
      const numId = getWordAttribute(numberingElement, "numId");
      const abstractNumId = getChildValue(numberingElement, "abstractNumId");
      const levels = abstractNumId ? abstractDefinitions.get(abstractNumId) : undefined;

      return numId && abstractNumId && levels
        ? [{ numId, abstractNumId, levels: levels.map((level) => ({ ...level })) }]
        : [];
    },
  );
}

function parseAbstractDefinition(
  element: Element,
): readonly [string, NumberingLevelDefinition[]] | null {
  const abstractNumId = getWordAttribute(element, "abstractNumId");

  if (!abstractNumId) {
    return null;
  }

  const levels = Array.from(element.children)
    .filter((child) => child.localName === "lvl")
    .map(parseLevel)
    .filter((level): level is NumberingLevelDefinition => level !== null);

  return [abstractNumId, levels];
}

function parseLevel(element: Element): NumberingLevelDefinition | null {
  const levelValue = getWordAttribute(element, "ilvl");
  const format = getChildValue(element, "numFmt");
  const levelText = getChildValue(element, "lvlText");
  const startValue = getChildValue(element, "start") ?? "1";
  const level = levelValue === null ? Number.NaN : Number(levelValue);
  const start = Number(startValue);

  return Number.isInteger(level) && level >= 0 && format && levelText && Number.isInteger(start)
    ? { level, format, levelText, start }
    : null;
}

function getChildValue(element: Element, localName: string): string | null {
  const child = Array.from(element.children).find((candidate) => candidate.localName === localName);

  return child ? getWordAttribute(child, "val") : null;
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
