import type {
  NormalizedDocument,
  Paragraph,
  ParagraphAlignment,
  RuleDefinition,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { getBodyParagraphs } from "./bodyParagraphs";
import { createParagraphEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

interface AlignmentObservation {
  actual: ParagraphAlignment | null;
  paragraph: Paragraph;
  paragraphIndex: number;
}

export class AlignmentValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedAlignment = getExpectedAlignment(rule.expected);

    const observations = getAlignmentObservations(document);
    const actualAlignments = observations.map((observation) => observation.actual);

    const passed =
      actualAlignments.length > 0 &&
      actualAlignments.every((alignment) => alignment === expectedAlignment);
    const failures = observations.filter(
      (observation) => observation.actual !== expectedAlignment,
    );

    const result: RuleResult = {
      ruleId: rule.id,
      ruleName: rule.title,
      status: passed ? "PASSED" : "FAILED",
      passed,
      severity: rule.severity,
      expected: expectedAlignment,
      actual: formatActualAlignments(actualAlignments),
      message: passed
        ? `${rule.title} kurali basarili.`
        : createFailureMessage(expectedAlignment, actualAlignments),
    };

    return passed
      ? result
      : {
          ...result,
          evidence: failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((failure) =>
            createParagraphEvidence(failure.paragraph, failure.paragraphIndex, {
              actual: formatAlignmentLabel(failure.actual),
              expected: formatAlignmentLabel(expectedAlignment),
            }),
          ),
          evidenceTotal: failures.length,
        };
  }
}

function getAlignmentObservations(document: NormalizedDocument): AlignmentObservation[] {
  return getBodyParagraphs(document, {
    excludeCaptions: true,
    excludeTableCells: true,
    excludeTableOfContents: true,
    excludeFigureCarriers: true,
  }).map((paragraph) => ({
    actual: paragraph.alignment,
    paragraph,
    paragraphIndex: document.paragraphs.indexOf(paragraph),
  }));
}

function getExpectedAlignment(expected: RuleExpectedValue): ParagraphAlignment {
  const value = typeof expected === "object" ? expected.value : expected;

  if (!isParagraphAlignment(value)) {
    throw new Error(
      "Alignment kurali gecerli bir expected degeri icermelidir.",
    );
  }

  return value;
}

function isParagraphAlignment(value: unknown): value is ParagraphAlignment {
  return (
    value === "left" ||
    value === "right" ||
    value === "center" ||
    value === "justify"
  );
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
