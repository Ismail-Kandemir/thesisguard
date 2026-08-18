import type {
  NormalizedDocument,
  RequiredSectionRuleExpected,
  RuleDefinition,
  RuleResult,
} from "../../types";
import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import type { RuleValidator } from "./RuleValidator";

export class RequiredSectionValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRequiredSectionRule(rule);
    const expected = getRequiredSectionExpected(rule.expected);
    const expectedNames = [expected.section, ...(expected.aliases ?? [])];
    const hasSection = document.sections.some((section) =>
      sectionMatchesAnyExpectedName(section, expectedNames),
    );
    const passed = !expected.required || hasSection;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expected.required
        ? `${expected.section} bölümü bulunmalı`
        : `${expected.section} bölümü zorunlu değil`,
      actual: hasSection ? "Bulundu" : "Tespit edilmedi",
      message: passed
        ? hasSection
          ? `${expected.section} bölümü bulundu.`
          : `${expected.section} bölümü zorunlu değil.`
        : `${expected.section} bölümü tespit edilemedi.`,
    };
  }
}

function assertRequiredSectionRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "REQUIRED_SECTION" } {
  if (rule.type !== "REQUIRED_SECTION") {
    throw new Error(
      "RequiredSectionValidator yalnızca REQUIRED_SECTION tipindeki kuralları çalıştırır.",
    );
  }
}

function getRequiredSectionExpected(
  expected: RuleDefinition["expected"],
): RequiredSectionRuleExpected {
  if (
    typeof expected !== "object" ||
    !("section" in expected) ||
    typeof expected.section !== "string" ||
    expected.section.trim().length === 0 ||
    !("required" in expected) ||
    typeof expected.required !== "boolean" ||
    ("aliases" in expected &&
      (expected.aliases === undefined ||
        !Array.isArray(expected.aliases) ||
        !expected.aliases.every((alias) => typeof alias === "string")))
  ) {
    throw new Error(
      "REQUIRED_SECTION kuralı section, optional aliases ve boolean required değerlerini içermelidir.",
    );
  }

  return expected;
}
