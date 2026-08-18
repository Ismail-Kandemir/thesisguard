import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { StyleInheritanceResolver } from "../../parsers/styleInheritanceResolver";
import type {
  CaptionKind,
  DocumentFigureOccurrence,
  DocumentTableOccurrence,
  NormalizedDocument,
  ObjectAlignment,
  ObjectAlignmentRuleExpected,
  ObjectAlignmentSource,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";

type AlignableOccurrence = DocumentTableOccurrence | DocumentFigureOccurrence;

interface ResolvedObjectAlignment {
  occurrence: AlignableOccurrence;
  label: string;
  alignment: ObjectAlignment;
  source: ObjectAlignmentSource;
}

export class ObjectAlignmentValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const items = getResolvedAlignments(document, expected.object);

    if (items.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        `Belgede ${objectNameLower(expected.object)} bulunmadığı için ${objectNameLower(expected.object)} hizalama kontrolü uygulanmadı.`,
      );
    }

    const unknown = items.filter((item) => item.alignment === "unknown");

    if (unknown.length === items.length) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        formatActual(items),
        `${objectName(expected.object)} yatay konumu güvenilir biçimde belirlenemediği için hizalama kontrolü uygulanmadı.`,
      );
    }

    const wrong = items.filter(
      (item) => item.alignment !== "unknown" && item.alignment !== expected.alignment,
    );

    if (wrong.length === 0 && unknown.length === 0) {
      return createResult(
        rule,
        expected,
        "PASSED",
        formatActual(items),
        `Belgedeki ${objectPlural(expected.object)} ortalanmış.`,
      );
    }

    return createResult(
      rule,
      expected,
      "FAILED",
      formatActual(items),
      createFailureMessage(expected.object, wrong, unknown),
    );
  }
}

function getResolvedAlignments(
  document: Readonly<NormalizedDocument>,
  object: CaptionKind,
): ResolvedObjectAlignment[] {
  return object === "table"
    ? resolveTableAlignments(document)
    : resolveFigureAlignments(document);
}

function resolveTableAlignments(
  document: Readonly<NormalizedDocument>,
): ResolvedObjectAlignment[] {
  const captionsById = new Map(document.captions.items.map((caption) => [caption.id, caption]));
  const styleResolver = new StyleInheritanceResolver(document.styles);

  return document.tables.items
    .filter((table) => !table.isNested)
    .map((table, index) => {
      const resolved = resolveTableAlignment(table, styleResolver);

      return {
        occurrence: table,
        label: getObjectLabel("table", table.captionId, captionsById, index),
        ...resolved,
      };
    });
}

function resolveTableAlignment(
  table: Readonly<DocumentTableOccurrence>,
  styleResolver: StyleInheritanceResolver,
): { alignment: ObjectAlignment; source: ObjectAlignmentSource } {
  if (table.alignment !== "unknown") {
    return { alignment: table.alignment, source: table.alignmentSource };
  }

  if (!table.tableStyleId) {
    return { alignment: "unknown", source: "unknown" };
  }

  for (const entry of styleResolver.resolve(table.tableStyleId)) {
    if (entry.type === "style" && entry.style.tableAlignment !== null) {
      return { alignment: entry.style.tableAlignment, source: "style" };
    }
  }

  return { alignment: "unknown", source: "unknown" };
}

function resolveFigureAlignments(
  document: Readonly<NormalizedDocument>,
): ResolvedObjectAlignment[] {
  const captionsById = new Map(document.captions.items.map((caption) => [caption.id, caption]));
  const paragraphsById = new Map(document.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const drawingCountByParagraphId = new Map<string, number>();
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
  );

  for (const figure of document.figures.items) {
    drawingCountByParagraphId.set(
      figure.paragraphId,
      (drawingCountByParagraphId.get(figure.paragraphId) ?? 0) + 1,
    );
  }

  return document.figures.items.map((figure, index) => {
    const resolved = resolveFigureAlignment(
      figure,
      paragraphsById,
      drawingCountByParagraphId,
      formattingResolver,
    );

    return {
      occurrence: figure,
      label: getObjectLabel("figure", figure.captionId, captionsById, index),
      ...resolved,
    };
  });
}

function resolveFigureAlignment(
  figure: Readonly<DocumentFigureOccurrence>,
  paragraphsById: ReadonlyMap<string, NormalizedDocument["paragraphs"][number]>,
  drawingCountByParagraphId: ReadonlyMap<string, number>,
  formattingResolver: EffectiveFormattingResolver,
): { alignment: ObjectAlignment; source: ObjectAlignmentSource } {
  if (figure.alignment !== "unknown") {
    return { alignment: figure.alignment, source: figure.alignmentSource };
  }

  if (figure.drawingType !== "inline" || (drawingCountByParagraphId.get(figure.paragraphId) ?? 0) !== 1) {
    return { alignment: "unknown", source: "unknown" };
  }

  const paragraph = paragraphsById.get(figure.paragraphId);

  if (!paragraph || !paragraph.isEmpty) {
    return { alignment: "unknown", source: "unknown" };
  }

  const alignment = toObjectAlignment(
    formattingResolver.resolveParagraphAlignment(paragraph.styleId, paragraph.alignment),
  );

  return {
    alignment,
    source: alignment === "unknown" ? "unknown" : "paragraph",
  };
}

function getObjectLabel(
  object: CaptionKind,
  captionId: string | null,
  captionsById: ReadonlyMap<string, NormalizedDocument["captions"]["items"][number]>,
  index: number,
): string {
  const caption = captionId ? captionsById.get(captionId) : undefined;

  if (caption && caption.kind === object) {
    return `${objectName(object)} ${caption.number}`;
  }

  return `${index + 1}. ${objectNameLower(object)}`;
}

function assertRule(
  rule: RuleDefinition,
): asserts rule is RuleDefinition & { type: "OBJECT_ALIGNMENT" } {
  if (rule.type !== "OBJECT_ALIGNMENT") {
    throw new Error("ObjectAlignmentValidator yalnızca OBJECT_ALIGNMENT kurallarını çalıştırır.");
  }
}

function getExpected(expected: RuleDefinition["expected"]): ObjectAlignmentRuleExpected {
  if (
    typeof expected !== "object" ||
    expected === null ||
    !("object" in expected) ||
    (expected.object !== "table" && expected.object !== "figure") ||
    !("alignment" in expected) ||
    !isExpectedAlignment(expected.alignment)
  ) {
    throw new Error("OBJECT_ALIGNMENT kuralı geçerli object ve alignment değerleri içermelidir.");
  }

  return expected as ObjectAlignmentRuleExpected;
}

function isExpectedAlignment(value: unknown): value is Exclude<ObjectAlignment, "unknown"> {
  return value === "left" || value === "center" || value === "right";
}

function createResult(
  rule: RuleDefinition,
  expected: ObjectAlignmentRuleExpected,
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
    expected: `${objectName(expected.object)} nesnesi: ${alignmentName(expected.alignment)}`,
    actual,
    message,
  };
}

function createFailureMessage(
  object: CaptionKind,
  wrong: readonly ResolvedObjectAlignment[],
  unknown: readonly ResolvedObjectAlignment[],
): string {
  const parts: string[] = [];

  if (wrong.length > 0) {
    parts.push(`${formatLabels(wrong)} ortalanmamış.`);
  }

  if (unknown.length > 0) {
    parts.push(`${formatLabels(unknown)} yatay konumu güvenilir biçimde belirlenemedi.`);
  }

  return wrong.length + unknown.length === 1
    ? parts.join(" ")
    : `Bazı ${objectPlural(object)} için hizalama uygun değil: ${parts.join(" ")}`;
}

function formatActual(items: readonly ResolvedObjectAlignment[]): string {
  return items
    .map((item) => `${item.label}: ${alignmentName(item.alignment)} (${sourceName(item.source)})`)
    .join("; ");
}

function formatLabels(items: readonly ResolvedObjectAlignment[]): string {
  return items.map((item) => item.label).join(", ");
}

function toObjectAlignment(value: ObjectAlignment | null): ObjectAlignment {
  switch (value) {
    case "left":
    case "right":
    case "center":
      return value;
    default:
      return "unknown";
  }
}

function objectName(object: CaptionKind): "Tablo" | "Şekil" {
  return object === "table" ? "Tablo" : "Şekil";
}

function objectNameLower(object: CaptionKind): "tablo" | "şekil" {
  return object === "table" ? "tablo" : "şekil";
}

function objectPlural(object: CaptionKind): "tablolar" | "şekiller" {
  return object === "table" ? "tablolar" : "şekiller";
}

function alignmentName(alignment: ObjectAlignment): string {
  switch (alignment) {
    case "left": return "Sola hizalı";
    case "center": return "Ortalanmış";
    case "right": return "Sağa hizalı";
    case "unknown": return "Teknik olarak belirlenemedi";
  }
}

function sourceName(source: ObjectAlignmentSource): string {
  switch (source) {
    case "direct": return "doğrudan";
    case "style": return "stil";
    case "paragraph": return "paragraf";
    case "unknown": return "kaynak belirsiz";
  }
}
