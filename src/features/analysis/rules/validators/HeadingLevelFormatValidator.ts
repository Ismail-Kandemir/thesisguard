import { sectionMatchesAnyExpectedName } from "../../parsers/sectionNameMatcher";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type {
  EffectiveFormatting,
  HeadingLevelFormatRuleExpected,
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
  SectionOrderItem,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

interface LocatedHeading {
  item: SectionOrderItem;
  paragraph: Paragraph;
}

interface FormattingIssue {
  headingText: string;
  problems: string[];
}

export class HeadingLevelFormatValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertHeadingLevelFormatRule(rule);
    const expected = getExpected(rule.expected);
    const locatedHeadings = locateHeadings(document, expected);

    if (locatedHeadings.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        "Biçimi güvenilir değerlendirilebilecek başlık bulunmadığı için kontrol uygulanmadı.",
      );
    }

    const resolver = new EffectiveFormattingResolver(
      document.styles,
      document.documentDefaults,
    );
    const issues = locatedHeadings.flatMap(({ paragraph }) =>
      validateParagraphFormatting(paragraph, expected, resolver),
    );

    if (issues.length > 0) {
      return createResult(
        rule,
        expected,
        "FAILED",
        `${issues.length} başlıkta biçim sorunu bulundu`,
        issues
          .map((issue) => `${issue.headingText}: ${issue.problems.join(" ")}`)
          .join(" "),
      );
    }

    return createResult(
      rule,
      expected,
      "PASSED",
      `${locatedHeadings.length} başlık uygun`,
      "Bulunan akademik başlıkların biçimi beklenen değerlerle uyumlu.",
    );
  }
}

function assertHeadingLevelFormatRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "HEADING_LEVEL_FORMAT" } {
  if (rule.type !== "HEADING_LEVEL_FORMAT") {
    throw new Error(
      "HeadingLevelFormatValidator yalnızca HEADING_LEVEL_FORMAT tipindeki kuralları çalıştırır.",
    );
  }
}

function getExpected(expected: RuleDefinition["expected"]): HeadingLevelFormatRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("level" in expected) ||
    typeof expected.level !== "number" ||
    !Number.isInteger(expected.level) ||
    expected.level < 0 ||
    !("sections" in expected) ||
    !Array.isArray(expected.sections) ||
    expected.sections.length === 0 ||
    !expected.sections.every(isSectionOrderItem) ||
    ("fontFamily" in expected && typeof expected.fontFamily !== "string") ||
    ("fontSize" in expected &&
      (typeof expected.fontSize !== "number" || !Number.isFinite(expected.fontSize))) ||
    ("bold" in expected && typeof expected.bold !== "boolean")
  ) {
    throw new Error(
      "HEADING_LEVEL_FORMAT kuralı level, sections ve en az bir geçerli biçim beklentisi içermelidir.",
    );
  }

  if (
    expected.fontFamily === undefined &&
    expected.fontSize === undefined &&
    expected.bold === undefined
  ) {
    throw new Error(
      "HEADING_LEVEL_FORMAT kuralı fontFamily, fontSize veya bold beklentilerinden en az birini içermelidir.",
    );
  }

  return expected;
}

function isSectionOrderItem(value: unknown): value is SectionOrderItem {
  if (typeof value !== "object" || value === null || !("section" in value)) {
    return false;
  }

  const item = value as { section?: unknown; aliases?: unknown };

  return (
    typeof item.section === "string" &&
    item.section.trim().length > 0 &&
    (item.aliases === undefined ||
      (Array.isArray(item.aliases) &&
        item.aliases.every(
          (alias) => typeof alias === "string" && alias.trim().length > 0,
        )))
  );
}

function locateHeadings(
  document: NormalizedDocument,
  expected: HeadingLevelFormatRuleExpected,
): LocatedHeading[] {
  return expected.sections.flatMap((item) => {
    const names = [item.section, ...(item.aliases ?? [])];
    const matches = document.sections.filter((section) =>
      sectionMatchesAnyExpectedName(section, names),
    );

    if (matches.length !== 1) {
      return [];
    }

    const section = matches[0];
    const paragraph = document.paragraphs.find(
      (candidate) => candidate.id === section.paragraphId,
    );

    if (
      !paragraph ||
      paragraph.numbering.level !== expected.level ||
      !isReliablyNumbered(paragraph)
    ) {
      return [];
    }

    return [{ item, paragraph }];
  });
}

function isReliablyNumbered(paragraph: Readonly<Paragraph>): boolean {
  if (paragraph.numbering.source === "text") {
    return paragraph.numbering.visibleLabel !== null;
  }

  return (
    paragraph.numbering.source === "word" &&
    paragraph.numbering.numId !== null &&
    paragraph.numbering.level !== null
  );
}

function validateParagraphFormatting(
  paragraph: Paragraph,
  expected: HeadingLevelFormatRuleExpected,
  resolver: EffectiveFormattingResolver,
): FormattingIssue[] {
  const visibleRuns = paragraph.runs.filter((run) => run.text.trim().length > 0);
  const problems = visibleRuns.flatMap((run) => {
    const formatting = resolver.resolveRun(
      run,
      paragraph.styleId,
      paragraph.lineSpacing,
    );

    return compareFormatting(formatting, expected);
  });
  const uniqueProblems = Array.from(new Set(problems));

  return uniqueProblems.length > 0
    ? [{ headingText: paragraph.text.trim(), problems: uniqueProblems }]
    : [];
}

function compareFormatting(
  actual: EffectiveFormatting,
  expected: HeadingLevelFormatRuleExpected,
): string[] {
  const problems: string[] = [];

  if (expected.fontFamily !== undefined && actual.fontFamily !== expected.fontFamily) {
    problems.push(
      `Yazı tipi ${actual.fontFamily ?? "belirlenemedi"} bulundu; ${expected.fontFamily} bekleniyor.`,
    );
  }

  if (expected.fontSize !== undefined && actual.fontSize !== expected.fontSize) {
    problems.push(
      `Punto ${actual.fontSize ?? "belirlenemedi"} bulundu; ${expected.fontSize} bekleniyor.`,
    );
  }

  if (expected.bold !== undefined && actual.bold !== expected.bold) {
    problems.push(
      expected.bold
        ? "Başlık kalın değil; kalın olması bekleniyor."
        : "Başlık kalın; kalın olmaması bekleniyor.",
    );
  }

  return problems;
}

function createResult(
  rule: RuleDefinition,
  expected: HeadingLevelFormatRuleExpected,
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

function formatExpected(expected: HeadingLevelFormatRuleExpected): string {
  const parts = [`düzey ${expected.level + 1}`];

  if (expected.fontFamily !== undefined) {
    parts.push(expected.fontFamily);
  }

  if (expected.fontSize !== undefined) {
    parts.push(`${expected.fontSize} punto`);
  }

  if (expected.bold !== undefined) {
    parts.push(expected.bold ? "kalın" : "kalın değil");
  }

  return parts.join(", ");
}
