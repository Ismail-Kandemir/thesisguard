const fs = require("fs");
const path = require("path");
require("../golden/experimentalGoldenRegression.cjs");

const { analyzeDocx } = require("../../src/features/analysis/analysisService.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  buildAnalysisDiagnostics,
} = require("../../src/features/analysis/diagnostics/academicObjectDiagnostics.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const {
  getDeclaredAcademicFigures,
} = require("../../src/features/analysis/rules/objectApplicability.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
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
const FIGURE_RULES = RULES.filter((rule) => FIGURE_RULE_IDS.includes(rule.id));

async function main() {
  const cases = {
    inlineDeclared: analyze(mainBoundary() + inlinePicture("center", 1) + caption("Şekil 1. Inline")),
    uncaptionedPicture: analyze(mainBoundary() + inlinePicture("center", 2)),
    uncaptionedChart: analyze(mainBoundary() + chartDrawing(3)),
    uncaptionedDiagram: analyze(mainBoundary() + diagramDrawing(4)),
    uncaptionedGroup: analyze(mainBoundary() + groupDrawing(5)),
    unknownDrawing: analyze(mainBoundary() + unknownDrawing(6)),
    captionedDiagram: analyze(mainBoundary() + diagramDrawing(7) + caption("Şekil 1. Diagram")),
    anchoredDeclaredCandidate: analyze(mainBoundary() + anchorPicture(8) + caption("Şekil 1. Anchor")),
    unresolvedAnchor: analyze(mainBoundary() + anchorPicture(9)),
    frontMatterPicture: analyze(inlinePicture("center", 10) + mainBoundary()),
    frontMatterChart: analyze(chartDrawing(11) + mainBoundary()),
    deletedDrawing: analyze(mainBoundary() + deletedInlineParagraph(12) + caption("Şekil 1. Deleted")),
    moveFromDrawing: analyze(mainBoundary() + moveFromInlineParagraph(13) + caption("Şekil 1. MoveFrom")),
    insertedDrawing: analyze(mainBoundary() + insertedInlineParagraph(14) + caption("Şekil 1. Inserted")),
    moveToDrawing: analyze(mainBoundary() + moveToInlineParagraph(15) + caption("Şekil 1. MoveTo")),
    alternateContent: analyze(mainBoundary() + alternateContent(inlinePicture("center", 16), chartDrawing(17)) + caption("Şekil 1. Alternate")),
    drawingTextbox: analyze(mainBoundary() + drawingTextbox(18) + caption("Şekil 1. Textbox")),
    vmlTextbox: analyze(mainBoundary() + vmlTextbox()),
    ole: analyze(mainBoundary() + oleObject()),
    equation: analyze(mainBoundary() + equationObject()),
  };

  assertAcademicFigureCount(cases.inlineDeclared, 1, "inline declared picture");
  assertAcademicFigureCount(cases.uncaptionedPicture, 0, "uncaptioned picture");
  assertAcademicFigureCount(cases.uncaptionedChart, 0, "uncaptioned chart");
  assertAcademicFigureCount(cases.uncaptionedDiagram, 0, "uncaptioned diagram");
  assertAcademicFigureCount(cases.uncaptionedGroup, 0, "uncaptioned group");
  assertAcademicFigureCount(cases.unknownDrawing, 0, "unknown drawing");
  assertAcademicFigureCount(cases.captionedDiagram, 1, "captioned diagram");
  assertAcademicFigureCount(cases.anchoredDeclaredCandidate, 0, "anchored ambiguous candidate");
  assertAcademicFigureCount(cases.unresolvedAnchor, 0, "unresolved anchor");
  assertAcademicFigureCount(cases.frontMatterPicture, 0, "front-matter generic picture");
  assertAcademicFigureCount(cases.frontMatterChart, 0, "front-matter generic chart");
  assertAcademicFigureCount(cases.deletedDrawing, 0, "deleted drawing");
  assertAcademicFigureCount(cases.moveFromDrawing, 0, "moveFrom drawing");
  assertAcademicFigureCount(cases.insertedDrawing, 1, "inserted declared drawing");
  assertAcademicFigureCount(cases.moveToDrawing, 1, "moveTo declared drawing");
  assertAcademicFigureCount(cases.alternateContent, 1, "AlternateContent active branch");
  assertAcademicFigureCount(cases.drawingTextbox, 0, "DrawingML textbox");
  assertAcademicFigureCount(cases.vmlTextbox, 0, "VML textbox");
  assertAcademicFigureCount(cases.ole, 0, "OLE");
  assertAcademicFigureCount(cases.equation, 0, "equation");

  assertStatus(cases.uncaptionedChart, "list-of-figures", "NOT_APPLICABLE", "uncaptioned chart list");
  assertStatus(cases.uncaptionedDiagram, "list-of-figures", "NOT_APPLICABLE", "uncaptioned diagram list");
  assertStatus(cases.uncaptionedGroup, "list-of-figures", "NOT_APPLICABLE", "uncaptioned group list");
  assertStatus(cases.unknownDrawing, "list-of-figures", "NOT_APPLICABLE", "unknown drawing list");
  assertStatus(cases.inlineDeclared, "list-of-figures", "FAILED", "declared figure list");
  assertStatus(cases.captionedDiagram, "list-of-figures", "FAILED", "captioned diagram list");
  assertStatus(cases.uncaptionedPicture, "figure-in-text-reference", "NOT_APPLICABLE", "uncaptioned picture reference");
  assertStatus(cases.inlineDeclared, "figure-in-text-reference", "FAILED", "declared figure reference");
  assertStatus(cases.anchoredDeclaredCandidate, "figure-object-alignment", "NOT_APPLICABLE", "anchor alignment guard");
  assertCoverage(cases.anchoredDeclaredCandidate, "none", 1, 0, 1, "anchor coverage");
  assertCoverage(cases.inlineDeclared, "complete", 1, 1, 0, "inline coverage");

  assertDiagnostic(cases.uncaptionedChart, "UNRESOLVED_ACADEMIC_OBJECT", "chart diagnostic");
  assertDiagnostic(cases.uncaptionedDiagram, "UNRESOLVED_ACADEMIC_OBJECT", "diagram diagnostic");
  assertDiagnostic(cases.unknownDrawing, "UNSUPPORTED_OBJECT_REPRESENTATION", "unknown drawing diagnostic");
  assertDiagnostic(cases.anchoredDeclaredCandidate, "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION", "anchor diagnostic");
  assertNoDiagnostic(cases.deletedDrawing, "deleted invisible diagnostic");
  assertNoDiagnostic(cases.moveFromDrawing, "moveFrom invisible diagnostic");
  assertEqual(
    cases.alternateContent.document.objectSemantics.representations.length,
    1,
    "AlternateContent remains single branch",
  );
  assertEqual(
    cases.drawingTextbox.document.objectSemantics.resolutions[0]?.status,
    "excluded",
    "DrawingML textbox remains excluded",
  );

  const golden = await analyzeDocx(
    createNodeDocxReaderInput(path.join(FIXTURE_DIR, "full-correct.docx")),
    SELECTION,
  );
  assertEqual(golden.passedRules, 46, "golden remains 46/46");
  assertEqual(golden.failedRules, 0, "golden has no failures");
  assertEqual(golden.score, 100, "golden remains 100%");
  assertEqual(golden.diagnostics.length, 0, "golden remains diagnostic-free");

  console.log(JSON.stringify({
    phase: "4E-18L",
    result: "PASS",
    retirementLevel: "LEVEL 2",
    matrix: Object.fromEntries(
      Object.entries(cases).map(([name, item]) => [name, summarize(item)]),
    ),
    golden: {
      passedRules: golden.passedRules,
      failedRules: golden.failedRules,
      notApplicableRules: golden.notApplicableRules,
      score: golden.score,
      diagnosticCount: golden.diagnostics.length,
    },
  }, null, 2));
}

function analyze(content) {
  const document = scopedDocument(content);
  const results = new RuleEngine().run(document, FIGURE_RULES);
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);

  return { document, results, diagnostics };
}

function scopedDocument(content) {
  const parsed = parseDocumentXml(documentXml(content));
  const marked = markRequiredSectionHeadings(parsed, RULES);
  const headed = normalizeDocumentHeadings(marked, RULES);
  return normalizeAcademicDocumentScopes(headed, RULES);
}

function summarize(item) {
  return {
    representations: item.document.objectSemantics.representations.map((representation) => ({
      kind: representation.kind,
      drawingType: representation.drawingType,
      academicScope: representation.academicScope.scope,
    })),
    resolutions: item.document.objectSemantics.resolutions.map((resolution) => ({
      status: resolution.status,
      academicType: resolution.academicType,
    })),
    legacyFigureCount: item.document.figures.items.length,
    semanticAcademicFigureCount: getDeclaredAcademicFigures(item.document).length,
    diagnostics: item.diagnostics.map((diagnostic) => diagnostic.code),
    rules: Object.fromEntries(item.results.map((result) => [result.ruleId.split(".").at(-1), {
      status: result.status,
      coverage: result.coverage ?? null,
    }])),
  };
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

function assertNoDiagnostic(item, label) {
  assertEqual(item.diagnostics.length, 0, `${label}: diagnostic count`);
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
    ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
    ' xmlns:v="urn:schemas-microsoft-com:vml"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
    ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">',
    '<w:body>',
    content,
    '</w:body>',
    '</w:document>',
  ].join("");
}

function mainBoundary() {
  return paragraph("Giriş");
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function caption(text) {
  return '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr>' +
    `<w:r><w:t>${text}</w:t></w:r></w:p>`;
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

function unknownDrawing(id) {
  return `<w:p>${inlineRun('<a:graphic><a:graphicData uri="urn:thesisguard:unknown"><tg:payload xmlns:tg="urn:thesisguard:unknown"/></a:graphicData></a:graphic>', id)}</w:p>`;
}

function drawingTextbox(id) {
  return `<w:p>${inlineRun('<a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>Textbox</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic>', id)}</w:p>`;
}

function vmlTextbox() {
  return '<w:p><w:r><w:pict><v:shape><v:textbox><w:txbxContent><w:p><w:r><w:t>VML Textbox</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>';
}

function oleObject() {
  return '<w:p><w:r><w:object><o:OLEObject/></w:object></w:r></w:p>';
}

function equationObject() {
  return '<w:p><w:r><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></w:r></w:p>';
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

function alternateContent(choice, fallback) {
  return [
    '<mc:AlternateContent>',
    `<mc:Choice Requires="wp">${choice}</mc:Choice>`,
    `<mc:Fallback>${fallback}</mc:Fallback>`,
    '</mc:AlternateContent>',
  ].join("");
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
