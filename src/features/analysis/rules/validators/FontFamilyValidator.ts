import type {
  NormalizedDocument,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class FontFamilyValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedFontFamily = getExpectedFontFamily(rule.expected);
    const actualFontFamilies = getActualFontFamilies(document);
    const passed = actualFontFamilies.every(
      (fontFamily) => fontFamily === expectedFontFamily,
    );

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      passed,
      severity: rule.severity,
      expected: expectedFontFamily,
      actual: formatActualValues(actualFontFamilies),
      message: passed ? `${rule.title} kurali basarili.` : rule.message,
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
  return document.paragraphs.flatMap((paragraph) =>
    paragraph.runs.map((run) => run.fontFamily),
  );
}

function formatActualValues(values: Array<string | null>): string | null {
  if (values.length === 0) {
    return null;
  }

  const uniqueValues = new Set(values.map((value) => value ?? "belirtilmemis"));

  return Array.from(uniqueValues).join(", ");
}
