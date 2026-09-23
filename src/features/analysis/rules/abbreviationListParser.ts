import { isPossibleAbbreviation } from "../parsers/documentAbbreviationsNormalizer";
import type {
  AcademicSectionOccurrence,
  AcademicTermEntry,
  AcademicTermEntryKind,
  Paragraph,
} from "../types";

const ENTRY_PATTERN = /^\s*([\p{Lu}\p{N}]+(?:-[\p{Lu}\p{N}]+)*)(?:[ \t]{2,}|\t+|[ \t]+-[ \t]+|[ \t]*:[ \t]*)(\S.*)$/u;
const MALFORMED_ENTRY_PATTERN = /^\s*(\S+)(?:[ \t]{2,}|\t+|[ \t]+-[ \t]+|[ \t]*:[ \t]*)(.*)$/u;

interface AcademicTermEntryParserOptions {
  kinds?: readonly AcademicTermEntryKind[];
}

export function parseAbbreviationListEntries(
  paragraphs: readonly Paragraph[],
): string[] {
  const entries = new Set(
    parseAcademicTermEntries(paragraphs)
      .filter((entry) => entry.kind === "abbreviation" && entry.status === "valid")
      .map((entry) => entry.term),
  );

  return [...entries];
}

export function parseAcademicTermEntries(
  paragraphs: readonly Paragraph[],
  sourceSection?: Readonly<AcademicSectionOccurrence>,
  options: Readonly<AcademicTermEntryParserOptions> = {},
): AcademicTermEntry[] {
  const supportedKinds = new Set(options.kinds ?? ["abbreviation"]);
  const entries: AcademicTermEntry[] = [];

  for (const [localIndex, paragraph] of paragraphs.entries()) {
    const visibleText = normalizeVisibleText(paragraph.text);
    const validMatch = ENTRY_PATTERN.exec(visibleText);

    if (validMatch) {
      const term = normalizeTerm(validMatch[1]);
      const kind = classifyEntryKind(term);

      if (supportedKinds.has(kind)) {
        entries.push(
          createEntry({
            paragraph,
            localIndex,
            sourceSection,
            term,
            definition: normalizeDefinition(validMatch[2]),
            kind,
            status: "valid",
            parsingEvidence: ["visible-paragraph-text", separatorEvidence(visibleText)],
          }),
        );
      }

      continue;
    }

    const malformedMatch = MALFORMED_ENTRY_PATTERN.exec(visibleText);

    if (malformedMatch) {
      const term = normalizeTerm(malformedMatch[1]);
      const kind = classifyEntryKind(term);

      if (supportedKinds.has(kind)) {
        entries.push(
          createEntry({
            paragraph,
            localIndex,
            sourceSection,
            term,
            definition: normalizeDefinition(malformedMatch[2]),
            kind,
            status: "malformed",
            parsingEvidence: ["visible-paragraph-text", "malformed-entry"],
          }),
        );
      }
    }
  }

  return entries;
}

export function normalizeAcademicTerm(value: string): string {
  return normalizeTerm(value);
}

interface EntryFactoryInput {
  paragraph: Readonly<Paragraph>;
  localIndex: number;
  sourceSection?: Readonly<AcademicSectionOccurrence>;
  term: string;
  definition: string;
  kind: AcademicTermEntryKind;
  status: AcademicTermEntry["status"];
  parsingEvidence: string[];
}

function createEntry(input: Readonly<EntryFactoryInput>): AcademicTermEntry {
  return {
    kind: input.kind,
    term: input.term,
    normalizedTerm: normalizeTerm(input.term),
    definition: input.definition,
    paragraphId: input.paragraph.id,
    paragraphIndex: getParagraphIndex(input.paragraph, input),
    blockIndex:
      input.sourceSection?.boundary.startBlockIndex === null ||
      input.sourceSection?.boundary.startBlockIndex === undefined
        ? null
        : input.sourceSection.boundary.startBlockIndex + input.localIndex,
    sourceSectionId: input.sourceSection?.id ?? "unknown",
    sourceSectionIdentity: input.sourceSection?.identity ?? null,
    confidence: input.status === "valid" ? "high" : "low",
    status: input.status,
    parsingEvidence: input.parsingEvidence,
  };
}

function classifyEntryKind(term: string): AcademicTermEntryKind {
  return isPossibleAbbreviation(term) ? "abbreviation" : "symbol";
}

function normalizeVisibleText(value: string): string {
  return value.normalize("NFC").replace(/\u00a0/g, " ");
}

function normalizeTerm(value: string): string {
  return value.normalize("NFC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDefinition(value: string): string {
  return value.normalize("NFC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function getParagraphIndex(
  paragraph: Readonly<Paragraph>,
  input: Readonly<Pick<EntryFactoryInput, "localIndex" | "sourceSection">>,
): number {
  const idMatch = /^paragraph-(\d+)$/u.exec(paragraph.id);

  if (idMatch) {
    return Number(idMatch[1]) - 1;
  }

  return (input.sourceSection?.boundary.startParagraphIndex ?? 0) + input.localIndex;
}

function separatorEvidence(value: string): string {
  if (/\t/.test(value)) {
    return "tab-separator";
  }

  if (/[ \t]+-[ \t]+/u.test(value)) {
    return "dash-separator";
  }

  if (/[ \t]*:[ \t]*/u.test(value)) {
    return "colon-separator";
  }

  return "aligned-whitespace-separator";
}
