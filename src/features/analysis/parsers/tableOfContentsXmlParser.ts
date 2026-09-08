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
  phase: "instruction" | "result";
  isTableOfContents: boolean;
  resultParagraphElements: Set<Element>;
}

interface TableOfContentsAnalysis {
  tableOfContents: TableOfContents;
  resultParagraphElements: Set<Element>;
}

export function parseTableOfContents(
  xmlDocument: Document,
): TableOfContents {
  return analyzeTableOfContentsFields(xmlDocument).tableOfContents;
}

export function analyzeTableOfContentsFields(
  xmlDocument: Document,
): TableOfContentsAnalysis {
  const fields: TableOfContentsField[] = [];
  const resultParagraphElements = new Set<Element>();
  const fieldStack: ComplexFieldState[] = [];
  const elements = Array.from(xmlDocument.getElementsByTagNameNS(WORD_NAMESPACE, "*"));

  for (const element of elements) {
    if (element.localName === "fldSimple") {
      const instruction = normalizeInstruction(getWordAttribute(element, "instr") ?? "");

      if (isTocInstruction(instruction)) {
        fields.push(createTocField(instruction, "fldSimple"));
      }

      continue;
    }

    if (element.localName === "fldChar") {
      analyzeFieldCharacter(element, fieldStack, fields, resultParagraphElements);
      continue;
    }

    if (element.localName === "instrText") {
      const currentField = fieldStack.at(-1);

      if (currentField?.phase === "instruction" && !hasAncestor(element, "fldSimple")) {
        currentField.instructionParts.push(element.textContent ?? "");
      }

      continue;
    }

    if (element.localName === "t" && (element.textContent ?? "").length > 0) {
      const paragraphElement = findAncestor(element, "p");

      if (!paragraphElement) {
        continue;
      }

      for (const field of fieldStack) {
        if (field.phase === "result" && field.isTableOfContents) {
          field.resultParagraphElements.add(paragraphElement);
        }
      }
    }
  }

  return {
    tableOfContents: {
      hasField: fields.length > 0,
      fields,
    },
    resultParagraphElements,
  };
}

function analyzeFieldCharacter(
  element: Element,
  fieldStack: ComplexFieldState[],
  fields: TableOfContentsField[],
  resultParagraphElements: Set<Element>,
): void {
  const fieldCharacterType = getWordAttribute(element, "fldCharType");

  if (fieldCharacterType === "begin") {
    fieldStack.push({
      instructionParts: [],
      phase: "instruction",
      isTableOfContents: false,
      resultParagraphElements: new Set<Element>(),
    });
    return;
  }

  const currentField = fieldStack.at(-1);

  if (fieldCharacterType === "separate") {
    if (currentField?.phase === "instruction") {
      currentField.phase = "result";
      currentField.isTableOfContents = isTocInstruction(
        normalizeInstruction(currentField.instructionParts.join("")),
      );
    }
    return;
  }

  if (fieldCharacterType !== "end" || !currentField) {
    return;
  }

  const completedField = fieldStack.pop();

  if (!completedField) {
    return;
  }

  const instruction = normalizeInstruction(completedField.instructionParts.join(""));

  if (!isTocInstruction(instruction)) {
    return;
  }

  fields.push(createTocField(instruction, "complex"));

  if (completedField.phase === "result" && completedField.isTableOfContents) {
    for (const paragraphElement of completedField.resultParagraphElements) {
      resultParagraphElements.add(paragraphElement);
    }
  }
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

function hasAncestor(element: Element, localName: string): boolean {
  return findAncestor(element, localName) !== null;
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
