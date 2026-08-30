import type {
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
  Run,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { getBodyParagraphs } from "./bodyParagraphs";
import type { RuleValidator } from "./RuleValidator";
import { createParagraphEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

const OOXML_UNITS_PER_LINE = 240;

const EMPTY_RUN: Run = {
  text: "",
  styleId: null,
  bold: false,
  italic: false,
  underline: false,
  fontFamily: null,
  fontSize: null,
};

interface LineSpacingObservation {
  actual: number;
  paragraph: Paragraph;
  paragraphIndex: number;
}

export class LineSpacingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedLineSpacing = getExpectedLineSpacing(rule.expected);
    const observations = getLineSpacingObservations(document);
    const actualLineSpacings = observations.map((observation) => observation.actual);

    const passed =
      actualLineSpacings.length > 0 &&
      actualLineSpacings.every(
        (lineSpacing) => lineSpacing === expectedLineSpacing,
      );
    const failures = observations.filter(
      (observation) => observation.actual !== expectedLineSpacing,
    );

    const result: RuleResult = {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expectedLineSpacing,
      actual: formatActualLineSpacings(actualLineSpacings),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expectedLineSpacing, actualLineSpacings),
    };

    return passed || failures.length === 0
      ? result
      : {
          ...result,
          evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((failure) =>
            createParagraphEvidence(failure.paragraph, failure.paragraphIndex, {
              actual: failure.actual,
              expected: expectedLineSpacing,
              unit: "satır",
            }),
          ),
          evidenceTotal: failures.length,
        };
  }
}

function getExpectedLineSpacing(expected: RuleExpectedValue): number {
  const value =
    typeof expected === "object" && "value" in expected
      ? expected.value
      : expected;
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(
      "Line spacing kurali sayisal bir expected degeri icermelidir.",
    );
  }

  return parsedValue;
}

function getLineSpacingObservations(document: NormalizedDocument): LineSpacingObservation[] {
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
  );

  return getBodyParagraphs(document, {
    excludeCaptions: true,
    excludeTableCells: true,
    excludeTableOfContents: true,
    excludeFigureCarriers: true,
  })
    .flatMap((paragraph) => {
      const run = paragraph.runs[0] ?? EMPTY_RUN;
      const lineSpacing = formattingResolver.resolveRun(
        run,
        paragraph.styleId,
        paragraph.lineSpacing,
      ).lineSpacing;

      if (lineSpacing === null) {
        return [];
      }

      return [{
        actual: convertOoxmlSpacingToLines(lineSpacing),
        paragraph,
        paragraphIndex: document.paragraphs.indexOf(paragraph),
      }];
    });
}

function convertOoxmlSpacingToLines(lineSpacing: number): number {
  return lineSpacing / OOXML_UNITS_PER_LINE;
}

function formatActualLineSpacings(
  lineSpacings: number[],
): string | null {
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
