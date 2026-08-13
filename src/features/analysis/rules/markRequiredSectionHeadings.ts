import { normalizeSectionName } from "../parsers/documentSectionsParser";
import type {
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
      .filter(isRequiredSectionRule)
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

function isRequiredSectionRule(
  rule: RuleDefinition,
): rule is RuleDefinition & {
  type: "REQUIRED_SECTION";
  expected: RequiredSectionRuleExpected;
} {
  return (
    rule.enabled &&
    rule.type === "REQUIRED_SECTION" &&
    typeof rule.expected === "object" &&
    "section" in rule.expected &&
    typeof rule.expected.section === "string"
  );
}
