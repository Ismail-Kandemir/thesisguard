import type {
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { getBodyParagraphs } from "./bodyParagraphs";
import type { RuleValidator } from "./RuleValidator";
import { createRunEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

interface FontSizeObservation {
  actual: number | null;
  paragraph: Paragraph;
  paragraphIndex: number;
  run: Paragraph["runs"][number];
  runIndex: number;
}

export class FontSizeValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedFontSize = getExpectedFontSize(rule.expected);
    const observations = getFontSizeObservations(document);
    const actualFontSizes = observations.map((observation) => observation.actual);
    const passed = actualFontSizes.every((fontSize) => fontSize === expectedFontSize);
    const failures = observations.filter((observation) => observation.actual !== expectedFontSize);

    const result: RuleResult = {
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

    return passed
      ? result
      : {
          ...result,
          evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((failure) =>
            createRunEvidence(failure.paragraph, failure.paragraphIndex, failure.run, failure.runIndex, {
              actual: failure.actual,
              expected: expectedFontSize,
              unit: "punto",
            }),
          ),
          evidenceTotal: failures.length,
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

function getFontSizeObservations(document: NormalizedDocument): FontSizeObservation[] {
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
    document.themeFonts,
  );

  const paragraphIndexById = new Map(document.paragraphs.map((paragraph, index) => [paragraph.id, index]));

  return getBodyParagraphs(document).flatMap((paragraph) =>
    paragraph.runs.flatMap((run, runIndex) => {
      if (!isVisibleRun(run)) {
        return [];
      }

      return [{
        actual: formattingResolver.resolveRun(run, paragraph.styleId).fontSize,
        paragraph,
        paragraphIndex: paragraphIndexById.get(paragraph.id) ?? 0,
        run,
        runIndex,
      }];
    }),
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
