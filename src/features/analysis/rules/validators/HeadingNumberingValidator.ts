import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import { normalizeSectionName } from "../../parsers/documentSectionsParser";
import type {
  DocumentSection,
  HeadingNumberingRuleExpected,
  HeadingNumberingSectionExpectation,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class HeadingNumberingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertHeadingNumberingRule(rule);
    const expected = getExpected(rule.expected);
    const duplicate = findDuplicate(expected.sections, document.sections);

    if (duplicate) {
      return createResult(
        rule,
        expected,
        "FAILED",
        "Güvenle doğrulanamadı",
        `${duplicate.section} bölümü birden fazla bulunduğu için numaralandırma güvenle doğrulanamadı.`,
      );
    }

    const located = expected.sections.flatMap((expectation) => {
      const occurrence = findOccurrences(expectation, document.sections)[0];
      const paragraph = occurrence
        ? document.paragraphs.find((candidate) => candidate.id === occurrence.paragraphId)
        : undefined;

      return occurrence && paragraph ? [{ expectation, occurrence, paragraph }] : [];
    });

    if (located.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        "Numaralandırması doğrulanacak bölüm bulunmadığı için kontrol uygulanmadı.",
      );
    }

    const unnumbered = located.find(({ paragraph }) => !isReliablyNumbered(paragraph));

    if (unnumbered) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${unnumbered.expectation.section}: Numaralandırılmamış`,
        `${unnumbered.expectation.section} bölümü numaralandırılmalıdır.`,
      );
    }

    const wrongLevel = located.find(
      ({ expectation, paragraph }) => paragraph.numbering.level !== expectation.level,
    );

    if (wrongLevel) {
      const actualLevel = wrongLevel.paragraph.numbering.level;

      return createResult(
        rule,
        expected,
        "FAILED",
        `${wrongLevel.expectation.section}: ${formatLevel(actualLevel)}`,
        `${wrongLevel.expectation.section} bölümü ${formatExpectedLevel(wrongLevel.expectation.level)} numaralandırılmalıdır. Bulunan düzey: ${formatLevel(actualLevel)}.`,
      );
    }

    return createResult(
      rule,
      expected,
      "PASSED",
      `${located.length}/${expected.sections.length} bulunan bölüm uygun`,
      "Bulunan akademik ana bölümler beklenen düzeyde numaralandırılmış.",
    );
  }
}

function assertHeadingNumberingRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "HEADING_NUMBERING" } {
  if (rule.type !== "HEADING_NUMBERING") {
    throw new Error(
      "HeadingNumberingValidator yalnızca HEADING_NUMBERING tipindeki kuralları çalıştırır.",
    );
  }
}

function getExpected(expected: RuleDefinition["expected"]): HeadingNumberingRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("sections" in expected) ||
    !Array.isArray(expected.sections) ||
    expected.sections.length === 0 ||
    !expected.sections.every(isValidExpectation)
  ) {
    throw new Error(
      "HEADING_NUMBERING kuralı en az bir geçerli section, optional aliases ve non-negative integer level tanımlamalıdır.",
    );
  }

  if (hasOverlappingExpectedNames(expected.sections)) {
    throw new Error(
      "HEADING_NUMBERING kuralı aynı section veya alias adını birden fazla expectation içinde tanımlayamaz.",
    );
  }

  return expected;
}

function hasOverlappingExpectedNames(
  expectations: readonly HeadingNumberingSectionExpectation[],
): boolean {
  const names = expectations.flatMap((expectation) => [
    expectation.section,
    ...(expectation.aliases ?? []),
  ]);
  const normalizedNames = names.map(normalizeSectionName);

  return new Set(normalizedNames).size !== normalizedNames.length;
}

function isValidExpectation(value: unknown): value is HeadingNumberingSectionExpectation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { section?: unknown; aliases?: unknown; level?: unknown };

  return (
    typeof candidate.section === "string" &&
    candidate.section.trim().length > 0 &&
    (candidate.aliases === undefined ||
      (Array.isArray(candidate.aliases) &&
        candidate.aliases.every(
          (alias) => typeof alias === "string" && alias.trim().length > 0,
        ))) &&
    typeof candidate.level === "number" &&
    Number.isInteger(candidate.level) &&
    candidate.level >= 0
  );
}

function findOccurrences(
  expectation: HeadingNumberingSectionExpectation,
  sections: readonly DocumentSection[],
): DocumentSection[] {
  const names = [expectation.section, ...(expectation.aliases ?? [])];

  return sections.filter((section) => sectionMatchesAnyExpectedName(section, names));
}

function findDuplicate(
  expectations: readonly HeadingNumberingSectionExpectation[],
  sections: readonly DocumentSection[],
): HeadingNumberingSectionExpectation | null {
  return expectations.find((expectation) => findOccurrences(expectation, sections).length > 1) ?? null;
}

function isReliablyNumbered(paragraph: Readonly<Paragraph>): boolean {
  if (paragraph.numbering.source === "text") {
    return paragraph.numbering.visibleLabel !== null && paragraph.numbering.level !== null;
  }

  return (
    paragraph.numbering.source === "word" &&
    paragraph.numbering.numId !== null &&
    paragraph.numbering.level !== null
  );
}

function formatExpectedLevel(level: number): string {
  return level === 0 ? "ana bölüm düzeyinde" : `${level + 1}. düzeyde`;
}

function formatLevel(level: number | null): string {
  return level === null ? "Belirlenemedi" : String(level + 1);
}

function createResult(
  rule: RuleDefinition,
  expected: HeadingNumberingRuleExpected,
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
    expected: expected.sections
      .map((expectation) => `${expectation.section}: düzey ${expectation.level + 1}`)
      .join(", "),
    actual,
    message,
  };
}
