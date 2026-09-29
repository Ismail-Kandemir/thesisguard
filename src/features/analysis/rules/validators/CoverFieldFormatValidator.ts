import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { normalizeSectionName } from "../../parsers/documentSectionsParser";
import type {
  CoverFieldFormatRuleExpected,
  CoverFieldOccurrence,
  CoverScopeConfidence,
  EffectiveFormatting,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
} from "../../types";
import { fontFamiliesEqual } from "../fontFamilyComparison";
import { createParagraphEvidence } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

const CONFIDENCE_RANK: Record<Exclude<CoverScopeConfidence, "unknown">, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

interface CoverFieldFormattingCandidate {
  field: CoverFieldOccurrence;
  paragraph: Paragraph;
  paragraphIndex: number;
}

interface FormattingIssue {
  candidate: CoverFieldFormattingCandidate;
  actual: string;
  problems: string[];
}

export class CoverFieldFormatValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertCoverFieldFormatRule(rule);
    const expected = getCoverFieldFormatExpected(rule.expected);
    const minConfidence = expected.minConfidence ?? "high";
    const candidates = findFormattingCandidates(document, expected, minConfidence);

    if (candidates.length === 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Güvenilir cover field formatting evidence bulunamadı",
        `${formatCoverScope(expected.coverScope)} için ${formatField(expected.field)} alanının biçimi güvenilir semantic evidence ile doğrulanamadı.`,
        [createMissingEvidence(expected)],
        1,
      );
    }

    const resolver = new EffectiveFormattingResolver(
      document.styles,
      document.documentDefaults,
      document.themeFonts,
    );
    const issues = candidates.flatMap((candidate) =>
      validateCandidateFormatting(candidate, expected, resolver),
    );

    if (issues.length > 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${issues.length} cover field biçim sorunu`,
        issues.map((issue) => issue.problems.join(" ")).join(" "),
        issues.map((issue) =>
          createParagraphEvidence(issue.candidate.paragraph, issue.candidate.paragraphIndex, {
            actual: issue.actual,
            expected: formatExpected(expected),
            sectionName: formatCoverScope(expected.coverScope),
          }),
        ),
        issues.length,
      );
    }

    return createResult(
      rule,
      expected,
      "PASSED",
      `${candidates.length} cover field uygun`,
      `${formatCoverScope(expected.coverScope)} için ${formatField(expected.field)} alanı beklenen biçimle uyumlu.`,
    );
  }
}

function assertCoverFieldFormatRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "COVER_FIELD_FORMAT" } {
  if (rule.type !== "COVER_FIELD_FORMAT") {
    throw new Error(
      "CoverFieldFormatValidator yalnızca COVER_FIELD_FORMAT tipindeki kuralları çalıştırır.",
    );
  }
}

function getCoverFieldFormatExpected(
  expected: RuleDefinition["expected"],
): CoverFieldFormatRuleExpected {
  if (!isCoverFieldFormatExpected(expected)) {
    throw new Error(
      "COVER_FIELD_FORMAT kuralı coverScope, field ve en az bir formatting beklentisi içermelidir.",
    );
  }

  return expected;
}

function isCoverFieldFormatExpected(
  value: RuleDefinition["expected"],
): value is CoverFieldFormatRuleExpected {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    coverScope?: unknown;
    field?: unknown;
    minConfidence?: unknown;
    fontFamily?: unknown;
    fontSize?: unknown;
    bold?: unknown;
  };

  return (
    isCoverScope(candidate.coverScope) &&
    isCoverField(candidate.field) &&
    (candidate.minConfidence === undefined ||
      candidate.minConfidence === "high" ||
      candidate.minConfidence === "medium" ||
      candidate.minConfidence === "low") &&
    (candidate.fontFamily === undefined || typeof candidate.fontFamily === "string") &&
    (candidate.fontSize === undefined ||
      (typeof candidate.fontSize === "number" && Number.isFinite(candidate.fontSize))) &&
    (candidate.bold === undefined || typeof candidate.bold === "boolean") &&
    (
      candidate.fontFamily !== undefined ||
      candidate.fontSize !== undefined ||
      candidate.bold !== undefined
    )
  );
}

function findFormattingCandidates(
  document: Readonly<NormalizedDocument>,
  expected: CoverFieldFormatRuleExpected,
  minConfidence: Exclude<CoverScopeConfidence, "unknown">,
): CoverFieldFormattingCandidate[] {
  const occurrenceById = new Map(
    document.coverSemantics.occurrences.map((occurrence) => [occurrence.id, occurrence]),
  );

  return document.coverSemantics.fields.flatMap((field) => {
    const occurrence = occurrenceById.get(field.coverOccurrenceId);
    const paragraph = document.paragraphs[field.paragraphIndex];

    if (
      !paragraph ||
      field.field !== expected.field ||
      occurrence?.scope !== expected.coverScope ||
      occurrence.confidence !== "high" ||
      !hasSufficientFieldConfidence(field, minConfidence) ||
      !fieldOwnsWholeParagraph(field, paragraph)
    ) {
      return [];
    }

    return [{ field, paragraph, paragraphIndex: field.paragraphIndex }];
  });
}

function hasSufficientFieldConfidence(
  field: Readonly<CoverFieldOccurrence>,
  minConfidence: Exclude<CoverScopeConfidence, "unknown">,
): boolean {
  return CONFIDENCE_RANK[field.confidence] >= CONFIDENCE_RANK[minConfidence];
}

function fieldOwnsWholeParagraph(
  field: Readonly<CoverFieldOccurrence>,
  paragraph: Readonly<Paragraph>,
): boolean {
  return normalizeSectionName(field.value) === normalizeSectionName(paragraph.text);
}

function validateCandidateFormatting(
  candidate: CoverFieldFormattingCandidate,
  expected: CoverFieldFormatRuleExpected,
  resolver: EffectiveFormattingResolver,
): FormattingIssue[] {
  const visibleRuns = candidate.paragraph.runs.filter((run) => run.text.trim().length > 0);

  if (visibleRuns.length === 0) {
    return [{
      candidate,
      actual: "Görünür run bulunamadı",
      problems: ["Cover field biçimi görünür run olmadığı için doğrulanamadı."],
    }];
  }

  const formats = visibleRuns.map((run) =>
    resolver.resolveRun(run, candidate.paragraph.styleId, candidate.paragraph.lineSpacing),
  );
  const problems = formats.flatMap((formatting) => compareFormatting(formatting, expected));

  return problems.length > 0
    ? [{
        candidate,
        actual: Array.from(new Set(formats.map(formatActual))).join("; "),
        problems: Array.from(new Set(problems)),
      }]
    : [];
}

function compareFormatting(
  actual: EffectiveFormatting,
  expected: CoverFieldFormatRuleExpected,
): string[] {
  return [
    ...(expected.fontFamily !== undefined &&
      !fontFamiliesEqual(actual.fontFamily, expected.fontFamily)
      ? [`Yazı tipi ${expected.fontFamily} olmalıdır.`]
      : []),
    ...(expected.fontSize !== undefined && actual.fontSize !== expected.fontSize
      ? [`Yazı boyutu ${expected.fontSize} pt olmalıdır.`]
      : []),
    ...(expected.bold !== undefined && actual.bold !== expected.bold
      ? [expected.bold ? "Yazı kalın olmalıdır." : "Yazı kalın olmamalıdır."]
      : []),
  ];
}

function createResult(
  rule: RuleDefinition,
  expected: CoverFieldFormatRuleExpected,
  status: RuleResult["status"],
  actual: string,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `${formatCoverScope(expected.coverScope)} ${formatField(expected.field)}: ${formatExpected(expected)}`,
    actual,
    message,
    ...(evidence ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function createMissingEvidence(expected: CoverFieldFormatRuleExpected): RuleEvidence {
  return {
    kind: "section",
    sectionName: formatCoverScope(expected.coverScope),
    expected: formatField(expected.field),
    actual: "Güvenilir formatting evidence yok",
  };
}

function formatExpected(expected: CoverFieldFormatRuleExpected): string {
  return [
    ...(expected.fontFamily !== undefined ? [expected.fontFamily] : []),
    ...(expected.fontSize !== undefined ? [`${expected.fontSize} pt`] : []),
    ...(expected.bold !== undefined ? [expected.bold ? "kalın" : "kalın değil"] : []),
  ].join(", ");
}

function formatActual(formatting: EffectiveFormatting): string {
  return [
    formatting.fontFamily ?? "yazı tipi belirlenemedi",
    formatting.fontSize === null ? "punto belirlenemedi" : `${formatting.fontSize} pt`,
    formatting.bold ? "kalın" : "kalın değil",
  ].join(", ");
}

function isCoverScope(value: unknown): value is CoverFieldFormatRuleExpected["coverScope"] {
  return value === "outer-cover" || value === "inner-cover" || value === "unknown";
}

function isCoverField(value: unknown): value is CoverFieldFormatRuleExpected["field"] {
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

function formatCoverScope(scope: CoverFieldFormatRuleExpected["coverScope"]): string {
  switch (scope) {
    case "outer-cover":
      return "Dış kapak";
    case "inner-cover":
      return "İç kapak";
    case "unknown":
      return "Belirsiz kapak";
  }
}

function formatField(field: CoverFieldFormatRuleExpected["field"]): string {
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
