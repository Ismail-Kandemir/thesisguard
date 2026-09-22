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
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

const RULES = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));
const FIGURE_ALIGNMENT_RULE = RULES.find((rule) => rule.id.endsWith("figure-object-alignment"));

if (!FIGURE_ALIGNMENT_RULE) {
  throw new Error("figure-object-alignment rule is missing");
}

async function main() {
  const cases = {
    inlinePass: analyze(mainBoundary() + inlinePicture("center") + caption("Şekil 1. Inline")),
    inlineFail: analyze(mainBoundary() + inlinePicture("left") + caption("Şekil 1. Inline")),
    anchorOnly: analyze(mainBoundary() + anchorPicture() + caption("Şekil 1. Anchor")),
    mixedPassAnchor: analyze(
      mainBoundary() +
        inlinePicture("center") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 2. Anchor"),
    ),
    mixedFailAnchor: analyze(
      mainBoundary() +
        inlinePicture("left") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 2. Anchor"),
    ),
    twoInlinePassAnchor: analyze(
      mainBoundary() +
        inlinePicture("center") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        inlinePicture("center") +
        caption("Şekil 2. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 3. Anchor"),
    ),
    inlinePassInlineFailAnchor: analyze(
      mainBoundary() +
        inlinePicture("center") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        inlinePicture("left") +
        caption("Şekil 2. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 3. Anchor"),
    ),
    twoAnchors: analyze(
      mainBoundary() +
        anchorPicture() +
        caption("Şekil 1. Anchor") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 2. Anchor"),
    ),
    frontMatterAnchor: analyze(anchorPicture() + caption("Şekil 1. Front") + mainBoundary()),
    deletedAnchor: analyze(mainBoundary() + deletedAnchorParagraph() + caption("Şekil 1. Deleted")),
    moveFromAnchor: analyze(mainBoundary() + moveFromAnchorParagraph() + caption("Şekil 1. MoveFrom")),
    moveToAnchor: analyze(mainBoundary() + moveToAnchorParagraph() + caption("Şekil 1. MoveTo")),
    unresolvedGenericAnchor: analyze(mainBoundary() + anchorPicture()),
  };

  assertRule(cases.inlinePass, "PASSED", "complete", 1, 1, 0, "one inline PASS");
  assertRule(cases.inlineFail, "FAILED", "complete", 1, 1, 0, "one inline FAIL");
  assertRule(cases.anchorOnly, "NOT_APPLICABLE", "none", 1, 0, 1, "one anchor only");
  assertRule(cases.mixedPassAnchor, "PASSED", "partial", 2, 1, 1, "inline PASS + anchor");
  assertRule(cases.mixedFailAnchor, "FAILED", "partial", 2, 1, 1, "inline FAIL + anchor");
  assertRule(cases.twoInlinePassAnchor, "PASSED", "partial", 3, 2, 1, "two inline PASS + anchor");
  assertRule(cases.inlinePassInlineFailAnchor, "FAILED", "partial", 3, 2, 1, "inline PASS + inline FAIL + anchor");
  assertRule(cases.twoAnchors, "NOT_APPLICABLE", "none", 2, 0, 2, "two anchors only");
  assertRule(cases.frontMatterAnchor, "NOT_APPLICABLE", "none", 0, 0, 0, "front-matter anchor");
  assertRule(cases.deletedAnchor, "NOT_APPLICABLE", "none", 0, 0, 0, "deleted anchor");
  assertRule(cases.moveFromAnchor, "NOT_APPLICABLE", "none", 0, 0, 0, "moveFrom anchor");
  assertRule(cases.moveToAnchor, "NOT_APPLICABLE", "none", 1, 0, 1, "visible moveTo anchor");
  assertRule(cases.unresolvedGenericAnchor, "NOT_APPLICABLE", "none", 0, 0, 0, "unresolved generic anchor");

  assert(
    cases.anchorOnly.result.message.includes("otomatik doğrulama yapılamadı"),
    "anchor-only N/A explains automatic validation limitation",
  );
  assert(
    cases.mixedPassAnchor.result.message.includes("Değerlendirilebilen"),
    "PASSED + partial avoids all-objects wording",
  );
  assertEqual(cases.mixedPassAnchor.diagnostics.length, 1, "partial coverage does not duplicate diagnostics");
  assertEqual(cases.mixedPassAnchor.diagnostics[0].code, "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION", "existing anchor diagnostic remains separate");

  const beforeScore = summarizeScore(cases.mixedPassAnchor.results);
  const afterScore = new ReportBuilder().build(cases.mixedPassAnchor.results);
  assertEqual(afterScore.score, beforeScore.score, "score arithmetic unchanged by coverage");
  assertEqual(afterScore.passedRules, beforeScore.passed, "passed count unchanged by coverage");
  assertEqual(afterScore.failedRules, beforeScore.failed, "failed count unchanged by coverage");
  assertEqual(afterScore.notApplicableRules, beforeScore.notApplicable, "N/A count unchanged by coverage");

  const firstDeterministicRun = summarizeCases({
    inlinePass: cases.inlinePass,
    anchorOnly: cases.anchorOnly,
    mixedPassAnchor: cases.mixedPassAnchor,
  });
  const secondDeterministicRun = summarizeCases({
    inlinePass: analyze(mainBoundary() + inlinePicture("center") + caption("Şekil 1. Inline")),
    anchorOnly: analyze(mainBoundary() + anchorPicture() + caption("Şekil 1. Anchor")),
    mixedPassAnchor: analyze(
      mainBoundary() +
        inlinePicture("center") +
        caption("Şekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture() +
        caption("Şekil 2. Anchor"),
    ),
  });
  assertEqual(
    JSON.stringify(firstDeterministicRun),
    JSON.stringify(secondDeterministicRun),
    "coverage output is deterministic for repeated cases",
  );

  const golden = await analyzeDocx(
    createNodeDocxReaderInput(path.join(FIXTURE_DIR, "full-correct.docx")),
    SELECTION,
  );
  const goldenAlignment = pick(golden.results);
  assertEqual(golden.passedRules, 46, "golden remains 46/46");
  assertEqual(golden.score, 100, "golden remains 100%");
  assertEqual(golden.diagnostics.length, 0, "golden remains diagnostic-free");
  assertEqual(goldenAlignment.coverage?.status, "complete", "production analyzeDocx exposes complete coverage");

  console.log(JSON.stringify({
    phase: "4E-18I",
    result: "PASS",
    synthetic: summarizeCases(cases),
    productionGolden: {
      status: goldenAlignment.status,
      coverage: goldenAlignment.coverage,
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
  const results = new RuleEngine().run(document, [FIGURE_ALIGNMENT_RULE]);
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);

  return {
    document,
    result: pick(results),
    results,
    diagnostics,
  };
}

function scopedDocument(content) {
  const parsed = parseDocumentXml(documentXml(content));
  const marked = markRequiredSectionHeadings(parsed, RULES);
  const headed = normalizeDocumentHeadings(marked, RULES);
  return normalizeAcademicDocumentScopes(headed, RULES);
}

function assertRule(item, expectedStatus, expectedCoverage, relevant, evaluated, unevaluated, label) {
  assertEqual(item.result.status, expectedStatus, `${label}: status`);
  assertEqual(item.result.coverage?.status, expectedCoverage, `${label}: coverage status`);
  assertEqual(item.result.coverage?.relevantCount, relevant, `${label}: relevant count`);
  assertEqual(item.result.coverage?.evaluatedCount, evaluated, `${label}: evaluated count`);
  assertEqual(item.result.coverage?.unevaluatedCount, unevaluated, `${label}: unevaluated count`);
}

function pick(results) {
  const result = results.find((item) => item.ruleId.endsWith("figure-object-alignment"));
  if (!result) throw new Error("Missing figure-object-alignment result");
  return result;
}

function summarizeScore(results) {
  const applicable = results.filter((result) => result.status !== "NOT_APPLICABLE");
  const passed = applicable.filter((result) => result.status === "PASSED").length;

  return {
    score: applicable.length === 0 ? 0 : Math.round((passed / applicable.length) * 100),
    passed,
    failed: applicable.length - passed,
    notApplicable: results.length - applicable.length,
  };
}

function summarizeCases(cases) {
  return Object.fromEntries(
    Object.entries(cases).map(([name, item]) => [
      name,
      {
        status: item.result.status,
        passed: item.result.passed,
        coverage: item.result.coverage,
        diagnosticCount: item.diagnostics.length,
        score: summarizeScore(item.results).score,
      },
    ]),
  );
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

function deletedAnchorParagraph() {
  return `<w:p><w:del w:id="1">${anchorRun()}</w:del></w:p>`;
}

function moveFromAnchorParagraph() {
  return `<w:p><w:moveFrom w:id="2">${anchorRun()}</w:moveFrom></w:p>`;
}

function moveToAnchorParagraph() {
  return `<w:p><w:moveTo w:id="3">${anchorRun()}</w:moveTo></w:p>`;
}

function assert(value, message) {
  if (!value) {
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
