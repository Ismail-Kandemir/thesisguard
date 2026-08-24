import type { FontSlotReference, RunFontFamilyReference } from "../types";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseRunFontFamilyReference(runProperties: Element | null): RunFontFamilyReference | null {
  const fonts = runProperties ? runProperties.getElementsByTagNameNS(WORD_NAMESPACE, "rFonts").item(0) : null;
  if (!fonts) return null;
  return {
    ascii: parseSlot(fonts, "ascii", "asciiTheme"),
    highAnsi: parseSlot(fonts, "hAnsi", "hAnsiTheme"),
    eastAsia: parseSlot(fonts, "eastAsia", "eastAsiaTheme"),
    complexScript: parseSlot(fonts, "cs", "cstheme"),
  };
}

export function getLegacyExplicitFont(reference: RunFontFamilyReference | null): string | null {
  for (const slot of [reference?.ascii, reference?.highAnsi, reference?.complexScript, reference?.eastAsia]) {
    if (slot?.kind === "explicit") return slot.value;
  }
  return null;
}

function parseSlot(fonts: Element, explicitName: string, themeName: string): FontSlotReference | null {
  const theme = normalize(fonts.getAttributeNS(WORD_NAMESPACE, themeName));
  if (theme) return { kind: "theme", value: theme };
  const explicit = normalize(fonts.getAttributeNS(WORD_NAMESPACE, explicitName));
  return explicit ? { kind: "explicit", value: explicit } : null;
}

function normalize(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
