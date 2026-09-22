const path = require("path");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const {
  buildAnalysisDiagnostics,
} = require("../../src/features/analysis/diagnostics/academicObjectDiagnostics.ts");
const {
  hasReviewRequiredDiagnostics,
  formatReviewRequiredCount,
} = require("../../src/features/analysis/report/diagnosticPresentation.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};
const RULES = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));

async function main() {
  assertPlainBoundary();
  assertManualBoundary();
  assertWordNumberedBoundary();
  assertMissingBoundary();
  assertTocCollision();
  assertRevisionVisibility();
  await assertFixtureParity();

  console.log(JSON.stringify({
    phase: "4E-18F",
    result: "PASS",
    frontMatterChart: summarize(scopedDocument(chart() + heading("Giriş") + paragraph("Metin"))),
    mainContentChart: summarize(scopedDocument(heading("Giriş") + chart())),
    mixed: summarize(scopedDocument(chart() + heading("Giriş") + chart())),
    missingBoundary: summarize(scopedDocument(chart())),
    multipleDiagnosticsUx: formatReviewRequiredCount(2),
  }, null, 2));
}

function assertPlainBoundary() {
  const document = scopedDocument(chart() + heading("Giriş") + chart());
  const representations = document.objectSemantics.representations;
  assertEqual(representations[0].academicScope.scope, "front-matter", "plain boundary front object scope");
  assertEqual(representations[1].academicScope.scope, "main-content", "plain boundary main object scope");
  assertEqual(buildAnalysisDiagnostics(document.objectSemantics).length, 1, "front chart suppressed, main chart diagnosed");
}

function assertManualBoundary() {
  const document = scopedDocument(chart() + heading("1. Giriş") + chart());
  const representations = document.objectSemantics.representations;
  assertEqual(representations[0].academicScope.scope, "front-matter", "manual boundary front object scope");
  assertEqual(representations[1].academicScope.scope, "main-content", "manual boundary main object scope");
}

function assertWordNumberedBoundary() {
  const document = scopedDocument(chart() + wordNumberedHeading("Giriş") + chart());
  const representations = document.objectSemantics.representations;
  assertEqual(representations[0].academicScope.scope, "front-matter", "word-numbered boundary front object scope");
  assertEqual(representations[1].academicScope.scope, "main-content", "word-numbered boundary main object scope");
}

function assertMissingBoundary() {
  const document = scopedDocument(chart());
  const representation = document.objectSemantics.representations[0];
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
  assertEqual(representation.academicScope.scope, "unknown", "missing boundary remains unknown");
  assertEqual(representation.academicScope.reason, "missing-main-boundary", "missing boundary reason");
  assertEqual(diagnostics.length, 1, "missing boundary chart remains diagnostic");
}

function assertTocCollision() {
  const document = scopedDocument(tocHeading("Giriş") + chart());
  const representation = document.objectSemantics.representations[0];
  assertEqual(representation.academicScope.scope, "unknown", "TOC heading does not establish boundary");
  assertEqual(representation.academicScope.reason, "missing-main-boundary", "TOC collision reason");
}

function assertRevisionVisibility() {
  const deleted = scopedDocument(deletedHeading("Giriş") + chart());
  assertEqual(
    deleted.objectSemantics.representations[0].academicScope.scope,
    "unknown",
    "deleted heading does not establish boundary",
  );

  const movedVisible = scopedDocument(chart() + movedVisibleHeading("Giriş") + chart());
  assertEqual(
    movedVisible.objectSemantics.representations[0].academicScope.scope,
    "front-matter",
    "visible moveTo heading establishes boundary for prior object",
  );
  assertEqual(
    movedVisible.objectSemantics.representations[1].academicScope.scope,
    "main-content",
    "visible moveTo heading establishes boundary for following object",
  );
}

async function assertFixtureParity() {
  const golden = await runAnalysisFixture(path.join(FIXTURE_DIR, "full-correct.docx"));
  assertEqual(golden.report.passedRules, 46, "golden remains 46/46");
  assertEqual(golden.report.failedRules, 0, "golden failed count");
  assertEqual(buildAnalysisDiagnostics(golden.document.objectSemantics).length, 0, "golden diagnostics remain zero");

  const chartFixture = await runAnalysisFixture(path.join(FIXTURE_DIR, "chart-object-synthetic.docx"));
  assertEqual(chartFixture.report.score, 100, "chart score follows semantic figure retirement");
  assertEqual(chartFixture.report.failedRules, 0, "chart no longer fails figure rules by legacy presence");
  assertEqual(buildAnalysisDiagnostics(chartFixture.document.objectSemantics).length, 1, "chart diagnostic remains");

  const diagnostics = buildAnalysisDiagnostics(chartFixture.document.objectSemantics);
  assertEqual(hasReviewRequiredDiagnostics(diagnostics), true, "4E-18E review state remains");
  assertEqual(formatReviewRequiredCount(diagnostics.length), "1 unsur", "4E-18E count remains");
}

function scopedDocument(content) {
  const parsed = parseDocumentXml(documentXml(content));
  const marked = markRequiredSectionHeadings(parsed, RULES);
  const headed = normalizeDocumentHeadings(marked, RULES);
  return normalizeAcademicDocumentScopes(headed, RULES);
}

function summarize(document) {
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
  return {
    scopes: document.objectSemantics.representations.map((item) => item.academicScope.scope),
    diagnosticCount: diagnostics.length,
    diagnosticCodes: diagnostics.map((item) => item.code),
  };
}

function documentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>' + content + '</w:body></w:document>';
}

function chart() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function heading(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function wordNumberedHeading(text) {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocHeading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function deletedHeading(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function movedVisibleHeading(text) {
  return `<w:p><w:moveTo w:id="2"><w:r><w:t>${text}</w:t></w:r></w:moveTo></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
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
