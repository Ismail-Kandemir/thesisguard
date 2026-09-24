import type {
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
  LineSpacingValue,
  Run,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { getBodyParagraphs } from "./bodyParagraphs";
import type { RuleValidator } from "./RuleValidator";
import { createParagraphEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import {
  formatLineSpacingValue,
  formatUnsupportedLineSpacingRules,
  toComparableLineMultiple,
} from "../lineSpacingSemantics";

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
  actual: number | null;
  raw: LineSpacingValue;
  paragraph: Paragraph;
  paragraphIndex: number;
}

export class LineSpacingValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedLineSpacing = getExpectedLineSpacing(rule.expected);
    const observations = getLineSpacingObservations(document);
    const comparableLineSpacings = observations.flatMap((observation) =>
      observation.actual === null ? [] : [observation.actual],
    );
    const unsupported = observations.filter((observation) => observation.actual === null);

    const passed =
      observations.length > 0 &&
      unsupported.length === 0 &&
      comparableLineSpacings.every(
        (lineSpacing) => lineSpacing === expectedLineSpacing,
      );
    const failures = observations.filter(
      (observation) => observation.actual === null || observation.actual !== expectedLineSpacing,
    );

    const result: RuleResult = {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expectedLineSpacing,
      actual: formatActualLineSpacings(observations),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(
            expectedLineSpacing,
            observations,
            unsupported.map((observation) => observation.raw),
          ),
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
      const comparable = toComparableLineMultiple(lineSpacing);

      return [{
        actual: comparable,
        raw: lineSpacing,
        paragraph,
        paragraphIndex: document.paragraphs.indexOf(paragraph),
      }];
    });
}

function formatActualLineSpacings(
  observations: readonly LineSpacingObservation[],
): string | null {
  if (observations.length === 0) {
    return null;
  }

  return Array.from(
    new Set(observations.map((observation) => formatLineSpacingValue(observation.raw))),
  ).join(", ");
}

function createFailureMessage(
  expectedLineSpacing: number,
  observations: readonly LineSpacingObservation[],
  unsupportedValues: readonly LineSpacingValue[],
): string {
  const actual = formatActualLineSpacings(observations);

  if (!actual) {
    return "Satir araligi uygun degil. Belgede bu ozellik tespit edilemedi.";
  }

  if (unsupportedValues.length > 0) {
    return `Satir araligi statik OOXML'den ${expectedLineSpacing} satir olarak guvenle dogrulanamadi. Karsilastirilamayan lineRule: ${formatUnsupportedLineSpacingRules(unsupportedValues)}.`;
  }

  return `Satir araligi uygun degil. Beklenen: ${expectedLineSpacing} satir, Bulunan: ${actual} satir.`;
}
