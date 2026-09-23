import type {
  NormalizedDocument,
  RequiredSectionRuleExpected,
  RuleDefinition,
  RuleResult,
} from "../../types";
import { findAcademicSectionOccurrencesByNames } from "../academicSectionLookup";
import {
  createAcademicSectionEvidence,
  createMissingSectionEvidence,
} from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class RequiredSectionValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRequiredSectionRule(rule);
    const expected = getRequiredSectionExpected(rule.expected);
    const expectedNames = [expected.section, ...(expected.aliases ?? [])];
    const matchingOccurrences = findAcademicSectionOccurrencesByNames(
      document,
      [rule],
      expectedNames,
    );
    const declaredOccurrences = matchingOccurrences.filter(
      (occurrence) => occurrence.status === "declared",
    );
    const ambiguousOccurrences = matchingOccurrences.filter(
      (occurrence) => occurrence.status === "ambiguous",
    );
    const hasSection = declaredOccurrences.length > 0;
    const hasAmbiguousSection = !hasSection && ambiguousOccurrences.length > 0;
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
      actual: hasSection
        ? "Bulundu"
        : hasAmbiguousSection
          ? "Belirsiz"
          : "Tespit edilmedi",
      message: passed
        ? hasSection
          ? `${expected.section} bölümü bulundu.`
          : `${expected.section} bölümü zorunlu değil.`
        : hasAmbiguousSection
          ? `${expected.section} bölümü belirsiz eşleşme nedeniyle güvenle doğrulanamadı.`
          : `${expected.section} bölümü tespit edilemedi.`,
      ...(passed
        ? {}
        : {
            evidence: hasAmbiguousSection
              ? ambiguousOccurrences.map((occurrence) =>
                  createAcademicSectionEvidence(occurrence, {
                    actual: occurrence.displayHeadingText,
                    expected: expected.section,
                    sectionName: expected.section,
                  }),
                )
              : [
                  createMissingSectionEvidence(expected.section, {
                    actual: "Tespit edilmedi",
                    expected: "Bölüm bulunmalı",
                  }),
                ],
            evidenceTotal: hasAmbiguousSection ? ambiguousOccurrences.length : 1,
          }),
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
