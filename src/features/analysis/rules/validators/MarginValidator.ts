import type {
  NormalizedDocument,
  PageMargins,
  RuleDefinition,
  RuleEvidence,
  RuleExpectedValue,
  RuleResult,
} from "../../types";
import { createDocumentFormatEvidence } from "../ruleEvidence";
import type {
  AssessmentCoverage,
  AssessmentObservation,
  RuleAssessment,
} from "../../types/RuleAssessment";
import type { RuleValidator } from "./RuleValidator";

type MarginSide = keyof PageMargins;

interface SectionMargin {
  actual: number | null;
  sectionIndex?: number;
}

export class MarginValidator implements RuleValidator {
  constructor(private readonly side: MarginSide) {}

  /** Opt-in static margin evidence; selected/resolved rules supply source scope. */
  assess(document: NormalizedDocument, rule: RuleDefinition): RuleAssessment {
    const reference = { kind: "rule", id: rule.id } as const;
    // A terminal body section closes the parsed inventory; a fallback or only
    // paragraph section breaks cannot prove that every section was represented.
    const coverage: AssessmentCoverage = document.pageSections.at(-1)?.source === "body"
      ? { population: "closed", excludedSubjects: [] }
      : {
          population: "open",
          excludedSubjects: [],
          reason: "Page-section inventory has no terminal body section.",
          unresolvedSubjects: [{ kind: "document" }],
        };
    const expectedMargin = getAssessmentExpectedMargin(rule.expected);
    if (
      !rule.enabled || rule.category !== "margin" ||
      (rule.type !== undefined && rule.type !== `MARGIN_${this.side.toUpperCase()}`) ||
      expectedMargin === null
    ) {
      return {
        reference,
        applicability: {
          state: "undetermined",
          reason: "An enabled margin requirement for this side with a known centimeter value is required.",
        },
        coverage,
        observations: [],
      };
    }

    const observations = getSectionMargins(document, this.side).map(
      (sectionMargin): AssessmentObservation => {
        const subject = sectionMargin.sectionIndex === undefined
          ? { kind: "document" } as const
          : { kind: "page-section", sectionIndex: sectionMargin.sectionIndex } as const;
        const identity = { certainty: "not-required" } as const;
        if (typeof sectionMargin.actual !== "number" || !Number.isFinite(sectionMargin.actual)) {
          return {
            state: "undetermined",
            subject,
            identity,
            evidence: { certainty: "missing", reason: "A finite margin value was not detected." },
          };
        }
        return {
          state: "confirmed",
          subject,
          identity,
          evidence: {
            certainty: "sufficient",
            items: [createMarginEvidence(this.side, expectedMargin, sectionMargin)],
          },
          finding: sectionMargin.actual === expectedMargin ? "compliant" : "violation",
        };
      },
    );

    // Margin rules have no semantic non-applicability condition in the current model.
    return {
      reference,
      applicability: {
        state: "applicable",
        evidence: [createDocumentFormatEvidence(`${rule.id}: ${this.side} margin requirement`, {
          expected: expectedMargin,
          unit: "cm",
        })],
      },
      coverage,
      observations,
    };
  }

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

function getAssessmentExpectedMargin(expected: RuleExpectedValue): number | null {
  const value = typeof expected === "object"
    ? "value" in expected ? expected.value : undefined
    : expected;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof expected === "object" && "unit" in expected &&
      expected.unit !== undefined && expected.unit !== "cm")
  ) return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
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
  const value = typeof expected === "object"
    ? "value" in expected ? expected.value : undefined
    : expected;
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
