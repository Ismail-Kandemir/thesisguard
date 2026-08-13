import type {
  NormalizedDocument,
  ReferencesRuleExpected,
  RuleDefinition,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class ReferencesValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertReferencesRule(rule);
    const expected = getReferencesExpected(rule.expected);
    const hasSection = document.references.hasSection;
    const passed = !expected.required || hasSection;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      passed,
      severity: rule.severity,
      expected: expected.required
        ? "Kaynaklar bölümü bulunmalı"
        : "Kaynaklar bölümü zorunlu değil",
      actual: hasSection ? "Bulundu" : "Tespit edilmedi",
      message: passed
        ? hasSection
          ? "Kaynaklar bölümü bulundu."
          : "Kaynaklar bölümü zorunlu değil."
        : "Kaynaklar bölümü tespit edilemedi.",
    };
  }
}

function assertReferencesRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "REFERENCES" } {
  if (rule.type !== "REFERENCES") {
    throw new Error(
      "ReferencesValidator yalnızca REFERENCES tipindeki kuralları çalıştırır.",
    );
  }
}

function getReferencesExpected(
  expected: RuleDefinition["expected"],
): ReferencesRuleExpected {
  if (
    typeof expected !== "object" ||
    !("required" in expected) ||
    typeof expected.required !== "boolean"
  ) {
    throw new Error(
      "REFERENCES kuralı boolean required değeri içermelidir.",
    );
  }

  return expected;
}
