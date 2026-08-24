import type { DocumentThemeFonts, ThemeFontFamily } from "../types";

const DRAWING_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main";

export function parseThemeFontsXml(themeXml: string): DocumentThemeFonts | null {
  const document = new DOMParser().parseFromString(themeXml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("theme XML geçerli değil.");
  const scheme = document.getElementsByTagNameNS(DRAWING_NAMESPACE, "fontScheme").item(0);
  if (!scheme) return null;
  const major = scheme.getElementsByTagNameNS(DRAWING_NAMESPACE, "majorFont").item(0);
  const minor = scheme.getElementsByTagNameNS(DRAWING_NAMESPACE, "minorFont").item(0);
  return major && minor ? { major: parseFamily(major), minor: parseFamily(minor) } : null;
}

function parseFamily(element: Element): ThemeFontFamily {
  return {
    latin: typeface(element, "latin"),
    eastAsia: typeface(element, "ea"),
    complexScript: typeface(element, "cs"),
    scriptOverrides: Object.fromEntries(
      Array.from(element.getElementsByTagNameNS(DRAWING_NAMESPACE, "font")).flatMap((font) => {
        const script = font.getAttribute("script")?.trim();
        const value = font.getAttribute("typeface")?.trim();
        return script && value ? [[script, value]] : [];
      }),
    ),
  };
}

function typeface(parent: Element, name: string): string | null {
  const value = parent.getElementsByTagNameNS(DRAWING_NAMESPACE, name).item(0)?.getAttribute("typeface")?.trim() ?? "";
  return value.length > 0 ? value : null;
}
