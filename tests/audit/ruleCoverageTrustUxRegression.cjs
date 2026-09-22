const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");

const { analyzeDocx } = require("../../src/features/analysis/analysisService.ts");
const {
  formatReviewRequiredCount,
} = require("../../src/features/analysis/report/diagnosticPresentation.ts");
const {
  formatCoverageEvaluationCount,
  getCoverageTrustMessage,
  toRuleCoveragePresentation,
} = require("../../src/features/analysis/report/ruleCoveragePresentation.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

async function main() {
  const production = {
    inlinePass: await analyzeSyntheticDocx(mainBoundary() + inlinePicture("center") + caption("Şekil 1. Inline")),
    inlineFail: await analyzeSyntheticDocx(mainBoundary() + inlinePicture("left") + caption("Şekil 1. Inline")),
    anchorOnly: await analyzeSyntheticDocx(mainBoundary() + anchorPicture() + caption("Şekil 1. Anchor")),
    mixedPassAnchor: await analyzeSyntheticDocx(
      mainBoundary() +
        inlinePicture("center") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 2. Anchor"),
    ),
    mixedFailAnchor: await analyzeSyntheticDocx(
      mainBoundary() +
        inlinePicture("left") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 2. Anchor"),
    ),
  };
  const golden = await analyzeFixture("full-correct.docx");
  const diagnosticOnly = await analyzeFixture("chart-object-synthetic.docx");

  const inlinePass = pickFigureAlignment(production.inlinePass);
  const inlineFail = pickFigureAlignment(production.inlineFail);
  const anchorOnly = pickFigureAlignment(production.anchorOnly);
  const mixedPassAnchor = pickFigureAlignment(production.mixedPassAnchor);
  const mixedFailAnchor = pickFigureAlignment(production.mixedFailAnchor);

  assertEqual(inlinePass.status, "PASSED", "inline pass status");
  assertEqual(inlinePass.coverage?.status, "complete", "inline pass complete coverage");
  assertEqual(toRuleCoveragePresentation(inlinePass), null, "PASSED + complete retains normal presentation");

  assertEqual(inlineFail.status, "FAILED", "inline fail status");
  assertEqual(inlineFail.coverage?.status, "complete", "inline fail complete coverage");
  assertEqual(toRuleCoveragePresentation(inlineFail), null, "FAILED + complete retains normal presentation");

  const passPartial = toRuleCoveragePresentation(mixedPassAnchor);
  assertEqual(mixedPassAnchor.status, "PASSED", "mixed pass status remains PASSED");
  assertEqual(mixedPassAnchor.coverage?.status, "partial", "mixed pass partial coverage");
  assert(passPartial, "PASSED + partial has presentation");
  assertEqual(passPartial.label, "Kısmi değerlendirme", "PASSED + partial label");
  assert(passPartial.summary.includes("Değerlendirilebilen nesnelerde ihlal bulunmadı"), "PASSED + partial avoids full verification claim");
  assert(!passPartial.summary.includes("tamamen"), "PASSED + partial does not claim complete verification");

  const failPartial = toRuleCoveragePresentation(mixedFailAnchor);
  assertEqual(mixedFailAnchor.status, "FAILED", "mixed fail status remains FAILED");
  assertEqual(mixedFailAnchor.coverage?.status, "partial", "mixed fail partial coverage");
  assert(failPartial, "FAILED + partial has presentation");
  assert(failPartial.summary.includes("Kural başarısız"), "FAILED + partial keeps failure primary");
  assert(!failPartial.summary.includes("doğrulanamayan nesneler başarısız"), "FAILED + partial does not fail unevaluated objects");

  const ordinaryNa = mockResult("NOT_APPLICABLE", {
    status: "none",
    relevantCount: 0,
    evaluatedCount: 0,
    unevaluatedCount: 0,
    reasons: ["no-relevant-object"],
  });
  assertEqual(toRuleCoveragePresentation(ordinaryNa), null, "ordinary N/A remains ordinary");

  const anchorOnlyPresentation = toRuleCoveragePresentation(anchorOnly);
  assertEqual(anchorOnly.status, "NOT_APPLICABLE", "anchor-only status");
  assertEqual(anchorOnly.coverage?.status, "none", "anchor-only none coverage");
  assert(anchorOnlyPresentation, "relevant-but-unevaluable N/A has presentation");
  assertEqual(anchorOnlyPresentation.label, "Otomatik doğrulanamadı", "relevant-but-unevaluable label");
  assert(anchorOnlyPresentation.summary.includes("otomatik olarak doğrulanamadı"), "relevant-but-unevaluable explains limitation");

  assertEqual(formatCoverageEvaluationCount(coverage(1, 1, 0, "complete")), "1 ilgili nesneden 1'i otomatik olarak değerlendirildi.", "1/1 wording");
  assertEqual(formatCoverageEvaluationCount(coverage(2, 1, 1, "partial")), "2 ilgili nesneden 1'i otomatik olarak değerlendirildi.", "1/2 wording");
  assertEqual(formatCoverageEvaluationCount(coverage(1, 0, 1, "none")), "1 ilgili nesneden hiçbiri otomatik olarak değerlendirilemedi.", "0/1 wording");
  assertEqual(formatCoverageEvaluationCount(coverage(2, 0, 2, "none")), "2 ilgili nesneden hiçbiri otomatik olarak değerlendirilemedi.", "0/2 wording");
  assertEqual(formatCoverageEvaluationCount(coverage(3, 2, 1, "partial")), "3 ilgili nesneden 2'si otomatik olarak değerlendirildi.", "2/3 wording");

  assertScoreAndCountsStable(production.mixedPassAnchor, "partial pass production");
  assertScoreAndCountsStable(production.mixedFailAnchor, "partial fail production");
  assertEqual(mixedPassAnchor.status, "PASSED", "partial coverage does not create failed RuleResult");
  assertEqual(production.mixedPassAnchor.failedRules, production.mixedPassAnchor.results.filter((item) => item.status === "FAILED").length, "failed count remains status-based");
  assertEqual(production.mixedPassAnchor.notApplicableRules, production.mixedPassAnchor.results.filter((item) => item.status === "NOT_APPLICABLE").length, "N/A count remains status-based");

  assertEqual(production.mixedPassAnchor.diagnostics.length, 1, "diagnostics remain separate for partial pass");
  assertEqual(formatReviewRequiredCount(production.mixedPassAnchor.diagnostics.length), "1 unsur", "manual review count uses diagnostics only");
  assert(getCoverageTrustMessage(production.mixedPassAnchor.results), "coverage trust message appears for partial coverage");
  assert(!getCoverageTrustMessage(production.mixedPassAnchor.results).includes("unsur"), "coverage trust message does not double-count review items");
  assert(!getCoverageTrustMessage(production.mixedPassAnchor.results).includes("wp:anchor"), "raw anchor term avoided in trust copy");
  assert(!passPartial.summary.includes("wp:anchor"), "raw anchor term avoided in rule copy");

  const noCoverageRule = production.mixedPassAnchor.results.find((item) => !item.coverage);
  assert(noCoverageRule, "ordinary rule without coverage exists");
  assertEqual(toRuleCoveragePresentation(noCoverageRule), null, "ordinary rule without coverage remains unchanged");

  assertEqual(getCoverageTrustMessage(golden.results), null, "golden UX has no exceptional coverage trust message");
  assertEqual(golden.passedRules, 46, "golden remains 46/46");
  assertEqual(golden.score, 100, "golden remains 100%");
  assertEqual(golden.diagnostics.length, 0, "golden remains diagnostic-free");

  assertEqual(diagnosticOnly.diagnostics.length, 1, "diagnostic-only fixture keeps diagnostics");
  assertEqual(getCoverageTrustMessage(diagnosticOnly.results), null, "diagnostic-only fixture has no partial coverage trust copy");

  console.log(JSON.stringify({
    phase: "4E-18J",
    result: "PASS",
    presentation: {
      inlinePass: summarizePresentation(inlinePass),
      inlineFail: summarizePresentation(inlineFail),
      anchorOnly: summarizePresentation(anchorOnly),
      mixedPassAnchor: summarizePresentation(mixedPassAnchor),
      mixedFailAnchor: summarizePresentation(mixedFailAnchor),
      ordinaryNa: summarizePresentation(ordinaryNa),
    },
    production: {
      inlinePass: summarizeReport(production.inlinePass),
      inlineFail: summarizeReport(production.inlineFail),
      anchorOnly: summarizeReport(production.anchorOnly),
      mixedPassAnchor: summarizeReport(production.mixedPassAnchor),
      mixedFailAnchor: summarizeReport(production.mixedFailAnchor),
      golden: summarizeReport(golden),
      diagnosticOnly: summarizeReport(diagnosticOnly),
    },
  }, null, 2));
}

async function analyzeFixture(fileName) {
  return analyzeDocx(createNodeDocxReaderInput(path.join(FIXTURE_DIR, fileName)), SELECTION);
}

async function analyzeSyntheticDocx(content) {
  return analyzeDocx(await createSyntheticDocxInput(content), SELECTION);
}

async function createSyntheticDocxInput(content) {
  const zip = new JSZip();
  zip.file("word/document.xml", documentXml(content));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return createFileLikeBytes(buffer, "coverage-trust-synthetic.docx");
}

function createNodeDocxReaderInput(filePath) {
  return createFileLikeBytes(fs.readFileSync(filePath), path.basename(filePath));
}

function createFileLikeBytes(buffer, name) {
  const exactBytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const bytes = new Uint8Array(exactBytes);

  Object.defineProperties(bytes, {
    name: { value: name, enumerable: true },
    size: { value: bytes.byteLength, enumerable: true },
    type: {
      value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      enumerable: true,
    },
  });

  return bytes;
}

function pickFigureAlignment(report) {
  const result = report.results.find((item) => item.ruleId.endsWith("figure-object-alignment"));
  if (!result) throw new Error("Missing figure-object-alignment result");
  return result;
}

function mockResult(status, resultCoverage) {
  return {
    ruleId: "mock-rule",
    ruleName: "Mock rule",
    status,
    passed: status === "PASSED",
    severity: "warning",
    expected: null,
    actual: null,
    message: "",
    coverage: resultCoverage,
  };
}

function coverage(relevantCount, evaluatedCount, unevaluatedCount, status) {
  return {
    status,
    relevantCount,
    evaluatedCount,
    unevaluatedCount,
    reasons: status === "complete"
      ? ["all-relevant-objects-evaluable"]
      : ["unsupported-anchored-placement"],
  };
}

function assertScoreAndCountsStable(report, label) {
  const passed = report.results.filter((item) => item.status === "PASSED").length;
  const failed = report.results.filter((item) => item.status === "FAILED").length;
  const notApplicable = report.results.filter((item) => item.status === "NOT_APPLICABLE").length;
  const evaluated = passed + failed;
  const expectedScore = evaluated === 0 ? 0 : Math.round((passed / evaluated) * 100);

  assertEqual(report.passedRules, passed, `${label}: passed count status-based`);
  assertEqual(report.failedRules, failed, `${label}: failed count status-based`);
  assertEqual(report.notApplicableRules, notApplicable, `${label}: N/A count status-based`);
  assertEqual(report.score, expectedScore, `${label}: score status-based`);
}

function summarizePresentation(result) {
  const presentation = toRuleCoveragePresentation(result);
  return {
    status: result.status,
    coverage: result.coverage ?? null,
    presentation,
  };
}

function summarizeReport(report) {
  const figureAlignment = pickFigureAlignment(report);
  return {
    score: report.score,
    passedRules: report.passedRules,
    failedRules: report.failedRules,
    notApplicableRules: report.notApplicableRules,
    diagnosticCount: report.diagnostics.length,
    figureAlignmentStatus: figureAlignment.status,
    figureAlignmentCoverage: figureAlignment.coverage ?? null,
    coverageTrustMessage: getCoverageTrustMessage(report.results),
  };
}

function documentXml(content) {
  return [
    '<w:document',
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
    '>',
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
  return [
    '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr>',
    `<w:r><w:t>${text}</w:t></w:r></w:p>`,
  ].join("");
}

function inlinePicture(alignment) {
  return [
    `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:r><w:drawing><wp:inline>`,
    '<wp:docPr id="1" name="Inline Picture"/>',
    pictureGraphic(),
    '</wp:inline></w:drawing></w:r></w:p>',
  ].join("");
}

function anchorPicture() {
  return `<w:p>${anchorRun()}</w:p>`;
}

function anchorRun() {
  return [
    '<w:r><w:drawing><wp:anchor simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">',
    '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>',
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
    '<wp:extent cx="1828800" cy="914400"/>',
    '<wp:wrapSquare wrapText="bothSides"/>',
    '<wp:docPr id="2" name="Anchor Object"/>',
    pictureGraphic(),
    '</wp:anchor></w:drawing></w:r>',
  ].join("");
}

function pictureGraphic() {
  return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>';
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
