import type {
  EffectiveFormatting,
  HeadingLevel,
  NormalizedDocument,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
  Run,
  StyleDefinition,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type { RuleValidator } from "./RuleValidator";

const SUPPORTED_HEADING_LEVELS: HeadingLevel[] = ["Heading1", "Heading2", "Heading3"];
const EMPTY_RUN: Run = {
  text: "",
  bold: false,
  italic: false,
  underline: false,
  fontFamily: null,
  fontSize: null,
};

interface ExpectedHeadingFormatting {
  level: HeadingLevel;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
}

export class HeadingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expected = getExpectedHeadingFormatting(rule);

    if (rule.category !== "heading") {
      return {
        ruleId: rule.id,
        ruleName: rule.title,
        status: "FAILED",
        passed: false,
        severity: rule.severity,
        expected: formatExpectedHeading(expected),
        actual: null,
        message: "HeadingValidator yalnizca heading kategorisindeki kurallari calistirir.",
      };
    }

    const headingStyle = findHeadingStyle(document.styles, expected.level);
    const actualFormatting = headingStyle
      ? getEffectiveHeadingFormatting(document, headingStyle)
      : null;
    const passed =
      actualFormatting !== null &&
      actualFormatting.fontFamily === expected.fontFamily &&
      actualFormatting.fontSize === expected.fontSize &&
      actualFormatting.bold === expected.bold;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: formatExpectedHeading(expected),
      actual: formatActualHeading(expected.level, actualFormatting),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expected, actualFormatting),
    };
  }
}

function getExpectedHeadingFormatting(rule: RuleDefinition): ExpectedHeadingFormatting {
  const expected = rule.expected;

  if (typeof expected !== "object") {
    throw new Error("Heading kurali nesne tipinde expected degeri icermelidir.");
  }

  const level = expected.level ?? parseHeadingLevel(expected.value);

  if (!level) {
    throw new Error("Heading kurali Heading1, Heading2 veya Heading3 seviyesi icermelidir.");
  }

  if (typeof expected.fontFamily !== "string") {
    throw new Error("Heading kurali fontFamily degeri icermelidir.");
  }

  if (typeof expected.fontSize !== "number" || !Number.isFinite(expected.fontSize)) {
    throw new Error("Heading kurali sayisal fontSize degeri icermelidir.");
  }

  if (typeof expected.bold !== "boolean") {
    throw new Error("Heading kurali boolean bold degeri icermelidir.");
  }

  return {
    level,
    fontFamily: expected.fontFamily,
    fontSize: expected.fontSize,
    bold: expected.bold,
  };
}

function findHeadingStyle(
  styles: StyleDefinition[],
  headingLevel: HeadingLevel,
): StyleDefinition | null {
  const normalizedHeadingLevel = normalizeHeadingName(headingLevel);

  return (
    styles.find((style) => {
      const normalizedStyleName = style.name ? normalizeHeadingName(style.name) : null;
      const normalizedStyleId = normalizeHeadingName(style.id);

      return (
        normalizedStyleName === normalizedHeadingLevel ||
        normalizedStyleId === normalizedHeadingLevel
      );
    }) ?? null
  );
}

function getEffectiveHeadingFormatting(
  document: NormalizedDocument,
  headingStyle: StyleDefinition,
): EffectiveFormatting {
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
  );

  return formattingResolver.resolveRun(EMPTY_RUN, headingStyle.id);
}

function parseHeadingLevel(value: RuleExpectedValue): HeadingLevel | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeHeadingName(value);

  return (
    SUPPORTED_HEADING_LEVELS.find(
      (headingLevel) => normalizeHeadingName(headingLevel) === normalizedValue,
    ) ?? null
  );
}

function normalizeHeadingName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatExpectedHeading(expected: ExpectedHeadingFormatting): string {
  return `${formatHeadingLevel(expected.level)}: ${expected.fontFamily}, ${
    expected.fontSize
  } pt, ${formatBoldLabel(expected.bold)}`;
}

function formatActualHeading(
  headingLevel: HeadingLevel,
  formatting: EffectiveFormatting | null,
): string | null {
  if (!formatting) {
    return null;
  }

  return `${headingLevel}: ${formatting.fontFamily ?? "belirtilmemis"}, ${
    formatting.fontSize ?? "belirtilmemis"
  } pt, ${formatBoldLabel(formatting.bold)}`;
}

function createFailureMessage(
  expected: ExpectedHeadingFormatting,
  actualFormatting: EffectiveFormatting | null,
): string {
  const headingLabel = formatHeadingLevel(expected.level);
  const expectedText = `${expected.fontFamily}, ${expected.fontSize} pt, ${formatBoldLabel(
    expected.bold,
  )}`;

  if (!actualFormatting) {
    return `${headingLabel} beklenen bicimde degil. Beklenen: ${expectedText}. Belgede bu ozellik tespit edilemedi.`;
  }

  return `${headingLabel} beklenen bicimde degil. Beklenen: ${expectedText}. Bulunan: ${
    actualFormatting.fontFamily ?? "Belirtilmemis"
  }, ${actualFormatting.fontSize ?? "Belirtilmemis"} pt, ${formatBoldLabel(
    actualFormatting.bold,
  )}.`;
}

function formatHeadingLevel(level: HeadingLevel): string {
  const labels: Record<HeadingLevel, string> = {
    Heading1: "Heading 1",
    Heading2: "Heading 2",
    Heading3: "Heading 3",
  };

  return labels[level];
}

function formatBoldLabel(bold: boolean): string {
  return bold ? "Kalin" : "Kalin degil";
}
