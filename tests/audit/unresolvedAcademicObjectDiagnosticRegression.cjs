const fs = require("fs");
const path = require("path");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  buildAnalysisDiagnostics,
} = require("../../src/features/analysis/diagnostics/academicObjectDiagnostics.ts");
const { analyzeDocx } = require("../../src/features/analysis/analysisService.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
const OFFICIAL_SOURCE_DIR = path.join(
  process.cwd(),
  "docs",
  "sources",
  "comu",
  "applied-sciences",
  "food-technology",
  "bachelor",
  "original",
);
const OFFICIAL_TEMPLATES = [
  "103-bitirme-tezi-sablo-literatur-calismasi.docx",
  "104-bitirme-tezi-sablonu-laboratuvar-calismasi.docx",
];
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

async function main() {
  assertSyntheticDiagnosticPolicy();
  const beforeAfter = await assertFixtureDiagnostics();
  const productionPath = await assertProductionPath();
  const officialTemplates = await inspectOfficialTemplates();

  console.log(JSON.stringify({
    phase: "4E-18D",
    result: "PASS",
    beforeAfter,
    productionPath,
    officialTemplates,
  }, null, 2));
}

function assertSyntheticDiagnosticPolicy() {
  const declared = analyze(picture() + caption("Şekil 1. Doğru"));
  assertDiagnostics(declared, [], "declared matched figure");

  const uncaptionedPicture = analyze(picture());
  assertDiagnostics(uncaptionedPicture, [], "uncaptioned picture front-matter guard");

  const chart = analyze(drawing("http://schemas.openxmlformats.org/drawingml/2006/chart", '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'));
  assertDiagnostics(chart, ["UNRESOLVED_ACADEMIC_OBJECT"], "uncaptioned chart");

  const unknown = analyze(drawing("urn:thesisguard:unknown", '<tg:payload xmlns:tg="urn:thesisguard:unknown"/>'));
  assertDiagnostics(unknown, ["UNSUPPORTED_OBJECT_REPRESENTATION"], "unknown drawing");

  const vml = analyze(vmlImage());
  assertDiagnostics(vml, ["UNSUPPORTED_OBJECT_REPRESENTATION"], "VML image");

  const oleDocument = analyze(ole());
  assertDiagnostics(oleDocument, ["UNSUPPORTED_OBJECT_REPRESENTATION"], "OLE object");

  const equationDocument = analyze(equation());
  assertDiagnostics(equationDocument, [], "equation policy is silent");

  const table = analyze(tableXml());
  assertDiagnostics(table, [], "uncaptioned table layout/front-matter guard");

  const ambiguous = analyze(caption("Şekil 1. Ön") + picture() + caption("Şekil 2. Son"));
  assertDiagnostics(ambiguous, ["AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION"], "ambiguous association");

  const conflicting = analyze(caption("Şekil 6. Çelişen") + tableXml());
  assertDiagnostics(conflicting, ["AMBIGUOUS_ACADEMIC_OBJECT"], "conflicting association");

  const textbox = analyze(textboxDrawing());
  assertDiagnostics(textbox, [], "textbox excluded policy is silent");

  const orphan = analyze(caption("Şekil 8. Yetim"));
  assertEqual(orphan.objectSemantics.captions[0]?.isOrphan, true, "orphan caption preserved");
  assertDiagnostics(orphan, [], "orphan caption does not fabricate object diagnostic");

  const duplicateRoot = buildAnalysisDiagnostics(ambiguous.objectSemantics);
  assertEqual(duplicateRoot.length, 1, "one semantic root cause creates one diagnostic");

  const firstIds = buildAnalysisDiagnostics(unknown.objectSemantics).map((item) => item.id);
  const secondIds = buildAnalysisDiagnostics(unknown.objectSemantics).map((item) => item.id);
  assertEqual(JSON.stringify(firstIds), JSON.stringify(secondIds), "diagnostic IDs deterministic");

  const evidence = buildAnalysisDiagnostics(ambiguous.objectSemantics)[0]?.evidence;
  assert(evidence, "ambiguous evidence missing");
  assert(evidence.candidateCaptions.length <= 2, "candidate evidence is bounded for targeted fixture");
  assert(
    evidence.candidateCaptions.every((item) => item.textExcerpt.length <= 160),
    "caption evidence excerpt is bounded",
  );
}

async function assertFixtureDiagnostics() {
  const fixtureExpectations = [
    ["full-correct.docx", 0],
    ["chart-object-synthetic.docx", 1],
    ["smartart-object-synthetic.docx", 1],
    ["grouped-drawing-object-synthetic.docx", 1],
    ["unknown-drawing-object-synthetic.docx", 1],
    ["vml-image-object-synthetic.docx", 1],
    ["ole-object-synthetic.docx", 1],
    ["equation-object-synthetic.docx", 0],
    ["drawingml-textbox-ownership-synthetic.docx", 0],
    ["textbox-font-size-synthetic.docx", 0],
    ["smartart-caption-collision-synthetic.docx", 0],
  ];
  const observations = [];

  for (const [fixture, expectedDiagnosticCount] of fixtureExpectations) {
    const { document, report } = await runAnalysisFixture(path.join(FIXTURE_DIR, fixture));
    const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
    assertEqual(diagnostics.length, expectedDiagnosticCount, `${fixture}: diagnostic count`);
    assertScoreAndRuleResultIsolation(report, report, `${fixture}: fixture self-parity`);
    observations.push({
      fixture,
      diagnosticCount: diagnostics.length,
      diagnosticCodes: diagnostics.map((item) => item.code),
      passedRules: report.passedRules,
      failedRules: report.failedRules,
      notApplicableRules: report.notApplicableRules,
      score: report.score,
    });
  }

  const golden = observations.find((item) => item.fixture === "full-correct.docx");
  assertEqual(golden?.passedRules, 46, "golden remains 46/46");
  return observations;
}

async function assertProductionPath() {
  const fixturePath = path.join(FIXTURE_DIR, "chart-object-synthetic.docx");
  const file = createNodeDocxReaderInput(fixturePath);
  const productionReport = await analyzeDocx(file, SELECTION);
  const fixture = await runAnalysisFixture(fixturePath);

  assert(productionReport.diagnostics.length > 0, "production report diagnostics missing");
  assert(
    productionReport.diagnostics.some((item) => item.code === "UNRESOLVED_ACADEMIC_OBJECT"),
    "production report unresolved diagnostic missing",
  );
  assertScoreAndRuleResultIsolation(fixture.report, productionReport, "production path score isolation");

  return {
    fixture: "chart-object-synthetic.docx",
    diagnosticCount: productionReport.diagnostics.length,
    diagnosticCodes: productionReport.diagnostics.map((item) => item.code),
    passedRules: productionReport.passedRules,
    failedRules: productionReport.failedRules,
    notApplicableRules: productionReport.notApplicableRules,
    score: productionReport.score,
  };
}

async function inspectOfficialTemplates() {
  const observations = [];

  for (const fileName of OFFICIAL_TEMPLATES) {
    const filePath = path.join(OFFICIAL_SOURCE_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const { document } = await runAnalysisFixture(filePath);
    const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
    observations.push({
      fileName,
      representationCount: document.objectSemantics.representations.length,
      declaredCount: document.objectSemantics.resolutions.filter((item) => item.status === "declared").length,
      unresolvedCount: document.objectSemantics.resolutions.filter((item) => item.status === "unresolved").length,
      ambiguousCount: document.objectSemantics.resolutions.filter((item) => item.status === "ambiguous").length,
      excludedCount: document.objectSemantics.resolutions.filter((item) => item.status === "excluded").length,
      diagnosticCount: diagnostics.length,
      diagnosticCodes: diagnostics.map((item) => item.code),
    });
  }

  return observations;
}

function assertDiagnostics(document, expectedCodes, label) {
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
  assertEqual(
    JSON.stringify(diagnostics.map((item) => item.code)),
    JSON.stringify(expectedCodes),
    `${label}: diagnostic codes`,
  );
  assert(
    diagnostics.every((item) => item.scope === "academic-object-semantics"),
    `${label}: diagnostic scope`,
  );
}

function assertScoreAndRuleResultIsolation(before, after, label) {
  assertEqual(after.totalRules, before.totalRules, `${label}: total rules`);
  assertEqual(after.passedRules, before.passedRules, `${label}: passed rules`);
  assertEqual(after.failedRules, before.failedRules, `${label}: failed rules`);
  assertEqual(after.notApplicableRules, before.notApplicableRules, `${label}: N/A rules`);
  assertEqual(after.score, before.score, `${label}: score`);
  assertEqual(
    JSON.stringify(after.results.map(toRuleResultSignature)),
    JSON.stringify(before.results.map(toRuleResultSignature)),
    `${label}: RuleResult signatures`,
  );
}

function toRuleResultSignature(result) {
  return {
    ruleId: result.ruleId,
    status: result.status,
    passed: result.passed,
    actual: result.actual,
  };
}

function analyze(content) {
  return parseDocumentXml(documentXml(content));
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

function drawing(uri, payload) {
  return `<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="${uri}">${payload}</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function vmlImage() {
  return '<w:p><w:r><w:pict><v:shape xmlns:v="urn:schemas-microsoft-com:vml"><v:imagedata/></v:shape></w:pict></w:r></w:p>';
}

function ole() {
  return '<w:p><w:r><w:object><o:OLEObject xmlns:o="urn:schemas-microsoft-com:office:office"/></w:object></w:r></w:p>';
}

function equation() {
  return '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></m:oMathPara>';
}

function textboxDrawing() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx><w:txbxContent><w:p><w:r><w:t>Metin</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function tableXml() {
  return '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Değer</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
}

function caption(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
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
