require("../golden/experimentalGoldenRegression.cjs");

const fs = require("node:fs");
const path = require("node:path");

const {
  AcademicCatalogError,
  buildAcademicCatalog,
} = require("../../src/features/analysis/catalog/AcademicCatalog.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const {
  RuleSetLoadError,
  loadDiscoveredRuleSets,
} = require("../../src/features/analysis/rules/RuleLoader.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");

const SYNTHETIC_UNIVERSITY_ID = "synthetic-north";
const SYNTHETIC_FACULTY_ID = "future-studies";
const SYNTHETIC_PROGRAM_ID = "ai-governance";
const SYNTHETIC_THESIS_TYPE_ID = "bachelor";
const SYNTHETIC_STUDY_TYPE_ID = "field-study";

function main() {
  const discovered = loadDiscoveredRuleSets(createSyntheticModules());
  const catalog = buildAcademicCatalog(discovered);
  const selection = createSelectionFromCatalog(catalog, SYNTHETIC_STUDY_TYPE_ID);
  const selectedRuleSets = new RuleSetSelector(catalog, discovered).select(selection);
  const resolvedRules = new RuleResolver().resolve(selectedRuleSets);
  const results = new RuleEngine().run(createNormalizedDocument(), resolvedRules);

  assertDiscovery(discovered);
  assertCatalog(catalog);
  assertSelection(selectedRuleSets);
  assertParentAndOverride(resolvedRules);
  assertValidatorDispatch(resolvedRules);
  assertEvidenceMetadata(resolvedRules);
  assertRuleEngineResults(results);
  assertFailureSafety();
  assertNoUniversitySpecificProductionRegistration();

  console.log(JSON.stringify({
    audit: "multiUniversitySyntheticIntegrationRegression.cjs",
    result: "PASS",
    discoveredRuleSets: discovered.map((ruleSet) => ruleSet.id).sort(),
    catalogEntries: catalog.length,
    selectedRuleSets: selectedRuleSets.map((ruleSet) => ruleSet.id).sort(),
    resolvedRules: resolvedRules.map((rule) => rule.id).sort(),
    ruleEngineStatuses: Object.fromEntries(results.map((result) => [result.ruleId, result.status])),
    failureSafety: "PASS",
    productionRegistration: "NOT_REQUIRED",
  }, null, 2));
}

function createSyntheticModules() {
  const parent = createRuleSet({
    id: `${SYNTHETIC_UNIVERSITY_ID}.bachelor`,
    metadata: {
      university: entity(SYNTHETIC_UNIVERSITY_ID, "Synthetic North University"),
      thesisType: entity(SYNTHETIC_THESIS_TYPE_ID, "Bachelor"),
      version: "1.1.0",
    },
    rules: [
      createRule({
        id: `${SYNTHETIC_UNIVERSITY_ID}.bachelor.typography.font-size`,
        type: "FONT_SIZE",
        category: "typography",
        expected: { value: 12, unit: "pt" },
        validationEvidence: { coverage: "COMPLETE", trust: "HIGH" },
      }),
      createRule({
        id: `${SYNTHETIC_UNIVERSITY_ID}.bachelor.format.alignment`,
        type: "ALIGNMENT",
        category: "format",
        expected: "justify",
        validationEvidence: { coverage: "COMPLETE", trust: "HIGH" },
      }),
    ],
  });
  const programBase = createRuleSet({
    id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor`,
    metadata: {
      university: entity(SYNTHETIC_UNIVERSITY_ID, "Synthetic North University"),
      faculty: entity(SYNTHETIC_FACULTY_ID, "Future Studies Faculty"),
      program: entity(SYNTHETIC_PROGRAM_ID, "AI Governance"),
      thesisType: entity(SYNTHETIC_THESIS_TYPE_ID, "Bachelor"),
      version: "1.1.0",
    },
    extends: [{ id: parent.id, scopeLevel: "university", version: "1.1.0" }],
    rules: [
      createRule({
        id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.page-number`,
        type: "PAGE_NUMBER",
        category: "structure",
        expected: { required: true, location: "footer", alignment: "center" },
      }),
    ],
  });
  const fieldStudy = createRuleSet({
    id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study`,
    metadata: {
      ...programBase.metadata,
      studyType: entity(SYNTHETIC_STUDY_TYPE_ID, "Field Study"),
    },
    extends: [{ id: programBase.id, scopeLevel: "program", version: "1.1.0" }],
    rules: [
      createRule({
        id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study.font-size`,
        type: "FONT_SIZE",
        category: "typography",
        expected: { value: 11, unit: "pt" },
        overrides: [{ ruleId: `${SYNTHETIC_UNIVERSITY_ID}.bachelor.typography.font-size` }],
      }),
      createRule({
        id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study.required-section`,
        type: "REQUIRED_SECTION",
        category: "structure",
        expected: { section: "Synthetic Section", required: true },
        validationEvidence: { coverage: "PARTIAL", trust: "MEDIUM" },
      }),
    ],
  });
  const deskStudy = createRuleSet({
    id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.desk-study`,
    metadata: {
      ...programBase.metadata,
      studyType: entity("desk-study", "Desk Study"),
    },
    extends: [{ id: programBase.id, scopeLevel: "program", version: "1.1.0" }],
    rules: [
      createRule({
        id: `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.desk-study.required-section`,
        type: "REQUIRED_SECTION",
        category: "structure",
        expected: { section: "Desk Section", required: true },
        validationEvidence: { coverage: "COMPLETE", trust: "HIGH" },
      }),
    ],
  });

  return {
    "synthetic/synthetic-north/bachelor.json": parent,
    "synthetic/synthetic-north/future-studies/ai-governance/bachelor.json": programBase,
    "synthetic/synthetic-north/future-studies/ai-governance/bachelor/field-study.json": fieldStudy,
    "synthetic/synthetic-north/future-studies/ai-governance/bachelor/desk-study.json": deskStudy,
  };
}

function assertDiscovery(discovered) {
  assertDeepEqual(
    discovered.map((ruleSet) => ruleSet.id).sort(),
    [
      `${SYNTHETIC_UNIVERSITY_ID}.bachelor`,
      `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor`,
      `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.desk-study`,
      `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study`,
    ],
    "synthetic discovery ids",
  );
}

function assertCatalog(catalog) {
  assertEqual(catalog.length, 1, "synthetic catalog entry count");
  const [entry] = catalog;
  assertEqual(entry.university.id, SYNTHETIC_UNIVERSITY_ID, "catalog university id");
  assertEqual(entry.faculty?.id, SYNTHETIC_FACULTY_ID, "catalog faculty id");
  assertEqual(entry.program?.id, SYNTHETIC_PROGRAM_ID, "catalog program id");
  assertEqual(entry.thesisType.id, SYNTHETIC_THESIS_TYPE_ID, "catalog thesis type id");
  assertDeepEqual(
    entry.studyTypes?.map((studyType) => studyType.id),
    ["desk-study", SYNTHETIC_STUDY_TYPE_ID],
    "catalog study type ids",
  );

  const relabeled = buildAcademicCatalog(
    loadDiscoveredRuleSets(createSyntheticModulesWithRelabeledDisplayNames()),
  );
  const relabeledSelection = createSelectionFromCatalog(relabeled, SYNTHETIC_STUDY_TYPE_ID);
  assertDeepEqual(relabeledSelection, {
    universityId: SYNTHETIC_UNIVERSITY_ID,
    facultyId: SYNTHETIC_FACULTY_ID,
    programId: SYNTHETIC_PROGRAM_ID,
    thesisTypeId: SYNTHETIC_THESIS_TYPE_ID,
    studyTypeId: SYNTHETIC_STUDY_TYPE_ID,
  }, "display label changes do not alter stable ids");
}

function assertSelection(selectedRuleSets) {
  assertDeepEqual(
    selectedRuleSets.map((ruleSet) => ruleSet.id).sort(),
    [
      `${SYNTHETIC_UNIVERSITY_ID}.bachelor`,
      `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor`,
      `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study`,
    ],
    "selected rule sets",
  );
}

function assertParentAndOverride(resolvedRules) {
  assertRule(resolvedRules, `${SYNTHETIC_UNIVERSITY_ID}.bachelor.format.alignment`);
  assertRule(
    resolvedRules,
    `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study.font-size`,
    { expectedValue: 11 },
  );
  assertMissingRule(
    resolvedRules,
    `${SYNTHETIC_UNIVERSITY_ID}.bachelor.typography.font-size`,
    "parent font-size must be removed by leaf override",
  );
}

function assertValidatorDispatch(resolvedRules) {
  const registry = new ValidatorRegistry();
  const validatorNames = Object.fromEntries(
    resolvedRules.map((rule) => [rule.id, registry.getValidator(rule)?.constructor.name ?? null]),
  );

  assertEqual(
    validatorNames[`${SYNTHETIC_UNIVERSITY_ID}.bachelor.format.alignment`],
    "AlignmentValidator",
    "synthetic inherited alignment validator",
  );
  assertEqual(
    validatorNames[`${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study.font-size`],
    "FontSizeValidator",
    "synthetic override font-size validator",
  );
  assertEqual(
    validatorNames[`${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.page-number`],
    "PageNumberValidator",
    "synthetic page number validator",
  );
}

function assertEvidenceMetadata(resolvedRules) {
  assertRuleMetadata(
    resolvedRules,
    `${SYNTHETIC_UNIVERSITY_ID}.bachelor.format.alignment`,
    "COMPLETE",
    "HIGH",
  );
  assertRuleMetadata(
    resolvedRules,
    `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study.font-size`,
    "MISSING",
    "LOW",
  );
  assertRuleMetadata(
    resolvedRules,
    `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.page-number`,
    "MISSING",
    "LOW",
  );
  assertRuleMetadata(
    resolvedRules,
    `${SYNTHETIC_UNIVERSITY_ID}.future-studies.ai-governance.bachelor.field-study.required-section`,
    "PARTIAL",
    "MEDIUM",
  );
}

function assertRuleEngineResults(results) {
  assertEqual(results.length, 4, "synthetic RuleEngine result count");
  for (const result of results) {
    assertEqual(result.status, "PASSED", `${result.ruleId}: RuleEngine status`);
  }
}

function assertFailureSafety() {
  assertThrows(
    () => loadDiscoveredRuleSets({
      "synthetic/duplicate-a.json": createDuplicateSelectionRuleSet("duplicate-a"),
      "synthetic/duplicate-b.json": createDuplicateSelectionRuleSet("duplicate-b"),
    }),
    RuleSetLoadError,
    "Aynı academic selection",
    "duplicate selection safety",
  );
  assertThrows(
    () => loadDiscoveredRuleSets({
      "synthetic/malformed.json": {
        id: "malformed.synthetic",
        metadata: { university: entity("broken", "Broken University") },
        rules: [],
      },
    }),
    RuleSetLoadError,
    "metadata.thesisType",
    "malformed discovered candidate safety",
  );
  assertThrows(
    () => buildAcademicCatalog([
      createRuleSet({
        id: "ambiguous.synthetic.a",
        metadata: {
          university: entity("ambiguous", "Ambiguous University"),
          faculty: entity("same-faculty", "Faculty A"),
          program: entity("a", "Program A"),
          thesisType: entity("bachelor", "Bachelor"),
          version: "1.1.0",
        },
        rules: [createRule({ id: "ambiguous.synthetic.a.required-section" })],
      }),
      createRuleSet({
        id: "ambiguous.synthetic.b",
        metadata: {
          university: entity("ambiguous", "Ambiguous University"),
          faculty: entity("same-faculty", "Faculty B"),
          program: entity("b", "Program B"),
          thesisType: entity("bachelor", "Bachelor"),
          version: "1.1.0",
        },
        rules: [createRule({ id: "ambiguous.synthetic.b.required-section" })],
      }),
    ]),
    AcademicCatalogError,
    "Academic metadata ambiguous",
    "ambiguous catalog metadata safety",
  );

  const [unsupported] = new RuleEngine().run(createNormalizedDocument(), [
    createRule({
      id: "synthetic.unsupported.rule",
      type: "UNSUPPORTED_SYNTHETIC_RULE",
    }),
  ]);
  assertEqual(unsupported.status, "FAILED", "unsupported rule type status");
  assertEqual(unsupported.passed, false, "unsupported rule type passed flag");
  assertEqual(
    unsupported.message,
    "Bu kural için kayıtlı validator bulunamadı.",
    "unsupported rule type missing validator message",
  );
}

function assertNoUniversitySpecificProductionRegistration() {
  for (const relativePath of [
    "src/features/analysis/rules/RuleLoader.ts",
    "src/features/analysis/catalog/AcademicCatalog.ts",
    "src/features/analysis/rules/ValidatorRegistry.ts",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
    assertEqual(
      source.includes(SYNTHETIC_UNIVERSITY_ID),
      false,
      `${relativePath}: synthetic university-specific registration`,
    );
  }
}

function createSyntheticModulesWithRelabeledDisplayNames() {
  const modules = createSyntheticModules();
  const clone = JSON.parse(JSON.stringify(modules));

  for (const ruleSet of Object.values(clone)) {
    ruleSet.metadata.university.name = "Relabeled Synthetic University";
    if (ruleSet.metadata.faculty) {
      ruleSet.metadata.faculty.name = "Relabeled Faculty";
    }
    if (ruleSet.metadata.program) {
      ruleSet.metadata.program.name = "Relabeled Program";
    }
    if (ruleSet.metadata.studyType?.id === SYNTHETIC_STUDY_TYPE_ID) {
      ruleSet.metadata.studyType.name = "Relabeled Field Study";
    }
  }

  return clone;
}

function createSelectionFromCatalog(catalog, studyTypeId) {
  const entry = catalog.find((candidate) =>
    candidate.university.id === SYNTHETIC_UNIVERSITY_ID &&
    candidate.faculty?.id === SYNTHETIC_FACULTY_ID &&
    candidate.program?.id === SYNTHETIC_PROGRAM_ID &&
    candidate.thesisType.id === SYNTHETIC_THESIS_TYPE_ID &&
    candidate.studyTypes?.some((studyType) => studyType.id === studyTypeId),
  );

  if (!entry) {
    throw new Error("Synthetic catalog entry not found");
  }

  return {
    universityId: entry.university.id,
    facultyId: entry.faculty.id,
    programId: entry.program.id,
    thesisTypeId: entry.thesisType.id,
    studyTypeId,
  };
}

function createDuplicateSelectionRuleSet(idSuffix) {
  return createRuleSet({
    id: `duplicate.synthetic.${idSuffix}`,
    metadata: {
      university: entity("duplicate-synthetic", "Duplicate Synthetic University"),
      thesisType: entity("bachelor", "Bachelor"),
      version: "1.1.0",
    },
    rules: [createRule({ id: `duplicate.synthetic.${idSuffix}.required-section` })],
  });
}

function createRuleSet({ id, metadata, rules, extends: extensions = undefined }) {
  return {
    id,
    metadata,
    ...(extensions ? { extends: extensions } : {}),
    rules,
  };
}

function createRule(overrides = {}) {
  return {
    id: "synthetic.rule",
    type: "REQUIRED_SECTION",
    title: "Synthetic Rule",
    description: "Synthetic integration rule.",
    category: "structure",
    expected: { section: "Synthetic Section", required: true },
    severity: "error",
    score: 10,
    message: "Synthetic rule failed.",
    solution: "Fix synthetic content.",
    enabled: true,
    version: "1.1.0",
    ...overrides,
  };
}

function createNormalizedDocument() {
  const paragraph = {
    id: "p1",
    text: "Synthetic body text",
    runs: [{
      text: "Synthetic body text",
      styleId: null,
      fontFamilyReference: null,
      bold: null,
      italic: null,
      underline: null,
      fontFamily: null,
      fontSize: 11,
    }],
    contentScope: "document",
    alignment: "justify",
    lineSpacing: { value: 240, rule: "auto" },
    paragraphFormatting: emptyParagraphFormatting(),
    styleId: null,
    numbering: { source: "none", numId: null, level: null, visibleLabel: null },
    isTableOfContentsEntry: false,
    isInTableCell: false,
    isEmpty: false,
  };

  return {
    paragraphs: [paragraph],
    styles: [],
    documentDefaults: {
      defaultParagraphStyleId: null,
      fontFamily: "Times New Roman",
      fontFamilyReference: null,
      fontSize: 11,
      bold: false,
      italic: false,
      underline: false,
      lineSpacing: { value: 240, rule: "auto" },
      alignment: "justify",
      paragraphFormatting: emptyParagraphFormatting(),
    },
    numberingDefinitions: [],
    pageMargins: { left: null, right: null, top: null, bottom: null },
    pageSections: [],
    pageNumbering: {
      hasPageNumbers: true,
      fields: [{
        sourcePath: "word/footer1.xml",
        location: "footer",
        alignment: "center",
        fieldType: "PAGE",
        structure: "instrText",
      }],
      sections: [],
    },
    tableOfContents: { hasField: false, fields: [] },
    tables: { count: 0, hasTables: false, items: [] },
    blocks: [{ id: "b1", blockIndex: 0, type: "paragraph", paragraphId: "p1" }],
    captions: { items: [], orphanCaptionIds: [] },
    objectSemantics: {
      representations: [],
      captions: [],
      associations: [],
      resolutions: [],
    },
    academicScopes: {
      paragraphs: [],
      blocks: [],
      mainContentBoundary: null,
    },
    objectReferences: { items: [] },
    abbreviations: { items: [], count: 0, hasAbbreviations: false },
    academicSections: {
      occurrences: [{
        id: "section-1",
        identity: "syntheticsection",
        canonicalName: "Synthetic Section",
        candidateIdentities: [],
        status: "declared",
        confidence: "high",
        headingParagraphId: "p1",
        headingParagraphIndex: 0,
        blockIndex: 0,
        normalizedHeadingText: "synthetic section",
        displayHeadingText: "Synthetic Section",
        headingLevel: 0,
        numberingLevel: 0,
        numberingSource: "none",
        visibleNumberingLabel: null,
        recognitionEvidence: ["rule-expected-section"],
        boundary: {
          startParagraphIndex: 0,
          endParagraphIndex: 0,
          startBlockIndex: 0,
          endBlockIndex: 0,
        },
        scope: null,
      }],
    },
    sections: [],
    headings: [],
    themeFonts: null,
  };
}

function emptyParagraphFormatting() {
  return {
    indentation: {
      leftTwips: null,
      rightTwips: null,
      firstLineTwips: null,
      hangingTwips: null,
      leftChars: null,
      rightChars: null,
      firstLineChars: null,
      hangingChars: null,
    },
    spacing: {
      beforeTwips: null,
      afterTwips: null,
      beforeLines: null,
      afterLines: null,
    },
  };
}

function assertRule(rules, ruleId, options = {}) {
  const rule = rules.find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error(`Rule not resolved: ${ruleId}`);
  }

  if ("expectedValue" in options) {
    assertEqual(rule.expected.value, options.expectedValue, `${ruleId}: expected value`);
  }

  return rule;
}

function assertMissingRule(rules, ruleId, message) {
  if (rules.some((rule) => rule.id === ruleId)) {
    throw new Error(message);
  }
}

function assertRuleMetadata(rules, ruleId, coverage, trust) {
  const rule = assertRule(rules, ruleId);
  assertEqual(rule.validation?.coverage, coverage, `${ruleId}: coverage`);
  assertEqual(rule.validation?.trust, trust, `${ruleId}: trust`);
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
