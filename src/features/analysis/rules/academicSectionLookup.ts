import { buildAcademicSections } from "../parsers/academicSectionsNormalizer";
import { normalizeSectionName } from "../parsers/documentSectionsParser";
import type {
  AcademicSectionOccurrence,
  NormalizedDocument,
  RuleDefinition,
} from "../types";

export function getAcademicSectionOccurrences(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
): readonly AcademicSectionOccurrence[] {
  return document.academicSections?.occurrences.length
    ? document.academicSections.occurrences
    : buildAcademicSections(document, rules).occurrences;
}

export function findAcademicSectionOccurrencesByNames(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
  names: readonly string[],
): readonly AcademicSectionOccurrence[] {
  const identities = new Set(names.map((name) => normalizeSectionName(name)));

  return getAcademicSectionOccurrences(document, rules).filter((occurrence) =>
    occurrence.identity
      ? identities.has(occurrence.identity)
      : occurrence.candidateIdentities.some((identity) => identities.has(identity)),
  );
}

export function findDeclaredAcademicSectionOccurrencesByNames(
  document: Readonly<NormalizedDocument>,
  rules: readonly RuleDefinition[],
  names: readonly string[],
): readonly AcademicSectionOccurrence[] {
  return findAcademicSectionOccurrencesByNames(document, rules, names).filter(
    (occurrence) => occurrence.status === "declared",
  );
}
