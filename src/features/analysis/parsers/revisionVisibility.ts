const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const CURRENT_DOCUMENT_REVISION_VISIBILITY_BY_LOCAL_NAME = {
  del: "invisible",
  ins: "visible",
  moveFrom: "invisible",
  moveTo: "visible",
} as const;

export function isRunVisibleInCurrentDocument(runElement: Element): boolean {
  return getCurrentDocumentRevisionVisibility(runElement) === "visible";
}

export function isInsideInvisibleCurrentDocumentRevision(element: Element): boolean {
  return getCurrentDocumentRevisionVisibility(element) === "invisible";
}

function getCurrentDocumentRevisionVisibility(element: Element): "visible" | "invisible" {
  let current: Element | null = element;

  while (current) {
    if (current.namespaceURI === WORD_NAMESPACE) {
      const visibility = getRevisionElementVisibility(current.localName);

      if (visibility === "invisible") {
        return "invisible";
      }
    }

    current = current.parentElement;
  }

  return "visible";
}

function getRevisionElementVisibility(localName: string): "visible" | "invisible" | null {
  if (localName in CURRENT_DOCUMENT_REVISION_VISIBILITY_BY_LOCAL_NAME) {
    return CURRENT_DOCUMENT_REVISION_VISIBILITY_BY_LOCAL_NAME[
      localName as keyof typeof CURRENT_DOCUMENT_REVISION_VISIBILITY_BY_LOCAL_NAME
    ];
  }

  return null;
}
