import { RuleEngine } from "./engine/RuleEngine";
import { parseDocumentXml } from "./parsers/documentXmlParser";
import { parseStylesXml } from "./parsers/stylesXmlParser";
import { readDocxAnalysisXmlParts } from "./readers/docxPackageReader";
import { loadRules } from "./rules/RuleLoader";
import type { NormalizedDocument, RuleResult } from "./types";

export async function createNormalizedDocumentFromDocx(file: File): Promise<NormalizedDocument> {
  const { documentXml, stylesXml } = await readDocxAnalysisXmlParts(file);
  const normalizedDocument = parseDocumentXml(documentXml);

  return {
    ...normalizedDocument,
    styles: stylesXml ? parseStylesXml(stylesXml) : [],
  };
}

export async function analyzeDocxWithRuleEngine(file: File): Promise<RuleResult[]> {
  const normalizedDocument = await createNormalizedDocumentFromDocx(file);
  const rules = loadRules();
  const ruleEngine = new RuleEngine();

  return ruleEngine.run(normalizedDocument, rules);
}
