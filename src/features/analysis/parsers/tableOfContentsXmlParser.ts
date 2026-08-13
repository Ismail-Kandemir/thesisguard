import type {
  TableOfContents,
  TableOfContentsField,
} from "../types";

const WORD_NAMESPACE =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCUMENT_SOURCE_PATH = "word/document.xml";
const TOC_INSTRUCTION_PATTERN = /^TOC(?:\s|$)/i;

interface ComplexFieldState {
  instructionParts: string[];
  acceptingInstruction: boolean;
}

export function parseTableOfContents(
  xmlDocument: Document,
): TableOfContents {
  const fields = [
    ...parseSimpleFields(xmlDocument),
    ...parseComplexFields(xmlDocument),
  ];

  return {
    hasSection: hasTableOfContentsSection(xmlDocument),
    hasField: fields.length > 0,
    fields,
  };
}

function hasTableOfContentsSection(xmlDocument: Document): boolean {
  return Array.from(
    xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "p"),
  ).some((paragraph) => {
    const paragraphText = Array.from(
      paragraph.getElementsByTagNameNS(WORD_NAMESPACE, "t"),
    )
      .map((textElement) => textElement.textContent ?? "")
      .join("");

    return normalizeSectionTitle(paragraphText) === "icindekiler";
  });
}

function normalizeSectionTitle(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseSimpleFields(xmlDocument: Document): TableOfContentsField[] {
  return Array.from(
    xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "fldSimple"),
  ).flatMap((element) => {
    const instruction = normalizeInstruction(
      getWordAttribute(element, "instr") ?? "",
    );

    return isTocInstruction(instruction)
      ? [createTocField(instruction, "fldSimple")]
      : [];
  });
}

function parseComplexFields(xmlDocument: Document): TableOfContentsField[] {
  const fields: TableOfContentsField[] = [];
  const fieldStack: ComplexFieldState[] = [];
  const elements = Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "*"));

  for (const element of elements) {
    if (element.localName === "fldChar") {
      const fieldCharacterType = getWordAttribute(element, "fldCharType");

      if (fieldCharacterType === "begin") {
        fieldStack.push({
          instructionParts: [],
          acceptingInstruction: true,
        });
      } else if (fieldCharacterType === "separate") {
        const currentField = fieldStack.at(-1);

        if (currentField) {
          currentField.acceptingInstruction = false;
        }
      } else if (fieldCharacterType === "end") {
        const completedField = fieldStack.pop();

        if (!completedField) {
          continue;
        }

        const instruction = normalizeInstruction(
          completedField.instructionParts.join(""),
        );

        if (isTocInstruction(instruction)) {
          fields.push(createTocField(instruction, "complex"));
        }
      }

      continue;
    }

    if (element.localName !== "instrText") {
      continue;
    }

    const currentField = fieldStack.at(-1);

    if (currentField?.acceptingInstruction) {
      currentField.instructionParts.push(element.textContent ?? "");
    }
  }

  return fields;
}

function createTocField(
  instruction: string,
  structure: TableOfContentsField["structure"],
): TableOfContentsField {
  return {
    fieldType: "TOC",
    structure,
    instruction,
    sourcePath: DOCUMENT_SOURCE_PATH,
  };
}

function normalizeInstruction(instruction: string): string {
  return instruction.trim().replace(/\s+/g, " ");
}

function isTocInstruction(instruction: string): boolean {
  return TOC_INSTRUCTION_PATTERN.test(instruction);
}

function getWordAttribute(element: Element, localName: string): string | null {
  return element.getAttributeNS(WORD_NAMESPACE, localName);
}
