const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      resolveJsonModule: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  module._compile(output, filename);
};

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
  "full-correct.docx",
);
const INDENTATION_NEGATIVE_FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
  "experimental-indentation-fail.docx",
);
const TYPOGRAPHY_NEGATIVE_FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
  "experimental-typography-fail.docx",
);
const PARAGRAPH_FORMAT_NEGATIVE_FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
  "experimental-paragraph-format-fail.docx",
);

const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

const EXPECTED_RULE_COUNTS = {
  experimental: 46,
  sourceResearch: 44,
  common: 41,
};

const CRITICAL_RULE_IDS = [
  "comu.bachelor.typography.font-family",
  "comu.bachelor.typography.font-size",
  "comu.bachelor.spacing.line-height",
  "comu.bachelor.format.alignment",
  "comu.applied-sciences.food-technology.bachelor.paragraph-indentation",
  "comu.applied-sciences.food-technology.bachelor.heading.heading1",
  "comu.bachelor.heading.heading2",
  "comu.bachelor.heading.heading3",
  "comu.applied-sciences.food-technology.bachelor.heading-alignment",
  "comu.applied-sciences.food-technology.bachelor.experimental.heading-numbering",
  "comu.applied-sciences.food-technology.bachelor.table-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.table-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.table-caption-format",
  "comu.applied-sciences.food-technology.bachelor.table-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-tables",
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-format",
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-figures",
  "comu.applied-sciences.food-technology.bachelor.list-of-abbreviations",
];

const INDENTATION_RULE_ID = "comu.applied-sciences.food-technology.bachelor.paragraph-indentation";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";
const LINE_SPACING_RULE_ID = "comu.bachelor.spacing.line-height";

installMinimalXmlDomParser();

async function main() {
  const { rules, results } = assertRuleComposition();

  runNegativeRegressionSmoke();

  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      [
        "Golden fixture is missing.",
        `Expected path: ${FIXTURE_PATH}`,
        "Copy thesisguard-comu-food-tech-experimental-46-of-46-full-correct.docx to that path as full-correct.docx.",
      ].join("\n"),
    );
  }

  await runPackageReadSmoke();

  const { document, report } = await runGoldenFixture();

  assertReport(report, rules, results);
  assertCriticalRules(report.results);
  assertFixtureFacts(document);
  await assertDerivedNegativeFixtures();

  console.log("Golden fixture regression passed: 46/46.");
}

function assertRuleComposition() {
  const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
  const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
  const {
    loadFoodTechnologyBachelorRuleSets,
  } = require("../../src/features/analysis/rules/RuleLoader.ts");

  const ruleSets = loadFoodTechnologyBachelorRuleSets();
  const ruleSetsById = new Map(ruleSets.map((ruleSet) => [ruleSet.id, ruleSet]));
  const experimentalRules = resolveRuleSet(
    "comu.applied-sciences.food-technology.bachelor.experimental",
    ruleSets,
    ruleSetsById,
    RuleResolver,
  );
  const sourceResearchRules = resolveRuleSet(
    "comu.applied-sciences.food-technology.bachelor.source-research",
    ruleSets,
    ruleSetsById,
    RuleResolver,
  );
  const commonRules = resolveRuleSet(
    "comu.applied-sciences.food-technology.bachelor",
    ruleSets,
    ruleSetsById,
    RuleResolver,
  );

  const emptyDocument = createEmptyDocument();
  const results = new RuleEngine().run(emptyDocument, experimentalRules);
  const missingValidatorCount = results.filter(
    (result) => result.message === "Bu kural icin kayitli validator bulunamadi.",
  ).length;

  assertEqual(experimentalRules.length, EXPECTED_RULE_COUNTS.experimental, "Experimental rule count changed");
  assertEqual(sourceResearchRules.length, EXPECTED_RULE_COUNTS.sourceResearch, "Source Research rule count changed");
  assertEqual(commonRules.length, EXPECTED_RULE_COUNTS.common, "Common rule count changed");
  assertEqual(results.length, experimentalRules.length, "Engine result count does not match resolved rules");
  assertEqual(missingValidatorCount, 0, "Missing validator count changed");
  assertUnique(experimentalRules.map((rule) => rule.id), "duplicate resolved rule ID");

  return { rules: experimentalRules, results };
}

function resolveRuleSet(ruleSetId, allRuleSets, ruleSetsById, RuleResolver) {
  const selected = new Set();

  function collect(ruleSet) {
    if (!ruleSet || selected.has(ruleSet.id)) return;
    selected.add(ruleSet.id);
    for (const reference of ruleSet.extends ?? []) {
      collect(ruleSetsById.get(reference.id));
    }
  }

  collect(ruleSetsById.get(ruleSetId));
  return new RuleResolver().resolve(allRuleSets.filter((ruleSet) => selected.has(ruleSet.id)));
}

async function runGoldenFixture() {
  return runAnalysisFixture(FIXTURE_PATH);
}

async function runAnalysisFixture(filePath) {
  const { readDocxAnalysisXmlParts } = require("../../src/features/analysis/readers/docxPackageReader.ts");
  const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
  const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
  const { parseNumberingXml } = require("../../src/features/analysis/parsers/numberingXmlParser.ts");
  const { parseThemeFontsXml } = require("../../src/features/analysis/parsers/themeFontsXmlParser.ts");
  const {
    parseHeaderFooterPageNumbering,
  } = require("../../src/features/analysis/parsers/headerFooterXmlParser.ts");
  const {
    normalizeDocumentNumbering,
  } = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
  const {
    normalizeDocumentAbbreviations,
  } = require("../../src/features/analysis/parsers/documentAbbreviationsNormalizer.ts");
  const {
    normalizeDocumentObjectReferences,
  } = require("../../src/features/analysis/parsers/documentObjectReferencesNormalizer.ts");
  const {
    normalizeDocumentHeadings,
  } = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
  const {
    markRequiredSectionHeadings,
  } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
  const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
  const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
  const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
  const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

  const file = createNodeDocxReaderInput(filePath);
  const { documentXml, stylesXml, numberingXml, themeXml, headerFooterXmlParts } =
    await readDocxAnalysisXmlParts(file);
  const parsed = parseDocumentXml(documentXml);
  const parsedStyles = stylesXml ? parseStylesXml(stylesXml) : null;
  const formatted = {
    ...parsed,
    styles: parsedStyles?.styles ?? [],
    documentDefaults: parsedStyles?.documentDefaults ?? parsed.documentDefaults,
    themeFonts: themeXml ? parseThemeFontsXml(themeXml) : null,
    numberingDefinitions: numberingXml ? parseNumberingXml(numberingXml) : [],
    pageNumbering: {
      ...parseHeaderFooterPageNumbering(headerFooterXmlParts),
      sections: parsed.pageNumbering.sections,
    },
  };
  const numbered = normalizeDocumentNumbering(formatted);
  const ruleSets = new RuleSetSelector().select(SELECTION);
  const rules = new RuleResolver().resolve(ruleSets);
  const marked = markRequiredSectionHeadings(
    {
      ...numbered,
      abbreviations: normalizeDocumentAbbreviations(numbered),
      objectReferences: normalizeDocumentObjectReferences(numbered),
    },
    rules,
  );
  const headed = normalizeDocumentHeadings(marked, rules);
  const document = {
    ...headed,
    abbreviations: normalizeDocumentAbbreviations(headed),
    objectReferences: normalizeDocumentObjectReferences(headed),
  };
  const results = new RuleEngine().run(document, rules);
  const report = new ReportBuilder().build(results);

  return { document, report };
}

async function assertDerivedNegativeFixtures() {
  assert(fs.existsSync(INDENTATION_NEGATIVE_FIXTURE_PATH), "indentation negative fixture missing");
  assert(fs.existsSync(TYPOGRAPHY_NEGATIVE_FIXTURE_PATH), "typography negative fixture missing");
  assert(fs.existsSync(PARAGRAPH_FORMAT_NEGATIVE_FIXTURE_PATH), "paragraph format negative fixture missing");

  const indentation = await runAnalysisFixture(INDENTATION_NEGATIVE_FIXTURE_PATH);
  assertSingleFailureReport(indentation.report, INDENTATION_RULE_ID, "indentation negative fixture");
  const indentationResult = getResultById(indentation.report.results, INDENTATION_RULE_ID);
  assertEqual(indentationResult.evidence?.[0]?.kind, "paragraph", "indentation fixture evidence kind");
  assertEqual(indentationResult.evidence?.[0]?.paragraphId, "paragraph-25", "indentation fixture evidence paragraph id");
  assertEqual(indentationResult.evidence?.[0]?.paragraphIndex, 24, "indentation fixture evidence paragraph index");

  const typography = await runAnalysisFixture(TYPOGRAPHY_NEGATIVE_FIXTURE_PATH);
  assertSingleFailureReport(typography.report, FONT_SIZE_RULE_ID, "typography negative fixture");
  const fontSizeResult = getResultById(typography.report.results, FONT_SIZE_RULE_ID);
  assertEqual(fontSizeResult.evidence?.[0]?.kind, "run", "typography fixture evidence kind");
  assertEqual(fontSizeResult.evidence?.[0]?.paragraphId, "paragraph-25", "typography fixture evidence paragraph id");
  assertEqual(fontSizeResult.evidence?.[0]?.paragraphIndex, 24, "typography fixture evidence paragraph index");
  assertEqual(fontSizeResult.evidence?.[0]?.runIndex, 0, "typography fixture evidence run index");
  assertEqual(
    fontSizeResult.evidence?.[0]?.textExcerpt,
    "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.",
    "typography fixture evidence excerpt",
  );
  assertEqual(fontSizeResult.evidence?.[0]?.expected, 12, "typography fixture evidence expected");
  assertEqual(fontSizeResult.evidence?.[0]?.actual, 11, "typography fixture evidence actual");
  assertEqual(fontSizeResult.evidenceTotal, 1, "typography fixture evidence total");

  const paragraphFormat = await runAnalysisFixture(PARAGRAPH_FORMAT_NEGATIVE_FIXTURE_PATH);
  assertSingleFailureReport(paragraphFormat.report, LINE_SPACING_RULE_ID, "paragraph format negative fixture");
  const lineSpacingResult = getResultById(paragraphFormat.report.results, LINE_SPACING_RULE_ID);
  assertEqual(lineSpacingResult.evidence?.[0]?.kind, "paragraph", "paragraph format fixture evidence kind");
  assertEqual(lineSpacingResult.evidence?.[0]?.paragraphId, "paragraph-25", "paragraph format fixture evidence paragraph id");
  assertEqual(lineSpacingResult.evidence?.[0]?.paragraphIndex, 24, "paragraph format fixture evidence paragraph index");
  assertEqual(
    lineSpacingResult.evidence?.[0]?.textExcerpt,
    "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.",
    "paragraph format fixture evidence excerpt",
  );
  assertEqual(lineSpacingResult.evidence?.[0]?.expected, 1.5, "paragraph format fixture evidence expected");
  assertEqual(lineSpacingResult.evidence?.[0]?.actual, 1, "paragraph format fixture evidence actual");
  assertEqual(lineSpacingResult.evidenceTotal, 1, "paragraph format fixture evidence total");
}

function assertSingleFailureReport(report, failedRuleId, label) {
  assertEqual(report.totalRules, 46, `${label} total rule count`);
  assertEqual(report.passedRules, 45, `${label} passed rule count`);
  assertEqual(report.failedRules, 1, `${label} failed rule count`);
  assertEqual(report.notApplicableRules, 0, `${label} not applicable rule count`);
  assertEqual(report.score, 98, `${label} score`);
  const failed = report.results.filter((result) => result.status === "FAILED");
  assertEqual(failed[0]?.ruleId, failedRuleId, `${label} failed rule id`);
}

function getResultById(results, ruleId) {
  const result = results.find((item) => item.ruleId === ruleId);
  if (!result) throw new Error(`Rule result missing: ${ruleId}`);
  return result;
}

async function runPackageReadSmoke() {
  const { readDocxAnalysisXmlParts } = require("../../src/features/analysis/readers/docxPackageReader.ts");

  assert(fs.existsSync(FIXTURE_PATH), `fixture does not exist: ${FIXTURE_PATH}`);

  const file = createNodeDocxReaderInput(FIXTURE_PATH);
  assertAtLeast(file.size, 1, "fixture file size");

  const zip = await JSZip.loadAsync(file);
  assert(zip.file("word/document.xml") !== null, "word/document.xml was not found in DOCX ZIP");

  const parts = await readDocxAnalysisXmlParts(file);
  assertAtLeast(parts.documentXml.length, 1, "production document.xml read length");
}

function createNodeDocxReaderInput(filePath) {
  const buffer = fs.readFileSync(filePath);
  const exactFixtureBytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const bytes = new Uint8Array(exactFixtureBytes);

  Object.defineProperties(bytes, {
    name: { value: path.basename(filePath), enumerable: true },
    size: { value: bytes.byteLength, enumerable: true },
    type: {
      value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      enumerable: true,
    },
  });

  return bytes;
}

function assertReport(report, rules) {
  assertEqual(report.totalRules, 46, "total rule count");
  assertEqual(report.evaluatedRules, 46, "evaluated rule count");
  assertEqual(report.passedRules, 46, "passed rule count");
  assertEqual(report.failedRules, 0, `failed rules: ${formatResults(report.results, "FAILED")}`);
  assertEqual(
    report.notApplicableRules,
    0,
    `not applicable rules: ${formatResults(report.results, "NOT_APPLICABLE")}`,
  );
  assertEqual(report.score, 100, "golden score");
  assertEqual(report.results.length, rules.length, "result count");
  assertUnique(report.results.map((result) => result.ruleId), "duplicate result ruleId");

  const ruleIds = new Set(rules.map((rule) => rule.id));
  const resultIds = new Set(report.results.map((result) => result.ruleId));
  const missing = [...ruleIds].filter((ruleId) => !resultIds.has(ruleId));
  const unexpected = [...resultIds].filter((ruleId) => !ruleIds.has(ruleId));
  assertEqual(missing.length, 0, `missing result IDs: ${missing.join(", ")}`);
  assertEqual(unexpected.length, 0, `unexpected result IDs: ${unexpected.join(", ")}`);
}

function assertCriticalRules(results) {
  const byId = new Map(results.map((result) => [result.ruleId, result]));

  for (const ruleId of CRITICAL_RULE_IDS) {
    const result = byId.get(ruleId);
    if (!result) throw new Error(`Critical rule result missing: ${ruleId}`);
    assertEqual(result.status, "PASSED", `Critical rule did not pass: ${ruleId}`);
  }
}

function assertFixtureFacts(document) {
  assertEqual(document.tables.hasTables, true, "hasTables fact");
  assertAtLeast(document.tables.items.length, 1, "table count");
  assertEqual(document.figures.hasFigures, true, "hasFigures fact");
  assertAtLeast(document.figures.items.length, 1, "figure count");
  assertEqual(document.abbreviations.hasAbbreviations, true, "hasAbbreviations fact");
  assert(
    document.abbreviations.items.some((item) => item.value === "DNA"),
    "DNA abbreviation was not detected",
  );
  assert(
    document.headings.some((heading) => heading.level === 1 && heading.text === "FERMENTE ÜRÜNLER"),
    "Heading2 occurrence not found",
  );
  assert(
    document.headings.some((heading) => heading.level === 2 && heading.text === "STARTER KÜLTÜRLER"),
    "Heading3 occurrence not found",
  );
  for (const sectionName of [
    "Tablolar Listesi",
    "Şekiller Listesi",
    "Simgeler ve Kısaltmalar Listesi",
  ]) {
    assert(
      document.sections.some((section) => section.displayName.trim() === sectionName),
      `section not found: ${sectionName}`,
    );
  }
}

function runNegativeRegressionSmoke() {
  const {
    ObjectAlignmentValidator,
  } = require("../../src/features/analysis/rules/validators/ObjectAlignmentValidator.ts");
  const {
    ObjectCaptionPlacementValidator,
  } = require("../../src/features/analysis/rules/validators/ObjectCaptionPlacementValidator.ts");
  const {
    ObjectInTextReferenceValidator,
  } = require("../../src/features/analysis/rules/validators/ObjectInTextReferenceValidator.ts");
  const {
    ConditionalRequiredSectionValidator,
  } = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");
  const {
    FontFamilyValidator,
  } = require("../../src/features/analysis/rules/validators/FontFamilyValidator.ts");
  const {
    FontSizeValidator,
  } = require("../../src/features/analysis/rules/validators/FontSizeValidator.ts");
  const {
    HeadingAlignmentValidator,
  } = require("../../src/features/analysis/rules/validators/HeadingAlignmentValidator.ts");
  const {
    HeadingNumberingValidator,
  } = require("../../src/features/analysis/rules/validators/HeadingNumberingValidator.ts");
  const { HeadingValidator } = require("../../src/features/analysis/rules/validators/HeadingValidator.ts");
  const {
    AlignmentValidator,
  } = require("../../src/features/analysis/rules/validators/AlignmentValidator.ts");
  const {
    LineSpacingValidator,
  } = require("../../src/features/analysis/rules/validators/LineSpacingValidator.ts");
  const {
    ObjectCaptionFormatValidator,
  } = require("../../src/features/analysis/rules/validators/ObjectCaptionFormatValidator.ts");
  const {
    ParagraphIndentationValidator,
  } = require("../../src/features/analysis/rules/validators/ParagraphIndentationValidator.ts");
  const {
    SectionOrderValidator,
  } = require("../../src/features/analysis/rules/validators/SectionOrderValidator.ts");

  const tableAlignmentResult = new ObjectAlignmentValidator().validate(
    createNegativeDocument({ tableAlignment: "left" }),
    {
      ...ruleBase("table alignment"),
      type: "OBJECT_ALIGNMENT",
      expected: { object: "table", alignment: "center" },
    },
  );
  assertEqual(tableAlignmentResult.status, "FAILED", "negative table alignment");
  assertEqual(tableAlignmentResult.evidence?.[0]?.kind, "table", "table alignment evidence kind");
  assertEqual(tableAlignmentResult.evidence?.[0]?.objectId, "table-1", "table alignment evidence id");
  assertEqual(tableAlignmentResult.evidence?.[0]?.objectLabel, "Tablo 1", "table alignment evidence label");
  assertEqual(tableAlignmentResult.evidence?.[0]?.expected, "Ortalanmış", "table alignment evidence expected");
  assertEqual(tableAlignmentResult.evidence?.[0]?.actual, "Sola hizalı", "table alignment evidence actual");
  assertEqual(tableAlignmentResult.evidenceTotal, 1, "table alignment evidence total");
  const figureAlignmentResult = new ObjectAlignmentValidator().validate(
    createNegativeDocument({ figureAlignment: "left" }),
    {
      ...ruleBase("figure alignment"),
      type: "OBJECT_ALIGNMENT",
      expected: { object: "figure", alignment: "center" },
    },
  );
  assertEqual(figureAlignmentResult.status, "FAILED", "negative figure alignment");
  assertEqual(figureAlignmentResult.evidence?.[0]?.kind, "figure", "figure alignment evidence kind");
  assertEqual(figureAlignmentResult.evidence?.[0]?.objectId, "figure-1", "figure alignment evidence id");
  assertEqual(figureAlignmentResult.evidence?.[0]?.objectLabel, "Şekil 1", "figure alignment evidence label");
  assertEqual(figureAlignmentResult.evidence?.[0]?.paragraphId, "figure-carrier", "figure alignment paragraph id");
  assertEqual(figureAlignmentResult.evidence?.[0]?.paragraphIndex, 3, "figure alignment paragraph index");
  assertEqual(figureAlignmentResult.evidence?.[0]?.expected, "Ortalanmış", "figure alignment evidence expected");
  assertEqual(figureAlignmentResult.evidence?.[0]?.actual, "Sola hizalı", "figure alignment evidence actual");
  assertEqual(figureAlignmentResult.evidenceTotal, 1, "figure alignment evidence total");
  const fontSizeResult = new FontSizeValidator().validate(createNegativeDocument({ bodyRunFontSize: 11 }), {
    ...ruleBase("font size"),
    type: "FONT_SIZE",
    expected: 12,
  });
  assertEqual(fontSizeResult.status, "FAILED", "negative font size");
  assertAtLeast(fontSizeResult.evidence?.length ?? 0, 1, "negative font size evidence count");
  assertEqual(fontSizeResult.evidenceTotal, 1, "negative font size evidence total");
  assertEqual(fontSizeResult.evidence?.[0]?.kind, "run", "negative font size evidence kind");
  assertEqual(fontSizeResult.evidence?.[0]?.paragraphId, "body", "negative font size paragraph id");
  assertEqual(fontSizeResult.evidence?.[0]?.paragraphIndex, 1, "negative font size paragraph index");
  assertEqual(fontSizeResult.evidence?.[0]?.runIndex, 0, "negative font size run index");
  assertEqual(fontSizeResult.evidence?.[0]?.expected, 12, "negative font size expected");
  assertEqual(fontSizeResult.evidence?.[0]?.actual, 11, "negative font size actual");
  assert(
    (fontSizeResult.evidence?.[0]?.textExcerpt?.length ?? 0) > 0 &&
      (fontSizeResult.evidence?.[0]?.textExcerpt?.length ?? 0) <= 160,
    "negative font size evidence excerpt should be bounded",
  );
  const fontFamilyResult = new FontFamilyValidator().validate(createNegativeDocument({ bodyRunFontFamily: "Arial" }), {
    ...ruleBase("font family"),
    type: "FONT_FAMILY",
    expected: "Times New Roman",
  });
  assertEqual(fontFamilyResult.status, "FAILED", "negative font family");
  assertAtLeast(fontFamilyResult.evidence?.length ?? 0, 1, "negative font family evidence count");
  assertEqual(fontFamilyResult.evidenceTotal, 1, "negative font family evidence total");
  assertEqual(fontFamilyResult.evidence?.[0]?.kind, "run", "negative font family evidence kind");
  assertEqual(fontFamilyResult.evidence?.[0]?.paragraphId, "body", "negative font family paragraph id");
  assertEqual(fontFamilyResult.evidence?.[0]?.paragraphIndex, 1, "negative font family paragraph index");
  assertEqual(fontFamilyResult.evidence?.[0]?.runIndex, 0, "negative font family run index");
  assertEqual(fontFamilyResult.evidence?.[0]?.expected, "Times New Roman", "negative font family expected");
  assertEqual(fontFamilyResult.evidence?.[0]?.actual, "Arial", "negative font family actual");
  const lineSpacingResult = new LineSpacingValidator().validate(createNegativeDocument({ bodyLineSpacing: 240 }), {
    ...ruleBase("line spacing"),
    type: "LINE_SPACING",
    expected: 1.5,
  });
  assertEqual(lineSpacingResult.status, "FAILED", "negative line spacing");
  assertAtLeast(lineSpacingResult.evidence?.length ?? 0, 1, "negative line spacing evidence count");
  assertEqual(lineSpacingResult.evidenceTotal, 1, "negative line spacing evidence total");
  assertEqual(lineSpacingResult.evidence?.[0]?.kind, "paragraph", "negative line spacing evidence kind");
  assertEqual(lineSpacingResult.evidence?.[0]?.paragraphId, "body", "negative line spacing paragraph id");
  assertEqual(lineSpacingResult.evidence?.[0]?.paragraphIndex, 1, "negative line spacing paragraph index");
  assertEqual(lineSpacingResult.evidence?.[0]?.expected, 1.5, "negative line spacing expected");
  assertEqual(lineSpacingResult.evidence?.[0]?.actual, 1, "negative line spacing actual");
  assert(
    (lineSpacingResult.evidence?.[0]?.textExcerpt?.length ?? 0) > 0 &&
      (lineSpacingResult.evidence?.[0]?.textExcerpt?.length ?? 0) <= 160,
    "negative line spacing evidence excerpt should be bounded",
  );
  const alignmentResult = new AlignmentValidator().validate(createNegativeDocument({ bodyAlignment: "left" }), {
    ...ruleBase("alignment"),
    type: "ALIGNMENT",
    expected: "justify",
  });
  assertEqual(alignmentResult.status, "FAILED", "negative alignment");
  assertAtLeast(alignmentResult.evidence?.length ?? 0, 1, "negative alignment evidence count");
  assertEqual(alignmentResult.evidenceTotal, 1, "negative alignment evidence total");
  assertEqual(alignmentResult.evidence?.[0]?.kind, "paragraph", "negative alignment evidence kind");
  assertEqual(alignmentResult.evidence?.[0]?.paragraphId, "body", "negative alignment paragraph id");
  assertEqual(alignmentResult.evidence?.[0]?.paragraphIndex, 1, "negative alignment paragraph index");
  assertEqual(alignmentResult.evidence?.[0]?.expected, "Iki yana yasli", "negative alignment expected");
  assertEqual(alignmentResult.evidence?.[0]?.actual, "Sola hizali", "negative alignment actual");
  const figureCaptionPlacementResult = new ObjectCaptionPlacementValidator().validate(
    createNegativeDocument({ figureCaptionPosition: "before" }),
    {
      ...ruleBase("figure caption placement"),
      type: "OBJECT_CAPTION_PLACEMENT",
      expected: { object: "figure", position: "after" },
    },
  );
  assertEqual(figureCaptionPlacementResult.status, "FAILED", "negative figure caption placement");
  assertEqual(figureCaptionPlacementResult.evidence?.[0]?.kind, "figure", "figure placement evidence kind");
  assertEqual(figureCaptionPlacementResult.evidence?.[0]?.objectId, "figure-1", "figure placement evidence id");
  const tableCaptionPlacementResult = new ObjectCaptionPlacementValidator().validate(
    createNegativeDocument({ tableCaptionPosition: "after" }),
    {
      ...ruleBase("table caption placement"),
      type: "OBJECT_CAPTION_PLACEMENT",
      expected: { object: "table", position: "before" },
    },
  );
  assertEqual(tableCaptionPlacementResult.status, "FAILED", "negative table caption placement");
  assertEqual(tableCaptionPlacementResult.evidence?.[0]?.kind, "table", "table placement evidence kind");
  assertEqual(tableCaptionPlacementResult.evidence?.[0]?.objectId, "table-1", "table placement evidence id");
  const figureCaptionFormatResult = new ObjectCaptionFormatValidator().validate(createNegativeDocument(), {
    ...ruleBase("figure caption format"),
    type: "OBJECT_CAPTION_FORMAT",
    expected: { object: "figure", alignment: "center", lineSpacing: 1 },
  });
  assertEqual(figureCaptionFormatResult.status, "FAILED", "negative figure caption format");
  assertEqual(figureCaptionFormatResult.evidence?.[0]?.kind, "caption", "caption format evidence kind");
  assertEqual(figureCaptionFormatResult.evidence?.[0]?.captionId, "figure-caption", "caption format evidence id");
  const tableCaptionFormatResult = new ObjectCaptionFormatValidator().validate(createNegativeDocument(), {
    ...ruleBase("table caption format"),
    type: "OBJECT_CAPTION_FORMAT",
    expected: { object: "table", alignment: "center", lineSpacing: 1 },
  });
  assertEqual(tableCaptionFormatResult.status, "FAILED", "negative table caption format");
  assertEqual(tableCaptionFormatResult.evidence?.[0]?.kind, "caption", "table caption format evidence kind");
  assertEqual(tableCaptionFormatResult.evidence?.[0]?.captionId, "table-caption", "table caption format evidence id");
  const tableReferenceResult = new ObjectInTextReferenceValidator().validate(createNegativeDocument(), {
    ...ruleBase("table reference"),
    type: "OBJECT_IN_TEXT_REFERENCE",
    expected: { object: "table" },
  });
  assertEqual(tableReferenceResult.status, "FAILED", "negative missing table reference");
  assertEqual(tableReferenceResult.evidence?.[0]?.kind, "table", "table reference evidence kind");
  assertEqual(tableReferenceResult.evidence?.[0]?.objectLabel, "Tablo 1", "table reference evidence label");
  assertEqual(tableReferenceResult.evidence?.[0]?.expected, "Metin içinde en az bir atıf", "table reference evidence expected");
  assertEqual(tableReferenceResult.evidence?.[0]?.actual, "Atıf tespit edilmedi", "table reference evidence actual");
  assertEqual(tableReferenceResult.evidenceTotal, 1, "table reference evidence total");
  const figureReferenceResult = new ObjectInTextReferenceValidator().validate(
    createNegativeDocument({ figureReference: false }),
    {
      ...ruleBase("figure reference"),
      type: "OBJECT_IN_TEXT_REFERENCE",
      expected: { object: "figure" },
    },
  );
  assertEqual(figureReferenceResult.status, "FAILED", "negative missing figure reference");
  assertEqual(figureReferenceResult.evidence?.[0]?.kind, "figure", "figure reference evidence kind");
  assertEqual(figureReferenceResult.evidence?.[0]?.objectLabel, "Şekil 1", "figure reference evidence label");
  assertEqual(figureReferenceResult.evidence?.[0]?.paragraphId, "figure-carrier", "figure reference paragraph id");
  assertEqual(figureReferenceResult.evidence?.[0]?.paragraphIndex, 3, "figure reference paragraph index");
  assertEqual(figureReferenceResult.evidence?.[0]?.expected, "Metin içinde en az bir atıf", "figure reference evidence expected");
  assertEqual(figureReferenceResult.evidence?.[0]?.actual, "Atıf tespit edilmedi", "figure reference evidence actual");
  assertEqual(figureReferenceResult.evidenceTotal, 1, "figure reference evidence total");
  assertEqual(
    new ConditionalRequiredSectionValidator().validate(
      createNegativeDocument({ abbreviationList: false }),
      {
        ...ruleBase("abbreviation list"),
        type: "CONDITIONAL_REQUIRED_SECTION",
        expected: {
          section: "Simgeler ve Kısaltmalar Listesi",
          requiredWhen: { fact: "hasAbbreviations", equals: true },
        },
      },
    ).status,
    "FAILED",
    "negative missing abbreviation list",
  );
  const headingResult = new HeadingValidator().validate(createNegativeDocument({ heading2Font: "Arial" }), {
      ...ruleBase("heading 2"),
      type: "HEADING",
      category: "heading",
      expected: {
        value: "Heading2",
        fontFamily: "Times New Roman",
        fontSize: 12,
        bold: true,
      },
    });
  assertEqual(headingResult.status, "FAILED", "negative wrong Heading2 font");
  assertEqual(headingResult.evidence?.[0]?.kind, "heading", "heading format evidence kind");
  assertEqual(headingResult.evidence?.[0]?.paragraphId, "heading2", "heading format evidence paragraph");
  const headingAlignmentResult = new HeadingAlignmentValidator().validate(createNegativeDocument(), {
    ...ruleBase("heading alignment"),
    type: "HEADING_ALIGNMENT",
    expected: { levels: [1], alignment: "center" },
  });
  assertEqual(headingAlignmentResult.status, "FAILED", "negative heading alignment");
  assertEqual(headingAlignmentResult.evidence?.[0]?.kind, "heading", "heading alignment evidence kind");
  const headingNumberingDocument = createNegativeDocument();
  headingNumberingDocument.headings = headingNumberingDocument.headings.map((heading) => ({
    ...heading,
    isRuleDefinedSection: true,
    sectionName: "Giriş",
  }));
  const headingNumberingResult = new HeadingNumberingValidator().validate(headingNumberingDocument, {
    ...ruleBase("heading numbering"),
    type: "HEADING_NUMBERING",
    expected: { sections: [{ section: "Giriş", level: 0 }] },
  });
  assertEqual(headingNumberingResult.status, "FAILED", "negative heading numbering");
  assertEqual(headingNumberingResult.evidence?.[0]?.kind, "heading", "heading numbering evidence kind");
  const sectionOrderDocument = createNegativeDocument();
  sectionOrderDocument.sections = [
    {
      normalizedName: "giris",
      displayName: "Giriş",
      paragraphId: "heading2",
      paragraphIndex: 2,
      isRuleDefinedHeading: true,
      isObjectReferenceExcluded: false,
    },
    {
      normalizedName: "sonuc",
      displayName: "Sonuç",
      paragraphId: "intro",
      paragraphIndex: 0,
      isRuleDefinedHeading: true,
      isObjectReferenceExcluded: false,
    },
  ];
  const sectionOrderResult = new SectionOrderValidator().validate(sectionOrderDocument, {
    ...ruleBase("section order"),
    type: "SECTION_ORDER",
    expected: { sections: [{ section: "Giriş" }, { section: "Sonuç" }] },
  });
  assertEqual(sectionOrderResult.status, "FAILED", "negative section order");
  assertEqual(sectionOrderResult.evidence?.[0]?.kind, "section", "section order evidence kind");
  const indentationResult = new ParagraphIndentationValidator().validate(
    createNegativeDocument({ bodyIndentTwips: 0 }),
    {
      ...ruleBase("paragraph indentation"),
      category: "spacing",
      expected: {
        firstLineCm: 1.5,
        toleranceTwips: 1,
        sections: ["Giriş"],
      },
    },
  );
  assertEqual(indentationResult.status, "FAILED", "negative wrong paragraph indentation");
  assertAtLeast(indentationResult.evidence?.length ?? 0, 1, "negative indentation evidence count");
  assertEqual(indentationResult.evidenceTotal, 1, "negative indentation evidence total");
  assertEqual(indentationResult.evidence?.[0]?.kind, "paragraph", "negative indentation evidence kind");
  assertEqual(indentationResult.evidence?.[0]?.paragraphId, "body", "negative indentation paragraph id");
  assertEqual(indentationResult.evidence?.[0]?.paragraphIndex, 1, "negative indentation paragraph index");
  assertEqual(indentationResult.evidence?.[0]?.expected, 1.5, "negative indentation evidence expected");
  assertEqual(indentationResult.evidence?.[0]?.actual, 0, "negative indentation evidence actual");
  assert(
    (indentationResult.evidence?.[0]?.textExcerpt?.length ?? 0) > 0 &&
      (indentationResult.evidence?.[0]?.textExcerpt?.length ?? 0) <= 160,
    "negative indentation evidence excerpt should be bounded",
  );
}

function createNegativeDocument(options = {}) {
  const emptyFormatting = createEmptyFormatting();
  const goodIndent = {
    ...emptyFormatting,
    indentation: { ...emptyFormatting.indentation, firstLineTwips: 850.3937007874016 },
  };
  const paragraph = (id, text, overrides = {}) => ({
    id,
    text,
    runs: text
      ? [{
          text,
          styleId: null,
          bold: overrides.runBold ?? null,
          italic: null,
          underline: null,
          fontFamily: overrides.runFontFamily ?? null,
          fontSize: overrides.runFontSize ?? null,
        }]
      : [],
    alignment: overrides.alignment ?? "justify",
    lineSpacing: overrides.lineSpacing ?? 360,
    paragraphFormatting: overrides.paragraphFormatting ?? goodIndent,
    styleId: overrides.styleId ?? "Normal",
    numbering: overrides.numbering ?? { source: "none", numId: null, level: null, visibleLabel: null },
    isTableOfContentsEntry: false,
    isInTableCell: false,
    isEmpty: text.length === 0,
  });
  const bodyParagraph = paragraph("body", "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.", {
    alignment: options.bodyAlignment ?? "justify",
    lineSpacing: options.bodyLineSpacing ?? 360,
    runFontFamily: options.bodyRunFontFamily ?? null,
    runFontSize: options.bodyRunFontSize ?? null,
    paragraphFormatting: {
      ...goodIndent,
      indentation: {
        ...goodIndent.indentation,
        firstLineTwips: options.bodyIndentTwips ?? goodIndent.indentation.firstLineTwips,
      },
    },
  });
  const heading2Paragraph = paragraph("heading2", "2.1. FERMENTE ÜRÜNLER", {
    alignment: "left",
    styleId: "Heading2",
    runFontFamily: options.heading2Font ?? null,
  });

  return {
    paragraphs: [
      paragraph("intro", "1. GİRİŞ", { alignment: "left", styleId: "Heading1" }),
      bodyParagraph,
      heading2Paragraph,
      paragraph("figure-carrier", "", { alignment: "center" }),
      paragraph("figure-caption", "Şekil 1. Örnek Şekil", { alignment: "left", lineSpacing: 240 }),
      paragraph("table-caption-paragraph", "Tablo 1. Örnek Tablo", { alignment: "left", lineSpacing: 240 }),
    ],
    styles: [
      createStyle("Heading1", "Heading 1"),
      createStyle("Heading2", "Heading 2"),
      createStyle("Heading3", "Heading 3"),
    ],
    documentDefaults: {
      fontFamily: "Times New Roman",
      fontSize: 12,
      bold: false,
      italic: false,
      underline: false,
      lineSpacing: 360,
      alignment: "justify",
      paragraphFormatting: goodIndent,
    },
    numberingDefinitions: [],
    pageMargins: { left: null, right: null, top: null, bottom: null },
    pageNumbering: { hasPageNumbers: false, fields: [], sections: [] },
    tableOfContents: { hasField: false, fields: [] },
    tables: {
      count: 1,
      hasTables: true,
      items: [{
        id: "table-1",
        blockIndex: 1,
        isNested: false,
        tableStyleId: null,
        alignment: options.tableAlignment ?? "center",
        alignmentSource: "direct",
        captionId: "table-caption",
        captionPosition: options.tableCaptionPosition ?? "before",
      }],
    },
    figures: {
      count: 1,
      hasFigures: true,
      items: [{
        id: "figure-1",
        paragraphId: "figure-carrier",
        paragraphIndex: 3,
        blockIndex: 3,
        drawingType: "inline",
        alignment: options.figureAlignment ?? "center",
        alignmentSource: "paragraph",
        captionId: "figure-caption",
        captionPosition: options.figureCaptionPosition ?? "after",
      }],
    },
    blocks: [
      { id: "block-1", blockIndex: 0, type: "paragraph", paragraphId: "intro" },
      { id: "block-2", blockIndex: 1, type: "paragraph", paragraphId: "body" },
      { id: "block-3", blockIndex: 2, type: "paragraph", paragraphId: "heading2" },
      { id: "block-4", blockIndex: 3, type: "paragraph", paragraphId: "figure-carrier" },
      { id: "block-5", blockIndex: 4, type: "paragraph", paragraphId: "figure-caption" },
    ],
    captions: {
      items: [
        {
          id: "table-caption",
          paragraphId: "table-caption-paragraph",
          paragraphIndex: 0,
          blockIndex: 0,
          text: "Tablo 1. Örnek Tablo",
          kind: "table",
          label: "Tablo",
          number: "1",
        },
        {
          id: "figure-caption",
          paragraphId: "figure-caption",
          paragraphIndex: 4,
          blockIndex: 4,
          text: "Şekil 1. Örnek Şekil",
          kind: "figure",
          label: "Şekil",
          number: "1",
        },
      ],
      orphanCaptionIds: [],
    },
    objectReferences: {
      items: options.figureReference === false
        ? []
        : [{
            kind: "figure",
            number: "1",
            paragraphId: "body",
            paragraphIndex: 1,
            blockIndex: 1,
            matchedText: "Şekil 1",
          }],
    },
    abbreviations: { items: [{ value: "DNA", occurrences: 1 }], count: 1, hasAbbreviations: true },
    sections: [
      {
        normalizedName: "giris",
        displayName: "1. GİRİŞ",
        paragraphId: "intro",
        paragraphIndex: 0,
        isRuleDefinedHeading: true,
        isObjectReferenceExcluded: false,
      },
      ...(options.abbreviationList === false
        ? []
        : [{
            normalizedName: "simgelervekisaltmalarlistesi",
            displayName: "Simgeler ve Kısaltmalar Listesi",
            paragraphId: "abbr-list",
            paragraphIndex: 0,
            isRuleDefinedHeading: true,
            isObjectReferenceExcluded: false,
          }]),
    ],
    headings: [{
      id: "heading-heading2",
      paragraphId: "heading2",
      paragraphIndex: 2,
      blockIndex: 2,
      text: "FERMENTE ÜRÜNLER",
      normalizedText: "fermenteurunler",
      level: 1,
      numberingLevel: 1,
      numberingSource: "text",
      numId: null,
      visibleLabel: "2.1.",
      styleId: "Heading2",
      styleName: "Heading 2",
      sectionName: null,
      isRuleDefinedSection: false,
      isAcademicHeading: true,
    }],
    themeFonts: null,
  };
}

function createStyle(id, name) {
  return {
    id,
    type: "paragraph",
    name,
    basedOn: null,
    nextStyle: null,
    fontFamily: "Times New Roman",
    fontSize: 12,
    bold: true,
    italic: null,
    underline: null,
    lineSpacing: 360,
    paragraphFormatting: createEmptyFormatting(),
    alignment: "left",
    tableAlignment: null,
    numbering: null,
  };
}

function createEmptyDocument() {
  return {
    paragraphs: [],
    styles: [],
    documentDefaults: {
      fontFamily: null,
      fontSize: null,
      bold: null,
      italic: null,
      underline: null,
      lineSpacing: null,
      alignment: null,
      paragraphFormatting: createEmptyFormatting(),
    },
    numberingDefinitions: [],
    pageMargins: { left: null, right: null, top: null, bottom: null },
    pageNumbering: { hasPageNumbers: false, fields: [], sections: [] },
    tableOfContents: { hasField: false, fields: [] },
    tables: { count: 0, hasTables: false, items: [] },
    figures: { count: 0, hasFigures: false, items: [] },
    blocks: [],
    captions: { items: [], orphanCaptionIds: [] },
    objectReferences: { items: [] },
    abbreviations: { items: [], count: 0, hasAbbreviations: false },
    sections: [],
    headings: [],
    themeFonts: null,
  };
}

function createEmptyFormatting() {
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

function ruleBase(title) {
  return {
    id: `negative.${title.replace(/\s+/g, "-")}`,
    title,
    description: "",
    category: "format",
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "1.0.0",
  };
}

function installMinimalXmlDomParser() {
  if (typeof globalThis.DOMParser !== "undefined") return;

  class XmlNode {
    constructor(localName, namespaceURI, attributes, parentElement) {
      this.localName = localName;
      this.namespaceURI = namespaceURI;
      this.attributes = attributes;
      this.parentElement = parentElement;
      this.children = [];
      this._text = "";
    }

    get textContent() {
      return this._text + this.children.map((child) => child.textContent).join("");
    }

    getElementsByTagNameNS(namespaceURI, localName) {
      const matches = [];
      for (const child of this.children) {
        if (
          (namespaceURI === "*" || child.namespaceURI === namespaceURI) &&
          (localName === "*" || child.localName === localName)
        ) {
          matches.push(child);
        }
        matches.push(...child.getElementsByTagNameNS(namespaceURI, localName));
      }
      return asNodeList(matches);
    }

    getAttributeNS(namespaceURI, localName) {
      const found = this.attributes.find(
        (attribute) => attribute.localName === localName && attribute.namespaceURI === namespaceURI,
      );
      return found ? found.value : null;
    }

    getAttribute(name) {
      const found = this.attributes.find((attribute) => attribute.name === name);
      return found ? found.value : null;
    }
  }

  class XmlDocument extends XmlNode {
    constructor(children) {
      super("#document", null, [], null);
      this.children = children;
      for (const child of children) child.parentElement = null;
    }

    querySelector(selector) {
      return selector === "parsererror"
        ? this.getElementsByTagNameNS("*", "parsererror").item(0)
        : null;
    }
  }

  globalThis.DOMParser = class DOMParser {
    parseFromString(xml) {
      try {
        return parseXml(xml);
      } catch {
        return new XmlDocument([new XmlNode("parsererror", null, [], null)]);
      }
    }
  };

  function parseXml(xml) {
    const root = new XmlDocument([]);
    const stack = [{ node: root, namespaces: {} }];
    const tokenPattern = /<[^>]+>|[^<]+/g;
    let match;

    while ((match = tokenPattern.exec(xml)) !== null) {
      const token = match[0];
      const current = stack[stack.length - 1];

      if (token.startsWith("<?") || token.startsWith("<!--") || token.startsWith("<!")) {
        continue;
      }

      if (token.startsWith("</")) {
        stack.pop();
        continue;
      }

      if (token.startsWith("<")) {
        const selfClosing = /\/>\s*$/.test(token);
        const body = token.slice(1, selfClosing ? -2 : -1).trim();
        const nameMatch = /^([^\s/>]+)/.exec(body);
        if (!nameMatch) continue;
        const qualifiedName = nameMatch[1];
        const namespaceScope = { ...current.namespaces };
        const rawAttributes = parseAttributes(body.slice(qualifiedName.length));

        for (const attribute of rawAttributes) {
          if (attribute.name === "xmlns") {
            namespaceScope[""] = attribute.value;
          } else if (attribute.name.startsWith("xmlns:")) {
            namespaceScope[attribute.name.slice("xmlns:".length)] = attribute.value;
          }
        }

        const { prefix, localName } = splitName(qualifiedName);
        const attributes = rawAttributes
          .filter((attribute) => attribute.name !== "xmlns" && !attribute.name.startsWith("xmlns:"))
          .map((attribute) => {
            const parts = splitName(attribute.name);
            return {
              name: attribute.name,
              localName: parts.localName,
              namespaceURI: namespaceScope[parts.prefix] ?? null,
              value: decodeEntities(attribute.value),
            };
          });
        const node = new XmlNode(localName, namespaceScope[prefix] ?? null, attributes, current.node);
        current.node.children.push(node);

        if (!selfClosing) stack.push({ node, namespaces: namespaceScope });
      } else {
        current.node._text += decodeEntities(token);
      }
    }

    return root;
  }

  function parseAttributes(value) {
    const attributes = [];
    const attributePattern = /([^\s=]+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = attributePattern.exec(value)) !== null) {
      attributes.push({ name: match[1], value: match[2] });
    }
    return attributes;
  }

  function splitName(name) {
    const index = name.indexOf(":");
    return index === -1
      ? { prefix: "", localName: name }
      : { prefix: name.slice(0, index), localName: name.slice(index + 1) };
  }

  function decodeEntities(value) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function asNodeList(items) {
    items.item = (index) => items[index] ?? null;
    return items;
  }
}

function formatResults(results, status) {
  return results
    .filter((result) => result.status === status)
    .map((result) => result.ruleId)
    .join(", ") || "none";
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  assertEqual(duplicates.length, 0, `${label}: ${[...new Set(duplicates)].join(", ")}`);
}

function assertAtLeast(actual, expected, label) {
  if (actual < expected) throw new Error(`${label}: expected at least ${expected}, received ${actual}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
