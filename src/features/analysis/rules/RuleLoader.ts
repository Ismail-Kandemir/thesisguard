import comuBachelorRuleSet from "../../../data/universities/comu/bachelor.json";
import type { RuleDefinition } from "../types";

export function loadRules(): RuleDefinition[] {
  const ruleSet = comuBachelorRuleSet as { rules: RuleDefinition[] };

  return [...ruleSet.rules];
}
