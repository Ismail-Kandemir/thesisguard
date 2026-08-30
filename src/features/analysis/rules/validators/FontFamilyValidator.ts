import type {
  NormalizedDocument,
  Paragraph,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { getBodyParagraphs } from "./bodyParagraphs";
import { fontFamiliesEqual } from "../fontFamilyComparison";
import type { RuleValidator } from "./RuleValidator";
import { createRunEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

interface FontFamilyObservation {
  actual: string | null;
  paragraph: Paragraph;
  paragraphIndex: number;
  run: Paragraph["runs"][number];
  runIndex: number;
}

export class FontFamilyValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedFontFamily = getExpectedFontFamily(rule.expected);
    const observations = getFontFamilyObservations(document);
    const actualFontFamilies = observations.map((observation) => observation.actual);
    const passed = actualFontFamilies.every(
      (fontFamily) => fontFamiliesEqual(fontFamily, expectedFontFamily),
    );
    const failures = observations.filter(
      (observation) => !fontFamiliesEqual(observation.actual, expectedFontFamily),
    );

    const result: RuleResult = {
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

    return passed
      ? result
      : {
          ...result,
          evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((failure) =>
            createRunEvidence(failure.paragraph, failure.paragraphIndex, failure.run, failure.runIndex, {
              actual: failure.actual ?? "Belirtilmemis",
              expected: expectedFontFamily,
            }),
          ),
          evidenceTotal: failures.length,
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

function getFontFamilyObservations(document: NormalizedDocument): FontFamilyObservation[] {
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
        actual: formattingResolver.resolveRun(run, paragraph.styleId).fontFamily,
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
