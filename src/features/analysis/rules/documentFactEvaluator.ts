import type {
  ConditionalRequiredSectionCondition,
  ConditionalRequiredSectionFact,
  NormalizedDocument,
} from "../types";

const DOCUMENT_FACT_READERS: Record<
  ConditionalRequiredSectionFact,
  (document: Readonly<NormalizedDocument>) => boolean
> = {
  hasTables: (document) => document.tables.hasTables,
  hasFigures: (document) => document.figures.hasFigures,
  hasAbbreviations: (document) => document.abbreviations.hasAbbreviations,
};

export function isSupportedDocumentFact(
  fact: unknown,
): fact is ConditionalRequiredSectionFact {
  return (
    typeof fact === "string" &&
    Object.prototype.hasOwnProperty.call(DOCUMENT_FACT_READERS, fact)
  );
}

export function evaluateDocumentCondition(
  document: Readonly<NormalizedDocument>,
  condition: ConditionalRequiredSectionCondition,
): boolean {
  return DOCUMENT_FACT_READERS[condition.fact](document) === condition.equals;
}

export function getDocumentFactValue(
  document: Readonly<NormalizedDocument>,
  fact: ConditionalRequiredSectionFact,
): boolean {
  return DOCUMENT_FACT_READERS[fact](document);
}

