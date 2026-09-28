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
import { getDeclaredAcademicFigures } from "../objectApplicability";
import {
  formatLineSpacingValue,
  formatUnsupportedLineSpacingRules,
  toComparableLineMultiple,
} from "../lineSpacingSemantics";
import type { RuleValidator } from "./RuleValidator";

interface CaptionFormatting {
  caption: DocumentCaption;
  alignment: ParagraphAlignment | null;
  fontSize: number | null;
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
        "Uygulanmadi",
        `${objectName(expected.object)} basligi guvenilir bicimde iliskilendirilemedigi icin bicim kontrolu uygulanmadi.`,
      );
    }

    const wrong = formatting.filter((item) => hasFormattingIssue(item, expected));
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
        ? `${objectName(expected.object)} basliklarinin bicimi uygun.`
        : createFailureMessage(expected.object, formatting.length, wrong, unsupportedLineSpacing),
      status === "FAILED"
        ? wrong.slice(0, MAX_RULE_EVIDENCE_ITEMS).map((item) =>
            createCaptionEvidence(item.caption, {
              actual: formatActual([item]),
              expected: formatExpected(expected),
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
  const paragraphById = new Map(
    document.paragraphs.map((paragraph) => [paragraph.id, paragraph]),
  );
  const resolver = new EffectiveFormattingResolver(document.styles, document.documentDefaults);

  return getDeclaredAcademicFigures(document).flatMap((figure) => {
    if (
      figure.representation.scope !== "body" ||
      figure.representation.drawingType !== "inline" ||
      !figure.caption ||
      !figure.semanticCaption ||
      figure.semanticCaption.semantic.status !== "declared" ||
      figure.semanticCaption.semantic.academicType !== "figure"
    ) return [];

    const paragraph = paragraphById.get(figure.caption.paragraphId);

    return paragraph ? [resolveFormatting(figure.caption, paragraph, resolver)] : [];
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
  const visibleRuns = paragraph.runs.filter((run) => run.text.trim().length > 0);
  const resolvedFormats = visibleRuns.map((run) =>
    resolver.resolveRun(run, paragraph.styleId, paragraph.lineSpacing),
  );
  const fontSizes = Array.from(new Set(resolvedFormats.map((formatting) => formatting.fontSize)));

  return {
    caption,
    alignment: resolver.resolveParagraphAlignment(paragraph.styleId, paragraph.alignment),
    fontSize: fontSizes.length === 1 ? fontSizes[0] ?? null : null,
    lineSpacing: comparableLineSpacing,
    rawLineSpacing: lineSpacing,
  };
}

function hasFormattingIssue(
  actual: CaptionFormatting,
  expected: ObjectCaptionFormatRuleExpected,
): boolean {
  return (
    (expected.alignment !== undefined && actual.alignment !== expected.alignment) ||
    (expected.lineSpacing !== undefined && actual.lineSpacing !== expected.lineSpacing) ||
    (expected.fontSize !== undefined && actual.fontSize !== expected.fontSize)
  );
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_CAPTION_FORMAT" } {
  if (rule.type !== "OBJECT_CAPTION_FORMAT") {
    throw new Error("ObjectCaptionFormatValidator only validates OBJECT_CAPTION_FORMAT rules.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectCaptionFormatRuleExpected {
  if (
    typeof expected !== "object" || expected === null ||
    !("object" in expected) || (expected.object !== "table" && expected.object !== "figure") ||
    ("alignment" in expected && !isAlignment(expected.alignment)) ||
    ("lineSpacing" in expected &&
      (typeof expected.lineSpacing !== "number" ||
        !Number.isFinite(expected.lineSpacing) || expected.lineSpacing <= 0)) ||
    ("fontSize" in expected &&
      (typeof expected.fontSize !== "number" ||
        !Number.isFinite(expected.fontSize) || expected.fontSize <= 0))
  ) {
    throw new Error("OBJECT_CAPTION_FORMAT must define object and at least one valid format expectation.");
  }

  if (
    expected.alignment === undefined &&
    expected.lineSpacing === undefined &&
    expected.fontSize === undefined
  ) {
    throw new Error("OBJECT_CAPTION_FORMAT must include alignment, lineSpacing, or fontSize.");
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
    expected: formatExpected(expected),
    actual,
    message,
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
  };
}

function formatActual(items: readonly CaptionFormatting[]): string {
  return items.map((item) =>
    `${item.caption.label} ${item.caption.number}: ${item.alignment ? alignmentName(item.alignment) : "Hizalama tespit edilemedi"}, ${formatFontSize(item.fontSize)}, ${formatLineSpacingValue(item.rawLineSpacing)}`,
  ).join("; ");
}

function formatExpected(expected: ObjectCaptionFormatRuleExpected): string {
  const parts: string[] = [];
  if (expected.alignment !== undefined) parts.push(alignmentName(expected.alignment));
  if (expected.fontSize !== undefined) parts.push(`${expected.fontSize} punto`);
  if (expected.lineSpacing !== undefined) parts.push(`${expected.lineSpacing} satir`);
  return parts.join(", ");
}

function formatFontSize(fontSize: number | null): string {
  return fontSize === null ? "Punto tespit edilemedi" : `${fontSize} punto`;
}

function createFailureMessage(
  object: CaptionKind,
  total: number,
  wrong: readonly CaptionFormatting[],
  unsupportedLineSpacing: readonly LineSpacingValue[],
): string {
  if (unsupportedLineSpacing.length > 0) {
    return `${objectName(object)} basligi satir araligi statik OOXML'den guvenle dogrulanamadi. Karsilastirilamayan lineRule: ${formatUnsupportedLineSpacingRules(unsupportedLineSpacing)}. Bulunan: ${formatActual(wrong)}.`;
  }

  if (total === 1) {
    return `${objectName(object)} basligi beklenen bicimde olmalidir. Bulunan: ${formatActual(wrong)}.`;
  }

  return `${total} ${object === "table" ? "tablo" : "sekil"} basligindan ${wrong.length} tanesinin bicimi uygun degil: ${formatActual(wrong)}.`;
}

function objectName(object: CaptionKind): "Tablo" | "Sekil" {
  return object === "table" ? "Tablo" : "Sekil";
}

function alignmentName(alignment: ParagraphAlignment): string {
  switch (alignment) {
    case "left": return "Sola yasli";
    case "center": return "Ortali";
    case "right": return "Saga yasli";
    case "justify": return "Iki yana yasli";
  }
}
