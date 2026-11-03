import { readDocxAnalysisXmlParts, DocxPackageError } from "../../src/features/analysis/readers/docxPackageReader";
import { parseDocumentXml } from "../../src/features/analysis/parsers/documentXmlParser";
import { parseStylesXml } from "../../src/features/analysis/parsers/stylesXmlParser";
import { parseNumberingXml } from "../../src/features/analysis/parsers/numberingXmlParser";
import { parseThemeFontsXml } from "../../src/features/analysis/parsers/themeFontsXmlParser";
import { parseHeaderFooterPageNumbering } from "../../src/features/analysis/parsers/headerFooterXmlParser";
import { normalizePageNumberingSemantics } from "../../src/features/analysis/parsers/pageNumberingSemantics";
import { normalizeDocumentNumbering } from "../../src/features/analysis/parsers/documentNumberingNormalizer";
import { normalizeCoverSemantics } from "../../src/features/analysis/parsers/coverSemanticsNormalizer";
import { normalizeDocumentAbbreviations } from "../../src/features/analysis/parsers/documentAbbreviationsNormalizer";
import { normalizeDocumentObjectReferences } from "../../src/features/analysis/parsers/documentObjectReferencesNormalizer";
import { EffectiveFormattingResolver } from "../../src/features/analysis/parsers/effectiveFormattingResolver";
import { assertValidUploadFile } from "../../src/features/upload/utils";
import { RuleEngine } from "../../src/features/analysis/engine/RuleEngine";
import { ReportBuilder } from "../../src/features/analysis/report/ReportBuilder";
import type { AnalysisReport, DocxAnalysisXmlParts, NormalizedDocument, RuleDefinition } from "../../src/features/analysis/types";
import { evaluateAnalysisReadiness } from "./analysisReadinessGatePilot";
import { classifySectionEvidence, type SectionEvidence } from "./sectionEvidenceClassifier";

/** Test-only entry: neither handle contains caller-supplied XML or provenance. */
export interface BoundPackageRead {
  readonly package: Readonly<{ kind: "package-read" }>;
  readonly evidence: Readonly<{ kind: "package-evidence" }>;
}
type Context = { readonly kind: "available"; readonly document: NormalizedDocument;
  readonly documentXml: string; readonly evidence: SectionEvidence }
  | { readonly kind: "unavailable"; readonly reason: string };
export type BoundReadiness = { readonly decision: "ACCEPT" }
  | { readonly decision: "DEFER"; readonly reasons: readonly string[] };
export type BoundMarginResult = Extract<BoundReadiness, { decision: "DEFER" }>
  | { readonly decision: "ACCEPT"; readonly report: AnalysisReport };
const packages = new WeakMap<object, Context>();
const proofs = new WeakMap<object, Context>();

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Compose the SAME production normalization functions from the already-read
// parts. The regression compares this document with the public service oracle.
// Never call createNormalizedDocumentFromDocx here: that would read a second ZIP.
function normalize(parts: DocxAnalysisXmlParts): NormalizedDocument {
  const document = parseDocumentXml(parts.documentXml);
  const styles = parts.stylesXml ? parseStylesXml(parts.stylesXml) : null;
  const defaults = styles?.documentDefaults ?? document.documentDefaults;
  const theme = parts.themeXml ? parseThemeFontsXml(parts.themeXml) : null;
  const resolver = new EffectiveFormattingResolver(styles?.styles ?? [], defaults, theme);
  const formatted: NormalizedDocument = { ...document, styles: styles?.styles ?? [],
    documentDefaults: defaults, themeFonts: theme,
    numberingDefinitions: parts.numberingXml ? parseNumberingXml(parts.numberingXml) : [],
    pageNumbering: normalizePageNumberingSemantics({
      ...parseHeaderFooterPageNumbering(parts.headerFooterXmlParts,
        (style, alignment) => resolver.resolveParagraphAlignment(style, alignment)),
      sections: document.pageNumbering.sections,
    }, parts.documentRelationshipsXml),
  };
  const numbered = normalizeCoverSemantics(normalizeDocumentNumbering(formatted), parts.documentXml);
  return { ...numbered, abbreviations: normalizeDocumentAbbreviations(numbered),
    objectReferences: normalizeDocumentObjectReferences(numbered) };
}

/** One owned byte snapshot → one existing package-reader call → both outputs.
 * Runtime token identity, not names, hashes or declarations, binds the read.
 * This boundary assumes trusted module/runtime code; it is not a sandbox for
 * malicious monkey-patching of the reader/DOM/engine in this same process.
 */
export async function readBoundPackage(file: File | Uint8Array): Promise<BoundPackageRead> {
  let context: Context;
  try {
    const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const snapshot = new Uint8Array(bytes);
    const name = "name" in file && typeof file.name === "string" ? file.name : "bound-pilot.docx";
    Object.defineProperties(snapshot, { name: { value: name }, size: { value: snapshot.byteLength },
      type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
    // Reader's File declaration is a browser input type; its JSZip runtime also
    // accepts the Node Uint8Array adapter already used by the golden harness.
    const input = snapshot as unknown as File;
    assertValidUploadFile(input);
    const parts = await readDocxAnalysisXmlParts(input);
    if (typeof parts.documentXml !== "string" || parts.documentXml.trim() === "") {
      context = { kind: "unavailable", reason: "raw-evidence-unavailable" };
    } else {
      const document = normalize(parts);
      context = { kind: "available", document, documentXml: parts.documentXml,
        evidence: classifySectionEvidence(document, parts.documentXml) };
    }
  } catch (error: unknown) {
    context = { kind: "unavailable", reason: error instanceof DocxPackageError
      ? error.code === "DOCX_MISSING_DOCUMENT_XML" ? "raw-evidence-unavailable" : error.code
      : "evidence-processing-failed" };
  }
  freeze(context);
  const packageToken = Object.freeze({ kind: "package-read" as const });
  const evidenceToken = Object.freeze({ kind: "package-evidence" as const });
  packages.set(packageToken, context);
  proofs.set(evidenceToken, context);
  return Object.freeze({ package: packageToken, evidence: evidenceToken });
}

function lookup(packageToken: unknown, evidenceToken: unknown): Context | string {
  if (packageToken === null || typeof packageToken !== "object" || !packages.has(packageToken)) return "unregistered-package-read";
  if (evidenceToken === null || typeof evidenceToken !== "object" || !proofs.has(evidenceToken)) return "unregistered-evidence";
  const context = packages.get(packageToken);
  if (!context || context !== proofs.get(evidenceToken)) return "package-binding-mismatch";
  return context;
}

/** No raw/document arguments, optional fallback, hash override or import path. */
export function evaluateBoundReadiness(packageToken: unknown, evidenceToken: unknown,
  rules: readonly RuleDefinition[]): BoundReadiness {
  const context = lookup(packageToken, evidenceToken);
  if (typeof context === "string") return { decision: "DEFER", reasons: [context] };
  if (context.kind === "unavailable") return { decision: "DEFER", reasons: [context.reason] };
  const selected = rules.filter((rule) => rule.enabled);
  if (!selected.length || selected.some((rule) => rule.category !== "margin")) return { decision: "DEFER", reasons: ["margin-pilot-scope-required"] };
  const readiness = evaluateAnalysisReadiness(context.document, selected, undefined, context.documentXml);
  return readiness.kind === "ready" ? { decision: "ACCEPT" }
    : { decision: "DEFER", reasons: [...new Set(readiness.issues.map((issue) => issue.reason)), ...context.evidence.reasons] };
}

/** Margin-only pilot, not the full production analyzeDocx/report/UI service. */
export function runBoundMarginPilot(packageToken: unknown, evidenceToken: unknown,
  rules: readonly RuleDefinition[]): BoundMarginResult {
  const selected = freeze(structuredClone([...rules]));
  const decision = evaluateBoundReadiness(packageToken, evidenceToken, selected);
  if (decision.decision === "DEFER") return decision;
  const context = lookup(packageToken, evidenceToken);
  if (typeof context === "string" || context.kind !== "available") return { decision: "DEFER", reasons: ["package-binding-mismatch"] };
  return { decision: "ACCEPT", report: new ReportBuilder().build(new RuleEngine().run(context.document, selected)) };
}

/** Defensive inspection copy for parity/audit tests; never usable as a token. */
export function inspectBoundEvidence(packageToken: unknown, evidenceToken: unknown):
  { readonly document: NormalizedDocument; readonly evidence: SectionEvidence } | null {
  const context = lookup(packageToken, evidenceToken);
  return typeof context !== "string" && context.kind === "available"
    ? structuredClone({ document: context.document, evidence: context.evidence }) : null;
}
