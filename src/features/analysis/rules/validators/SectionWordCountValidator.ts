import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import { getSectionContentParagraphs } from "../sectionContent";
import { countWords } from "../wordCount";
import type {
  DocumentSection,
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
  SectionWordCountRuleExpected,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class SectionWordCountValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertSectionWordCountRule(rule);
    const expected = getSectionWordCountExpected(rule.expected);
    const occurrences = findSectionOccurrences(document.sections, expected);

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${expected.section} bölümü bulunmadığı için kelime sayısı kontrolü uygulanmadı.`,
      );
    }

    if (occurrences.length > 1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Güvenle hesaplanamadı",
        `${expected.section} bölümü birden fazla kez bulunduğu için kelime sayısı güvenle hesaplanamadı.`,
      );
    }

    const paragraphs = getSectionContentParagraphs(document, occurrences[0]);
    const wordCount = countWords(paragraphs.map((paragraph) => paragraph.text));
    const passed =
      (expected.min === undefined || wordCount >= expected.min) &&
      (expected.max === undefined || wordCount <= expected.max);

    return createResult(
      rule,
      expected,
      passed ? "PASSED" : "FAILED",
      `${wordCount} kelime`,
      createMessage(expected, wordCount, passed),
    );
  }
}

function assertSectionWordCountRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "SECTION_WORD_COUNT" } {
  if (rule.type !== "SECTION_WORD_COUNT") {
    throw new Error(
      "SectionWordCountValidator yalnızca SECTION_WORD_COUNT tipindeki kuralları çalıştırır.",
    );
  }
}

function getSectionWordCountExpected(
  expected: RuleDefinition["expected"],
): SectionWordCountRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("section" in expected) ||
    typeof expected.section !== "string" ||
    expected.section.trim().length === 0 ||
    ("aliases" in expected &&
      (expected.aliases === undefined ||
        !Array.isArray(expected.aliases) ||
        !expected.aliases.every(
          (alias) => typeof alias === "string" && alias.trim().length > 0,
        ))) ||
    ("min" in expected &&
      expected.min !== undefined &&
      !isNonNegativeInteger(expected.min)) ||
    ("max" in expected &&
      expected.max !== undefined &&
      !isNonNegativeInteger(expected.max)) ||
    (!("min" in expected) && !("max" in expected)) ||
    (expected.min === undefined && expected.max === undefined) ||
    (expected.min !== undefined &&
      expected.max !== undefined &&
      expected.min > expected.max)
  ) {
    throw new Error(
      "SECTION_WORD_COUNT kuralı geçerli section, optional aliases ve en az bir non-negative integer min/max değeri içermelidir; min max değerini aşamaz.",
    );
  }

  return expected;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function findSectionOccurrences(
  sections: readonly DocumentSection[],
  expected: SectionWordCountRuleExpected,
): DocumentSection[] {
  const expectedNames = [expected.section, ...(expected.aliases ?? [])];

  return sections.filter((section) =>
    sectionMatchesAnyExpectedName(section, expectedNames),
  );
}

function createResult(
  rule: RuleDefinition,
  expected: SectionWordCountRuleExpected,
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
    expected: formatExpected(expected),
    actual,
    message,
  };
}

function formatExpected(expected: SectionWordCountRuleExpected): string {
  if (expected.min !== undefined && expected.max !== undefined) {
    return `${expected.min}–${expected.max} kelime`;
  }

  return expected.min !== undefined
    ? `En az ${expected.min} kelime`
    : `En fazla ${expected.max} kelime`;
}

function createMessage(
  expected: SectionWordCountRuleExpected,
  actual: number,
  passed: boolean,
): string {
  if (passed) {
    return `${expected.section} bölümü kelime sayısı sınırına uygun. Bulunan: ${actual} kelime.`;
  }

  if (expected.min !== undefined && actual < expected.min) {
    return `${expected.section} bölümü en az ${expected.min} kelime olmalı. Bulunan: ${actual} kelime.`;
  }

  return `${expected.section} bölümü ${expected.max} kelime sınırını aşıyor. Bulunan: ${actual} kelime.`;
}
