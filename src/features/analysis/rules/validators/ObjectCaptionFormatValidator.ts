import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type {
  CaptionKind,
  DocumentCaption,
  NormalizedDocument,
  ObjectCaptionFormatRuleExpected,
  Paragraph,
  ParagraphAlignment,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { createCaptionEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";

const OOXML_UNITS_PER_LINE = 240;

interface CaptionFormatting {
  caption: DocumentCaption;
  alignment: ParagraphAlignment | null;
  lineSpacing: number | null;
}

export class ObjectCaptionFormatValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const formatting = getAssociatedCaptionFormatting(document, expected.object);

    if (formatting.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `${objectName(expected.object)} başlığı güvenilir biçimde ilişkilendirilemediği için biçim kontrolü uygulanmadı.`,
      );
    }

    const wrong = formatting.filter(
      (item) => item.alignment !== expected.alignment || item.lineSpacing !== expected.lineSpacing,
    );
    const status: RuleResultStatus = wrong.length === 0 ? "PASSED" : "FAILED";

    return createResult(
      rule,
      expected,
      status,
      formatActual(formatting),
      status === "PASSED"
        ? `${objectName(expected.object)} başlıklarının biçimi uygun.`
        : createFailureMessage(expected.object, formatting.length, wrong),
      status === "FAILED"
        ? wrong.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((item) =>
            createCaptionEvidence(item.caption, {
              actual: formatActual([item]),
              expected: `${alignmentName(expected.alignment)}, ${expected.lineSpacing} satır`,
            }),
          )
        : undefined,
      status === "FAILED" ? wrong.length : undefined,
    );
  }
}

function getAssociatedCaptionFormatting(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): CaptionFormatting[] {
  const occurrences = object === "table"
    ? document.tables.items.filter((item) => !item.isNested)
    : document.figures.items.filter((item) => item.drawingType === "inline");
  const captionById = new Map(document.captions.items.map((caption) => [caption.id, caption]));
  const paragraphById = new Map(document.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const resolver = new EffectiveFormattingResolver(document.styles, document.documentDefaults);

  return occurrences.flatMap((occurrence) => {
    if (occurrence.captionId === null || occurrence.captionPosition === "ambiguous") {
      return [];
    }

    const caption = captionById.get(occurrence.captionId);
    const paragraph = caption ? paragraphById.get(caption.paragraphId) : undefined;

    return caption && paragraph
      ? [resolveFormatting(caption, paragraph, resolver)]
      : [];
  });
}

function resolveFormatting(
  caption: DocumentCaption,
  paragraph: Paragraph,
  resolver: EffectiveFormattingResolver,
): CaptionFormatting {
  const lineSpacing = resolver.resolveParagraphLineSpacing(
    paragraph.styleId,
    paragraph.lineSpacing,
  );

  return {
    caption,
    alignment: resolver.resolveParagraphAlignment(paragraph.styleId, paragraph.alignment),
    lineSpacing: lineSpacing === null ? null : lineSpacing / OOXML_UNITS_PER_LINE,
  };
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_CAPTION_FORMAT" } {
  if (rule.type !== "OBJECT_CAPTION_FORMAT") {
    throw new Error("ObjectCaptionFormatValidator yalnızca OBJECT_CAPTION_FORMAT kurallarını çalıştırır.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectCaptionFormatRuleExpected {
  if (
    typeof expected !== "object" || expected === null ||
    !("object" in expected) || (expected.object !== "table" && expected.object !== "figure") ||
    !("alignment" in expected) || !isAlignment(expected.alignment) ||
    !("lineSpacing" in expected) || typeof expected.lineSpacing !== "number" ||
    !Number.isFinite(expected.lineSpacing) || expected.lineSpacing <= 0
  ) {
    throw new Error("OBJECT_CAPTION_FORMAT kuralı geçerli object, alignment ve lineSpacing içermelidir.");
  }

  return expected as ObjectCaptionFormatRuleExpected;
}

function isAlignment(value: unknown): value is ParagraphAlignment {
  return value === "left" || value === "center" || value === "right" || value === "justify";
}

function createResult(
  rule: RuleDefinition,
  expected: ObjectCaptionFormatRuleExpected,
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
    expected: `${alignmentName(expected.alignment)}, ${expected.lineSpacing} satır`,
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatActual(items: readonly CaptionFormatting[]): string {
  return items.map((item) =>
    `${item.caption.label} ${item.caption.number}: ${item.alignment ? alignmentName(item.alignment) : "Hizalama tespit edilemedi"}, ${item.lineSpacing ?? "Satır aralığı tespit edilemedi"} satır`,
  ).join("; ");
}

function createFailureMessage(
  object: CaptionKind,
  total: number,
  wrong: readonly CaptionFormatting[],
): string {
  if (total === 1) {
    return `${objectName(object)} başlığı sola yaslı ve tek satır aralığında olmalıdır. Bulunan: ${formatActual(wrong)}.`;
  }

  return `${total} ${object === "table" ? "tablo" : "şekil"} başlığından ${wrong.length} tanesinin biçimi uygun değil: ${formatActual(wrong)}.`;
}

function objectName(object: CaptionKind): "Tablo" | "Şekil" {
  return object === "table" ? "Tablo" : "Şekil";
}

function alignmentName(alignment: ParagraphAlignment): string {
  switch (alignment) {
    case "left": return "Sola yaslı";
    case "center": return "Ortalı";
    case "right": return "Sağa yaslı";
    case "justify": return "İki yana yaslı";
  }
}
