const path = require("path");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { ObjectCaptionFormatValidator } = require("../../src/features/analysis/rules/validators/ObjectCaptionFormatValidator.ts");

const FIXTURE_DIR = path.join("tests", "fixtures", "comu", "food-technology", "experimental");
const PILOT_RULE_ID = "comu.applied-sciences.food-technology.bachelor.figure-caption-format";
const PILOT_RULE = {
  id: PILOT_RULE_ID,
  type: "OBJECT_CAPTION_FORMAT",
  title: "Şekil başlığı biçimi",
  description: "Audit rule",
  category: "format",
  expected: { object: "figure", alignment: "left", lineSpacing: 1 },
  severity: "error",
  score: 1,
  message: "Audit",
  solution: "Audit",
  enabled: true,
  version: "audit",
};
const LEGACY_COMPARISON_RULE = { ...PILOT_RULE, id: "audit.legacy.figure-caption-format" };
const FIXTURES = [
  "full-correct.docx",
  "chart-object-synthetic.docx",
  "smartart-object-synthetic.docx",
  "grouped-drawing-object-synthetic.docx",
  "unknown-drawing-object-synthetic.docx",
  "vml-image-object-synthetic.docx",
  "ole-object-synthetic.docx",
  "equation-object-synthetic.docx",
  "smartart-caption-collision-synthetic.docx",
  "drawingml-textbox-ownership-synthetic.docx",
  "textbox-font-size-synthetic.docx",
  "alternate-content-figure-synthetic.docx",
  "tracked-move-synthetic.docx",
  "tracked-move-semantic-collision-synthetic.docx",
];

async function main() {
  const differential = await assertCorpusParity();
  assertTargetedContracts();
  console.log(JSON.stringify({
    phase: "4E-18C",
    result: "PASS",
    pilotDecision: "PILOT_SUCCESS_WITH_LIMITATIONS",
    ruleId: PILOT_RULE_ID,
    differential,
  }, null, 2));
}

async function assertCorpusParity() {
  const validator = new ObjectCaptionFormatValidator();
  const differential = [];

  for (const fixture of FIXTURES) {
    const { document, report } = await runAnalysisFixture(path.join(FIXTURE_DIR, fixture));
    const legacy = validator.validate(document, LEGACY_COMPARISON_RULE);
    const shadow = validator.validate(document, PILOT_RULE);
    const production = report.results.find((item) => item.ruleId === PILOT_RULE_ID);
    assert(production, `${fixture}: production pilot result missing`);
    assertEquivalentResult(shadow, production, `${fixture}: direct/engine shadow parity`);
    assertEquivalentResult(legacy, shadow, `${fixture}: legacy/shadow parity`);

    differential.push({
      fixture,
      legacyEligible: countLegacyEligible(document),
      shadowEligible: countShadowEligible(document),
      legacyStatus: legacy.status,
      shadowStatus: shadow.status,
      classification: "PARITY",
    });
  }

  const expectedNonPilotFailures = new Map([
    ["chart-object-synthetic.docx", ["comu.applied-sciences.food-technology.bachelor.figure-caption-placement"]],
    ["smartart-object-synthetic.docx", ["comu.applied-sciences.food-technology.bachelor.figure-caption-placement"]],
    ["grouped-drawing-object-synthetic.docx", ["comu.applied-sciences.food-technology.bachelor.figure-caption-placement"]],
    ["unknown-drawing-object-synthetic.docx", ["comu.applied-sciences.food-technology.bachelor.figure-caption-placement"]],
    ["smartart-caption-collision-synthetic.docx", ["comu.applied-sciences.food-technology.bachelor.figure-in-text-reference"]],
  ]);
  for (const [fixture, expected] of expectedNonPilotFailures) {
    const { report } = await runAnalysisFixture(path.join(FIXTURE_DIR, fixture));
    const actual = report.results.filter((item) => item.status === "FAILED").map((item) => item.ruleId);
    assertEqual(JSON.stringify(actual), JSON.stringify(expected), `${fixture}: non-pilot RuleResult parity`);
  }

  return differential;
}

function assertTargetedContracts() {
  const correct = analyze(picture() + caption("Şekil 1. Doğru", "left", 240));
  assertResult(correct, "PASSED", 1, "correct declared matched figure");

  const wrong = analyze(picture() + caption("Şekil 1. Yanlış", "center", 360));
  assertResult(wrong, "FAILED", 1, "wrong declared matched figure");
  const wrongResult = validate(wrong);
  assertEqual(wrongResult.evidenceTotal, 1, "wrong formatting evidence total");
  assertEqual(wrongResult.evidence?.length, 1, "wrong formatting evidence length");

  for (const [label, content, kind] of [
    ["uncaptioned picture", picture(), "picture"],
    ["uncaptioned chart", drawing("http://schemas.openxmlformats.org/drawingml/2006/chart", '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'), "chart"],
    ["uncaptioned diagram", drawing("http://schemas.openxmlformats.org/drawingml/2006/diagram", '<dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>'), "diagram"],
    ["uncaptioned group", drawing("http://schemas.microsoft.com/office/word/2010/wordprocessingGroup", '<wpg:wgp xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"/>'), "group"],
    ["unknown drawing", drawing("urn:thesisguard:unknown", '<tg:payload xmlns:tg="urn:thesisguard:unknown"/>'), "unknown-drawing"],
    ["VML image", vmlImage(), "vml-image"],
    ["OLE", ole(), "ole"],
    ["equation", equation(), "equation"],
    ["textbox", textbox(), "textbox"],
  ]) {
    const document = analyze(content);
    assert(document.objectSemantics.representations.some((item) => item.kind === kind), `${label}: representation missing`);
    assertResult(document, "NOT_APPLICABLE", 0, label);
  }

  const orphan = analyze(caption("Şekil 8. Yetim", "left", 240));
  assertEqual(orphan.objectSemantics.captions[0].isOrphan, true, "orphan caption fact");
  assertResult(orphan, "NOT_APPLICABLE", 0, "orphan caption");

  const ambiguous = analyze(
    caption("Şekil 1. Ön", "left", 240) + picture() + caption("Şekil 2. Son", "left", 240),
  );
  assertEqual(ambiguous.objectSemantics.associations[0].status, "ambiguous", "ambiguous association state");
  assertResult(ambiguous, "NOT_APPLICABLE", 0, "ambiguous association");

  const malformed = analyze(picture() + caption("Şekil 1: Bozuk", "center", 360));
  assertEqual(malformed.objectSemantics.captions[0].semantic.status, "malformed", "malformed syntax ownership");
  assertResult(malformed, "NOT_APPLICABLE", 0, "malformed caption not format failure");

  const mixed = analyze(
    picture() + caption("Şekil 1. Doğru", "left", 240) +
    textParagraph("Akademik metin sınırı") +
    drawing("http://schemas.openxmlformats.org/drawingml/2006/chart", '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'),
  );
  assertResult(mixed, "PASSED", 1, "mixed declared and unresolved");

  const multiple = analyze(
    picture() + caption("Şekil 1. Doğru", "left", 240) +
    textParagraph("Ayırıcı") +
    picture() + caption("Şekil 2. Yanlış", "center", 360),
  );
  assertResult(multiple, "FAILED", 2, "multiple declared figures");
  assertEqual(validate(multiple).evidenceTotal, 1, "multiple figure failure aggregation");

  const alternate = analyze([
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">',
    '<mc:Choice Requires="pic">', picture(), '</mc:Choice>',
    '<mc:Fallback>', picture(), '</mc:Fallback>',
    '</mc:AlternateContent>',
    caption("Şekil 1. Alternate", "left", 240),
  ].join(""));
  assertResult(alternate, "PASSED", 1, "AlternateContent single eligible figure");

  const revision = analyze(
    '<w:p><w:moveFrom w:id="1">' + pictureRun() + '</w:moveFrom><w:moveTo w:id="2">' + pictureRun() + '</w:moveTo></w:p>' +
    '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr>' +
    '<w:moveFrom w:id="3"><w:r><w:t>Şekil 99. Silinmiş</w:t></w:r></w:moveFrom>' +
    '<w:moveTo w:id="4"><w:r><w:t>Şekil 1. Görünür</w:t></w:r></w:moveTo></w:p>',
  );
  assertResult(revision, "PASSED", 1, "revision visibility");
}

function countLegacyEligible(document) {
  return document.figures.items.filter((item) => item.drawingType === "inline" && item.captionId !== null && item.captionPosition !== "ambiguous").length;
}

function countShadowEligible(document) {
  const representationById = new Map(document.objectSemantics.representations.map((item) => [item.id, item]));
  const associationByObjectId = new Map(document.objectSemantics.associations.map((item) => [item.objectId, item]));
  return document.objectSemantics.resolutions.filter((resolution) => {
    const representation = representationById.get(resolution.objectId);
    const association = associationByObjectId.get(resolution.objectId);
    return resolution.status === "declared" && resolution.academicType === "figure" &&
      representation?.scope === "body" && representation.drawingType === "inline" &&
      association?.status === "matched" && association.captionId === resolution.captionId;
  }).length;
}

function assertResult(document, expectedStatus, expectedEligible, label) {
  const result = validate(document);
  assertEqual(result.status, expectedStatus, `${label}: status`);
  assertEqual(countShadowEligible(document), expectedEligible, `${label}: eligible count`);
}

function validate(document) {
  return new ObjectCaptionFormatValidator().validate(document, PILOT_RULE);
}

function analyze(content) {
  return parseDocumentXml(documentXml(content));
}

function assertEquivalentResult(actual, expected, label) {
  for (const key of ["status", "passed", "expected", "actual", "message", "evidenceTotal"]) {
    assertEqual(actual[key], expected[key], `${label}: ${key}`);
  }
  assertEqual(JSON.stringify(actual.evidence ?? []), JSON.stringify(expected.evidence ?? []), `${label}: evidence`);
}

function documentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + content + '</w:body></w:document>';
}

function picture() {
  return `<w:p>${pictureRun()}</w:p>`;
}

function pictureRun() {
  return '<w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
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

function textbox() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx><w:txbxContent><w:p><w:r><w:t>Metin</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function caption(text, alignment, line) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/><w:spacing w:line="${line}" w:lineRule="auto"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textParagraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
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
