import { EffectiveFormattingResolver } from "../../parsers/effectiveFormattingResolver";
import { StyleInheritanceResolver } from "../../parsers/styleInheritanceResolver";
import type {
  CaptionKind,
  DocumentTableOccurrence,
  NormalizedDocument,
  ObjectAlignment,
  ObjectAlignmentRuleExpected,
  ObjectAlignmentSource,
  ObjectRepresentationOccurrence,
  RuleDefinition,
  RuleEvidence,
  RuleEvaluationCoverage,
  RuleResult,
  RuleResultStatus,
} from "../../types";
import type { RuleValidator } from "./RuleValidator";
import { createObjectEvidence, MAX_RULE_EVIDENCE_ITEMS } from "../ruleEvidence";
import {
  getDeclaredAcademicFigures,
  getFigurePhysicalAlignmentCoverage,
  isFigurePhysicalAlignmentEvaluable,
} from "../objectApplicability";

type AlignableOccurrence = DocumentTableOccurrence | ObjectRepresentationOccurrence;

interface ResolvedObjectAlignment {
  occurrence: AlignableOccurrence;
  label: string;
  captionId: string | null;
  captionNumber: string | null;
  captionText: string | null;
  alignment: ObjectAlignment;
  source: ObjectAlignmentSource;
}

export class ObjectAlignmentValidator implements RuleValidator {
  validate(document: NormalizedDocument, rule: RuleDefinition): RuleResult {
    assertRule(rule);
    const expected = getExpected(rule.expected);
    const items = getResolvedAlignments(document, expected.object);
    const coverage = expected.object === "figure"
      ? getFigurePhysicalAlignmentCoverage(document)
      : undefined;

    if (items.length === 0) {
      return createResult(
        rule,
        expected,
        "NOT_APPLICABLE",
        "Uygulanmadı",
        coverage && coverage.relevantCount > 0
          ? "Bu kural için ilgili şekil bulundu ancak otomatik doğrulama yapılamadı."
          : `Belgede ${objectNameLower(expected.object)} bulunmadığı için ${objectNameLower(expected.object)} hizalama kontrolü uygulanmadı.`,
        undefined,
        undefined,
        coverage,
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
        undefined,
        undefined,
        coverage,
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
        coverage?.status === "partial"
          ? `Değerlendirilebilen ${objectPlural(expected.object)} ortalanmış.`
          : `Belgedeki ${objectPlural(expected.object)} ortalanmış.`,
        undefined,
        undefined,
        coverage,
      );
    }

    return createResult(
      rule,
      expected,
      "FAILED",
      formatActual(items),
      createFailureMessage(expected.object, wrong, unknown),
      [...wrong, ...unknown].slice(0, MAX_RULE_EVIDENCE_ITEMS).map((item) =>
        createObjectEvidence(expected.object, item.occurrence, {
          actual: alignmentName(item.alignment),
          captionId: item.captionId ?? undefined,
          captionNumber: item.captionNumber ?? undefined,
          captionText: item.captionText ?? undefined,
          expected: alignmentName(expected.alignment),
          objectLabel: item.label,
        }),
      ),
      wrong.length + unknown.length,
      coverage,
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
      const caption = table.captionId ? captionsById.get(table.captionId) : undefined;

      return {
        occurrence: table,
        label: getObjectLabel("table", caption, index),
        captionId: caption?.id ?? null,
        captionNumber: caption?.number ?? null,
        captionText: caption?.text ?? null,
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
  const paragraphsById = new Map(document.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const drawingCountByParagraphId = new Map<string, number>();
  const formattingResolver = new EffectiveFormattingResolver(
    document.styles,
    document.documentDefaults,
  );

  const declaredFigures = getDeclaredAcademicFigures(document);

  for (const figure of declaredFigures) {
    const paragraphId = figure.representation.paragraphId;
    if (paragraphId) {
      drawingCountByParagraphId.set(
        paragraphId,
        (drawingCountByParagraphId.get(paragraphId) ?? 0) + 1,
      );
    }
  }

  return declaredFigures
    .filter((figure) => isFigurePhysicalAlignmentEvaluable(figure.representation))
    .map((figure, index) => {
    const resolved = resolveFigureAlignment(
      figure.representation,
      paragraphsById,
      drawingCountByParagraphId,
      formattingResolver,
    );
    const caption = figure.caption ?? undefined;

    return {
      occurrence: figure.representation,
      label: getObjectLabel("figure", caption, index),
      captionId: caption?.id ?? null,
      captionNumber: caption?.number ?? null,
      captionText: caption?.text ?? null,
      ...resolved,
    };
  });
}

function resolveFigureAlignment(
  figure: Readonly<ObjectRepresentationOccurrence>,
  paragraphsById: ReadonlyMap<string, NormalizedDocument["paragraphs"][number]>,
  drawingCountByParagraphId: ReadonlyMap<string, number>,
  formattingResolver: EffectiveFormattingResolver,
): { alignment: ObjectAlignment; source: ObjectAlignmentSource } {
  if (figure.alignment !== null && figure.alignment !== "unknown") {
    return { alignment: figure.alignment, source: figure.alignmentSource ?? "unknown" };
  }

  if (
    figure.drawingType !== "inline" ||
    figure.paragraphId === null ||
    (drawingCountByParagraphId.get(figure.paragraphId) ?? 0) !== 1
  ) {
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
  caption: NormalizedDocument["captions"]["items"][number] | undefined,
  index: number,
): string {
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
  evidence?: RuleEvidence[],
  evidenceTotal?: number,
  coverage?: RuleEvaluationCoverage,
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
    ...(coverage ? { coverage } : {}),
    ...(evidence && evidence.length > 0 ? { evidence } : {}),
    ...(evidenceTotal !== undefined ? { evidenceTotal } : {}),
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
