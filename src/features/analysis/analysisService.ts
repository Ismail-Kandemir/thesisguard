import { RuleEngine } from "./engine/RuleEngine";
import { parseDocumentXml } from "./parsers/documentXmlParser";
import { normalizeDocumentNumbering } from "./parsers/documentNumberingNormalizer";
import { parseNumberingXml } from "./parsers/numberingXmlParser";
import { normalizeDocumentAbbreviations } from "./parsers/documentAbbreviationsNormalizer";
import { parseHeaderFooterPageNumbering } from "./parsers/headerFooterXmlParser";
import { parseStylesXml } from "./parsers/stylesXmlParser";
import { parseThemeFontsXml } from "./parsers/themeFontsXmlParser";
import { normalizeDocumentObjectReferences } from "./parsers/documentObjectReferencesNormalizer";
import { normalizeDocumentHeadings } from "./parsers/documentHeadingsNormalizer";
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
  const { documentXml, stylesXml, numberingXml, themeXml, headerFooterXmlParts } =
    await readDocxAnalysisXmlParts(file);
  const normalizedDocument = parseDocumentXml(documentXml);
  const parsedStyles = stylesXml ? parseStylesXml(stylesXml) : null;

  const documentWithFormatting: NormalizedDocument = {
    ...normalizedDocument,
    styles: parsedStyles?.styles ?? [],
    documentDefaults: parsedStyles?.documentDefaults ?? normalizedDocument.documentDefaults,
    themeFonts: themeXml ? parseThemeFontsXml(themeXml) : null,
    numberingDefinitions: numberingXml ? parseNumberingXml(numberingXml) : [],
    pageNumbering: {
      ...parseHeaderFooterPageNumbering(headerFooterXmlParts),
      sections: normalizedDocument.pageNumbering.sections,
    },
  };

  const documentWithNumbering = normalizeDocumentNumbering(documentWithFormatting);

  return {
    ...documentWithNumbering,
    abbreviations: normalizeDocumentAbbreviations(documentWithNumbering),
    objectReferences: normalizeDocumentObjectReferences(documentWithNumbering),
  };
}

export async function analyzeDocx(
  file: File,
  selection?: Readonly<AcademicSelection>,
): Promise<AnalysisReport> {
  const normalizedDocument = await createNormalizedDocumentFromDocx(file);
  const ruleSets = selection
    ? new RuleSetSelector().select(selection)
    : loadRuleSets();
  const rules = new RuleResolver().resolve(ruleSets);
  const documentWithMarkedSectionHeadings = markRequiredSectionHeadings(
    normalizedDocument,
    rules,
  );
  const documentWithHeadingOccurrences = normalizeDocumentHeadings(
    documentWithMarkedSectionHeadings,
    rules,
  );
  const documentWithSectionHeadings: NormalizedDocument = {
    ...documentWithHeadingOccurrences,
    abbreviations: normalizeDocumentAbbreviations(
      documentWithHeadingOccurrences,
    ),
    objectReferences: normalizeDocumentObjectReferences(
      documentWithHeadingOccurrences,
    ),
  };
  const ruleEngine = new RuleEngine();
  const reportBuilder = new ReportBuilder();
  const results = ruleEngine.run(documentWithSectionHeadings, rules);

  return reportBuilder.build(results);
}
