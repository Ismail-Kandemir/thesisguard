import type {
  NormalizedDocument,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { getBodyParagraphs } from "./bodyParagraphs";
import type { RuleValidator } from "./RuleValidator";

export class FontSizeValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedFontSize = getExpectedFontSize(rule.expected);
    const actualFontSizes = getActualFontSizes(document);
    const passed = actualFontSizes.every((fontSize) => fontSize === expectedFontSize);

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expectedFontSize,
      actual: formatActualFontSizes(actualFontSizes),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expectedFontSize, actualFontSizes),
    };
  }
}

function getExpectedFontSize(expected: RuleExpectedValue): number {
  const value = typeof expected === "object" ? expected.value : expected;
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error("Font size kurali sayisal bir expected degeri icermelidir.");
  }

  return parsedValue;
}

function getActualFontSizes(document: NormalizedDocument): Array<number | null> {
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
    document.themeFonts,
  );

  return getBodyParagraphs(document).flatMap((paragraph) =>
    paragraph.runs.filter(isVisibleRun).map(
      (run) => formattingResolver.resolveRun(run, paragraph.styleId).fontSize,
    ),
  );
}

function isVisibleRun(run: NormalizedDocument["paragraphs"][number]["runs"][number]): boolean {
  return run.text.trim().length > 0;
}

function formatActualFontSizes(fontSizes: Array<number | null>): string | null {
  if (fontSizes.length === 0) {
    return null;
  }

  const uniqueFontSizes = new Set(
    fontSizes.map((fontSize) => (fontSize === null ? "belirtilmemis" : String(fontSize))),
  );

  return Array.from(uniqueFontSizes).join(", ");
}

function createFailureMessage(
  expectedFontSize: number,
  actualFontSizes: Array<number | null>,
): string {
  const actual = formatActualFontSizes(actualFontSizes);

  if (!actual || actualFontSizes.every((fontSize) => fontSize === null)) {
    return "Yazi boyutu uygun degil. Belgede bu ozellik tespit edilemedi.";
  }

  return `Yazi boyutu uygun degil. Beklenen: ${expectedFontSize} pt, Bulunan: ${actual} pt.`;
}
