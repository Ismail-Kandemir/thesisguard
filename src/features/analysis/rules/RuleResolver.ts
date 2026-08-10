import type {
  RuleDefinition,
  RuleExpectedValue,
  UniversityRuleSet,
} from "../types";

type VisitState = "visiting" | "visited";

export class RuleResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleResolutionError";
  }
}

export class RuleResolver {
  resolve(ruleSets: readonly UniversityRuleSet[]): RuleDefinition[] {
    const ruleSetsById = createRuleSetIndex(ruleSets);
    const orderedRuleSets = orderRuleSets(ruleSetsById);

    return resolveRules(orderedRuleSets);
  }
}

function createRuleSetIndex(
  ruleSets: readonly UniversityRuleSet[],
): ReadonlyMap<string, UniversityRuleSet> {
  const ruleSetsById = new Map<string, UniversityRuleSet>();

  for (const ruleSet of ruleSets) {
    if (ruleSetsById.has(ruleSet.id)) {
      throw new RuleResolutionError(
        `Aynı rule set ID birden fazla kez tanımlanmış: ${ruleSet.id}.`,
      );
    }

    ruleSetsById.set(ruleSet.id, ruleSet);
  }

  return ruleSetsById;
}

function orderRuleSets(
  ruleSetsById: ReadonlyMap<string, UniversityRuleSet>,
): UniversityRuleSet[] {
  const orderedRuleSets: UniversityRuleSet[] = [];
  const visitStates = new Map<string, VisitState>();
  const path: string[] = [];
  const candidates = Array.from(ruleSetsById.values()).sort(compareRuleSets);

  for (const ruleSet of candidates) {
    visitRuleSet(ruleSet, ruleSetsById, visitStates, path, orderedRuleSets);
  }

  return orderedRuleSets;
}

function visitRuleSet(
  ruleSet: UniversityRuleSet,
  ruleSetsById: ReadonlyMap<string, UniversityRuleSet>,
  visitStates: Map<string, VisitState>,
  path: string[],
  orderedRuleSets: UniversityRuleSet[],
): void {
  const state = visitStates.get(ruleSet.id);

  if (state === "visited") {
    return;
  }

  if (state === "visiting") {
    const cycleStart = path.indexOf(ruleSet.id);
    const cycle = [...path.slice(cycleStart), ruleSet.id].join(" -> ");

    throw new RuleResolutionError(`Rule set extends döngüsü tespit edildi: ${cycle}.`);
  }

  visitStates.set(ruleSet.id, "visiting");
  path.push(ruleSet.id);

  const parentRuleSets = (ruleSet.extends ?? [])
    .map((reference) => {
      const parent = ruleSetsById.get(reference.id);

      if (!parent) {
        throw new RuleResolutionError(
          `${ruleSet.id} rule set'i bulunamayan parent'a referans veriyor: ${reference.id}.`,
        );
      }

      return parent;
    })
    .sort(compareRuleSets);

  for (const parentRuleSet of parentRuleSets) {
    visitRuleSet(parentRuleSet, ruleSetsById, visitStates, path, orderedRuleSets);
  }

  path.pop();
  visitStates.set(ruleSet.id, "visited");
  orderedRuleSets.push(ruleSet);
}

function compareRuleSets(first: UniversityRuleSet, second: UniversityRuleSet): number {
  const specificityDifference = getSpecificity(first) - getSpecificity(second);

  return specificityDifference !== 0
    ? specificityDifference
    : first.id.localeCompare(second.id);
}

function getSpecificity(ruleSet: UniversityRuleSet): number {
  if (ruleSet.metadata.department || ruleSet.metadata.program) {
    return 2;
  }

  if (ruleSet.metadata.faculty || ruleSet.metadata.institute) {
    return 1;
  }

  return 0;
}

function resolveRules(orderedRuleSets: readonly UniversityRuleSet[]): RuleDefinition[] {
  const resolvedRules = new Map<string, RuleDefinition>();
  const encounteredRuleIds = new Set<string>();

  for (const ruleSet of orderedRuleSets) {
    for (const rule of ruleSet.rules) {
      if (encounteredRuleIds.has(rule.id)) {
        throw new RuleResolutionError(
          `Aynı rule ID birden fazla kez çözümlendi: ${rule.id}.`,
        );
      }

      encounteredRuleIds.add(rule.id);

      for (const override of rule.overrides ?? []) {
        resolvedRules.delete(override.ruleId);
      }

      resolvedRules.set(rule.id, cloneRule(rule));
    }
  }

  return Array.from(resolvedRules.values());
}

function cloneRule(rule: RuleDefinition): RuleDefinition {
  return {
    ...rule,
    expected: cloneExpected(rule.expected),
    scope: rule.scope ? { ...rule.scope } : undefined,
    overrides: rule.overrides?.map((override) => ({ ...override })),
  };
}

function cloneExpected(expected: RuleExpectedValue): RuleExpectedValue {
  return typeof expected === "object" ? { ...expected } : expected;
}
