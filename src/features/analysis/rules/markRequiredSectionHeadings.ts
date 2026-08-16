import { normalizeSectionName } from "../parsers/documentSectionsParser";
import type {
  ConditionalRequiredSectionRuleExpected,
  NormalizedDocument,
  RequiredSectionRuleExpected,
  RuleDefinition,
} from "../types";

export function markRequiredSectionHeadings(
  document: NormalizedDocument,
  rules: readonly RuleDefinition[],
): NormalizedDocument {
  const requiredSectionNames = new Set(
    rules
      .filter(isRuleDefinedSectionRule)
      .flatMap((rule) => [
        rule.expected.section,
        ...(rule.expected.aliases ?? []),
      ])
      .map(normalizeSectionName),
  );

  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      isRuleDefinedHeading: requiredSectionNames.has(section.normalizedName),
    })),
  };
}

function isRuleDefinedSectionRule(
  rule: RuleDefinition,
): rule is RuleDefinition & {
  type: "CONDITIONAL_REQUIRED_SECTION" | "REQUIRED_SECTION";
  expected: ConditionalRequiredSectionRuleExpected | RequiredSectionRuleExpected;
} {
  return (
    rule.enabled &&
    (rule.type === "CONDITIONAL_REQUIRED_SECTION" ||
      rule.type === "REQUIRED_SECTION") &&
    typeof rule.expected === "object" &&
    rule.expected !== null &&
    "section" in rule.expected &&
    typeof rule.expected.section === "string"
  );
}
