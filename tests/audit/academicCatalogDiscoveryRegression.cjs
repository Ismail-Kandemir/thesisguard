require("../golden/experimentalGoldenRegression.cjs");

const {
  ACADEMIC_CATALOG,
  AcademicCatalogError,
  buildAcademicCatalog,
} = require("../../src/features/analysis/catalog/AcademicCatalog.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");

function main() {
  assertProductionCatalogPreserved();
  assertStableSelectionCompatibility();
  assertSyntheticSecondUniversityCatalog();
  assertAmbiguousMetadataFails();
  assertMixedDirectAndStudyTypeLeavesFail();

  console.log(JSON.stringify({
    audit: "academicCatalogDiscoveryRegression.cjs",
    result: "PASS",
    productionCatalogEntries: ACADEMIC_CATALOG.length,
    productionStudyTypes: ACADEMIC_CATALOG[0]?.studyTypes?.map((item) => item.id) ?? [],
    syntheticSecondUniversity: "PASS",
    ambiguousMetadata: "FAILED_SAFELY",
  }, null, 2));
}

function assertProductionCatalogPreserved() {
  assertEqual(ACADEMIC_CATALOG.length, 2, "production catalog entry count");

  const entry = findCatalogEntry("applied-sciences", "food-technology");

  assertEqual(entry.university.id, "comu", "university id");
  assertEqual(entry.university.name, "Çanakkale Onsekiz Mart Üniversitesi", "university label");
  assertEqual(entry.faculty?.id, "applied-sciences", "faculty id");
  assertEqual(entry.faculty?.name, "Uygulamalı Bilimler Fakültesi", "faculty label");
  assertEqual(entry.department?.id, "food-technology", "department id");
  assertEqual(entry.department?.name, "Gıda Teknolojisi", "department label");
  assertEqual(entry.thesisType.id, "bachelor", "thesis type id");
  assertEqual(entry.thesisType.name, "Lisans", "thesis type label");
  assertDeepEqual(
    entry.studyTypes?.map((studyType) => studyType.id),
    ["experimental", "source-research"],
    "study type ids",
  );
  assertDeepEqual(
    entry.studyTypes?.map((studyType) => studyType.name),
    ["Deneysel Çalışma", "Teorik / Kaynak Araştırması"],
    "study type labels",
  );

  const computerEngineering = findCatalogEntry("engineering", "computer-engineering");

  assertEqual(computerEngineering.university.id, "comu", "computer university id");
  assertEqual(computerEngineering.faculty?.id, "engineering", "computer faculty id");
  assertEqual(computerEngineering.faculty?.name, "Mühendislik Fakültesi", "computer faculty label");
  assertEqual(computerEngineering.department?.id, "computer-engineering", "computer department id");
  assertEqual(computerEngineering.department?.name, "Bilgisayar Mühendisliği", "computer department label");
  assertEqual(computerEngineering.thesisType.id, "bachelor", "computer thesis type id");
  assertEqual(computerEngineering.studyTypes, undefined, "computer study types");
}

function assertStableSelectionCompatibility() {
  const entry = findCatalogEntry("applied-sciences", "food-technology");
  const selectedIds = new RuleSetSelector(ACADEMIC_CATALOG, loadAvailableRuleSets())
    .select({
      universityId: entry.university.id,
      facultyId: entry.faculty.id,
      departmentId: entry.department.id,
      thesisTypeId: entry.thesisType.id,
      studyTypeId: "experimental",
    })
    .map((ruleSet) => ruleSet.id)
    .sort();

  assertDeepEqual(
    selectedIds,
    [
      "comu.applied-sciences.food-technology.bachelor",
      "comu.applied-sciences.food-technology.bachelor.experimental",
      "comu.bachelor",
    ],
    "stable catalog ids resolve expected rule sets",
  );
}

function findCatalogEntry(facultyId, departmentId) {
  const entry = ACADEMIC_CATALOG.find((candidate) =>
    candidate.faculty?.id === facultyId &&
    candidate.department?.id === departmentId
  );

  if (!entry) {
    throw new Error(`Catalog entry not found: ${facultyId}/${departmentId}`);
  }

  return entry;
}

function assertSyntheticSecondUniversityCatalog() {
  const parent = createRuleSet("second-university.bachelor", {
    university: entity("second-university", "Second University"),
    thesisType: entity("bachelor", "Bachelor"),
    version: "1.1.0",
  });
  const leaf = createRuleSet("second-university.engineering.software.bachelor", {
    university: entity("second-university", "Second University"),
    faculty: entity("engineering", "Engineering Faculty"),
    department: entity("software", "Software Engineering"),
    thesisType: entity("bachelor", "Bachelor"),
    version: "1.1.0",
  }, [{ id: parent.id, scopeLevel: "university", version: "1.1.0" }]);
  const catalog = buildAcademicCatalog([parent, leaf]);

  assertEqual(catalog.length, 1, "synthetic catalog entry count");
  assertEqual(catalog[0].university.id, "second-university", "synthetic university id");
  assertEqual(catalog[0].faculty?.id, "engineering", "synthetic faculty id");
  assertEqual(catalog[0].department?.id, "software", "synthetic department id");
  assertEqual(catalog[0].studyTypes, undefined, "synthetic direct leaf has no study type selector");
}

function assertAmbiguousMetadataFails() {
  assertThrows(
    () => buildAcademicCatalog([
      createRuleSet("ambiguous-u.engineering.software.bachelor.a", {
        university: entity("ambiguous-u", "Ambiguous University"),
        faculty: entity("engineering", "Engineering Faculty"),
        department: entity("software-a", "Software A"),
        thesisType: entity("bachelor", "Bachelor"),
        version: "1.1.0",
      }),
      createRuleSet("ambiguous-u.engineering.software.bachelor.b", {
        university: entity("ambiguous-u", "Ambiguous University"),
        faculty: entity("engineering", "Different Engineering Label"),
        department: entity("software-b", "Software B"),
        thesisType: entity("bachelor", "Bachelor"),
        version: "1.1.0",
      }),
    ]),
    AcademicCatalogError,
    "Academic metadata ambiguous",
    "ambiguous catalog metadata",
  );
}

function assertMixedDirectAndStudyTypeLeavesFail() {
  const baseMetadata = {
    university: entity("mixed-u", "Mixed University"),
    faculty: entity("engineering", "Engineering Faculty"),
    department: entity("software", "Software Engineering"),
    thesisType: entity("bachelor", "Bachelor"),
    version: "1.1.0",
  };

  assertThrows(
    () => buildAcademicCatalog([
      createRuleSet("mixed-u.engineering.software.bachelor.direct", baseMetadata),
      createRuleSet("mixed-u.engineering.software.bachelor.experimental", {
        ...baseMetadata,
        studyType: entity("experimental", "Experimental"),
      }),
    ]),
    AcademicCatalogError,
    "direct leaf ve study type leaf karisimi",
    "mixed direct and study type leaves",
  );
}

function createRuleSet(id, metadata, extensions = undefined) {
  return {
    id,
    metadata,
    ...(extensions ? { extends: extensions } : {}),
    rules: [createRule(`${id}.required-section`)],
  };
}

function createRule(id) {
  return {
    id,
    type: "REQUIRED_SECTION",
    title: "Synthetic Required Section",
    description: "Synthetic required section rule.",
    category: "structure",
    expected: { section: "Synthetic Section", required: true },
    severity: "error",
    score: 10,
    message: "Synthetic section missing.",
    solution: "Add the synthetic section.",
    enabled: true,
    version: "1.1.0",
  };
}

function entity(id, name) {
  return { id, name, slug: id };
}

function assertThrows(fn, errorClass, expectedMessagePart, message) {
  try {
    fn();
  } catch (error) {
    if (
      error instanceof errorClass &&
      error.message.includes(expectedMessagePart)
    ) {
      return;
    }

    throw new Error(`${message}: unexpected error ${error}`);
  }

  throw new Error(`${message}: expected throw`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    throw new Error(`${message}: expected ${expectedText}, received ${actualText}`);
  }
}

main();
