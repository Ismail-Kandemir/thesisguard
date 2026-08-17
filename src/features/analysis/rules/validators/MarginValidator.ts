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
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expectedMargin,
      actual: actualMargin,
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(this.side, expectedMargin, actualMargin),
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

function createFailureMessage(
  side: MarginSide,
  expectedMargin: number,
  actualMargin: number | null,
): string {
  if (actualMargin === null) {
    return `${formatMarginSide(side)} kenar boslugu uygun degil. Belgede bu ozellik tespit edilemedi.`;
  }

  return `${formatMarginSide(
    side,
  )} kenar boslugu uygun degil. Beklenen: ${formatMarginSide(
    side,
  )} kenar ${expectedMargin} cm, Bulunan: ${actualMargin} cm.`;
}

function formatMarginSide(side: MarginSide): string {
  const labels: Record<MarginSide, string> = {
    left: "Sol",
    right: "Sag",
    top: "Ust",
    bottom: "Alt",
  };

  return labels[side];
}
