const MARKUP_COMPATIBILITY_NAMESPACE =
  "http://schemas.openxmlformats.org/markup-compatibility/2006";
const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WORDPROCESSING_DRAWING_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const DRAWINGML_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PICTURE_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const WORDPROCESSING_SHAPE_NAMESPACE =
  "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";
const VML_NAMESPACE = "urn:schemas-microsoft-com:vml";

export const SUPPORTED_MCE_REQUIRED_NAMESPACES = new Set<string>([
  WORD_NAMESPACE,
  WORDPROCESSING_DRAWING_NAMESPACE,
  DRAWINGML_NAMESPACE,
  PICTURE_NAMESPACE,
  WORDPROCESSING_SHAPE_NAMESPACE,
  VML_NAMESPACE,
]);

export function getSemanticDescendantsByTagNameNS(
  root: Element | Document,
  namespaceURI: string,
  localName: string,
): Element[] {
  const matches: Element[] = [];

  for (const child of getSemanticChildElements(root)) {
    collectSemanticDescendants(child, namespaceURI, localName, matches);
  }

  return matches;
}

export function getSemanticChildElements(root: Element | Document): Element[] {
  return Array.from(root.children).flatMap((child) => {
    if (isAlternateContentElement(child)) {
      const selectedBranch = selectAlternateContentBranch(child);
      return selectedBranch ? getSemanticChildElements(selectedBranch) : [];
    }

    if (isAlternateContentBranchElement(child)) {
      return [];
    }

    return [child];
  });
}

function collectSemanticDescendants(
  element: Element,
  namespaceURI: string,
  localName: string,
  matches: Element[],
): void {
  if (
    (namespaceURI === "*" || element.namespaceURI === namespaceURI) &&
    (localName === "*" || element.localName === localName)
  ) {
    matches.push(element);
  }

  for (const child of getSemanticChildElements(element)) {
    collectSemanticDescendants(child, namespaceURI, localName, matches);
  }
}

function selectAlternateContentBranch(alternateContent: Element): Element | null {
  const choices = Array.from(alternateContent.children).filter(isChoiceElement);
  const supportedChoice = choices.find(isSupportedChoice);

  if (supportedChoice) {
    return supportedChoice;
  }

  return Array.from(alternateContent.children).find(isFallbackElement) ?? null;
}

function isSupportedChoice(choice: Element): boolean {
  const requires = choice.getAttribute("Requires")?.trim();

  if (!requires) {
    return false;
  }

  return requires
    .split(/\s+/)
    .every((prefix) => {
      const namespaceURI = resolveNamespacePrefix(choice, prefix);
      return namespaceURI !== null && SUPPORTED_MCE_REQUIRED_NAMESPACES.has(namespaceURI);
    });
}

function resolveNamespacePrefix(element: Element, prefix: string): string | null {
  if (prefix.length === 0) {
    return null;
  }

  const standardResolved = element.lookupNamespaceURI?.(prefix) ?? null;

  if (standardResolved) {
    return standardResolved;
  }

  let current: Element | null = element;

  while (current) {
    const namespaceDeclaration = current.getAttribute(`xmlns:${prefix}`);

    if (namespaceDeclaration) {
      return namespaceDeclaration;
    }

    current = current.parentElement;
  }

  return null;
}

function isAlternateContentElement(element: Element): boolean {
  return element.namespaceURI === MARKUP_COMPATIBILITY_NAMESPACE &&
    element.localName === "AlternateContent";
}

function isAlternateContentBranchElement(element: Element): boolean {
  return isChoiceElement(element) || isFallbackElement(element);
}

function isChoiceElement(element: Element): boolean {
  return element.namespaceURI === MARKUP_COMPATIBILITY_NAMESPACE &&
    element.localName === "Choice";
}

function isFallbackElement(element: Element): boolean {
  return element.namespaceURI === MARKUP_COMPATIBILITY_NAMESPACE &&
    element.localName === "Fallback";
}
