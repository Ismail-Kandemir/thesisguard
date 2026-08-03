import comuBachelorRuleSet from "../../data/universities/comu/bachelor.json";
import { RuleEngine } from "./engine/RuleEngine";
import { parseDocumentXml } from "./parsers/documentXmlParser";
import { readDocxDocumentXml } from "./readers/docxPackageReader";
import type { NormalizedDocument, RuleDefinition, RuleResult } from "./types";

const FONT_FAMILY_RULE_ID = "comu.bachelor.typography.font-family";

export async function createNormalizedDocumentFromDocx(file: File): Promise<NormalizedDocument> {
  const documentXml = await readDocxDocumentXml(file);

  return parseDocumentXml(documentXml);
}

export async function analyzeDocxWithRuleEngine(file: File): Promise<RuleResult[]> {
  const normalizedDocument = await createNormalizedDocumentFromDocx(file);
  const ruleEngine = new RuleEngine();

  return ruleEngine.run(normalizedDocument, getEnabledProofOfConceptRules());
}

function getEnabledProofOfConceptRules(): RuleDefinition[] {
  const ruleSet = comuBachelorRuleSet as { rules: RuleDefinition[] };

  return ruleSet.rules.filter((rule) => rule.id === FONT_FAMILY_RULE_ID);
}
