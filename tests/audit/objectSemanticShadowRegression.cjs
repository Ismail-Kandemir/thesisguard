const path = require("path");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");

async function main() {
  assertSyntheticInvariants();
  await assertFixtureObservations();
  console.log("Phase 4E-18A object semantic shadow regression: PASS");
}

function assertSyntheticInvariants() {
  const uncaptioned = parseDocumentXml(documentXml(pictureParagraph()));
  assertKinds(uncaptioned, ["picture"], "uncaptioned picture representation");
  assertResolution(uncaptioned, 0, "unresolved", null, "picture does not imply figure");

  const captionedFigure = parseDocumentXml(documentXml(
    pictureParagraph() + captionParagraph("Şekil 1. Sistem mimarisi"),
  ));
  assertResolution(captionedFigure, 0, "declared", "figure", "declared figure resolution");

  const captionedTable = parseDocumentXml(documentXml(
    captionParagraph("Tablo 1. Bulgular") + tableXml(),
  ));
  assertKinds(captionedTable, ["table"], "table representation");
  assertResolution(captionedTable, 0, "declared", "table", "declared table resolution");

  const ambiguous = parseDocumentXml(documentXml(
    captionParagraph("Şekil 1. Ön aday") +
    pictureParagraph() +
    captionParagraph("Şekil 2. Son aday"),
  ));
  assertEqual(ambiguous.objectSemantics.associations[0].status, "ambiguous", "ambiguous association");
  assertResolution(ambiguous, 0, "ambiguous", null, "ambiguous resolution");

  const orphan = parseDocumentXml(documentXml(captionParagraph("Şekil 7. Yetim başlık")));
  assertEqual(orphan.objectSemantics.representations.length, 0, "orphan caption creates no object");
  assertEqual(orphan.objectSemantics.captions.length, 1, "orphan caption preserved");
  assertEqual(orphan.objectSemantics.captions[0].isOrphan, true, "orphan caption marked");

  const textbox = parseDocumentXml(documentXml(drawingTextboxParagraph()));
  assertKinds(textbox, ["textbox"], "DrawingML textbox representation");
  assertResolution(textbox, 0, "excluded", null, "textbox does not imply figure");

  const alternate = parseDocumentXml(documentXml([
    '<mc:AlternateContent>',
    '<mc:Choice Requires="pic">', pictureParagraph(), '</mc:Choice>',
    '<mc:Fallback>', pictureParagraph(), '</mc:Fallback>',
    '</mc:AlternateContent>',
  ].join("")));
  assertEqual(alternate.objectSemantics.representations.length, 1, "AlternateContent occurrence not duplicated");

  const revisions = parseDocumentXml(documentXml([
    '<w:moveFrom w:id="1">', pictureParagraph(), '</w:moveFrom>',
    '<w:del w:id="2">', pictureParagraph(), '</w:del>',
    '<w:moveTo w:id="3">', chartParagraph(), '</w:moveTo>',
  ].join("")));
  assertKinds(revisions, ["chart"], "invisible revision objects excluded");
  assertResolution(revisions, 0, "ambiguous", null, "visible moved chart retains uncertain block ownership");
}

async function assertFixtureObservations() {
  const baseline = await analyze("full-correct.docx");
  assert(hasResolution(baseline.document, "picture", "declared", "figure"), "baseline captioned picture resolved");
  assert(hasResolution(baseline.document, "table", "declared", "table"), "baseline captioned table resolved");
  assertEqual(baseline.report.passedRules, 46, "baseline legacy RuleResult parity");

  const chart = await analyze("chart-object-synthetic.docx");
  assert(hasResolution(chart.document, "chart", "unresolved", null), "uncaptioned chart unresolved");
  assertEqual(chart.report.failedRules, 1, "chart legacy RuleResult parity");

  const diagram = await analyze("smartart-object-synthetic.docx");
  assert(hasResolution(diagram.document, "diagram", "unresolved", null), "uncaptioned diagram unresolved");

  const group = await analyze("grouped-drawing-object-synthetic.docx");
  assert(hasResolution(group.document, "group", "unresolved", null), "uncaptioned group unresolved");

  const ole = await analyze("ole-object-synthetic.docx");
  assert(hasResolution(ole.document, "ole", "unresolved", null), "OLE represented and unresolved");

  const captionedDiagram = await analyze("smartart-caption-collision-synthetic.docx");
  assert(hasResolution(captionedDiagram.document, "diagram", "declared", "figure"), "captioned diagram resolved figure");
  assertEqual(captionedDiagram.report.failedRules, 1, "captioned diagram legacy RuleResult parity");

  const drawingTextbox = await analyze("drawingml-textbox-ownership-synthetic.docx");
  assert(hasResolution(drawingTextbox.document, "textbox", "excluded", null), "DrawingML textbox excluded");
  assertEqual(drawingTextbox.report.passedRules, 46, "DrawingML textbox legacy parity");

  const vmlTextbox = await analyze("textbox-font-size-synthetic.docx");
  assert(hasResolution(vmlTextbox.document, "textbox", "excluded", null), "VML textbox excluded");

  const alternate = await analyze("alternate-content-figure-synthetic.docx");
  const pictures = alternate.document.objectSemantics.representations.filter((item) => item.kind === "picture");
  assertEqual(pictures.length, 1, "AlternateContent produces one logical picture");

  const trackedMove = await analyze("tracked-move-synthetic.docx");
  assertEqual(trackedMove.report.passedRules, 46, "tracked move legacy parity");
}

function hasResolution(document, kind, status, academicType) {
  const representationById = new Map(
    document.objectSemantics.representations.map((item) => [item.id, item]),
  );
  return document.objectSemantics.resolutions.some((item) =>
    representationById.get(item.objectId)?.kind === kind &&
    item.status === status &&
    item.academicType === academicType,
  );
}

function assertKinds(document, expected, label) {
  assertEqual(
    JSON.stringify(document.objectSemantics.representations.map((item) => item.kind)),
    JSON.stringify(expected),
    label,
  );
}

function assertResolution(document, index, status, academicType, label) {
  const actual = document.objectSemantics.resolutions[index];
  assert(actual, `${label}: resolution missing`);
  assertEqual(actual.status, status, `${label} status`);
  assertEqual(actual.academicType, academicType, `${label} academic type`);
}

function analyze(fileName) {
  return runAnalysisFixture(path.join(FIXTURE_DIR, fileName));
}

function documentXml(content) {
  return [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
    ' xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"',
    ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
    ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">',
    '<w:body>', content, '</w:body></w:document>',
  ].join("");
}

function pictureParagraph() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function chartParagraph() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function drawingTextboxParagraph() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>Metin</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function captionParagraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tableXml() {
  return '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Değer</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
