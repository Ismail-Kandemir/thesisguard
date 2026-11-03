import { parseDocumentXml } from "../../src/features/analysis/parsers/documentXmlParser";
import { getSemanticChildElements, selectAlternateContentBranch } from "../../src/features/analysis/parsers/markupCompatibilityResolver";
import { isInsideInvisibleCurrentDocumentRevision } from "../../src/features/analysis/parsers/revisionVisibility";
import type { NormalizedDocument, PageMargins } from "../../src/features/analysis/types";

const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const math = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const compatibility = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const sides = ["top", "bottom", "left", "right"] as const;

export type SectionEvidenceReason =
  | "raw-evidence-unavailable" | "invalid-document-xml" | "body-unavailable"
  | "section-mapping-mismatch" | "section-placement-unverified"
  | "terminal-section-unverified" | "unsupported-section-carrier"
  | "unresolved-alternate-content" | "margin-element-unverified" | "margin-value-unavailable";

export interface SectionEvidence {
  readonly boundaries: "reliable" | "unverified";
  readonly marginEvidence: "complete" | "unavailable";
  readonly sectionCoverage: "closed" | "open";
  readonly reasons: readonly SectionEvidenceReason[];
  readonly sections: readonly {
    readonly index: number;
    readonly placement: "body" | "paragraph" | "unverified";
    readonly rawMargins: Readonly<Record<keyof PageMargins, string | null>>;
    readonly parsedMargins: Readonly<PageMargins> | null;
  }[];
  readonly text: {
    readonly generalExtraction: "closed" | "open" | "unknown";
    readonly equationElements: number;
    readonly unsupportedCarriers: readonly string[];
  };
}

/** Test-only structural audit, not an academic rule or a second numeric parser.
 * Margin numbers and section ranges remain production parser facts. Raw XML
 * independently binds their placement/uniqueness and carrier completeness.
 * Math/text extraction is descriptive; it never overrides a structural defect.
 */
export function classifySectionEvidence(document: NormalizedDocument, documentXml: string | null): SectionEvidence {
  const reasons = new Set<SectionEvidenceReason>();
  const sections: SectionEvidence["sections"][number][] = [];
  const carriers = new Set<string>();
  let equationElements = 0;
  let boundaries: SectionEvidence["boundaries"] = "unverified";
  let marginEvidence: SectionEvidence["marginEvidence"] = "unavailable";
  let sectionCoverage: SectionEvidence["sectionCoverage"] = "open";
  const result = (): SectionEvidence => ({ boundaries, marginEvidence, sectionCoverage,
    reasons: [...reasons], sections, text: {
      generalExtraction: document.sectionExtractionCoverage?.population ?? "unknown",
      equationElements, unsupportedCarriers: [...carriers],
    } });
  if (documentXml === null) { reasons.add("raw-evidence-unavailable"); return result(); }

  try {
    const xml = new DOMParser().parseFromString(documentXml, "application/xml");
    if (xml.querySelector("parsererror")) { reasons.add("invalid-document-xml"); return result(); }
    const roots = Array.from(xml.children);
    const root = roots[0];
    const bodies = root ? Array.from(root.children).filter((node) => node.namespaceURI === word && node.localName === "body") : [];
    if (roots.length !== 1 || root?.namespaceURI !== word || root.localName !== "document" || bodies.length !== 1) {
      reasons.add("body-unavailable"); return result();
    }
    const body = bodies[0];
    const activeSections: Element[] = [];
    const walk = (node: Element): void => {
      if (isInsideInvisibleCurrentDocumentRevision(node)) return;
      // Historical property snapshots do not establish current boundaries.
      if (node.namespaceURI === word && ["sectPrChange", "pPrChange"].includes(node.localName)) return;
      if (node.namespaceURI === word && ["altChunk", "subDoc", "contentPart"].includes(node.localName)) {
        carriers.add(node.localName); reasons.add("unsupported-section-carrier");
      }
      if (node.namespaceURI === math && ["oMath", "oMathPara"].includes(node.localName)) equationElements++;
      if (node.namespaceURI === word && node.localName === "sectPr") activeSections.push(node);
      // Reuse the parser's active MCE branch selection, not a parallel resolver.
      for (const child of Array.from(node.children)) {
        if (child.namespaceURI === compatibility && child.localName === "AlternateContent" && selectAlternateContentBranch(child) === null) {
          reasons.add("unresolved-alternate-content");
        }
      }
      getSemanticChildElements(node).forEach(walk);
    };
    walk(body);

    const parsed = parseDocumentXml(documentXml);
    const mappingValid = activeSections.length > 0 && activeSections.length === parsed.pageSections.length &&
      JSON.stringify(parsed.pageSections) === JSON.stringify(document.pageSections);
    if (!mappingValid) reasons.add("section-mapping-mismatch");

    const placement = (node: Element): "body" | "paragraph" | "unverified" => {
      if (node.parentElement === body) return "body";
      const properties = node.parentElement;
      const paragraph = properties?.parentElement;
      if (properties?.namespaceURI !== word || properties.localName !== "pPr" || paragraph?.namespaceURI !== word || paragraph.localName !== "p") return "unverified";
      if (Array.from(paragraph.children).filter((child) => child.namespaceURI === word && child.localName === "pPr").length !== 1 ||
        Array.from(properties.children).filter((child) => child.namespaceURI === word && child.localName === "sectPr").length !== 1) return "unverified";
      // Section breaks in tables, drawings, math or foreign wrappers cannot be
      // promoted to document-flow boundaries merely because a parser saw them.
      let ancestor = paragraph.parentElement;
      while (ancestor && ancestor !== body) {
        const flowWrapper = ancestor.namespaceURI === word && ["sdt", "sdtContent", "customXml", "ins", "moveTo"].includes(ancestor.localName);
        const selectedMceWrapper = ancestor.namespaceURI === compatibility && ["AlternateContent", "Choice", "Fallback"].includes(ancestor.localName);
        if (!flowWrapper && !selectedMceWrapper) return "unverified";
        ancestor = ancestor.parentElement;
      }
      return ancestor === body ? "paragraph" : "unverified";
    };

    for (const [index, node] of activeSections.entries()) {
      const source = placement(node);
      if (source === "unverified" || source !== parsed.pageSections[index]?.source) reasons.add("section-placement-unverified");
      const margins = Array.from(node.children).filter((child) => child.namespaceURI === word && child.localName === "pgMar");
      if (margins.length !== 1) reasons.add("margin-element-unverified");
      const rawMargins = Object.fromEntries(sides.map((side) => [side, margins.length === 1 ? margins[0].getAttributeNS(word, side) : null])) as Record<keyof PageMargins, string | null>;
      const parsedMargins = parsed.pageSections[index]?.pageMargins ?? null;
      if (sides.some((side) => rawMargins[side] === null || typeof parsedMargins?.[side] !== "number" || !Number.isFinite(parsedMargins[side]))) {
        reasons.add("margin-value-unavailable");
      }
      sections.push({ index, placement: source, rawMargins, parsedMargins });
    }
    const terminals = activeSections.filter((node) => node.parentElement === body);
    const activeBodyChildren = getSemanticChildElements(body).filter((node) => !isInsideInvisibleCurrentDocumentRevision(node));
    const terminalValid = terminals.length === 1 && activeSections.at(-1) === terminals[0] && activeBodyChildren.at(-1) === terminals[0];
    if (!terminalValid) reasons.add("terminal-section-unverified");
    boundaries = mappingValid && !reasons.has("section-placement-unverified") ? "reliable" : "unverified";
    marginEvidence = activeSections.length > 0 && !reasons.has("margin-element-unverified") && !reasons.has("margin-value-unavailable") ? "complete" : "unavailable";
    sectionCoverage = boundaries === "reliable" && terminalValid && !reasons.has("unsupported-section-carrier") &&
      !reasons.has("unresolved-alternate-content") ? "closed" : "open";
    return result();
  } catch {
    reasons.add("invalid-document-xml"); return result();
  }
}
