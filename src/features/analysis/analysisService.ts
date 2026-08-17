import { RuleEngine } from "./engine/RuleEngine";
import { parseDocumentXml } from "./parsers/documentXmlParser";
import { normalizeDocumentAbbreviations } from "./parsers/documentAbbreviationsNormalizer";
import { parseHeaderFooterPageNumbering } from "./parsers/headerFooterXmlParser";
import { EffectiveFormattingResolver } from "./parsers/effectiveFormattingResolver";
import { parseStylesXml } from "./parsers/stylesXmlParser";
import { readDocxAnalysisXmlParts } from "./readers/docxPackageReader";
import { ReportBuilder } from "./report/ReportBuilder";
import { loadRuleSets } from "./rules/RuleLoader";
import { RuleResolver } from "./rules/RuleResolver";
import { RuleSetSelector } from "./rules/RuleSetSelector";
import { markRequiredSectionHeadings } from "./rules/markRequiredSectionHeadings";
import type {
  AcademicSelection,
  AnalysisReport,
  NormalizedDocument,
} from "./types";

export async function createNormalizedDocumentFromDocx(file: File): Promise<NormalizedDocument> {
  const { documentXml, stylesXml, headerFooterXmlParts } =
    await readDocxAnalysisXmlParts(file);
  const normalizedDocument = parseDocumentXml(documentXml);
  const parsedStyles = stylesXml ? parseStylesXml(stylesXml) : null;

  const documentWithFormatting: NormalizedDocument = {
    ...normalizedDocument,
    styles: parsedStyles?.styles ?? [],
    documentDefaults: parsedStyles?.documentDefaults ?? normalizedDocument.documentDefaults,
    pageNumbering: parseHeaderFooterPageNumbering(headerFooterXmlParts),
  };

  return {
    ...documentWithFormatting,
    abbreviations: normalizeDocumentAbbreviations(documentWithFormatting),
  };
}

export async function analyzeDocx(
  file: File,
  selection?: Readonly<AcademicSelection>,
): Promise<AnalysisReport> {
  const normalizedDocument = await createNormalizedDocumentFromDocx(file);
  logParserDebugData(normalizedDocument);
  const ruleSets = selection
    ? new RuleSetSelector().select(selection)
    : loadRuleSets();
  const rules = new RuleResolver().resolve(ruleSets);
  const documentWithMarkedSectionHeadings = markRequiredSectionHeadings(
    normalizedDocument,
    rules,
  );
  const documentWithSectionHeadings: NormalizedDocument = {
    ...documentWithMarkedSectionHeadings,
    abbreviations: normalizeDocumentAbbreviations(
      documentWithMarkedSectionHeadings,
    ),
  };
  const ruleEngine = new RuleEngine();
  const reportBuilder = new ReportBuilder();
  const results = ruleEngine.run(documentWithSectionHeadings, rules);

  return reportBuilder.build(results);
}

function logParserDebugData(document: NormalizedDocument): void {
  console.table(createParagraphDebugRows(document));
  console.table(createRunDebugRows(document));
  console.table([document.documentDefaults]);
  console.table(createEffectiveFormattingDebugRows(document));
}

function createParagraphDebugRows(document: NormalizedDocument) {
  const stylesById = new Map(document.styles.map((style) => [style.id, style]));

  return document.paragraphs.map((paragraph) => ({
    paragraphId: paragraph.id,
    styleId: paragraph.styleId,
    alignment: paragraph.alignment,
    lineSpacing: paragraph.styleId
      ? stylesById.get(paragraph.styleId)?.lineSpacing ?? null
      : null,
  }));
}

function createRunDebugRows(document: NormalizedDocument) {
  return document.paragraphs.flatMap((paragraph) =>
    paragraph.runs.map((run, runIndex) => ({
      paragraphId: paragraph.id,
      runIndex,
      text: run.text,
      fontFamily: run.fontFamily,
      fontSize: run.fontSize,
    })),
  );
}

function createEffectiveFormattingDebugRows(document: NormalizedDocument) {
  const resolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
  );

  return document.paragraphs.flatMap((paragraph) =>
    paragraph.runs.map((run, runIndex) => {
      const effectiveFormatting = resolver.resolveRun(
        run,
        paragraph.styleId,
        paragraph.lineSpacing,
      );

      return {
        paragraphId: paragraph.id,
        runIndex,
        fontFamily: effectiveFormatting.fontFamily,
        fontSize: effectiveFormatting.fontSize,
        lineSpacing: effectiveFormatting.lineSpacing,
      };
    }),
  );
}
