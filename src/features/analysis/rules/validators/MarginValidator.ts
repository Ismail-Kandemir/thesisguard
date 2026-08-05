import type {
  NormalizedDocument,
  PageMargins,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

type MarginSide = keyof PageMargins;

export class MarginValidator implements RuleValidator {
  constructor(private readonly side: MarginSide) {}

  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedMargin = getExpectedMargin(rule.expected);
    const actualMargin = document.pageMargins[this.side];
    const passed = actualMargin !== null && actualMargin === expectedMargin;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      passed,
      severity: rule.severity,
      expected: expectedMargin,
      actual: actualMargin,
      message: passed ? `${rule.title} kurali basarili.` : rule.message,
    };
  }
}

function getExpectedMargin(expected: RuleExpectedValue): number {
  const value = typeof expected === "object" ? expected.value : expected;
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error("Margin kurali sayisal bir expected degeri icermelidir.");
  }

  return parsedValue;
}
