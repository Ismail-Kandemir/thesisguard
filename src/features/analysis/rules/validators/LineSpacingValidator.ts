import type {
  NormalizedDocument,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
  Run,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type { RuleValidator } from "./RuleValidator";

const OOXML_UNITS_PER_LINE = 240;
const EMPTY_RUN: Run = {
  text: "",
  bold: false,
  italic: false,
  underline: false,
  fontFamily: null,
  fontSize: null,
};

export class LineSpacingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedLineSpacing = getExpectedLineSpacing(rule.expected);
    const actualLineSpacings = getActualLineSpacings(document);
    const passed =
      actualLineSpacings.length > 0 &&
      actualLineSpacings.every((lineSpacing) => lineSpacing === expectedLineSpacing);

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      passed,
      severity: rule.severity,
      expected: expectedLineSpacing,
      actual: formatActualLineSpacings(actualLineSpacings),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expectedLineSpacing, actualLineSpacings),
    };
  }
}

function getExpectedLineSpacing(expected: RuleExpectedValue): number {
  const value = typeof expected === "object" ? expected.value : expected;
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error("Line spacing kurali sayisal bir expected degeri icermelidir.");
  }

  return parsedValue;
}

function getActualLineSpacings(document: NormalizedDocument): number[] {
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
  );

  return document.paragraphs
    .map((paragraph) => {
      const run = paragraph.runs[0] ?? EMPTY_RUN;

      return formattingResolver.resolveRun(run, paragraph.styleId, paragraph.lineSpacing)
        .lineSpacing;
    })
    .filter((lineSpacing): lineSpacing is number => lineSpacing !== null)
    .map(convertOoxmlSpacingToLines);
}

function convertOoxmlSpacingToLines(lineSpacing: number): number {
  return lineSpacing / OOXML_UNITS_PER_LINE;
}

function formatActualLineSpacings(lineSpacings: number[]): string | null {
  if (lineSpacings.length === 0) {
    return null;
  }

  return Array.from(new Set(lineSpacings)).join(", ");
}

function createFailureMessage(
  expectedLineSpacing: number,
  actualLineSpacings: number[],
): string {
  const actual = formatActualLineSpacings(actualLineSpacings);

  if (!actual) {
    return "Satir araligi uygun degil. Belgede bu ozellik tespit edilemedi.";
  }

  return `Satir araligi uygun degil. Beklenen: ${expectedLineSpacing} satir, Bulunan: ${actual} satir.`;
}
