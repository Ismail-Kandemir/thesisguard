import type {
  CaptionKind,
  CaptionPosition,
  DocumentFigureOccurrence,
  DocumentTableOccurrence,
  NormalizedDocument,
  ObjectCaptionPlacementRuleExpected,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

type CaptionOccurrence = DocumentTableOccurrence | DocumentFigureOccurrence;

export class ObjectCaptionPlacementValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const occurrences = getReliableOccurrences(document, expected.object);

    if (occurrences.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${objectName(expected.object)} bulunmadığı veya konumu güvenle belirlenemediği için başlık konumu kontrol edilmedi.`,
      );
    }

    const wrong = occurrences.filter(
      (occurrence) => occurrence.captionPosition !== expected.position,
    );

    if (wrong.length === 0) {
      return createResult(
        rule,
        expected,
        "PASSED",
        formatActual(occurrences),
        `${objectName(expected.object)} başlıklarının konumu uygun.`,
      );
    }

    return createResult(
      rule,
      expected,
      "FAILED",
      formatActual(occurrences),
      createFailureMessage(expected.object, occurrences.length, wrong),
    );
  }
}

function getReliableOccurrences(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): CaptionOccurrence[] {
  return object === "table"
    ? document.tables.items.filter((item) => !item.isNested)
    : document.figures.items.filter((item) => item.drawingType === "inline");
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_CAPTION_PLACEMENT" } {
  if (rule.type !== "OBJECT_CAPTION_PLACEMENT") {
    throw new Error("ObjectCaptionPlacementValidator yalnızca OBJECT_CAPTION_PLACEMENT kurallarını çalıştırır.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectCaptionPlacementRuleExpected {
  if (
    typeof expected !== "object" || expected === null ||
    !("object" in expected) || !isObjectKind(expected.object) ||
    !("position" in expected) || (expected.position !== "before" && expected.position !== "after")
  ) {
    throw new Error("OBJECT_CAPTION_PLACEMENT kuralı geçerli object ve position içermelidir.");
  }

  return expected as ObjectCaptionPlacementRuleExpected;
}

function isObjectKind(value: unknown): value is CaptionKind {
  return value === "table" || value === "figure";
}

function createResult(
  rule: RuleDefinition,
  expected: ObjectCaptionPlacementRuleExpected,
  status: RuleResultStatus,
  actual: string,
  message: string,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleName: rule.title,
    status,
    passed: status === "PASSED",
    severity: rule.severity,
    expected: `${objectName(expected.object)} başlığı: ${positionName(expected.position)}`,
    actual,
    message,
  };
}

function formatActual(occurrences: readonly CaptionOccurrence[]): string {
  return occurrences
    .map((item, index) => `${index + 1}: ${positionName(item.captionPosition)}`)
    .join(", ");
}

function createFailureMessage(
  object: CaptionKind,
  total: number,
  wrong: readonly CaptionOccurrence[],
): string {
  const missing = wrong.filter((item) => item.captionPosition === "none").length;
  const ambiguous = wrong.filter((item) => item.captionPosition === "ambiguous").length;

  if (total === 1 && missing === 1) {
    return `${objectName(object)} başlığı tespit edilemedi.`;
  }

  if (total === 1 && ambiguous === 1) {
    return `Başlık ile ${objectName(object).toLocaleLowerCase("tr-TR")} eşleştirmesi güvenilir biçimde belirlenemedi.`;
  }

  if (total === 1) {
    return object === "table"
      ? "Tablo başlığı tablonun üstünde bulunmalıdır."
      : "Şekil başlığı şeklin altında bulunmalıdır.";
  }

  return `${total} ${object === "table" ? "tablodan" : "şekilden"} ${wrong.length} tanesinin başlık konumu uygun değil.`;
}

function objectName(object: CaptionKind): "Tablo" | "Şekil" {
  return object === "table" ? "Tablo" : "Şekil";
}

function positionName(position: CaptionPosition): string {
  switch (position) {
    case "before": return "Üstte";
    case "after": return "Altta";
    case "none": return "Başlık tespit edilemedi";
    case "ambiguous": return "Eşleştirme belirsiz";
  }
}
