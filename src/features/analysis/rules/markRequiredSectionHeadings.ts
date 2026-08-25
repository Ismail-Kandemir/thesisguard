import { sectionMatchesAnyExpectedName } from "../parsers/sectionNameMatcher";
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
  const captionParagraphIds = new Set(
    document.captions.items.map((caption) => caption.paragraphId),
  );
  const requiredSectionNames = rules
    .filter(isRuleDefinedSectionRule)
    .flatMap((rule) => [
      rule.expected.section,
      ...(rule.expected.aliases ?? []),
    ]);
  const objectReferenceExcludedNames = rules
    .filter(isObjectReferenceExcludedSectionRule)
    .flatMap((rule) => [rule.expected.section, ...(rule.expected.aliases ?? [])]);

  return {
    ...document,
    sections: document.sections
      .filter((section) => !captionParagraphIds.has(section.paragraphId))
      .map((section) => ({
        ...section,
        isRuleDefinedHeading: sectionMatchesAnyExpectedName(
          section,
          requiredSectionNames,
        ),
        isObjectReferenceExcluded: sectionMatchesAnyExpectedName(
          section,
          objectReferenceExcludedNames,
        ),
      })),
  };
}

function isObjectReferenceExcludedSectionRule(
  rule: RuleDefinition,
): rule is RuleDefinition & {
  type: "CONDITIONAL_REQUIRED_SECTION";
  expected: ConditionalRequiredSectionRuleExpected;
} {
  return (
    rule.enabled &&
    rule.type === "CONDITIONAL_REQUIRED_SECTION" &&
    typeof rule.expected === "object" &&
    rule.expected !== null &&
    "section" in rule.expected &&
    "requiredWhen" in rule.expected &&
    (rule.expected.requiredWhen.fact === "hasTables" ||
      rule.expected.requiredWhen.fact === "hasFigures")
  );
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
