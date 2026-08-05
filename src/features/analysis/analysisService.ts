import { RuleEngine } from "./engine/RuleEngine";
import { parseDocumentXml } from "./parsers/documentXmlParser";
import { parseStylesXml } from "./parsers/stylesXmlParser";
import { readDocxAnalysisXmlParts } from "./readers/docxPackageReader";
import { ReportBuilder } from "./report/ReportBuilder";
import { loadRules } from "./rules/RuleLoader";
import type { AnalysisReport, NormalizedDocument } from "./types";

export async function createNormalizedDocumentFromDocx(file: File): Promise<NormalizedDocument> {
  const { documentXml, stylesXml } = await readDocxAnalysisXmlParts(file);
  const normalizedDocument = parseDocumentXml(documentXml);
  const parsedStyles = stylesXml ? parseStylesXml(stylesXml) : null;

  return {
    ...normalizedDocument,
    styles: parsedStyles?.styles ?? [],
    documentDefaults: parsedStyles?.documentDefaults ?? normalizedDocument.documentDefaults,
  };
}

export async function analyzeDocx(file: File): Promise<AnalysisReport> {
  const normalizedDocument = await createNormalizedDocumentFromDocx(file);
  const rules = loadRules();
  const ruleEngine = new RuleEngine();
  const reportBuilder = new ReportBuilder();
  const results = ruleEngine.run(normalizedDocument, rules);

  return reportBuilder.build(results);
}
