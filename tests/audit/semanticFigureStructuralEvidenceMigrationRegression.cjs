const fs = require("fs");
const path = require("path");
require("../golden/experimentalGoldenRegression.cjs");

const { analyzeDocx } = require("../../src/features/analysis/analysisService.ts");
const { buildAnalysisDiagnostics } = require("../../src/features/analysis/diagnostics/academicObjectDiagnostics.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { normalizeAcademicDocumentScopes } = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const { normalizeDocumentHeadings } = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const { normalizeDocumentObjectReferences } = require("../../src/features/analysis/parsers/documentObjectReferencesNormalizer.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { getDeclaredAcademicFigures } = require("../../src/features/analysis/rules/objectApplicability.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "comu", "food-technology", "experimental");
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};
const RULES = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));
const FIGURE_RULE_IDS = [
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-format",
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-figures",
];
const TABLE_RULE_IDS = [
  "comu.applied-sciences.food-technology.bachelor.table-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.table-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.table-caption-format",
  "comu.applied-sciences.food-technology.bachelor.table-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-tables",
];
const FIGURE_RULES = RULES.filter((rule) => FIGURE_RULE_IDS.includes(rule.id));
const STATIC_FILES = [
  "src/features/analysis/rules/objectApplicability.ts",
  "src/features/analysis/rules/validators/ObjectAlignmentValidator.ts",
  "src/features/analysis/rules/validators/ObjectCaptionPlacementValidator.ts",
  "src/features/analysis/rules/validators/ObjectInTextReferenceValidator.ts",
];

async function main() {
  const inlinePass = analyze(
    mainBoundary() + inlinePicture("center", 1) + caption("fig", 1, "Inline"),
    noBridgeMutation,
  );
  assertAcademicFigureCount(inlinePass, 1, "inline semantic figure without bridge state");
  assertStatus(inlinePass, "figure-object-alignment", "PASSED", "inline alignment pass");
  assertCoverage(inlinePass, "complete", 1, 1, 0, "inline alignment coverage");
  assertStatus(inlinePass, "figure-caption-placement", "PASSED", "inline placement pass");

  const inlineFail = analyze(
    mainBoundary() + inlinePicture("left", 2) + caption("fig", 1, "Inline"),
    noBridgeMutation,
  );
  assertStatus(inlineFail, "figure-object-alignment", "FAILED", "inline alignment fail");

  const declaredAnchor = forceFirstRepresentationDeclaredFigure(
    analyze(mainBoundary() + anchorPicture(3) + caption("fig", 1, "Anchor"), noBridgeMutation),
  );
  assertStatus(declaredAnchor, "figure-object-alignment", "NOT_APPLICABLE", "declared anchor alignment");
  assertCoverage(declaredAnchor, "none", 1, 0, 1, "declared anchor coverage");

  const inlinePlusAnchor = analyze(
    mainBoundary() +
      inlinePicture("center", 4) +
      caption("fig", 1, "Inline") +
      paragraph("Ara metin.") +
      anchorPicture(5) +
      caption("fig", 2, "Anchor"),
    noBridgeMutation,
  );
  assertStatus(inlinePlusAnchor, "figure-object-alignment", "PASSED", "inline plus anchor alignment");
  assertCoverage(inlinePlusAnchor, "partial", 2, 1, 1, "inline plus anchor coverage");

  const genericInline = analyze(mainBoundary() + inlinePicture("center", 6), noBridgeMutation);
  assertAcademicFigureCount(genericInline, 0, "generic inline drawing");
  assertStatus(genericInline, "figure-object-alignment", "NOT_APPLICABLE", "generic inline alignment");
  assertStatus(genericInline, "list-of-figures", "NOT_APPLICABLE", "generic inline list");

  const genericAnchor = analyze(mainBoundary() + anchorPicture(7), noBridgeMutation);
  assertAcademicFigureCount(genericAnchor, 0, "generic anchor drawing");
  assertCoverage(genericAnchor, "none", 0, 0, 0, "generic anchor coverage");

  for (const [label, drawing] of [
    ["chart", chartDrawing(8)],
    ["diagram", diagramDrawing(9)],
    ["group", groupDrawing(10)],
  ]) {
    const item = analyze(mainBoundary() + drawing, noBridgeMutation);
    assertAcademicFigureCount(item, 0, `${label} unresolved identity`);
    assertStatus(item, "figure-caption-placement", "NOT_APPLICABLE", `${label} placement`);
  }

  const placementIncorrect = analyze(
    mainBoundary() + caption("fig", 1, "Before") + inlinePicture("center", 11),
    noBridgeMutation,
  );
  assertStatus(placementIncorrect, "figure-caption-placement", "FAILED", "caption placement incorrect");

  const referencePresent = analyze(
    mainBoundary() +
      inlinePicture("center", 12) +
      caption("fig", 1, "Referenced") +
      paragraph("Bu metinde " + figureLabel(1) + " kullanildi."),
    noBridgeMutation,
  );
  assertStatus(referencePresent, "figure-in-text-reference", "PASSED", "reference present");

  const referenceMissing = analyze(
    mainBoundary() + inlinePicture("center", 13) + caption("fig", 1, "Missing reference"),
    noBridgeMutation,
  );
  assertStatus(referenceMissing, "figure-in-text-reference", "FAILED", "reference missing");

  assertAcademicFigureCount(
    analyze(mainBoundary() + deletedInlineParagraph(14) + caption("fig", 1, "Deleted"), noBridgeMutation),
    0,
    "deleted drawing invisible",
  );
  assertAcademicFigureCount(
    analyze(mainBoundary() + moveFromInlineParagraph(15) + caption("fig", 1, "MoveFrom"), noBridgeMutation),
    0,
    "moveFrom drawing invisible",
  );
  assertAcademicFigureCount(
    analyze(mainBoundary() + insertedInlineParagraph(16) + caption("fig", 1, "Inserted"), noBridgeMutation),
    1,
    "inserted drawing visible",
  );
  assertAcademicFigureCount(
    analyze(mainBoundary() + moveToInlineParagraph(17) + caption("fig", 1, "MoveTo"), noBridgeMutation),
    1,
    "moveTo drawing visible",
  );

  const frontMatterGeneric = analyze(inlinePicture("center", 18) + mainBoundary(), noBridgeMutation);
  assertAcademicFigureCount(frontMatterGeneric, 0, "front-matter generic identity");
  assertStatus(frontMatterGeneric, "list-of-figures", "NOT_APPLICABLE", "front-matter generic list");

  const diagnosticCase = analyze(mainBoundary() + chartDrawing(19), noBridgeMutation);
  assertDiagnostic(diagnosticCase, "UNRESOLVED_ACADEMIC_OBJECT", "diagnostics remain separate");
  const diagnosticReport = new ReportBuilder().build(diagnosticCase.results, undefined, undefined, diagnosticCase.diagnostics);
  assertEqual(diagnosticReport.failedRules, 0, "diagnostics do not create failed rule count");
  assertEqual(diagnosticReport.score, 0, "all-N/A score arithmetic remains unchanged");

  const golden = await analyzeDocx(
    createNodeDocxReaderInput(path.join(FIXTURE_DIR, "full-correct.docx")),
    SELECTION,
  );
  assertEqual(golden.passedRules, 46, "golden remains 46/46");
  assertEqual(golden.score, 100, "golden remains 100%");
  assertEqual(golden.diagnostics.length, 0, "golden diagnostics remain zero");
  for (const ruleId of TABLE_RULE_IDS) {
    assertEqual(
      golden.results.find((result) => result.ruleId === ruleId)?.status,
      "PASSED",
      `${ruleId} table behavior remains passed`,
    );
  }

  assertMigratedSourcesDoNotReadLegacyFigureItems();

  console.log(JSON.stringify({
    phase: "4E-18N",
    result: "PASS",
    semanticStructuralEvidenceMigration: "COMPLETE",
    golden: {
      passedRules: golden.passedRules,
      failedRules: golden.failedRules,
      score: golden.score,
      diagnosticCount: golden.diagnostics.length,
    },
  }, null, 2));
}

function analyze(content, mutate = (document) => document) {
  const document = mutate(scopedDocument(content));
  const results = new RuleEngine().run(document, FIGURE_RULES);
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);

  return { document, results, diagnostics };
}

function scopedDocument(content) {
  const parsed = parseDocumentXml(documentXml(content));
  const marked = markRequiredSectionHeadings(parsed, RULES);
  const headed = normalizeDocumentHeadings(marked, RULES);
  const scoped = normalizeAcademicDocumentScopes(headed, RULES);

  return {
    ...scoped,
    objectReferences: normalizeDocumentObjectReferences(scoped),
  };
}

function noBridgeMutation(document) {
  return document;
}

function forceFirstRepresentationDeclaredFigure(item) {
  const representation = item.document.objectSemantics.representations[0];
  const caption = item.document.objectSemantics.captions[0];
  assert(representation, "forced declared anchor representation missing");
  assert(caption, "forced declared anchor caption missing");

  const document = {
    ...item.document,
    objectSemantics: {
      ...item.document.objectSemantics,
      associations: item.document.objectSemantics.associations.map((association) =>
        association.objectId === representation.id
          ? {
              ...association,
              status: "matched",
              captionId: caption.id,
              candidateCaptionIds: [caption.id],
              position: "after",
              distanceInBlocks: 1,
              reasons: ["audit-forced-declared-anchor"],
            }
          : association,
      ),
      resolutions: item.document.objectSemantics.resolutions.map((resolution) =>
        resolution.objectId === representation.id
          ? {
              ...resolution,
              status: "declared",
              academicType: "figure",
              captionId: caption.id,
              reasons: ["audit-forced-declared-anchor"],
            }
          : resolution,
      ),
    },
  };

  const results = new RuleEngine().run(document, FIGURE_RULES);
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);

  return { document, results, diagnostics };
}

function assertMigratedSourcesDoNotReadLegacyFigureItems() {
  for (const relativePath of STATIC_FILES) {
    const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert(
      !content.includes("document.figures.items"),
      `${relativePath} must not read document.figures.items after 18N migration`,
    );
    assert(
      !content.includes("document.figures.count"),
      `${relativePath} must not read document.figures.count after 18N migration`,
    );
    assert(
      !content.includes("document.figures.hasFigures"),
      `${relativePath} must not read document.figures.hasFigures after 18N migration`,
    );
  }
}

function assertAcademicFigureCount(item, expected, label) {
  assertEqual(getDeclaredAcademicFigures(item.document).length, expected, `${label}: semantic academic figure count`);
}

function assertStatus(item, ruleSuffix, expected, label) {
  assertEqual(pick(item, ruleSuffix).status, expected, `${label}: ${ruleSuffix} status`);
}

function assertCoverage(item, status, relevant, evaluated, unevaluated, label) {
  const coverage = pick(item, "figure-object-alignment").coverage;
  assert(coverage, `${label}: coverage missing`);
  assertEqual(coverage.status, status, `${label}: coverage status`);
  assertEqual(coverage.relevantCount, relevant, `${label}: relevant count`);
  assertEqual(coverage.evaluatedCount, evaluated, `${label}: evaluated count`);
  assertEqual(coverage.unevaluatedCount, unevaluated, `${label}: unevaluated count`);
}

function assertDiagnostic(item, expectedCode, label) {
  assert(
    item.diagnostics.some((diagnostic) => diagnostic.code === expectedCode),
    `${label}: expected diagnostic ${expectedCode}`,
  );
}

function pick(item, ruleSuffix) {
  const result = item.results.find((candidate) => candidate.ruleId.endsWith(ruleSuffix));
  if (!result) {
    throw new Error(`Missing result: ${ruleSuffix}`);
  }

  return result;
}

function documentXml(content) {
  return [
    '<w:document',
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
    ' xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"',
    ' xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"',
    ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
    ' xmlns:v="urn:schemas-microsoft-com:vml"',
    ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
    '<w:body>',
    content,
    '</w:body>',
    '</w:document>',
  ].join("");
}

function mainBoundary() {
  return paragraph("Giri\u015F");
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function caption(kind, number, text) {
  const label = kind === "table" ? "Tablo" : "\u015Eekil";
  return '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr>' +
    `<w:r><w:t>${label} ${number}. ${text}</w:t></w:r></w:p>`;
}

function figureLabel(number) {
  return `\u015Eekil ${number}`;
}

function inlinePicture(alignment, id) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr>${inlineRun(pictureGraphic(), id)}</w:p>`;
}

function inlineRun(graphic, id) {
  return `<w:r><w:drawing><wp:inline><wp:docPr id="${id}" name="Inline ${id}"/>${graphic}</wp:inline></w:drawing></w:r>`;
}

function anchorPicture(id) {
  return `<w:p>${anchorRun(pictureGraphic(), id)}</w:p>`;
}

function anchorRun(graphic, id) {
  return [
    '<w:r><w:drawing><wp:anchor simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">',
    '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>',
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
    '<wp:extent cx="1828800" cy="914400"/>',
    '<wp:wrapSquare wrapText="bothSides"/>',
    `<wp:docPr id="${id}" name="Anchor ${id}"/>`,
    graphic,
    '</wp:anchor></w:drawing></w:r>',
  ].join("");
}

function pictureGraphic() {
  return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>';
}

function chartDrawing(id) {
  return `<w:p>${inlineRun('<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart/></a:graphicData></a:graphic>', id)}</w:p>`;
}

function diagramDrawing(id) {
  return `<w:p>${inlineRun('<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds/></a:graphicData></a:graphic>', id)}</w:p>`;
}

function groupDrawing(id) {
  return `<w:p>${inlineRun('<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp/></a:graphicData></a:graphic>', id)}</w:p>`;
}

function deletedInlineParagraph(id) {
  return `<w:p><w:del w:id="1">${inlineRun(pictureGraphic(), id)}</w:del></w:p>`;
}

function moveFromInlineParagraph(id) {
  return `<w:p><w:moveFrom w:id="2">${inlineRun(pictureGraphic(), id)}</w:moveFrom></w:p>`;
}

function insertedInlineParagraph(id) {
  return `<w:p><w:ins w:id="3">${inlineRun(pictureGraphic(), id)}</w:ins></w:p>`;
}

function moveToInlineParagraph(id) {
  return `<w:p><w:moveTo w:id="4">${inlineRun(pictureGraphic(), id)}</w:moveTo></w:p>`;
}

function createNodeDocxReaderInput(filePath) {
  const buffer = fs.readFileSync(filePath);
  const exactBytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const bytes = new Uint8Array(exactBytes);

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
