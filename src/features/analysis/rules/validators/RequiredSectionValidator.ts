import type {
  NormalizedDocument,
  RequiredSectionRuleExpected,
  RuleDefinition,
  RuleResult,
} from "../../types";
import { findAcademicSectionOccurrencesByNames } from "../academicSectionLookup";
import {
  createAcademicSectionEvidence,
  createDocumentFormatEvidence,
  createMissingSectionEvidence,
} from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";
import type { AssessmentEvidence, AssessmentObservation, RuleAssessment } from "../../types/RuleAssessment";
import { buildAcademicSections, qualifyAcademicSectionIdentity } from "../../parsers/academicSectionsNormalizer";
import { getSectionQualificationCoverage } from "../semanticQualification";

export class RequiredSectionValidator implements RuleValidator {
  assess(document: NormalizedDocument, rule: RuleDefinition): RuleAssessment {
    assertRequiredSectionRule(rule);
    return assessRequiredSection(document, rule, getRequiredSectionExpected(rule.expected));
  }

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

export function assessRequiredSection(
  document: NormalizedDocument,
  rule: RuleDefinition,
  expected: RequiredSectionRuleExpected,
  applicabilityEvidence?: AssessmentEvidence,
): RuleAssessment {
  const reference = { kind: "rule", id: rule.id } as const;
  const evidence = [createMissingSectionEvidence(expected.section, { expected: expected.required })] as const;
  const names = [expected.section, ...(expected.aliases ?? [])];
  const sourceCoverage = getSectionQualificationCoverage(document, names);
  if (!rule.enabled) return {
    reference, applicability: { state: "undetermined", reason: "The rule is not enabled." },
    coverage: sourceCoverage, observations: [],
  };
  if (!expected.required) return {
    reference,
    applicability: { state: "not-applicable", reason: "The source rule explicitly makes this section optional.", evidence },
  };
  const matches = findAcademicSectionOccurrencesByNames(document, [rule], names);
  const rebuilt = buildAcademicSections(document, [rule]).occurrences;
  const missingRecords = rebuilt.filter((candidate) => !matches.some((item) =>
    item.headingParagraphId === candidate.headingParagraphId));
  const coverage = missingRecords.length > 0
    ? {
        population: "open" as const, excludedSubjects: sourceCoverage.excludedSubjects, reason: "Academic section records omit source candidates.",
        unresolvedSubjects: [
          ...(sourceCoverage.population === "open" ? sourceCoverage.unresolvedSubjects : []),
          ...missingRecords.map((item) => ({ kind: "paragraph" as const, paragraphId: item.headingParagraphId })),
        ],
      }
    : sourceCoverage;
  const observations: AssessmentObservation[] = matches.map((occurrence) => {
    // Re-qualify current evidence: cached annotations cannot authorize a PASS.
    const qualification = qualifyAcademicSectionIdentity(document, occurrence, matches);
    const proof = [
      createAcademicSectionEvidence(occurrence, { actual: occurrence.displayHeadingText, expected: expected.section }),
      createDocumentFormatEvidence("academic-section.structural-identity", { actual: JSON.stringify(qualification) }),
    ] as const;
    const subject = { kind: "academic-section", occurrenceId: occurrence.id } as const;
    if (qualification.certainty !== "confirmed") return {
      state: "undetermined", subject,
      identity: { certainty: qualification.certainty, reason: qualification.reason },
      evidence: { certainty: "sufficient", items: proof },
    };
    return { state: "confirmed", subject, identity: { certainty: "confirmed", evidence: proof },
      evidence: { certainty: "sufficient", items: proof }, finding: "compliant" };
  });
  if (matches.length === 0 && coverage.population === "closed") observations.push({
    state: "confirmed", subject: { kind: "document" }, identity: { certainty: "not-required" },
    evidence: { certainty: "sufficient", items: [createMissingSectionEvidence(expected.section, { actual: "Absent from closed candidate inventory", expected: "Required section" })] },
    finding: "violation",
  });
  return { reference, applicability: { state: "applicable", evidence: applicabilityEvidence ?? evidence }, coverage, observations };
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
