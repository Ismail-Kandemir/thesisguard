import comuBachelorRuleSet from "../../../data/universities/comu/bachelor.json";
import foodTechnologyBachelorRuleSet from "../../../data/universities/comu/faculties/applied-sciences/departments/food-technology/bachelor.json";
import type {
  RuleDefinition,
  RuleExpectedValue,
  UniversityRuleSet,
} from "../types";

interface LegacyRuleFile {
  metadata: {
    university: string;
    programLevel: string;
    version: string;
  };
  rules: RuleDefinition[];
}

const legacyComuBachelorRuleSet = comuBachelorRuleSet as LegacyRuleFile;
const comuFoodTechnologyBachelorRuleSet =
  foodTechnologyBachelorRuleSet as UniversityRuleSet;

export function loadRules(): RuleDefinition[] {
  return cloneRules(legacyComuBachelorRuleSet.rules);
}

export function loadRuleSets(
  ruleSets: readonly UniversityRuleSet[] = [adaptComuBachelorRuleSet()],
): UniversityRuleSet[] {
  return ruleSets.map(cloneRuleSet);
}

export function loadFoodTechnologyBachelorRuleSets(): UniversityRuleSet[] {
  return loadRuleSets([
    adaptComuBachelorRuleSet(),
    comuFoodTechnologyBachelorRuleSet,
  ]);
}

function adaptComuBachelorRuleSet(): UniversityRuleSet {
  const { metadata, rules } = legacyComuBachelorRuleSet;

  return {
    id: `${metadata.university}.${metadata.programLevel}`,
    metadata: {
      university: {
        id: metadata.university,
        name: "Çanakkale Onsekiz Mart Üniversitesi",
        slug: metadata.university,
      },
      thesisType: {
        id: metadata.programLevel,
        name: "Lisans",
        slug: metadata.programLevel,
      },
      version: metadata.version,
    },
    rules: cloneRules(rules),
  };
}

function cloneRuleSet(ruleSet: UniversityRuleSet): UniversityRuleSet {
  return {
    ...ruleSet,
    metadata: {
      ...ruleSet.metadata,
      university: { ...ruleSet.metadata.university },
      thesisType: { ...ruleSet.metadata.thesisType },
      faculty: ruleSet.metadata.faculty
        ? { ...ruleSet.metadata.faculty }
        : undefined,
      institute: ruleSet.metadata.institute
        ? { ...ruleSet.metadata.institute }
        : undefined,
      department: ruleSet.metadata.department
        ? { ...ruleSet.metadata.department }
        : undefined,
      program: ruleSet.metadata.program
        ? { ...ruleSet.metadata.program }
        : undefined,
    },
    extends: ruleSet.extends?.map((reference) => ({ ...reference })),
    rules: cloneRules(ruleSet.rules),
  };
}

function cloneRules(rules: readonly RuleDefinition[]): RuleDefinition[] {
  return rules.map((rule) => ({
    ...rule,
    expected: cloneExpected(rule.expected),
    scope: rule.scope ? { ...rule.scope } : undefined,
    overrides: rule.overrides?.map((override) => ({ ...override })),
  }));
}

function cloneExpected(expected: RuleExpectedValue): RuleExpectedValue {
  return typeof expected === "object" ? { ...expected } : expected;
}
