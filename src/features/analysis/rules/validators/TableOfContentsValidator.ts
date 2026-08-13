import type {
  NormalizedDocument,
  RuleDefinition,
  RuleResult,
  TableOfContentsRuleExpected,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class TableOfContentsValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertTableOfContentsRule(rule);
    const expected = getTableOfContentsExpected(rule.expected);
    const hasSection = document.tableOfContents.hasSection;
    const passed = !expected.required || hasSection;

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      passed,
      severity: rule.severity,
      expected: expected.required
        ? "İçindekiler bölümü bulunmalı"
        : "İçindekiler bölümü zorunlu değil",
      actual: hasSection ? "Bulundu" : "Tespit edilmedi",
      message: passed
        ? "İçindekiler bölümü bulundu."
        : "İçindekiler bölümü tespit edilemedi.",
    };
  }
}

function assertTableOfContentsRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "TABLE_OF_CONTENTS" } {
  if (rule.type !== "TABLE_OF_CONTENTS") {
    throw new Error(
      "TableOfContentsValidator yalnızca TABLE_OF_CONTENTS tipindeki kuralları çalıştırır.",
    );
  }
}

function getTableOfContentsExpected(
  expected: RuleDefinition["expected"],
): TableOfContentsRuleExpected {
  if (
    typeof expected !== "object" ||
    !("required" in expected) ||
    typeof expected.required !== "boolean"
  ) {
    throw new Error(
      "TABLE_OF_CONTENTS kuralı boolean required değeri içermelidir.",
    );
  }

  return expected;
}
