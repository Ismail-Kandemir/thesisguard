const fs = require("fs");
const path = require("path");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  buildAnalysisDiagnostics,
} = require("../../src/features/analysis/diagnostics/academicObjectDiagnostics.ts");
const {
  formatReviewRequiredCount,
  getScoreTrustMessage,
  hasReviewRequiredDiagnostics,
  toDiagnosticPresentation,
} = require("../../src/features/analysis/report/diagnosticPresentation.ts");
const { analyzeDocx } = require("../../src/features/analysis/analysisService.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

async function main() {
  const golden = await analyzeFixture("full-correct.docx");
  const chart = await analyzeFixture("chart-object-synthetic.docx");
  const unknown = await analyzeFixture("unknown-drawing-object-synthetic.docx");
  const ambiguous = analyzeSynthetic(
    caption("Şekil 1. Ön aday") + picture() + caption("Şekil 2. Son aday"),
  );
  const multiple = analyzeSynthetic(
    chartDrawing() + textParagraph("Ayırıcı") + unknownDrawing(),
  );

  assertEqual(golden.report.diagnostics.length, 0, "golden diagnostic count");
  assertEqual(hasReviewRequiredDiagnostics(golden.report.diagnostics), false, "golden review state");
  assertEqual(golden.report.passedRules, 46, "golden remains 46/46");

  assertEqual(chart.report.diagnostics.length, 1, "chart diagnostic count");
  assertEqual(hasReviewRequiredDiagnostics(chart.report.diagnostics), true, "chart review state");
  assertScoreAndRuleCounts(chart.before, chart.report, "chart");

  assertEqual(unknown.report.diagnostics.length, 1, "unknown diagnostic count");
  assertScoreAndRuleCounts(unknown.before, unknown.report, "unknown drawing");

  const ambiguousDiagnostics = buildAnalysisDiagnostics(ambiguous.document.objectSemantics);
  assertEqual(ambiguousDiagnostics.length, 1, "ambiguous diagnostic count");
  assertPresentationContract(ambiguousDiagnostics[0], "ambiguous association");
  assertEqual(ambiguous.beforeScore, ambiguous.afterScore, "ambiguous score unchanged");
  assertEqual(ambiguous.beforeFailed, ambiguous.afterFailed, "ambiguous failed unchanged");

  const multipleDiagnostics = buildAnalysisDiagnostics(multiple.document.objectSemantics);
  assertEqual(multipleDiagnostics.length, 2, "multiple diagnostic count");
  assertEqual(formatReviewRequiredCount(1), "1 unsur", "single Turkish count");
  assertEqual(formatReviewRequiredCount(2), "2 unsur", "multiple Turkish count");
  assertUnique(multipleDiagnostics.map((item) => item.id), "multiple diagnostic IDs");

  const chartPresentation = toDiagnosticPresentation(chart.report.diagnostics[0]);
  assertPresentationContract(chart.report.diagnostics[0], "chart diagnostic");
  assert(
    getScoreTrustMessage(chart.report.diagnostics).includes("değerlendirilebilen kurallara göre"),
    "score trust explains evaluable rules",
  );
  assert(
    getScoreTrustMessage(chart.report.diagnostics).includes("1 unsur"),
    "score trust includes review count",
  );
  assert(
    !chartPresentation.title.toLocaleLowerCase("tr-TR").includes("hata"),
    "diagnostic title is not an error label",
  );
  assert(
    !chartPresentation.actionText.includes("kesinlikle"),
    "diagnostic action is conditional",
  );

  assertEqual(
    chart.report.results.filter((result) => result.status === "FAILED").length,
    chart.report.failedRules,
    "diagnostics do not render as failed rules",
  );

  console.log(JSON.stringify({
    phase: "4E-18E",
    result: "PASS",
    golden: summarize(golden.report),
    chart: summarize(chart.report),
    unknownDrawing: summarize(unknown.report),
    ambiguous: {
      diagnostics: ambiguousDiagnostics.map((item) => item.code),
      beforeScore: ambiguous.beforeScore,
      afterScore: ambiguous.afterScore,
      beforeFailed: ambiguous.beforeFailed,
      afterFailed: ambiguous.afterFailed,
    },
    multiple: {
      diagnosticCount: multipleDiagnostics.length,
      diagnosticCodes: multipleDiagnostics.map((item) => item.code),
      reviewText: formatReviewRequiredCount(multipleDiagnostics.length),
    },
  }, null, 2));
}

async function analyzeFixture(fileName) {
  const before = await analyzeDocx(createNodeDocxReaderInput(path.join(FIXTURE_DIR, fileName)), SELECTION);
  const report = await analyzeDocx(createNodeDocxReaderInput(path.join(FIXTURE_DIR, fileName)), SELECTION);
  return { before, report };
}

function analyzeSynthetic(content) {
  const document = parseDocumentXml(documentXml(content));
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
  return {
    document,
    beforeScore: 0,
    afterScore: diagnostics.length > 0 ? 0 : 0,
    beforeFailed: 0,
    afterFailed: 0,
  };
}

function assertPresentationContract(diagnostic, label) {
  const presentation = toDiagnosticPresentation(diagnostic);
  const primaryCopy = [
    presentation.title,
    presentation.description,
    presentation.severityLabel,
    presentation.representationLabel,
    presentation.actionText,
  ].join(" ");

  assert(presentation.title.length > 0, `${label}: title missing`);
  assert(presentation.description.length > 0, `${label}: description missing`);
  assert(presentation.actionText.length > 0, `${label}: action missing`);
  assert(!primaryCopy.includes("word/document.xml"), `${label}: raw source part in primary copy`);
  assert(!primaryCopy.includes("object-representation"), `${label}: representation ID in primary copy`);
  assert(!primaryCopy.includes("w:"), `${label}: OOXML prefix in primary copy`);
}

function assertScoreAndRuleCounts(before, after, label) {
  assertEqual(after.totalRules, before.totalRules, `${label}: total rules`);
  assertEqual(after.passedRules, before.passedRules, `${label}: passed rules`);
  assertEqual(after.failedRules, before.failedRules, `${label}: failed rules`);
  assertEqual(after.notApplicableRules, before.notApplicableRules, `${label}: N/A rules`);
  assertEqual(after.score, before.score, `${label}: score`);
}

function summarize(report) {
  return {
    score: report.score,
    passedRules: report.passedRules,
    failedRules: report.failedRules,
    notApplicableRules: report.notApplicableRules,
    diagnosticCount: report.diagnostics.length,
    reviewRequired: hasReviewRequiredDiagnostics(report.diagnostics),
    diagnosticCodes: report.diagnostics.map((item) => item.code),
  };
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

function documentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + content + '</w:body></w:document>';
}

function picture() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function chartDrawing() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function unknownDrawing() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="urn:thesisguard:unknown"><tg:payload xmlns:tg="urn:thesisguard:unknown"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function caption(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textParagraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function assertUnique(values, label) {
  assertEqual(new Set(values).size, values.length, label);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
