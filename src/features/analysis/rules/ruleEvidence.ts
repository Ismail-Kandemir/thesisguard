import type {
  CaptionRuleEvidence,
  DocumentFormatRuleEvidence,
  DocumentCaption,
  DocumentFigureOccurrence,
  DocumentHeadingOccurrence,
  DocumentSection,
  DocumentTableOccurrence,
  HeadingRuleEvidence,
  ObjectRuleEvidence,
  Paragraph,
  ParagraphRuleEvidence,
  RunRuleEvidence,
  Run,
  RuleResultValue,
  SectionRuleEvidence,
} from "../types";

export const MAX_RULE_EVIDENCE_ITEMS = 10;
const MAX_TEXT_EXCERPT_LENGTH = 160;

export function createParagraphEvidence(
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
    sectionName?: string;
    unit?: string;
  }> = {},
): ParagraphRuleEvidence {
  const textExcerpt = createBoundedTextExcerpt(paragraph.text);

  return {
    kind: "paragraph",
    paragraphId: paragraph.id,
    paragraphIndex,
    ...(textExcerpt ? { textExcerpt } : {}),
    ...(values.sectionName ? { sectionName: values.sectionName } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
    ...(values.unit ? { unit: values.unit } : {}),
  };
}

export function createRunEvidence(
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  run: Readonly<Run>,
  runIndex: number,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
    sectionName?: string;
    unit?: string;
  }> = {},
): RunRuleEvidence {
  const textExcerpt = createBoundedTextExcerpt(run.text);
  const paragraphExcerpt = createBoundedTextExcerpt(paragraph.text);

  return {
    kind: "run",
    paragraphId: paragraph.id,
    paragraphIndex,
    runIndex,
    ...(textExcerpt ? { textExcerpt } : {}),
    ...(paragraphExcerpt ? { paragraphExcerpt } : {}),
    ...(values.sectionName ? { sectionName: values.sectionName } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
    ...(values.unit ? { unit: values.unit } : {}),
  };
}

export function createHeadingEvidence(
  heading: Readonly<DocumentHeadingOccurrence>,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
  }> = {},
): HeadingRuleEvidence {
  const textExcerpt = createBoundedTextExcerpt(heading.text);

  return {
    kind: "heading",
    paragraphId: heading.paragraphId,
    paragraphIndex: heading.paragraphIndex,
    ...(heading.blockIndex !== null ? { blockIndex: heading.blockIndex } : {}),
    ...(textExcerpt ? { textExcerpt } : {}),
    headingLevel: heading.level,
    ...(heading.sectionName ? { sectionName: heading.sectionName } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
  };
}

export function createHeadingParagraphEvidence(
  paragraph: Readonly<Paragraph>,
  paragraphIndex: number,
  values: Readonly<{
    actual?: RuleResultValue;
    blockIndex?: number | null;
    expected?: RuleResultValue;
    headingLevel?: number;
    sectionName?: string;
  }> = {},
): HeadingRuleEvidence {
  const textExcerpt = createBoundedTextExcerpt(paragraph.text);

  return {
    kind: "heading",
    paragraphId: paragraph.id,
    paragraphIndex,
    ...(values.blockIndex !== undefined && values.blockIndex !== null
      ? { blockIndex: values.blockIndex }
      : {}),
    ...(textExcerpt ? { textExcerpt } : {}),
    ...(values.headingLevel !== undefined ? { headingLevel: values.headingLevel } : {}),
    ...(values.sectionName ? { sectionName: values.sectionName } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
  };
}

export function createSectionEvidence(
  section: Readonly<DocumentSection>,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
    sectionName?: string;
    unit?: string;
  }> = {},
): SectionRuleEvidence {
  return {
    kind: "section",
    sectionName: values.sectionName ?? section.displayName,
    paragraphId: section.paragraphId,
    paragraphIndex: section.paragraphIndex,
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
    ...(values.unit ? { unit: values.unit } : {}),
  };
}

export function createMissingSectionEvidence(
  sectionName: string,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
    unit?: string;
  }> = {},
): SectionRuleEvidence {
  return {
    kind: "section",
    sectionName,
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
    ...(values.unit ? { unit: values.unit } : {}),
  };
}

export function createDocumentFormatEvidence(
  property: string,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
    sectionIndex?: number;
    unit?: string;
  }> = {},
): DocumentFormatRuleEvidence {
  return {
    kind: "document-format",
    property,
    ...(values.sectionIndex !== undefined ? { sectionIndex: values.sectionIndex } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
    ...(values.unit ? { unit: values.unit } : {}),
  };
}

export function createCaptionEvidence(
  caption: Readonly<DocumentCaption>,
  values: Readonly<{
    actual?: RuleResultValue;
    expected?: RuleResultValue;
  }> = {},
): CaptionRuleEvidence {
  const textExcerpt = createBoundedTextExcerpt(caption.text);

  return {
    kind: "caption",
    captionKind: caption.kind,
    captionId: caption.id,
    paragraphId: caption.paragraphId,
    paragraphIndex: caption.paragraphIndex,
    blockIndex: caption.blockIndex,
    label: caption.label,
    number: caption.number,
    ...(textExcerpt ? { textExcerpt } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
  };
}

export function createObjectEvidence(
  objectKind: "table" | "figure",
  occurrence: Readonly<DocumentTableOccurrence | DocumentFigureOccurrence>,
  values: Readonly<{
    actual?: RuleResultValue;
    captionId?: string;
    captionNumber?: string;
    captionText?: string;
    expected?: RuleResultValue;
    objectLabel?: string;
  }> = {},
): ObjectRuleEvidence {
  const captionText = values.captionText ? createBoundedTextExcerpt(values.captionText) : undefined;

  return {
    kind: objectKind,
    objectId: occurrence.id,
    ...(occurrence.blockIndex !== null ? { blockIndex: occurrence.blockIndex } : {}),
    ...("paragraphId" in occurrence ? { paragraphId: occurrence.paragraphId } : {}),
    ...("paragraphIndex" in occurrence ? { paragraphIndex: occurrence.paragraphIndex } : {}),
    ...(values.objectLabel ? { objectLabel: values.objectLabel } : {}),
    ...(values.captionId ? { captionId: values.captionId } : {}),
    ...(captionText ? { captionText } : {}),
    ...(values.captionNumber ? { captionNumber: values.captionNumber } : {}),
    ...("expected" in values ? { expected: values.expected } : {}),
    ...("actual" in values ? { actual: values.actual } : {}),
  };
}

export function createBoundedTextExcerpt(text: string): string | undefined {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length <= MAX_TEXT_EXCERPT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TEXT_EXCERPT_LENGTH - 1).trimEnd()}…`;
}
