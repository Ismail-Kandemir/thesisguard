import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import {
  evaluateDocumentCondition,
  getDocumentFactValue,
  isSupportedDocumentFact,
} from "../documentFactEvaluator";
import type {
  ConditionalRequiredSectionFact,
  ConditionalRequiredSectionRuleExpected,
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

const FACT_LABELS: Record<ConditionalRequiredSectionFact, string> = {
  hasTables: "tablo",
  hasFigures: "şekil",
  hasAbbreviations: "kısaltma",
};

export class ConditionalRequiredSectionValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertConditionalRequiredSectionRule(rule);
    const expected = getConditionalRequiredSectionExpected(rule.expected);
    const conditionMet = evaluateDocumentCondition(
      document,
      expected.requiredWhen,
    );
    const hasSection = hasExpectedSection(document, expected);

    if (!conditionMet) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        createNotApplicableMessage(document, expected),
      );
    }

    return createResult(
      rule,
      expected,
      hasSection ? "PASSED" : "FAILED",
      hasSection ? "Bulundu" : "Tespit edilmedi",
      hasSection
        ? `${expected.section} bölümü bulundu.`
        : `Belgede ${getFactLabel(expected.requiredWhen.fact)} bulunduğu için ${expected.section} bölümü bulunmalıdır.`,
    );
  }
}

function assertConditionalRequiredSectionRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & {
  type: "CONDITIONAL_REQUIRED_SECTION";
} {
  if (rule.type !== "CONDITIONAL_REQUIRED_SECTION") {
    throw new Error(
      "ConditionalRequiredSectionValidator yalnızca CONDITIONAL_REQUIRED_SECTION tipindeki kuralları çalıştırır.",
    );
  }
}

function getConditionalRequiredSectionExpected(
  expected: RuleDefinition["expected"],
): ConditionalRequiredSectionRuleExpected {
  if (!isConditionalRequiredSectionExpected(expected)) {
    throw new Error(
      "CONDITIONAL_REQUIRED_SECTION kuralı geçerli section, optional aliases ve supported fact ile boolean equals içeren requiredWhen tanımlamalıdır.",
    );
  }

  return expected;
}

function isConditionalRequiredSectionExpected(
  value: RuleDefinition["expected"],
): value is ConditionalRequiredSectionRuleExpected {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    section?: unknown;
    aliases?: unknown;
    requiredWhen?: unknown;
  };

  return (
    typeof candidate.section === "string" &&
    candidate.section.trim().length > 0 &&
    areValidAliases(candidate.aliases) &&
    isValidCondition(candidate.requiredWhen)
  );
}

function areValidAliases(aliases: unknown): boolean {
  return (
    aliases === undefined ||
    (Array.isArray(aliases) &&
      aliases.every(
        (alias) => typeof alias === "string" && alias.trim().length > 0,
      ))
  );
}

function isValidCondition(
  condition: unknown,
): condition is ConditionalRequiredSectionRuleExpected["requiredWhen"] {
  if (typeof condition !== "object" || condition === null) {
    return false;
  }

  const candidate = condition as { fact?: unknown; equals?: unknown };

  return (
    isSupportedDocumentFact(candidate.fact) &&
    typeof candidate.equals === "boolean"
  );
}

function hasExpectedSection(
  document: Readonly<NormalizedDocument>,
  expected: ConditionalRequiredSectionRuleExpected,
): boolean {
  const expectedNames = [expected.section, ...(expected.aliases ?? [])];

  return document.sections.some((section) =>
    sectionMatchesAnyExpectedName(section, expectedNames),
  );
}

function createResult(
  rule: RuleDefinition,
  expected: ConditionalRequiredSectionRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `${formatCondition(expected.requiredWhen)} ${expected.section} bölümü bulunmalı`,
    actual,
    message,
  };
}

function formatCondition(
  condition: ConditionalRequiredSectionRuleExpected["requiredWhen"],
): string {
  return condition.equals
    ? `Belgede ${getFactLabel(condition.fact)} bulunduğunda`
    : `Belgede ${getFactLabel(condition.fact)} bulunmadığında`;
}

function createNotApplicableMessage(
  document: Readonly<NormalizedDocument>,
  expected: ConditionalRequiredSectionRuleExpected,
): string {
  const factValue = getDocumentFactValue(document, expected.requiredWhen.fact);

  return factValue
    ? `Belgede ${getFactLabel(expected.requiredWhen.fact)} bulunduğu için bu kontrol uygulanmadı.`
    : `Belgede ${getFactLabel(expected.requiredWhen.fact)} bulunmadığı için bu kontrol uygulanmadı.`;
}

function getFactLabel(fact: ConditionalRequiredSectionFact): string {
  return FACT_LABELS[fact];
}
