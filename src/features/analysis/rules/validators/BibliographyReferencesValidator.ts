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
      return createPassedResult(rule, expected, `${expected.section} bÃ¶lÃ¼mÃ¼ zorunlu deÄŸil.`);
    }

    if (!hasSection) {
      return {
        ruleId: rule.id,
        ruleName: rule.title,
        status: "FAILED",
        passed: false,
        severity: rule.severity,
        expected: `${expected.section} bÃ¶lÃ¼mÃ¼ ve en az bir kaynak girdisi bulunmalÄ±`,
        actual: hasAmbiguousSection ? "Belirsiz" : "Tespit edilmedi",
        message: hasAmbiguousSection
          ? `${expected.section} bÃ¶lÃ¼mÃ¼ belirsiz eÅŸleÅŸme nedeniyle gÃ¼venle doÄŸrulanamadÄ±.`
          : `${expected.section} bÃ¶lÃ¼mÃ¼ tespit edilemedi.`,
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
                expected: "BÃ¶lÃ¼m ve kaynak girdisi bulunmalÄ±",
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
        expected: `${expected.section} bÃ¶lÃ¼mÃ¼nde en az bir kaynak girdisi bulunmalÄ±`,
        actual: bibliography.status,
        message: `${expected.section} bÃ¶lÃ¼mÃ¼ bulundu ancak gÃ¶rÃ¼nÃ¼r kaynak girdisi tespit edilemedi.`,
        evidence: declaredOccurrences.map((occurrence) =>
          createAcademicSectionEvidence(occurrence, {
            actual: "BÃ¶lÃ¼m boÅŸ",
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
      expected: `${expected.section} bÃ¶lÃ¼mÃ¼ ve kaynak girdileri bulunmalÄ±`,
      actual: `${bibliography.entries.length} kaynak girdisi`,
      message: `${expected.section} bÃ¶lÃ¼mÃ¼nde ${bibliography.entries.length} kaynak girdisi bulundu.`,
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
    expected: `${expected.section} bÃ¶lÃ¼mÃ¼ zorunlu deÄŸil`,
    actual: "Zorunlu deÄŸil",
    message,
  };
}

function assertRequiredSectionRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "REQUIRED_SECTION" } {
  if (rule.type !== "REQUIRED_SECTION") {
    throw new Error(
      "BibliographyReferencesValidator yalnÄ±zca REQUIRED_SECTION tipindeki kurallarÄ± Ã§alÄ±ÅŸtÄ±rÄ±r.",
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
      "REQUIRED_SECTION kuralÄ± section, optional aliases ve boolean required deÄŸerlerini iÃ§ermelidir.",
    );
  }

  return expected;
}
