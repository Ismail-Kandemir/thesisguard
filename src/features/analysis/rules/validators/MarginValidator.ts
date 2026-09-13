import type {
  NormalizedDocument,
  PageMargins,
  RuleDefinition,
  RuleEvidence,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import { createDocumentFormatEvidence } from "../ruleEvidence";
import type { RuleValidator } from "./RuleValidator";

type MarginSide = keyof PageMargins;

interface SectionMargin {
  actual: number | null;
  sectionIndex?: number;
}

export class MarginValidator implements RuleValidator {
  constructor(private readonly side: MarginSide) {}

  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    const expectedMargin = getExpectedMargin(rule.expected);
    const sectionMargins = getSectionMargins(document, this.side);
    const failedSectionMargins = sectionMargins.filter(
      (sectionMargin) => sectionMargin.actual !== expectedMargin,
    );
    const passed = sectionMargins.length > 0 && failedSectionMargins.length === 0;
    const actualMargin = formatActualMargin(sectionMargins);

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
      ...(passed
        ? {}
        : {
            evidence: failedSectionMargins.map((sectionMargin) =>
              createMarginEvidence(this.side, expectedMargin, sectionMargin),
            ),
            evidenceTotal: failedSectionMargins.length,
          }),
    };
  }
}

function getSectionMargins(
  document: Readonly<NormalizedDocument>,
  side: MarginSide,
): SectionMargin[] {
  if (document.pageSections.length === 0) {
    return [{ actual: document.pageMargins[side] }];
  }

  return document.pageSections.map((section) => ({
    actual: section.pageMargins[side],
    sectionIndex: section.index,
  }));
}

function createMarginEvidence(
  side: MarginSide,
  expectedMargin: number,
  sectionMargin: SectionMargin,
): RuleEvidence {
  return createDocumentFormatEvidence(`${formatMarginSide(side)} kenar boşluğu`, {
    actual: sectionMargin.actual,
    expected: expectedMargin,
    sectionIndex: sectionMargin.sectionIndex,
    unit: "cm",
  });
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
  actualMargin: string | number | null,
): string {
  if (actualMargin === null) {
    return `${formatMarginSide(side)} kenar boslugu uygun degil. Belgede bu ozellik tespit edilemedi.`;
  }

  const actualText = typeof actualMargin === "number" ? `${actualMargin} cm` : actualMargin;

  return `${formatMarginSide(
    side,
  )} kenar boslugu uygun degil. Beklenen: ${formatMarginSide(
    side,
  )} kenar ${expectedMargin} cm, Bulunan: ${actualText}.`;
}

function formatActualMargin(sectionMargins: readonly SectionMargin[]): string | number | null {
  if (sectionMargins.length === 0) {
    return null;
  }

  if (sectionMargins.length === 1) {
    return sectionMargins[0].actual;
  }

  return sectionMargins
    .map((sectionMargin, index) => {
      const sectionNumber = sectionMargin.sectionIndex === undefined
        ? index + 1
        : sectionMargin.sectionIndex + 1;
      const value = sectionMargin.actual === null
        ? "Tespit edilemedi"
        : `${sectionMargin.actual} cm`;

      return `Bölüm ${sectionNumber}: ${value}`;
    })
    .join("; ");
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
