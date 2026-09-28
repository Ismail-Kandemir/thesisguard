import type {
  CaptionKind,
  NormalizedDocument,
  ObjectMinimumWidthRuleExpected,
  ObjectRepresentationOccurrence,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import { createObjectEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import { getDeclaredAcademicFigures } from "../objectApplicability";
import type { RuleValidator } from "./RuleValidator";

interface EvaluatedObject {
  occurrence: ObjectRepresentationOccurrence;
  label: string;
  widthCm: number | null;
  dimensionStatus: string;
}

export class ObjectMinimumWidthValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const items = getEvaluatedObjects(document, expected.object);

    if (items.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadi",
        `${objectName(expected.object)} bulunmadigi icin minimum genislik kontrolu uygulanmadi.`,
      );
    }

    const tolerance = expected.toleranceCm ?? 0;
    const failures = items.filter((item) =>
      item.widthCm === null || item.widthCm + tolerance < expected.minWidthCm,
    );

    if (failures.length === 0) {
      return createResult(
        rule,
        expected,
        "PASSED",
        formatActual(items),
        `${items.length} ${objectNameLower(expected.object)} minimum genislik beklentisini karsiliyor.`,
      );
    }

    return createResult(
      rule,
      expected,
      "FAILED",
      formatActual(items),
      `${failures.length} ${objectNameLower(expected.object)} minimum genislik beklentisini karsilamiyor veya genislik kaniti guvenilir degil.`,
      failures.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((item) =>
        createObjectEvidence(expected.object, item.occurrence, {
          actual: item.widthCm === null
            ? `dimension evidence: ${item.dimensionStatus}`
            : `${item.widthCm} cm`,
          expected: `>= ${expected.minWidthCm} cm`,
          objectLabel: item.label,
        }),
      ),
      failures.length,
    );
  }
}

function getEvaluatedObjects(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): EvaluatedObject[] {
  if (object !== "figure") {
    return [];
  }

  return getDeclaredAcademicFigures(document).map((figure, index) => {
    const label = figure.caption ? `Sekil ${figure.caption.number}` : `${index + 1}. sekil`;
    const dimensions = figure.representation.dimensions;

    return {
      occurrence: figure.representation,
      label,
      widthCm: dimensions.status === "available" ? dimensions.widthCm : null,
      dimensionStatus: dimensions.status,
    };
  });
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_MIN_WIDTH" } {
  if (rule.type !== "OBJECT_MIN_WIDTH") {
    throw new Error("ObjectMinimumWidthValidator only validates OBJECT_MIN_WIDTH rules.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectMinimumWidthRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("object" in expected) ||
    (expected.object !== "table" && expected.object !== "figure") ||
    !("minWidthCm" in expected) ||
    typeof expected.minWidthCm !== "number" ||
    !Number.isFinite(expected.minWidthCm) ||
    expected.minWidthCm <= 0 ||
    ("toleranceCm" in expected &&
      (typeof expected.toleranceCm !== "number" ||
        !Number.isFinite(expected.toleranceCm) ||
        expected.toleranceCm < 0))
  ) {
    throw new Error("OBJECT_MIN_WIDTH must define object and positive minWidthCm.");
  }

  return expected as ObjectMinimumWidthRuleExpected;
}

function createResult(
  rule: RuleDefinition,
  expected: ObjectMinimumWidthRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `${objectName(expected.object)} genisligi >= ${expected.minWidthCm} cm`,
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatActual(items: readonly EvaluatedObject[]): string {
  return items.map((item) =>
    `${item.label}: ${item.widthCm === null ? `dimension evidence ${item.dimensionStatus}` : `${item.widthCm} cm`}`,
  ).join("; ");
}

function objectName(object: CaptionKind): "Tablo" | "Sekil" {
  return object === "table" ? "Tablo" : "Sekil";
}

function objectNameLower(object: CaptionKind): "tablo" | "sekil" {
  return object === "table" ? "tablo" : "sekil";
}
