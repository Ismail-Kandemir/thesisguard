import type {
  CoverFieldOccurrence,
  CoverFieldPresenceRuleExpected,
  CoverScopeConfidence,
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
} from "../../types";
import { createParagraphEvidence } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

const CONFIDENCE_RANK: Record<Exclude<CoverScopeConfidence, "unknown">, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export class CoverFieldPresenceValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertCoverFieldPresenceRule(rule);
    const expected = getCoverFieldPresenceExpected(rule.expected);
    const minConfidence = expected.minConfidence ?? "high";
    const matchingFields = findMatchingFields(document, expected);
    const verifiedFields = matchingFields.filter((field) =>
      hasSufficientFieldConfidence(field, minConfidence) &&
      hasExpectedDatePrecision(field, expected),
    );
    const passed = expected.required
      ? verifiedFields.length > 0
      : verifiedFields.length === 0;
    const actual = verifiedFields.length > 0
      ? "Güvenilir semantic evidence bulundu"
      : matchingFields.length > 0
        ? "Yetersiz semantic confidence"
        : "Tespit edilmedi";

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: `${formatCoverScope(expected.coverScope)} ${formatField(expected.field)} alanı`,
      actual,
      message: passed
        ? `${formatCoverScope(expected.coverScope)} için ${formatField(expected.field)} alanı güvenilir semantic evidence ile doğrulandı.`
        : `${formatCoverScope(expected.coverScope)} için ${formatField(expected.field)} alanı güvenilir semantic evidence ile doğrulanamadı.`,
      ...(passed
        ? {}
        : {
            evidence: createFailureEvidence(document, matchingFields, expected),
            evidenceTotal: Math.max(matchingFields.length, 1),
          }),
    };
  }
}

function assertCoverFieldPresenceRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "COVER_FIELD_PRESENCE" } {
  if (rule.type !== "COVER_FIELD_PRESENCE") {
    throw new Error(
      "CoverFieldPresenceValidator yalnızca COVER_FIELD_PRESENCE tipindeki kuralları çalıştırır.",
    );
  }
}

function getCoverFieldPresenceExpected(
  expected: RuleDefinition["expected"],
): CoverFieldPresenceRuleExpected {
  if (!isCoverFieldPresenceExpected(expected)) {
    throw new Error(
      "COVER_FIELD_PRESENCE kuralı coverScope, field, required ve optional minConfidence değerlerini içermelidir.",
    );
  }

  return expected;
}

function isCoverFieldPresenceExpected(
  value: RuleDefinition["expected"],
): value is CoverFieldPresenceRuleExpected {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    coverScope?: unknown;
    field?: unknown;
    required?: unknown;
    minConfidence?: unknown;
    datePrecision?: unknown;
  };

  return (
    isCoverScope(candidate.coverScope) &&
    isCoverField(candidate.field) &&
    typeof candidate.required === "boolean" &&
    (candidate.minConfidence === undefined ||
      candidate.minConfidence === "high" ||
      candidate.minConfidence === "medium" ||
      candidate.minConfidence === "low") &&
    (candidate.datePrecision === undefined ||
      (candidate.field === "date" && candidate.datePrecision === "month-year"))
  );
}

function findMatchingFields(
  document: Readonly<NormalizedDocument>,
  expected: CoverFieldPresenceRuleExpected,
): CoverFieldOccurrence[] {
  const occurrenceById = new Map(
    document.coverSemantics.occurrences.map((occurrence) => [occurrence.id, occurrence]),
  );

  return document.coverSemantics.fields.filter((field) => {
    const occurrence = occurrenceById.get(field.coverOccurrenceId);

    return (
      field.field === expected.field &&
      occurrence?.scope === expected.coverScope &&
      occurrence.confidence === "high"
    );
  });
}

function hasSufficientFieldConfidence(
  field: Readonly<CoverFieldOccurrence>,
  minConfidence: Exclude<CoverScopeConfidence, "unknown">,
): boolean {
  return CONFIDENCE_RANK[field.confidence] >= CONFIDENCE_RANK[minConfidence];
}

function hasExpectedDatePrecision(
  field: Readonly<CoverFieldOccurrence>,
  expected: CoverFieldPresenceRuleExpected,
): boolean {
  return expected.datePrecision === undefined ||
    (
      field.field === "date" &&
      field.dateFacts?.precision === expected.datePrecision
    );
}

function createFailureEvidence(
  document: Readonly<NormalizedDocument>,
  matchingFields: readonly CoverFieldOccurrence[],
  expected: CoverFieldPresenceRuleExpected,
) {
  const evidence = matchingFields
    .map((field) => {
      const paragraph = document.paragraphs[field.paragraphIndex];

      return paragraph
        ? createParagraphEvidence(paragraph, field.paragraphIndex, {
            actual: field.confidence,
            expected: expected.minConfidence ?? "high",
            sectionName: formatCoverScope(expected.coverScope),
          })
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return evidence.length > 0
    ? evidence
    : [{
        kind: "section" as const,
        sectionName: formatCoverScope(expected.coverScope),
        expected: formatField(expected.field),
        actual: "Tespit edilmedi",
      }];
}

function isCoverScope(value: unknown): value is CoverFieldPresenceRuleExpected["coverScope"] {
  return value === "outer-cover" || value === "inner-cover" || value === "unknown";
}

function isCoverField(value: unknown): value is CoverFieldPresenceRuleExpected["field"] {
  return (
    value === "institution" ||
    value === "title" ||
    value === "author" ||
    value === "advisor" ||
    value === "work-type" ||
    value === "date" ||
    value === "publication-place"
  );
}

function formatCoverScope(scope: CoverFieldPresenceRuleExpected["coverScope"]): string {
  switch (scope) {
    case "outer-cover":
      return "Dış kapak";
    case "inner-cover":
      return "İç kapak";
    case "unknown":
      return "Belirsiz kapak";
  }
}

function formatField(field: CoverFieldPresenceRuleExpected["field"]): string {
  switch (field) {
    case "institution":
      return "kurum";
    case "title":
      return "başlık";
    case "author":
      return "yazar";
    case "advisor":
      return "danışman";
    case "work-type":
      return "çalışma türü";
    case "date":
      return "tarih";
    case "publication-place":
      return "basım yeri";
  }
}
