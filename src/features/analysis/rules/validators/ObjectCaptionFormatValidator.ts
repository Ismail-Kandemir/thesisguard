import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import type {
  CaptionKind,
  DocumentCaption,
  LineSpacingValue,
  NormalizedDocument,
  ObjectCaptionFormatRuleExpected,
  Paragraph,
  ParagraphAlignment,
  RuleDefinition,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import { createCaptionEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import {
  formatLineSpacingValue,
  formatUnsupportedLineSpacingRules,
  toComparableLineMultiple,
} from "../lineSpacingSemantics";
import type { RuleValidator } from "./RuleValidator";

interface CaptionFormatting {
  caption: DocumentCaption;
  alignment: ParagraphAlignment | null;
  lineSpacing: number | null;
  rawLineSpacing: LineSpacingValue | null;
}

export class ObjectCaptionFormatValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const formatting = expected.object === "figure"
      ? getDeclaredFigureCaptionFormatting(document)
      : getLegacyAssociatedCaptionFormatting(document, expected.object);

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
    const unsupportedLineSpacing = wrong
      .map((item) => item.rawLineSpacing)
      .filter((value): value is LineSpacingValue =>
        value !== null && toComparableLineMultiple(value) === null,
      );
    const status: RuleResultStatus = wrong.length === 0 ? "PASSED" : "FAILED";

    return createResult(
      rule,
      expected,
      status,
      formatActual(formatting),
      status === "PASSED"
        ? `${objectName(expected.object)} başlıklarının biçimi uygun.`
        : createFailureMessage(expected.object, formatting.length, wrong, unsupportedLineSpacing),
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

function getLegacyAssociatedCaptionFormatting(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): CaptionFormatting[] {
  const occurrences = object === "table"
    ? document.tables.items.filter((item) => !item.isNested)
    : [];
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

function getDeclaredFigureCaptionFormatting(
  document: Readonly<NormalizedDocument>,
): CaptionFormatting[] {
  const representationById = new Map(
    document.objectSemantics.representations.map((item) => [item.id, item]),
  );
  const associationByObjectId = new Map(
    document.objectSemantics.associations.map((item) => [item.objectId, item]),
  );
  const semanticCaptionById = new Map(
    document.objectSemantics.captions.map((item) => [item.id, item]),
  );
  const legacyCaptionByParagraphId = new Map(
    document.captions.items.map((caption) => [caption.paragraphId, caption]),
  );
  const paragraphById = new Map(
    document.paragraphs.map((paragraph) => [paragraph.id, paragraph]),
  );
  const resolver = new EffectiveFormattingResolver(document.styles, document.documentDefaults);

  return document.objectSemantics.resolutions.flatMap((resolution) => {
    if (resolution.status !== "declared" || resolution.academicType !== "figure") return [];

    const representation = representationById.get(resolution.objectId);
    const association = associationByObjectId.get(resolution.objectId);

    if (
      !representation || representation.scope !== "body" || representation.drawingType !== "inline" ||
      !association || association.status !== "matched" || association.captionId === null ||
      resolution.captionId !== association.captionId
    ) {
      return [];
    }

    const semanticCaption = semanticCaptionById.get(association.captionId);
    if (
      !semanticCaption || semanticCaption.semantic.status !== "declared" ||
      semanticCaption.semantic.academicType !== "figure"
    ) {
      return [];
    }

    const caption = legacyCaptionByParagraphId.get(semanticCaption.paragraphId);
    const paragraph = paragraphById.get(semanticCaption.paragraphId);

    if (
      !caption || caption.kind !== "figure" ||
      caption.number !== semanticCaption.semantic.number || !paragraph
    ) {
      return [];
    }

    return [resolveFormatting(caption, paragraph, resolver)];
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
  const comparableLineSpacing = lineSpacing === null
    ? null
    : toComparableLineMultiple(lineSpacing);

  return {
    caption,
    alignment: resolver.resolveParagraphAlignment(paragraph.styleId, paragraph.alignment),
    lineSpacing: comparableLineSpacing,
    rawLineSpacing: lineSpacing,
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
    `${item.caption.label} ${item.caption.number}: ${item.alignment ? alignmentName(item.alignment) : "Hizalama tespit edilemedi"}, ${formatLineSpacingValue(item.rawLineSpacing)}`,
  ).join("; ");
}

function createFailureMessage(
  object: CaptionKind,
  total: number,
  wrong: readonly CaptionFormatting[],
  unsupportedLineSpacing: readonly LineSpacingValue[],
): string {
  if (unsupportedLineSpacing.length > 0) {
    return `${objectName(object)} başlığı satır aralığı statik OOXML'den güvenle doğrulanamadı. Karşılaştırılamayan lineRule: ${formatUnsupportedLineSpacingRules(unsupportedLineSpacing)}. Bulunan: ${formatActual(wrong)}.`;
  }

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
