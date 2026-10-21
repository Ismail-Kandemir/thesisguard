const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Preserve absence, invalid evidence and explicit body-text level separately. */
export function parseOutlineLevel(properties: Element | null): number | null | undefined {
  const elements = Array.from(properties?.children ?? []).filter((element) =>
    element.namespaceURI === WORD_NAMESPACE && element.localName === "outlineLvl");
  if (elements.length === 0) return undefined;
  if (elements.length !== 1) return null;
  const raw = elements[0].getAttributeNS(WORD_NAMESPACE, "val")?.trim();
  if (!raw || !/^[+-]?\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 9 ? value : null;
}
