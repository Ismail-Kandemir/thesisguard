import { loadAvailableRuleSets } from "../rules/RuleLoader";
import type {
  Department,
  Faculty,
  Institute,
  Program,
  RuleSetMetadata,
  StudyType,
  ThesisType,
  University,
  UniversityRuleSet,
} from "../types";

interface AcademicCatalogEntryBase {
  university: Readonly<University>;
  thesisType: Readonly<ThesisType>;
  studyTypes?: readonly Readonly<StudyType>[];
}

type FacultyOrInstituteCatalogEntry =
  | { faculty: Readonly<Faculty>; institute?: never }
  | { faculty?: never; institute: Readonly<Institute> };

type DepartmentOrProgramCatalogEntry =
  | { department: Readonly<Department>; program?: never }
  | { department?: never; program: Readonly<Program> };

export type AcademicCatalogEntry = Readonly<
  AcademicCatalogEntryBase &
    FacultyOrInstituteCatalogEntry &
    DepartmentOrProgramCatalogEntry
>;

export class AcademicCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicCatalogError";
  }
}

export const ACADEMIC_CATALOG: readonly AcademicCatalogEntry[] =
  buildAcademicCatalog(loadAvailableRuleSets());

export function buildAcademicCatalog(
  ruleSets: readonly UniversityRuleSet[],
): AcademicCatalogEntry[] {
  assertConsistentAcademicEntities(ruleSets);

  const parentRuleSetIds = new Set(
    ruleSets.flatMap((ruleSet) =>
      (ruleSet.extends ?? []).map((reference) => reference.id),
    ),
  );
  const groups = new Map<string, MutableCatalogGroup>();

  for (const ruleSet of ruleSets) {
    if (!isSelectableLeafRuleSet(ruleSet, parentRuleSetIds)) {
      continue;
    }

    const { metadata } = ruleSet;
    const key = createCatalogGroupKey(metadata);
    const existing = groups.get(key);

    if (existing) {
      addStudyType(existing, metadata.studyType, ruleSet.id);
      continue;
    }

    const group: MutableCatalogGroup = {
      entry: createCatalogEntry(metadata),
      hasDirectSelectableRuleSet: !metadata.studyType,
      sourceRuleSetIds: [ruleSet.id],
      studyTypes: metadata.studyType ? [metadata.studyType] : [],
    };

    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map(finalizeCatalogGroup)
    .sort(compareCatalogEntries);
}

interface MutableCatalogGroup {
  entry: AcademicCatalogEntry;
  hasDirectSelectableRuleSet: boolean;
  sourceRuleSetIds: string[];
  studyTypes: StudyType[];
}

function isSelectableLeafRuleSet(
  ruleSet: Readonly<UniversityRuleSet>,
  parentRuleSetIds: ReadonlySet<string>,
): boolean {
  const { metadata } = ruleSet;

  return (
    !parentRuleSetIds.has(ruleSet.id) &&
    hasOrganization(metadata) &&
    hasUnit(metadata)
  );
}

function createCatalogEntry(
  metadata: Readonly<RuleSetMetadata>,
): AcademicCatalogEntry {
  const base = {
    university: { ...metadata.university },
    thesisType: { ...metadata.thesisType },
  };
  const organization = metadata.faculty
    ? { faculty: { ...metadata.faculty } }
    : { institute: { ...metadata.institute } };
  const unit = metadata.department
    ? { department: { ...metadata.department } }
    : { program: { ...metadata.program } };

  return {
    ...base,
    ...organization,
    ...unit,
  } as AcademicCatalogEntry;
}

function addStudyType(
  group: MutableCatalogGroup,
  studyType: StudyType | undefined,
  ruleSetId: string,
): void {
  if (!studyType) {
    if (group.studyTypes.length > 0) {
      throw new AcademicCatalogError(
        `Catalog direct leaf ve study type leaf karisimi iceriyor: ${[
          ...group.sourceRuleSetIds,
          ruleSetId,
        ].join(", ")}.`,
      );
    }

    group.hasDirectSelectableRuleSet = true;
    group.sourceRuleSetIds.push(ruleSetId);
    return;
  }

  if (group.hasDirectSelectableRuleSet) {
    throw new AcademicCatalogError(
      `Catalog direct leaf ve study type leaf karisimi iceriyor: ${[
        ...group.sourceRuleSetIds,
        ruleSetId,
      ].join(", ")}.`,
    );
  }

  if (group.studyTypes.some((candidate) => candidate.id === studyType.id)) {
    throw new AcademicCatalogError(
      `Catalog duplicate study type iceriyor: ${studyType.id}.`,
    );
  }

  group.studyTypes.push({ ...studyType });
  group.sourceRuleSetIds.push(ruleSetId);
}

function finalizeCatalogGroup(group: MutableCatalogGroup): AcademicCatalogEntry {
  if (group.studyTypes.length === 0) {
    return group.entry;
  }

  return {
    ...group.entry,
    studyTypes: [...group.studyTypes].sort(compareEntities),
  };
}

function assertConsistentAcademicEntities(
  ruleSets: readonly UniversityRuleSet[],
): void {
  const labelsByScopedId = new Map<string, string>();

  for (const ruleSet of ruleSets) {
    const { metadata } = ruleSet;
    assertEntityConsistency(
      labelsByScopedId,
      `university:${metadata.university.id}`,
      metadata.university,
    );
    assertEntityConsistency(
      labelsByScopedId,
      `university:${metadata.university.id}:thesis-type:${metadata.thesisType.id}`,
      metadata.thesisType,
    );

    if (metadata.faculty) {
      assertEntityConsistency(
        labelsByScopedId,
        `university:${metadata.university.id}:faculty:${metadata.faculty.id}`,
        metadata.faculty,
      );
    }

    if (metadata.institute) {
      assertEntityConsistency(
        labelsByScopedId,
        `university:${metadata.university.id}:institute:${metadata.institute.id}`,
        metadata.institute,
      );
    }

    const organizationKey = metadata.faculty
      ? `faculty:${metadata.faculty.id}`
      : metadata.institute
        ? `institute:${metadata.institute.id}`
        : "organization:none";

    if (metadata.department) {
      assertEntityConsistency(
        labelsByScopedId,
        `university:${metadata.university.id}:${organizationKey}:department:${metadata.department.id}`,
        metadata.department,
      );
    }

    if (metadata.program) {
      assertEntityConsistency(
        labelsByScopedId,
        `university:${metadata.university.id}:${organizationKey}:program:${metadata.program.id}`,
        metadata.program,
      );
    }

    if (metadata.studyType) {
      assertEntityConsistency(
        labelsByScopedId,
        `${createCatalogGroupKey(metadata)}:study-type:${metadata.studyType.id}`,
        metadata.studyType,
      );
    }
  }
}

function assertEntityConsistency(
  labelsByScopedId: Map<string, string>,
  scopedId: string,
  entity: Readonly<University | ThesisType | Faculty | Institute | Department | Program | StudyType>,
): void {
  const label = `${entity.name}|${entity.slug}`;
  const existingLabel = labelsByScopedId.get(scopedId);

  if (existingLabel && existingLabel !== label) {
    throw new AcademicCatalogError(
      `Academic metadata ambiguous for ${scopedId}.`,
    );
  }

  labelsByScopedId.set(scopedId, label);
}

function createCatalogGroupKey(metadata: Readonly<RuleSetMetadata>): string {
  return [
    metadata.university.id,
    metadata.faculty ? `faculty:${metadata.faculty.id}` : "",
    metadata.institute ? `institute:${metadata.institute.id}` : "",
    metadata.department ? `department:${metadata.department.id}` : "",
    metadata.program ? `program:${metadata.program.id}` : "",
    metadata.thesisType.id,
  ].join("|");
}

function compareCatalogEntries(
  first: AcademicCatalogEntry,
  second: AcademicCatalogEntry,
): number {
  return createCatalogEntrySortKey(first).localeCompare(
    createCatalogEntrySortKey(second),
  );
}

function createCatalogEntrySortKey(entry: AcademicCatalogEntry): string {
  return [
    entry.university.id,
    entry.faculty?.id ?? entry.institute?.id ?? "",
    entry.department?.id ?? entry.program?.id ?? "",
    entry.thesisType.id,
  ].join("|");
}

function compareEntities(
  first: Readonly<StudyType>,
  second: Readonly<StudyType>,
): number {
  return first.id.localeCompare(second.id);
}

function hasOrganization(
  metadata: Readonly<RuleSetMetadata>,
): metadata is RuleSetMetadata & FacultyOrInstituteCatalogEntry {
  return Boolean(metadata.faculty ?? metadata.institute);
}

function hasUnit(
  metadata: Readonly<RuleSetMetadata>,
): metadata is RuleSetMetadata & DepartmentOrProgramCatalogEntry {
  return Boolean(metadata.department ?? metadata.program);
}
