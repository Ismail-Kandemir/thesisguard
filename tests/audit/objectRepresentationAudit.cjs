const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");

const FIXTURE_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
);
const SOURCE_DOCX = path.join(FIXTURE_DIR, "full-correct.docx");

const FIXTURES = [
  {
    name: "chart-object-synthetic.docx",
    kind: "chart",
    body: paragraphXml(drawingRunXml("rIdAuditChart", chartGraphicDataXml()), "center"),
    packageParts: addChartPackageParts,
  },
  {
    name: "smartart-object-synthetic.docx",
    kind: "smartart",
    body: paragraphXml(drawingRunXml("rIdAuditDiagram", smartArtGraphicDataXml()), "center"),
    packageParts: addDiagramPackageParts,
  },
  {
    name: "grouped-drawing-object-synthetic.docx",
    kind: "groupedDrawing",
    body: paragraphXml(drawingRunXml("rIdAuditGroup", groupedGraphicDataXml()), "center"),
  },
  {
    name: "ole-object-synthetic.docx",
    kind: "ole",
    body: paragraphXml(oleObjectXml(), "center"),
    packageParts: addOlePackageParts,
  },
  {
    name: "smartart-caption-collision-synthetic.docx",
    kind: "smartartCaptionCollision",
    body:
      paragraphXml(drawingRunXml("rIdAuditDiagram", smartArtGraphicDataXml()), "center") +
      paragraphXml(textRunXml("Şekil 99. Audit SmartArt başlığı"), "left", 240),
    packageParts: addDiagramPackageParts,
  },
];

const FIGURE_RULE_IDS = [
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-format",
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-figures",
];

async function main() {
  await createFixtures();

  const baseline = await inspectFixture(path.join(FIXTURE_DIR, "full-correct.docx"), "normalPictureBaseline");
  const fixtures = [];

  for (const fixture of FIXTURES) {
    fixtures.push(await inspectFixture(path.join(FIXTURE_DIR, fixture.name), fixture.kind));
  }

  assertEqual(baseline.normalized.figureCount, 1, "normal picture baseline figure count");
  assertEqual(findFixture(fixtures, "chart").normalized.figureCount, 2, "chart classified as figure");
  assertEqual(findFixture(fixtures, "smartart").normalized.figureCount, 2, "SmartArt classified as figure");
  assertEqual(findFixture(fixtures, "groupedDrawing").normalized.figureCount, 2, "grouped drawing classified as figure");
  assertEqual(findFixture(fixtures, "ole").normalized.figureCount, 1, "OLE not classified as figure");
  assertEqual(
    findFixture(fixtures, "smartartCaptionCollision").normalized.figureCount,
    2,
    "SmartArt caption collision figure count",
  );

  console.log(JSON.stringify({
    selectedTarget: "generic w:drawing object classification",
    detectorArchitecture: {
      figureSignal:
        "documentCaptionsNormalizer parses every semantic w:drawing under w:body as a figure unless the drawing contains wps:txbx or w:txbxContent.",
      pictureSpecificSignal: "No pic:pic or a:graphicData URI requirement is present in the current figure detector.",
      oleSignal: "w:object / o:OLEObject is not a w:drawing and is not normalized as a figure occurrence.",
    },
    activeFigureRules: FIGURE_RULE_IDS,
    objectTaxonomy: createObjectTaxonomy(),
    riskRanking: createRiskRanking(),
    fixtures: [baseline, ...fixtures],
    conclusion: {
      genericDrawingClassificationConfirmed: true,
      wrongRuleResultProven: false,
      classification:
        "OBJECT CLASSIFICATION GAP / ARCHITECTURAL LIMITATION / AMBIGUOUS PRODUCT SEMANTICS",
      rationale:
        "Chart, SmartArt, and grouped DrawingML are classified as figure facts by generic w:drawing detection. Runtime rule impact is observable, but the active rule metadata only defines Şekil/Table semantics and does not provide a source-backed taxonomy that excludes charts or diagrams from Şekil.",
    },
  }, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);

  for (const fixture of FIXTURES) {
    const zip = await JSZip.loadAsync(source);
    const documentXml = await readZipText(zip, "word/document.xml");
    const mutatedDocumentXml = insertBeforeFinalSection(documentXml, fixture.body);

    zip.file("word/document.xml", mutatedDocumentXml);
    fixture.packageParts?.(zip);
    fs.writeFileSync(path.join(FIXTURE_DIR, fixture.name), await zip.generateAsync({ type: "nodebuffer" }));
  }
}

async function inspectFixture(fixturePath, kind) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentXml = await readZipText(zip, "word/document.xml");
  const { document, report } = await runAnalysisFixture(fixturePath);

  return {
    fixture: path.relative(process.cwd(), fixturePath),
    kind,
    raw: {
      drawingCount: countMatches(documentXml, /<w:drawing\b/g),
      inlineCount: countMatches(documentXml, /<wp:inline\b/g),
      anchorCount: countMatches(documentXml, /<wp:anchor\b/g),
      graphicDataCount: countMatches(documentXml, /<a:graphicData\b/g),
      pictureCount: countMatches(documentXml, /<pic:pic\b/g),
      chartCount: countMatches(documentXml, /<c:chart\b/g),
      diagramCount: countMatches(documentXml, /<dgm:relIds\b/g),
      groupedDrawingCount: countMatches(documentXml, /<wpg:/g),
      textboxCount: countMatches(documentXml, /<wps:txbx\b|<w:txbxContent\b/g),
      objectCount: countMatches(documentXml, /<w:object\b/g),
      oleObjectCount: countMatches(documentXml, /<o:OLEObject\b/g),
      alternateContentCount: countMatches(documentXml, /<mc:AlternateContent\b/g),
    },
    normalized: {
      figureCount: document.figures.count,
      figures: document.figures.items,
      captions: document.captions.items,
      orphanCaptionIds: document.captions.orphanCaptionIds,
      references: document.objectReferences.items.filter((reference) => reference.kind === "figure"),
    },
    report: summarizeReport(report),
    affectedRuleResults: FIGURE_RULE_IDS.map((ruleId) =>
      summarizeResult(report.results.find((result) => result.ruleId === ruleId)),
    ),
    nonPassedResults: report.results
      .filter((result) => result.status !== "PASSED")
      .map(summarizeResult),
  };
}

function createObjectTaxonomy() {
  return [
    {
      type: "Normal picture",
      representation: "w:drawing / wp:inline / a:graphic / a:graphicData / pic:pic",
      currentDetectorOutcome: "figure",
      semanticConfidence: "High",
    },
    {
      type: "Chart",
      representation: "w:drawing / a:graphicData / c:chart",
      currentDetectorOutcome: "figure",
      semanticConfidence: "Ambiguous; no chart-specific rule taxonomy exists.",
    },
    {
      type: "SmartArt / diagram",
      representation: "w:drawing / a:graphicData / dgm:relIds",
      currentDetectorOutcome: "figure",
      semanticConfidence: "Ambiguous; diagrams may be academic figures but detector does not know that.",
    },
    {
      type: "Grouped DrawingML",
      representation: "w:drawing / a:graphicData / wpg",
      currentDetectorOutcome: "figure",
      semanticConfidence: "Ambiguous; logical object identity can be complex.",
    },
    {
      type: "WPS textbox",
      representation: "w:drawing with wps:txbx or w:txbxContent",
      currentDetectorOutcome: "not figure",
      semanticConfidence: "High; covered by existing textbox regression.",
    },
    {
      type: "VML image",
      representation: "w:pict / v:shape / v:imagedata",
      currentDetectorOutcome: "not figure unless wrapped by w:drawing",
      semanticConfidence: "Medium; legacy images may need future source-backed scope.",
    },
    {
      type: "OLE / embedded object",
      representation: "w:object / v:shape / o:OLEObject",
      currentDetectorOutcome: "not figure",
      semanticConfidence: "Ambiguous; embedded objects are outside current normalized figure taxonomy.",
    },
  ];
}

function createRiskRanking() {
  return [
    {
      candidate: "Chart",
      risk: "High",
      realWorldLikelihood: "High",
      detectorFigureLikelihood: "High",
      falsePositiveRisk: "Ambiguous",
      falseNegativeRisk: "Low for w:drawing chart; higher for legacy/non-drawing charts",
      ruleImpact: "figure caption placement/alignment/reference/list-of-figures",
      testability: "High",
    },
    {
      candidate: "SmartArt / diagram",
      risk: "High",
      realWorldLikelihood: "Medium",
      detectorFigureLikelihood: "High",
      falsePositiveRisk: "Ambiguous",
      falseNegativeRisk: "Low for w:drawing diagram",
      ruleImpact: "figure caption placement/alignment/reference/list-of-figures",
      testability: "High",
    },
    {
      candidate: "Grouped DrawingML",
      risk: "Medium",
      realWorldLikelihood: "Medium",
      detectorFigureLikelihood: "High",
      falsePositiveRisk: "Ambiguous",
      falseNegativeRisk: "Medium for nested shapes not represented as top-level w:drawing",
      ruleImpact: "figure occurrence count, caption association, alignment",
      testability: "Medium",
    },
    {
      candidate: "OLE / embedded object",
      risk: "Medium",
      realWorldLikelihood: "Medium",
      detectorFigureLikelihood: "Low",
      falsePositiveRisk: "Low",
      falseNegativeRisk: "Ambiguous",
      ruleImpact: "figure rules if product semantics treats embedded objects as figures",
      testability: "Medium",
    },
    {
      candidate: "Normal picture",
      risk: "Low",
      realWorldLikelihood: "High",
      detectorFigureLikelihood: "High",
      falsePositiveRisk: "Low",
      falseNegativeRisk: "Low for DrawingML pictures",
      ruleImpact: "baseline figure rules",
      testability: "High",
    },
    {
      candidate: "WPS textbox",
      risk: "Low",
      realWorldLikelihood: "Medium",
      detectorFigureLikelihood: "Low after previous fix",
      falsePositiveRisk: "Low",
      falseNegativeRisk: "Low for textbox ownership semantics",
      ruleImpact: "body typography/object false positives",
      testability: "Covered",
    },
  ];
}

function insertBeforeFinalSection(documentXml, bodyContent) {
  const sectionIndex = documentXml.lastIndexOf("<w:sectPr");
  if (sectionIndex !== -1) {
    return documentXml.slice(0, sectionIndex) + bodyContent + documentXml.slice(sectionIndex);
  }

  return documentXml.replace("</w:body>", `${bodyContent}</w:body>`);
}

function paragraphXml(content, alignment, lineSpacing = 360) {
  const paragraphProperties = [
    "<w:pPr>",
    alignment ? `<w:jc w:val="${alignment}"/>` : "",
    `<w:spacing w:line="${lineSpacing}" w:lineRule="auto"/>`,
    "</w:pPr>",
  ].join("");

  return `<w:p>${paragraphProperties}${content}</w:p>`;
}

function drawingRunXml(relationshipId, graphicDataXml) {
  return [
    "<w:r>",
    "<w:drawing>",
    "<wp:inline>",
    "<wp:extent cx=\"914400\" cy=\"914400\"/>",
    "<wp:docPr id=\"901\" name=\"ThesisGuard Audit Object\"/>",
    "<a:graphic xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">",
    graphicDataXml,
    "</a:graphic>",
    "</wp:inline>",
    "</w:drawing>",
    "</w:r>",
  ].join("").replace("rIdAudit", relationshipId);
}

function chartGraphicDataXml() {
  return [
    "<a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/chart\">",
    "<c:chart xmlns:c=\"http://schemas.openxmlformats.org/drawingml/2006/chart\" ",
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" r:id=\"rIdAudit\"/>",
    "</a:graphicData>",
  ].join("");
}

function smartArtGraphicDataXml() {
  return [
    "<a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/diagram\">",
    "<dgm:relIds xmlns:dgm=\"http://schemas.openxmlformats.org/drawingml/2006/diagram\" ",
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" ",
    "r:dm=\"rIdAuditData\" r:lo=\"rIdAuditLayout\" r:qs=\"rIdAuditQuickStyle\" r:cs=\"rIdAuditColors\"/>",
    "</a:graphicData>",
  ].join("");
}

function groupedGraphicDataXml() {
  return [
    "<a:graphicData uri=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\">",
    "<wpg:wgp xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\">",
    "<wpg:cNvGrpSpPr/>",
    "<wpg:grpSpPr/>",
    "</wpg:wgp>",
    "</a:graphicData>",
  ].join("");
}

function oleObjectXml() {
  return [
    "<w:r>",
    "<w:object>",
    "<v:shape xmlns:v=\"urn:schemas-microsoft-com:vml\" id=\"_x0000_i2048\" type=\"#_x0000_t75\">",
    "<v:imagedata r:id=\"rIdAuditOleImage\" o:title=\"\" xmlns:o=\"urn:schemas-microsoft-com:office:office\"/>",
    "</v:shape>",
    "<o:OLEObject xmlns:o=\"urn:schemas-microsoft-com:office:office\" Type=\"Embed\" ProgID=\"Excel.Sheet.12\" ",
    "ShapeID=\"_x0000_i2048\" r:id=\"rIdAuditOleObject\"/>",
    "</w:object>",
    "</w:r>",
  ].join("");
}

function textRunXml(text) {
  return [
    "<w:r>",
    "<w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\"/><w:sz w:val=\"24\"/></w:rPr>",
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`,
    "</w:r>",
  ].join("");
}

function addChartPackageParts(zip) {
  addRelationship(
    zip,
    "rIdAuditChart",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
    "charts/chart1.xml",
  );
  zip.file("word/charts/chart1.xml", minimalChartXml());
  addContentTypeOverride(zip, "/word/charts/chart1.xml", "application/vnd.openxmlformats-officedocument.drawingml.chart+xml");
}

function addDiagramPackageParts(zip) {
  addRelationship(
    zip,
    "rIdAuditDiagramData",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData",
    "diagrams/data1.xml",
  );
  zip.file("word/diagrams/data1.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><dgm:dataModel xmlns:dgm=\"http://schemas.openxmlformats.org/drawingml/2006/diagram\"/>");
  addContentTypeOverride(zip, "/word/diagrams/data1.xml", "application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml");
}

function addOlePackageParts(zip) {
  addRelationship(
    zip,
    "rIdAuditOleObject",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject",
    "embeddings/oleObject1.bin",
  );
  zip.file("word/embeddings/oleObject1.bin", Buffer.from("ThesisGuard synthetic OLE placeholder", "utf8"));
  addContentTypeOverride(zip, "/word/embeddings/oleObject1.bin", "application/vnd.openxmlformats-officedocument.oleObject");
}

function addRelationship(zip, id, type, target) {
  const relsPath = "word/_rels/document.xml.rels";
  const rels = zip.file(relsPath).async("string");
  zip.file(relsPath, rels.then((xml) =>
    xml.includes(`Id="${id}"`)
      ? xml
      : xml.replace("</Relationships>", `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`),
  ));
}

function addContentTypeOverride(zip, partName, contentType) {
  const contentTypesPath = "[Content_Types].xml";
  const contentTypes = zip.file(contentTypesPath).async("string");
  zip.file(contentTypesPath, contentTypes.then((xml) =>
    xml.includes(`PartName="${partName}"`)
      ? xml
      : xml.replace("</Types>", `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`),
  ));
}

function minimalChartXml() {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>",
    "<c:chartSpace xmlns:c=\"http://schemas.openxmlformats.org/drawingml/2006/chart\" ",
    "xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" ",
    "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">",
    "<c:chart><c:plotArea><c:layout/></c:plotArea></c:chart>",
    "</c:chartSpace>",
  ].join("");
}

async function readZipText(zip, filePath) {
  const file = zip.file(filePath);
  if (!file) throw new Error(`${filePath} not found.`);
  return file.async("string");
}

function countMatches(value, pattern) {
  return Array.from(value.matchAll(pattern)).length;
}

function summarizeReport(report) {
  return {
    total: report.totalRules,
    passed: report.passedRules,
    failed: report.failedRules,
    notApplicable: report.notApplicableRules,
    score: report.score,
  };
}

function summarizeResult(result) {
  return result
    ? {
        ruleId: result.ruleId,
        status: result.status,
        expected: result.expected,
        actual: result.actual,
        message: result.message,
        evidence: result.evidence ?? [],
        evidenceTotal: result.evidenceTotal,
      }
    : null;
}

function findFixture(fixtures, kind) {
  const fixture = fixtures.find((item) => item.kind === kind);
  if (!fixture) throw new Error(`Fixture summary missing: ${kind}`);
  return fixture;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
