import {
  ACADEMIC_CATALOG,
  type AcademicCatalogEntry,
} from "../catalog/AcademicCatalog";
import type { AcademicSelection, UniversityRuleSet } from "../types";
import { loadAvailableRuleSets } from "./RuleLoader";

export class AcademicSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicSelectionError";
  }
}

export class RuleSetSelector {
  constructor(
    private readonly catalog: readonly AcademicCatalogEntry[] = ACADEMIC_CATALOG,
    private readonly availableRuleSets: readonly UniversityRuleSet[] =
      loadAvailableRuleSets(),
  ) {}

  select(selection: Readonly<AcademicSelection>): UniversityRuleSet[] {
    validateSelection(selection, this.catalog);
    const selectedRuleSet = this.availableRuleSets.find((ruleSet) =>
      matchesSelection(ruleSet, selection),
    );

    if (!selectedRuleSet) {
      throw new AcademicSelectionError(
        "Seçim için yapılandırılmış bir rule set bulunamadı.",
      );
    }

    const selectedIds = collectRequiredRuleSetIds(
      selectedRuleSet,
      this.availableRuleSets,
    );

    return this.availableRuleSets.filter((ruleSet) =>
      selectedIds.has(ruleSet.id),
    );
  }
}

function validateSelection(
  selection: Readonly<AcademicSelection>,
  catalog: readonly AcademicCatalogEntry[],
): void {
  const universityEntries = catalog.filter(
    (entry) => entry.university.id === selection.universityId,
  );

  if (universityEntries.length === 0) {
    throw new AcademicSelectionError(
      `Bilinmeyen university: ${selection.universityId}.`,
    );
  }

  const organizationEntries = universityEntries.filter((entry) =>
    "facultyId" in selection
      ? entry.faculty?.id === selection.facultyId
      : entry.institute?.id === selection.instituteId,
  );

  if (organizationEntries.length === 0) {
    const kind = "facultyId" in selection ? "faculty" : "institute";
    const id =
      "facultyId" in selection ? selection.facultyId : selection.instituteId;
    throw new AcademicSelectionError(`Bilinmeyen ${kind}: ${id}.`);
  }

  const unitEntries = organizationEntries.filter((entry) =>
    "departmentId" in selection
      ? entry.department?.id === selection.departmentId
      : entry.program?.id === selection.programId,
  );

  if (unitEntries.length === 0) {
    const kind = "departmentId" in selection ? "department" : "program";
    const id =
      "departmentId" in selection
        ? selection.departmentId
        : selection.programId;
    throw new AcademicSelectionError(`Bilinmeyen ${kind}: ${id}.`);
  }

  if (
    !unitEntries.some(
      (entry) => entry.thesisType.id === selection.thesisTypeId,
    )
  ) {
    throw new AcademicSelectionError(
      `Desteklenmeyen thesis type: ${selection.thesisTypeId}.`,
    );
  }
}

function matchesSelection(
  ruleSet: UniversityRuleSet,
  selection: Readonly<AcademicSelection>,
): boolean {
  const { metadata } = ruleSet;

  return (
    metadata.university.id === selection.universityId &&
    metadata.thesisType.id === selection.thesisTypeId &&
    ("facultyId" in selection
      ? metadata.faculty?.id === selection.facultyId
      : metadata.institute?.id === selection.instituteId) &&
    ("departmentId" in selection
      ? metadata.department?.id === selection.departmentId
      : metadata.program?.id === selection.programId)
  );
}

function collectRequiredRuleSetIds(
  selectedRuleSet: UniversityRuleSet,
  availableRuleSets: readonly UniversityRuleSet[],
): ReadonlySet<string> {
  const requiredIds = new Set<string>();
  const ruleSetsById = new Map(
    availableRuleSets.map((ruleSet) => [ruleSet.id, ruleSet]),
  );

  function collect(ruleSet: UniversityRuleSet): void {
    if (requiredIds.has(ruleSet.id)) {
      return;
    }

    requiredIds.add(ruleSet.id);

    for (const reference of ruleSet.extends ?? []) {
      const parent = ruleSetsById.get(reference.id);

      if (parent) {
        collect(parent);
      }
    }
  }

  collect(selectedRuleSet);
  return requiredIds;
}
