import type {
  NormalizedDocument,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { getBodyParagraphs } from "./bodyParagraphs";
import { fontFamiliesEqual } from "../fontFamilyComparison";
import type { RuleValidator } from "./RuleValidator";

export class FontFamilyValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedFontFamily = getExpectedFontFamily(rule.expected);
    const actualFontFamilies = getActualFontFamilies(document);
    const passed = actualFontFamilies.every(
      (fontFamily) => fontFamiliesEqual(fontFamily, expectedFontFamily),
    );

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expectedFontFamily,
      actual: formatActualValues(actualFontFamilies),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expectedFontFamily, actualFontFamilies),
    };
  }
}

function getExpectedFontFamily(expected: RuleExpectedValue): string {
  if (typeof expected === "string") {
    return expected;
  }

  if (typeof expected === "object") {
    return String(expected.value);
  }

  return String(expected);
}

function getActualFontFamilies(document: NormalizedDocument): Array<string | null> {
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
    document.themeFonts,
  );

  return getBodyParagraphs(document).flatMap((paragraph) =>
    paragraph.runs.filter(isVisibleRun).map(
      (run) => formattingResolver.resolveRun(run, paragraph.styleId).fontFamily,
    ),
  );
}

function isVisibleRun(run: NormalizedDocument["paragraphs"][number]["runs"][number]): boolean {
  return run.text.trim().length > 0;
}

function formatActualValues(values: Array<string | null>): string | null {
  if (values.length === 0) {
    return null;
  }

  const uniqueValues = new Set(values.map((value) => value ?? "Belirtilmemis"));

  return Array.from(uniqueValues).join(", ");
}

function createFailureMessage(
  expectedFontFamily: string,
  actualFontFamilies: Array<string | null>,
): string {
  const actual = formatActualValues(actualFontFamilies);

  if (!actual || actualFontFamilies.every((fontFamily) => fontFamily === null)) {
    return "Yazi tipi uygun degil. Belgede bu ozellik tespit edilemedi.";
  }

  return `Yazi tipi uygun degil. Beklenen: ${expectedFontFamily}, Bulunan: ${actual}.`;
}
