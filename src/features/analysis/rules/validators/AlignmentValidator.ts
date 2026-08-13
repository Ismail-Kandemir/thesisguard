import type {
  NormalizedDocument,
  ParagraphAlignment,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { getBodyParagraphs } from "./bodyParagraphs";

export class AlignmentValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedAlignment = getExpectedAlignment(rule.expected);
    const actualAlignments = getBodyParagraphs(document).map(
      (paragraph) => paragraph.alignment,
    );
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
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expectedAlignment, actualAlignments),
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

  const uniqueAlignments = new Set(alignments.map(formatAlignmentLabel));

  return Array.from(uniqueAlignments).join(", ");
}

function createFailureMessage(
  expectedAlignment: ParagraphAlignment,
  actualAlignments: Array<ParagraphAlignment | null>,
): string {
  const actual = formatActualAlignments(actualAlignments);

  if (!actual || actualAlignments.every((alignment) => alignment === null)) {
    return "Paragraf hizalamasi uygun degil. Belgede bu ozellik tespit edilemedi.";
  }

  return `Paragraf hizalamasi uygun degil. Beklenen: ${formatAlignmentLabel(
    expectedAlignment,
  )}, Bulunan: ${actual}.`;
}

function formatAlignmentLabel(alignment: ParagraphAlignment | null): string {
  if (alignment === null) {
    return "Belirtilmemis";
  }

  const labels: Record<ParagraphAlignment, string> = {
    left: "Sola hizali",
    right: "Saga hizali",
    center: "Ortali",
    justify: "Iki yana yasli",
  };

  return labels[alignment];
}
