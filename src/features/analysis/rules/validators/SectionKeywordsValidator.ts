import { sectionMatchesExpectedName } from "../../parsers/sectionNameMatcher";
import { getSectionContentParagraphs } from "../sectionContent";
import { parseSectionKeywordLines } from "../sectionKeywordsParser";
import type {
  DocumentSection,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
  SectionKeywordsRuleExpected,
} from "../../types";
import {
  createParagraphEvidence,
  createSectionEvidence,
  MAX_RULE_EVIDENCE_ITEMS,
} from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

export class SectionKeywordsValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertSectionKeywordsRule(rule);
    const expected = getExpected(rule.expected);
    const occurrences = findSectionOccurrences(document.sections, expected.section);

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${expected.section} bölümü bulunmadığı için anahtar kelime kontrolü uygulanmadı.`,
      );
    }

    if (occurrences.length > 1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Güvenle doğrulanamadı",
        `${expected.section} bölümü birden fazla kez bulunduğu için anahtar kelimeler güvenle doğrulanamadı.`,
        occurrences.map((occurrence) =>
          createSectionEvidence(occurrence, {
            actual: "Birden fazla bölüm bulundu",
            expected: "Tek bölüm",
            sectionName: occurrence.displayName,
          }),
        ),
        occurrences.length,
      );
    }

    const section = occurrences[0];
    const paragraphs = getSectionContentParagraphs(document, section);
    const lines = parseSectionKeywordLines(
      paragraphs,
      expected.labels,
      expected.separators,
    );
    const primaryLabel = expected.labels[0];

    if (lines.length === 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Bulunamadı",
        `${primaryLabel} satırı bulunamadı.`,
        [
          createSectionEvidence(section, {
            actual: "Tespit edilmedi",
            expected: `${expected.min}-${expected.max} anahtar kelime`,
            sectionName: section.displayName,
          }),
        ],
        1,
      );
    }

    if (lines.length > 1) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${lines.length} satır`,
        `Birden fazla ${primaryLabel} satırı bulundu.`,
        lines
          .slice(0, MAX_RULE_EVIDENCE_ITEMS)
          .map((line) =>
            createKeywordLineEvidence(document, paragraphs, line.paragraphIndex, {
              actual: "Fazladan anahtar kelime satırı",
              expected: "Tek anahtar kelime satırı",
            }),
          ),
        lines.length,
      );
    }

    const line = lines[0];
    const count = line.entries.length;

    if (count < expected.min) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${count} anahtar kelime`,
        `En az ${expected.min} anahtar kelime gerekli. Bulunan: ${count}.`,
        [
          createKeywordLineEvidence(document, paragraphs, line.paragraphIndex, {
            actual: count,
            expected: expected.min,
            unit: "anahtar kelime",
          }),
        ],
        1,
      );
    }

    if (count > expected.max) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${count} anahtar kelime`,
        `En fazla ${expected.max} anahtar kelime kullanılabilir. Bulunan: ${count}.`,
        [
          createKeywordLineEvidence(document, paragraphs, line.paragraphIndex, {
            actual: count,
            expected: expected.max,
            unit: "anahtar kelime",
          }),
        ],
        1,
      );
    }

    const hasVisibleContentAfter = paragraphs
      .slice(line.paragraphIndex + 1)
      .some((paragraph) => paragraph.text.trim().length > 0);

    if (hasVisibleContentAfter) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${count} anahtar kelime; konum uygun değil`,
        `${primaryLabel} satırı bölümün sonunda değil.`,
        [
          createKeywordLineEvidence(document, paragraphs, line.paragraphIndex, {
            actual: "Bölüm sonunda değil",
            expected: "Bölüm sonunda",
          }),
        ],
        1,
      );
    }

    return createResult(
      rule,
      expected,
      "PASSED",
      `${count} anahtar kelime`,
      "Anahtar kelime sayısı ve konumu uygun.",
    );
  }
}

function assertSectionKeywordsRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "SECTION_KEYWORDS" } {
  if (rule.type !== "SECTION_KEYWORDS") {
    throw new Error(
      "SectionKeywordsValidator yalnızca SECTION_KEYWORDS tipindeki kuralları çalıştırır.",
    );
  }
}

function getExpected(
  expected: RuleDefinition["expected"],
): SectionKeywordsRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("section" in expected) ||
    typeof expected.section !== "string" ||
    expected.section.trim().length === 0 ||
    !("labels" in expected) ||
    !isNonEmptyStringArray(expected.labels) ||
    !("min" in expected) ||
    !isNonNegativeInteger(expected.min) ||
    !("max" in expected) ||
    !isNonNegativeInteger(expected.max) ||
    expected.min > expected.max ||
    !("separators" in expected) ||
    !isNonEmptyStringArray(expected.separators) ||
    !("placement" in expected) ||
    expected.placement !== "section-end"
  ) {
    throw new Error(
      "SECTION_KEYWORDS kuralı geçerli section, labels, min/max, separators ve section-end placement tanımlamalıdır.",
    );
  }

  return expected;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function findSectionOccurrences(
  sections: readonly DocumentSection[],
  sectionName: string,
): DocumentSection[] {
  return sections.filter((section) => sectionMatchesExpectedName(section, sectionName));
}

function createKeywordLineEvidence(
  document: Readonly<NormalizedDocument>,
  paragraphs: readonly Paragraph[],
  sectionParagraphIndex: number,
  values: Readonly<{
    actual?: string | number;
    expected?: string | number;
    unit?: string;
  }>,
): RuleEvidence {
  const paragraph = paragraphs[sectionParagraphIndex];
  const paragraphIndex = paragraph
    ? document.paragraphs.findIndex((candidate) => candidate.id === paragraph.id)
    : -1;

  if (!paragraph || paragraphIndex < 0) {
    return {
      kind: "section",
      sectionName: "Anahtar kelime satırı",
      ...("expected" in values ? { expected: values.expected } : {}),
      ...("actual" in values ? { actual: values.actual } : {}),
      ...(values.unit ? { unit: values.unit } : {}),
    };
  }

  return createParagraphEvidence(paragraph, paragraphIndex, values);
}

function createResult(
  rule: RuleDefinition,
  expected: SectionKeywordsRuleExpected,
  status: RuleResultStatus,
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
    expected: `${expected.min}–${expected.max} anahtar kelime; bölüm sonunda`,
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}
