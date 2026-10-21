import type { AcademicSectionOccurrence, NormalizedDocument, Paragraph } from "../types";
import { StyleInheritanceResolver } from "./styleInheritanceResolver";

type HeadingProvenance = NonNullable<NonNullable<AcademicSectionOccurrence["structuralIdentity"]>["headingProvenance"]>;

/** Evidence for section assessment only; production heading discovery is unchanged. */
export function resolveHeadingStyleProvenance(
  document: Readonly<NormalizedDocument>,
  paragraph: Readonly<Paragraph>,
): HeadingProvenance {
  const styleId = paragraph.styleId ?? document.documentDefaults.defaultParagraphStyleId;
  const chain = styleId === null ? { styles: [], error: null }
    : new StyleInheritanceResolver(document.styles).resolveParagraphChain(styleId);
  const styleIds = chain.styles.map((style) => style.id);
  const result = (
    certainty: HeadingProvenance["certainty"], reason: string,
    level: number | null = null, source: HeadingProvenance["source"] = "none",
  ): HeadingProvenance => ({ certainty, reason, level, source, styleIds });
  if (chain.error) return result("unresolved", chain.error);
  if (chain.styles.some((style) => style.customStyle === null)) {
    return result("unresolved", "The style definition has invalid custom-style provenance.");
  }
  if (paragraph.outlineLevel === null || chain.styles.some((style) => style.outlineLevel === null)) {
    return result("unresolved", "Outline evidence is malformed or duplicated.");
  }
  const outlineStyle = chain.styles.find((style) => style.outlineLevel !== undefined);
  const outline = paragraph.outlineLevel ?? outlineStyle?.outlineLevel;
  const source = paragraph.outlineLevel !== undefined ? "paragraph-outline" : "style-outline";
  // A display name is never independent positive evidence. Only complete,
  // paragraph-typed inheritance reaching a canonical heading ID can supply it.
  const headingLevels: number[] = [];
  for (const style of chain.styles) {
    if (style.customStyle === true) continue;
    const id = /^heading([1-9])$/i.exec(style.id);
    if (!id) continue;
    const level = Number(id[1]) - 1;
    const name = /^heading\s*([1-9])$/i.exec(style.name ?? "");
    if (name && Number(name[1]) - 1 !== level) {
      return result("ambiguous", "Canonical heading style ID and name disagree.");
    }
    headingLevels.push(level);
  }
  if (new Set(headingLevels).size > 1) {
    return result("ambiguous", "The style chain contains conflicting canonical heading identities.");
  }
  const styleLevel = headingLevels[0];
  if (outline !== undefined) {
    if (styleLevel !== undefined && outline !== styleLevel) {
      return result("ambiguous", "Effective outline and canonical heading style disagree.", null, source);
    }
    if (outline === 9) return result("non-heading", "Outline level 9 explicitly supplies no heading level.", null, source);
    return result("confirmed", "Heading level is supported by effective OOXML outline evidence.", outline, source);
  }
  return styleLevel !== undefined
    ? result("confirmed", "A complete paragraph style chain supplies canonical heading semantics.", styleLevel, "heading-style")
    : result("non-heading", "No independent outline or canonical heading style evidence is available.");
}
