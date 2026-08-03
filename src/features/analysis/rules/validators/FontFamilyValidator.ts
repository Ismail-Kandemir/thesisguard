import type {
  NormalizedDocument,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
  Run,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class FontFamilyValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedFontFamily = getExpectedFontFamily(rule.expected);
    const mismatchedRuns = getMismatchedRuns(document, expectedFontFamily);
    const passed = mismatchedRuns.length === 0;

    return {
      ruleId: rule.id,
      title: rule.title,
      passed,
      severity: rule.severity,
      score: passed ? rule.score : 0,
      message: passed ? `${rule.title} kurali basarili.` : rule.message,
      solution: passed ? "" : rule.solution,
      details: mismatchedRuns.map(
        ({ paragraphId, run }) =>
          `${paragraphId}: "${run.text}" font="${run.fontFamily ?? "belirtilmemis"}"`,
      ),
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

function getMismatchedRuns(
  document: NormalizedDocument,
  expectedFontFamily: string,
): Array<{ paragraphId: string; run: Run }> {
  return document.paragraphs.flatMap((paragraph) =>
    paragraph.runs
      .filter((run) => run.fontFamily !== expectedFontFamily)
      .map((run) => ({
        paragraphId: paragraph.id,
        run,
      })),
  );
}
