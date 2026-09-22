const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "comu", "food-technology", "experimental");
const BASELINE_PATH = path.join(FIXTURE_DIR, "full-correct.docx");
const OFFICIAL_SOURCE_DIR = path.join(process.cwd(), "docs", "sources", "comu", "applied-sciences", "food-technology", "bachelor", "original");
const OFFICIAL_TEMPLATES = [
  "103-bitirme-tezi-sablo-literatur-calismasi.docx",
  "104-bitirme-tezi-sablonu-laboratuvar-calismasi.docx",
];
const COVERAGE_FIXTURES = [
  {
    file: "vml-image-object-synthetic.docx",
    kind: "vml-image",
    xml: '<w:p><w:r><w:pict><v:shape xmlns:v="urn:schemas-microsoft-com:vml" id="tg-vml-image"><v:imagedata r:id="rIdTgVmlImage" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></v:shape></w:pict></w:r></w:p>',
    legacyFigureCount: 1,
    resolutionStatus: "unresolved",
    failedRuleIds: [],
  },
  {
    file: "equation-object-synthetic.docx",
    kind: "equation",
    xml: '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath></m:oMathPara>',
    legacyFigureCount: 1,
    resolutionStatus: "ambiguous",
    failedRuleIds: [],
  },
  {
    file: "unknown-drawing-object-synthetic.docx",
    kind: "unknown-drawing",
    xml: '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="urn:thesisguard:unknown"><tg:payload xmlns:tg="urn:thesisguard:unknown"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>',
    legacyFigureCount: 2,
    resolutionStatus: "unresolved",
    failedRuleIds: [],
  },
];

const EXISTING_FIXTURES = [
  ["full-correct.docx", "picture"],
  ["chart-object-synthetic.docx", "chart"],
  ["smartart-object-synthetic.docx", "diagram"],
  ["grouped-drawing-object-synthetic.docx", "group"],
  ["ole-object-synthetic.docx", "ole"],
  ["drawingml-textbox-ownership-synthetic.docx", "textbox"],
  ["textbox-font-size-synthetic.docx", "textbox"],
];

async function main() {
  await createCoverageFixturesIfMissing();
  assertCaptionAndAssociationCoverage();
  const differential = [];

  for (const [file, requiredKind] of EXISTING_FIXTURES) {
    const result = await inspectFixture(file);
    assert(result.representations.some((item) => item.kind === requiredKind), `${file}: ${requiredKind} representation missing`);
    differential.push(summarize(result));
  }

  for (const fixture of COVERAGE_FIXTURES) {
    const result = await inspectFixture(fixture.file);
    const representation = result.representations.find((item) => item.kind === fixture.kind);
    assert(representation, `${fixture.file}: ${fixture.kind} representation missing`);
    const resolution = result.resolutions.find((item) => item.objectId === representation.id);
    assertEqual(resolution?.status, fixture.resolutionStatus, `${fixture.file}: academic resolution`);
    assertEqual(resolution?.academicType, null, `${fixture.file}: academic type`);
    assertEqual(result.document.figures.count, fixture.legacyFigureCount, `${fixture.file}: legacy figure count`);
    assertEqual(
      JSON.stringify(result.report.results.filter((item) => item.status === "FAILED").map((item) => item.ruleId)),
      JSON.stringify(fixture.failedRuleIds),
      `${fixture.file}: legacy RuleResult parity`,
    );
    differential.push(summarize(result));
  }

  const captionedDiagram = await inspectFixture("smartart-caption-collision-synthetic.docx");
  assert(hasResolution(captionedDiagram, "diagram", "declared", "figure"), "captioned diagram declared figure");
  differential.push(summarize(captionedDiagram));
  const officialTemplateObservations = [];
  for (const file of OFFICIAL_TEMPLATES) {
    const filePath = path.join(OFFICIAL_SOURCE_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const { document } = await runAnalysisFixture(filePath);
    officialTemplateObservations.push({
      file,
      representations: document.objectSemantics.representations.map((item) => ({ kind: item.kind, scope: item.scope })),
      resolutions: document.objectSemantics.resolutions.map((item) => ({ status: item.status, academicType: item.academicType })),
    });
  }

  console.log(JSON.stringify({
    phase: "4E-18B",
    result: "PASS",
    overallReadiness: "READY_FOR_PILOT_MIGRATION",
    decision: "OPTION_C",
    firstValidator: "ObjectCaptionFormatValidator",
    firstRuleId: "comu.applied-sciences.food-technology.bachelor.figure-caption-format",
    newExploratoryFixtures: COVERAGE_FIXTURES.map((item) => item.file),
    officialTemplateObservations,
    differential,
  }, null, 2));
}

async function createCoverageFixturesIfMissing() {
  const source = fs.readFileSync(BASELINE_PATH);
  for (const fixture of COVERAGE_FIXTURES) {
    const target = path.join(FIXTURE_DIR, fixture.file);
    if (fs.existsSync(target)) continue;
    const zip = await JSZip.loadAsync(source);
    const documentXml = await zip.file("word/document.xml").async("string");
    zip.file("word/document.xml", insertBeforeFinalSection(documentXml, fixture.xml));
    fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
  }
}

function assertCaptionAndAssociationCoverage() {
  const matched = parseDocumentXml(documentXml(picture() + captionRuns(["Şe", "kil ", "3.", " Açıklama"])));
  assertCaption(matched, "declared", "figure", "3", "split-run figure caption");
  assertAssociation(matched, "matched", "declared", "split-run matched association");

  const table = parseDocumentXml(documentXml(caption("Tablo 1. Bulgular") + tableXml()));
  assertCaption(table, "declared", "table", "1", "declared table caption");
  assertAssociation(table, "matched", "declared", "table matched association");

  const field = parseDocumentXml(documentXml(picture() + fieldCaption()));
  assertCaption(field, "declared", "figure", "4", "SEQ visible result semantics");
  assert(field.objectSemantics.captions[0].fieldEvidence.some((item) => item.instruction.includes("SEQ Şekil")), "SEQ field instruction retained");

  const missing = parseDocumentXml(documentXml(picture()));
  assertAssociation(missing, "missing", "unresolved", "missing association");

  const ambiguous = parseDocumentXml(documentXml(caption("Şekil 1. Ön") + picture() + caption("Şekil 2. Son")));
  assertAssociation(ambiguous, "ambiguous", "ambiguous", "multiple caption ambiguity");

  const shared = parseDocumentXml(documentXml(picture() + picture() + caption("Şekil 5. Paylaşılan")));
  assert(shared.objectSemantics.associations.every((item) => item.status === "ambiguous"), "shared caption claims remain ambiguous");

  const conflicting = parseDocumentXml(documentXml(caption("Şekil 6. Çelişen") + tableXml()));
  assertAssociation(conflicting, "conflicting", "ambiguous", "conflicting association");

  const textbox = parseDocumentXml(documentXml(textboxDrawing()));
  assertAssociation(textbox, "not-attempted", "excluded", "textbox association not attempted");

  const captionStates = parseDocumentXml(documentXml(
    caption("Şekil") + caption("Tablo 1: Biçim") + caption("İlgisiz paragraf") + caption("Şekil 9. Yetim"),
  ));
  assertEqual(captionStates.objectSemantics.captions.length, 3, "unrelated paragraph is not a caption occurrence");
  assertEqual(captionStates.objectSemantics.captions[0].semantic.status, "unnumbered", "unnumbered caption state");
  assertEqual(captionStates.objectSemantics.captions[1].semantic.status, "malformed", "malformed caption state");
  assertEqual(captionStates.objectSemantics.captions[2].isOrphan, true, "valid orphan caption state");
}

async function inspectFixture(file) {
  const { document, report } = await runAnalysisFixture(path.join(FIXTURE_DIR, file));
  return {
    file,
    document,
    report,
    representations: document.objectSemantics.representations,
    resolutions: document.objectSemantics.resolutions,
  };
}

function summarize(result) {
  const counts = { declaredFigure: 0, declaredTable: 0, unresolved: 0, ambiguous: 0, excluded: 0 };
  for (const resolution of result.resolutions) {
    if (resolution.status === "declared" && resolution.academicType === "figure") counts.declaredFigure += 1;
    else if (resolution.status === "declared" && resolution.academicType === "table") counts.declaredTable += 1;
    else counts[resolution.status] += 1;
  }
  return {
    fixture: result.file,
    legacyFigures: result.document.figures.count,
    legacyTables: result.document.tables.count,
    shadow: counts,
    failedRuleIds: result.report.results.filter((item) => item.status === "FAILED").map((item) => item.ruleId),
  };
}

function hasResolution(result, kind, status, academicType) {
  const byId = new Map(result.representations.map((item) => [item.id, item]));
  return result.resolutions.some((item) =>
    byId.get(item.objectId)?.kind === kind && item.status === status && item.academicType === academicType,
  );
}

function assertCaption(document, status, academicType, number, label) {
  const captionFact = document.objectSemantics.captions.find((item) => item.semantic.status === status);
  assert(captionFact, `${label}: caption missing`);
  assertEqual(captionFact.semantic.academicType, academicType, `${label}: academic type`);
  assertEqual(captionFact.semantic.number, number, `${label}: number`);
}

function assertAssociation(document, associationStatus, resolutionStatus, label) {
  assertEqual(document.objectSemantics.associations[0]?.status, associationStatus, `${label}: association`);
  assertEqual(document.objectSemantics.resolutions[0]?.status, resolutionStatus, `${label}: resolution`);
}

function insertBeforeFinalSection(xml, content) {
  const index = xml.lastIndexOf("<w:sectPr");
  return index === -1 ? xml.replace("</w:body>", `${content}</w:body>`) : xml.slice(0, index) + content + xml.slice(index);
}

function documentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:body>' + content + '</w:body></w:document>';
}

function picture() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function textboxDrawing() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>Metin</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

function tableXml() {
  return '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Değer</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
}

function caption(text) {
  return captionRuns([text]);
}

function captionRuns(parts) {
  return `<w:p>${parts.map((part) => `<w:r><w:t xml:space="preserve">${part}</w:t></w:r>`).join("")}</w:p>`;
}

function fieldCaption() {
  return '<w:p><w:r><w:t xml:space="preserve">Şekil </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> SEQ Şekil \\* ARABIC </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>4</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t>. Alan sonucu</w:t></w:r></w:p>';
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
