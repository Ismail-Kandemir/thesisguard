import type {
  NormalizedDocument,
  ParagraphAlignment,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

export class AlignmentValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedAlignment = getExpectedAlignment(rule.expected);
    const actualAlignments = document.paragraphs.map((paragraph) => paragraph.alignment);
    const passed =
      actualAlignments.length > 0 &&
      actualAlignments.every((alignment) => alignment === expectedAlignment);

    return {
      ruleId: rule.id,
      ruleName: rule.title,
      passed,
      severity: rule.severity,
      expected: expectedAlignment,
      actual: formatActualAlignments(actualAlignments),
      message: passed ? `${rule.title} kurali basarili.` : rule.message,
    };
  }
}

function getExpectedAlignment(expected: RuleExpectedValue): ParagraphAlignment {
  const value = typeof expected === "object" ? expected.value : expected;

  if (!isParagraphAlignment(value)) {
    throw new Error("Alignment kurali gecerli bir expected degeri icermelidir.");
  }

  return value;
}

function isParagraphAlignment(value: unknown): value is ParagraphAlignment {
  return value === "left" || value === "right" || value === "center" || value === "justify";
}

function formatActualAlignments(
  alignments: Array<ParagraphAlignment | null>,
): string | null {
  if (alignments.length === 0) {
    return null;
  }

  const uniqueAlignments = new Set(
    alignments.map((alignment) => alignment ?? "belirtilmemis"),
  );

  return Array.from(uniqueAlignments).join(", ");
}
