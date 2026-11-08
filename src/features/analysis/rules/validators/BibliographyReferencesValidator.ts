import type {
  NormalizedDocument,
  RequiredSectionRuleExpected,
  RuleDefinition,
  RuleResult,
} from "../../types";
import { getDocumentBibliography } from "../../parsers/bibliographySemanticsNormalizer";
import { findAcademicSectionOccurrencesByNames } from "../academicSectionLookup";
import {
  createAcademicSectionEvidence,
  createMissingSectionEvidence,
} from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class BibliographyReferencesValidator implements RuleValidator {
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

    if (!expected.required) {
      return createPassedResult(rule, expected, `${expected.section} bölümü zorunlu değil.`);
    }

    if (!hasSection) {
      return {
        ruleId: rule.id,
        ruleName: rule.title,
        status: "FAILED",
        passed: false,
        severity: rule.severity,
        expected: `${expected.section} bölümü ve en az bir kaynak girdisi bulunmalı`,
        actual: hasAmbiguousSection ? "Belirsiz" : "Tespit edilmedi",
        message: hasAmbiguousSection
          ? `${expected.section} bölümü belirsiz eşleşme nedeniyle güvenle doğrulanamadı.`
          : `${expected.section} bölümü tespit edilemedi.`,
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
                expected: "Bölüm ve kaynak girdisi bulunmalı",
              }),
            ],
        evidenceTotal: hasAmbiguousSection ? ambiguousOccurrences.length : 1,
      };
    }

    const bibliography = getDocumentBibliography(document, [rule]);

    if (bibliography.entries.length === 0) {
      return {
        ruleId: rule.id,
        ruleName: rule.title,
        status: "FAILED",
        passed: false,
        severity: rule.severity,
        expected: `${expected.section} bölümünde en az bir kaynak girdisi bulunmalı`,
        actual: bibliography.status,
        message: `${expected.section} bölümü bulundu ancak görünür kaynak girdisi tespit edilemedi.`,
        evidence: declaredOccurrences.map((occurrence) =>
          createAcademicSectionEvidence(occurrence, {
            actual: "Bölüm boş",
            expected: "En az bir kaynak girdisi",
            sectionName: expected.section,
          }),
        ),
        evidenceTotal: declaredOccurrences.length,
      };
    }

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: "PASSED",
      passed: true,
      severity: rule.severity,
      expected: `${expected.section} bölümü ve kaynak girdileri bulunmalı`,
      actual: `${bibliography.entries.length} kaynak girdisi`,
      message: `${expected.section} bölümünde ${bibliography.entries.length} kaynak girdisi bulundu.`,
    };
  }
}

function createPassedResult(
  rule: RuleDefinition,
  expected: RequiredSectionRuleExpected,
  message: string,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status: "PASSED",
    passed: true,
    severity: rule.severity,
    expected: `${expected.section} bölümü zorunlu değil`,
    actual: "Zorunlu değil",
    message,
  };
}

function assertRequiredSectionRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "REQUIRED_SECTION" } {
  if (rule.type !== "REQUIRED_SECTION") {
    throw new Error(
      "BibliographyReferencesValidator yalnızca REQUIRED_SECTION tipindeki kuralları çalıştırır.",
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
