const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const {
  buildAnalysisDiagnostics,
} = require("../../src/features/analysis/diagnostics/academicObjectDiagnostics.ts");

const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

const RULES = new RuleResolver().resolve(new RuleSetSelector().select(SELECTION));
const OBJECT_RULE_IDS = [
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.figure-caption-format",
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-figures",
  "comu.applied-sciences.food-technology.bachelor.table-object-alignment",
  "comu.applied-sciences.food-technology.bachelor.table-caption-placement",
  "comu.applied-sciences.food-technology.bachelor.table-caption-format",
  "comu.applied-sciences.food-technology.bachelor.table-in-text-reference",
  "comu.applied-sciences.food-technology.bachelor.list-of-tables",
];
const OBJECT_RULES = RULES.filter((rule) => OBJECT_RULE_IDS.includes(rule.id));

async function main() {
  const inline = summarize("inline-baseline", scopedDocument(mainBoundary() + inlinePicture() + caption("Şekil 1. Inline")));
  const anchor = summarize("anchor-baseline", scopedDocument(mainBoundary() + anchorPicture({
    positionV: { relativeFrom: "paragraph", value: "914400" },
  }) + caption("Şekil 1. Anchor")));
  const anchorBeforeDown = summarize("anchor-before-caption-down", scopedDocument(
    mainBoundary() +
    anchorPicture({ positionV: { relativeFrom: "paragraph", value: "914400" } }) +
    caption("Şekil 1. Asagi istenen anchor"),
  ));
  const anchorAfterUp = summarize("anchor-after-caption-up", scopedDocument(
    mainBoundary() +
    caption("Şekil 1. Yukari istenen anchor") +
    anchorPicture({ positionV: { relativeFrom: "paragraph", value: "-914400" } }),
  ));
  const emptyOwner = summarize("anchor-empty-owner", scopedDocument(mainBoundary() + anchorPicture()));
  const textOwner = summarize("anchor-text-owner", scopedDocument(mainBoundary() + anchorPicture({
    prefixText: "Metinli paragraf ",
  })));
  const twoCaptions = summarize("anchor-two-nearby-captions", scopedDocument(
    mainBoundary() +
    caption("Şekil 1. Birinci") +
    anchorPicture() +
    caption("Şekil 2. Ikinci"),
  ));
  const pageRelative = summarize("anchor-relative-page", scopedDocument(mainBoundary() + anchorPicture({
    positionV: { relativeFrom: "page", value: "0" },
    positionH: { relativeFrom: "page", align: "center" },
  }) + caption("Şekil 1. Page")));
  const marginRelative = summarize("anchor-relative-margin", scopedDocument(mainBoundary() + anchorPicture({
    positionV: { relativeFrom: "margin", value: "0" },
    positionH: { relativeFrom: "margin", align: "center" },
  }) + caption("Şekil 1. Margin")));
  const frontMatterChart = summarize("front-matter-anchor-chart", scopedDocument(anchorChart()));
  const mainChart = summarize("main-content-anchor-chart", scopedDocument(mainBoundary() + anchorChart()));
  const textbox = summarize("anchor-textbox", scopedDocument(mainBoundary() + anchorTextbox() + caption("Şekil 1. Textbox")));
  const diagram = summarize("anchor-diagram", scopedDocument(mainBoundary() + anchorDiagram()));
  const group = summarize("anchor-group", scopedDocument(mainBoundary() + anchorGroup()));
  const alternate = summarize("alternate-content-anchor", scopedDocument(
    mainBoundary() +
    alternateContent(anchorPicture(), anchorChart()) +
    caption("Şekil 1. Alternate"),
  ));
  const deletedCase = summarize("deleted-anchor", scopedDocument(mainBoundary() + deletedAnchor()));
  const moveFromCase = summarize("moveFrom-anchor", scopedDocument(mainBoundary() + moveFromAnchor()));
  const movedVisibleCase = summarize("moveTo-anchor", scopedDocument(mainBoundary() + movedVisibleAnchor()));
  const tableCell = summarize("table-cell-anchor-layoutInCell", scopedDocument(mainBoundary() + tableCellAnchor()));
  const inlinePlusAnchor = summarize("inline-plus-anchor", scopedDocument(
    mainBoundary() +
    inlinePicture() +
    caption("Şekil 1. Inline") +
    paragraph("Metinde atif vardir.") +
    anchorPicture(),
  ));

  assertEqual(inline.representations[0].drawingType, "inline", "inline representation drawing type");
  assertEqual(inline.representations[0].kind, "picture", "inline representation kind");
  assertEqual(inline.associations[0].status, "matched", "inline association matched");
  assertEqual(inline.resolutions[0].status, "declared", "inline academic resolution declared");
  assertEqual(inline.rules.figureCaptionFormat.status, "PASSED", "inline pilot format passes");

  assertEqual(anchor.representations[0].drawingType, "anchor", "anchor representation drawing type");
  assertEqual(anchor.representations[0].kind, "picture", "anchor representation kind");
  assertNotEqual(anchor.representations[0].paragraphId, null, "anchor paragraph owner is recorded");
  assertNotEqual(anchor.representations[0].blockIndex, null, "anchor block owner is recorded");
  assertEqual(anchor.associations[0].status, "ambiguous", "anchor association ambiguous");
  assertEqual(anchor.associations[0].reasons[0], "object-position-not-deterministic", "anchor association reason");
  assertEqual(anchor.resolutions[0].status, "ambiguous", "anchor academic resolution ambiguous");
  assertEqual(anchor.legacyFigures[0].drawingType, "anchor", "legacy figure preserves anchor");
  assertEqual(anchor.legacyFigures[0].captionPosition, "ambiguous", "legacy anchor caption position ambiguous");
  assertEqual(anchor.rules.figureCaptionPlacement.status, "NOT_APPLICABLE", "placement excludes anchor");
  assertEqual(anchor.rules.figureCaptionFormat.status, "NOT_APPLICABLE", "pilot format excludes anchor");
  assertEqual(anchor.rules.figureInTextReference.status, "NOT_APPLICABLE", "reference excludes anchor without inline caption");
  assertEqual(anchor.rules.figureObjectAlignment.status, "NOT_APPLICABLE", "anchor-only alignment is unknown and not applicable");
  assertEqual(anchor.rules.listOfFigures.status, "NOT_APPLICABLE", "guarded list-of-figures excludes generic anchor");
  assertEqual(anchor.diagnostics[0].code, "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION", "anchor diagnostic code");

  assertEqual(anchorBeforeDown.associations[0].status, "ambiguous", "down-offset anchor still ambiguous");
  assertEqual(anchorAfterUp.associations[0].status, "ambiguous", "up-offset anchor still ambiguous");
  assertEqual(twoCaptions.associations[0].candidateCaptionIds.length, 0, "anchor does not claim nearby captions");
  assertEqual(pageRelative.associations[0].status, "ambiguous", "page relative anchor remains ambiguous");
  assertEqual(marginRelative.associations[0].status, "ambiguous", "margin relative anchor remains ambiguous");
  assertNotEqual(emptyOwner.representations[0].paragraphId, null, "empty owner anchor paragraph recorded");
  assertNotEqual(textOwner.representations[0].paragraphId, null, "text owner anchor paragraph recorded");
  assertEqual(textOwner.rules.figureObjectAlignment.status, "NOT_APPLICABLE", "text owner paragraph does not provide anchor alignment");

  assertEqual(frontMatterChart.representations[0].academicScope.scope, "unknown", "missing boundary chart scope unknown");
  assertEqual(mainChart.representations[0].academicScope.scope, "main-content", "main anchor chart scope main-content");
  assertEqual(mainChart.representations[0].drawingType, "anchor", "scope independent from drawing type");
  assertEqual(mainChart.representations[0].kind, "chart", "anchor chart payload preserved");
  assertEqual(mainChart.diagnostics[0].code, "AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION", "main anchor chart diagnostic ambiguous");
  assertEqual(textbox.representations[0].kind, "textbox", "anchor textbox kind preserved");
  assertEqual(textbox.resolutions[0].status, "excluded", "anchor textbox excluded");
  assertEqual(textbox.legacyFigures.length, 0, "anchor textbox not a legacy figure");
  assertEqual(diagram.representations[0].kind, "diagram", "anchor diagram payload preserved");
  assertEqual(group.representations[0].kind, "group", "anchor group payload preserved");
  assertEqual(alternate.representations.length, 1, "AlternateContent resolves one branch");
  assertEqual(alternate.representations[0].drawingType, "anchor", "AlternateContent active branch is anchor");
  assertEqual(deletedCase.representations.length, 0, "deleted anchor invisible");
  assertEqual(moveFromCase.representations.length, 0, "moveFrom anchor invisible");
  assertEqual(movedVisibleCase.representations.length, 1, "moveTo anchor visible");
  const tableCellAnchorRepresentation = tableCell.representations.find((item) => item.drawingType === "anchor");
  assert(tableCellAnchorRepresentation, "table cell anchor representation exists");
  assertEqual(tableCellAnchorRepresentation.scope, "table-cell", "table cell anchor scope");
  assertEqual(tableCellAnchorRepresentation.drawingType, "anchor", "table cell anchor drawing type");
  assertEqual(inlinePlusAnchor.rules.figureObjectAlignment.status, "PASSED", "inline plus anchor alignment evaluates inline only");
  assertEqual(inlinePlusAnchor.rules.figureCaptionPlacement.status, "PASSED", "placement evaluates inline only");
  assertEqual(inlinePlusAnchor.rules.figureCaptionFormat.status, "PASSED", "pilot format evaluates inline only");

  const golden = await runAnalysisFixture("tests/fixtures/comu/food-technology/experimental/full-correct.docx");
  assertEqual(golden.report.passedRules, 46, "golden passed rules");
  assertEqual(golden.report.failedRules, 0, "golden failed rules");
  assertEqual(buildAnalysisDiagnostics(golden.document.objectSemantics).length, 0, "golden diagnostics remain zero");

  const result = {
    phase: "4E-18G",
    result: "PASS",
    decision: "OPTION B",
    noProductionBehaviorChangedByAudit: true,
    cases: {
      inline: compactCase(inline),
      anchor: compactCase(anchor),
      anchorBeforeDown: compactCase(anchorBeforeDown),
      anchorAfterUp: compactCase(anchorAfterUp),
      emptyOwner: compactCase(emptyOwner),
      textOwner: compactCase(textOwner),
      twoCaptions: compactCase(twoCaptions),
      pageRelative: compactCase(pageRelative),
      marginRelative: compactCase(marginRelative),
      frontMatterChart: compactCase(frontMatterChart),
      mainChart: compactCase(mainChart),
      textbox: compactCase(textbox),
      diagram: compactCase(diagram),
      group: compactCase(group),
      alternate: compactCase(alternate),
      deleted: compactCase(deletedCase),
      moveFrom: compactCase(moveFromCase),
      movedVisible: compactCase(movedVisibleCase),
      tableCell: compactCase(tableCell),
      inlinePlusAnchor: compactCase(inlinePlusAnchor),
    },
    anchorFactsClassified: {
      mode: "USEFUL STRUCTURAL FACT",
      docPr: "USEFUL STRUCTURAL FACT",
      extent: "POTENTIALLY USEFUL",
      positionH: "POTENTIALLY USEFUL",
      positionV: "POTENTIALLY USEFUL",
      posOffset: "RENDERER-DEPENDENT",
      align: "RENDERER-DEPENDENT",
      relativeFrom: "POTENTIALLY USEFUL",
      wrapNone: "RENDERER-DEPENDENT",
      wrapSquare: "RENDERER-DEPENDENT",
      wrapTight: "RENDERER-DEPENDENT",
      wrapThrough: "RENDERER-DEPENDENT",
      wrapTopAndBottom: "RENDERER-DEPENDENT",
      distT: "RENDERER-DEPENDENT",
      distB: "RENDERER-DEPENDENT",
      distL: "RENDERER-DEPENDENT",
      distR: "RENDERER-DEPENDENT",
      behindDoc: "NOT RELEVANT TO CURRENT RULES",
      relativeHeight: "NOT RELEVANT TO CURRENT RULES",
      allowOverlap: "NOT RELEVANT TO CURRENT RULES",
      layoutInCell: "POTENTIALLY USEFUL",
      simplePos: "RENDERER-DEPENDENT",
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

function compactCase(item) {
  return {
    label: item.label,
    representations: item.representations.map((representation) => ({
      kind: representation.kind,
      drawingType: representation.drawingType,
      scope: representation.scope,
      academicScope: representation.academicScope.scope,
      blockIndex: representation.blockIndex,
      paragraphIndex: representation.paragraphIndex,
    })),
    associations: item.associations.map((association) => ({
      status: association.status,
      candidateCaptionIds: association.candidateCaptionIds,
      reasons: association.reasons,
    })),
    resolutions: item.resolutions.map((resolution) => ({
      status: resolution.status,
      academicType: resolution.academicType,
    })),
    legacyFigures: item.legacyFigures.map((figure) => ({
      drawingType: figure.drawingType,
      alignment: figure.alignment,
      captionPosition: figure.captionPosition,
    })),
    diagnostics: item.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      drawingType: diagnostic.drawingType,
      representationKind: diagnostic.representationKind,
      academicScope: diagnostic.academicScope,
    })),
    ruleStatuses: Object.fromEntries(
      Object.entries(item.rules).map(([key, value]) => [key, value.status]),
    ),
  };
}

function summarize(label, document) {
  const results = new RuleEngine().run(document, OBJECT_RULES);
  return {
    label,
    representations: document.objectSemantics.representations.map((item) => ({
      id: item.id,
      kind: item.kind,
      drawingType: item.drawingType,
      scope: item.scope,
      academicScope: item.academicScope,
      paragraphId: item.paragraphId,
      paragraphIndex: item.paragraphIndex,
      blockIndex: item.blockIndex,
      evidence: item.evidence,
    })),
    captions: document.objectSemantics.captions.map((item) => ({
      id: item.id,
      rawText: item.rawText,
      blockIndex: item.blockIndex,
      semantic: item.semantic,
      isOrphan: item.isOrphan,
    })),
    associations: document.objectSemantics.associations,
    resolutions: document.objectSemantics.resolutions,
    legacyFigures: document.figures.items.map((item) => ({
      id: item.id,
      drawingType: item.drawingType,
      paragraphId: item.paragraphId,
      paragraphIndex: item.paragraphIndex,
      blockIndex: item.blockIndex,
      alignment: item.alignment,
      alignmentSource: item.alignmentSource,
      captionId: item.captionId,
      captionPosition: item.captionPosition,
    })),
    diagnostics: buildAnalysisDiagnostics(document.objectSemantics).map((item) => ({
      code: item.code,
      severity: item.severity,
      associationStatus: item.associationStatus,
      representationKind: item.representationKind,
      drawingType: item.evidence.drawingType,
      academicScope: item.evidence.academicScope,
      reasons: item.evidence.associationReasons,
    })),
    rules: summarizeRules(results),
  };
}

function summarizeRules(results) {
  return {
    figureObjectAlignment: pick(results, "figure-object-alignment"),
    figureCaptionPlacement: pick(results, "figure-caption-placement"),
    figureCaptionFormat: pick(results, "figure-caption-format"),
    figureInTextReference: pick(results, "figure-in-text-reference"),
    listOfFigures: pick(results, "list-of-figures"),
    tableObjectAlignment: pick(results, "table-object-alignment"),
    tableCaptionPlacement: pick(results, "table-caption-placement"),
    tableCaptionFormat: pick(results, "table-caption-format"),
    tableInTextReference: pick(results, "table-in-text-reference"),
    listOfTables: pick(results, "list-of-tables"),
  };
}

function pick(results, suffix) {
  const result = results.find((item) => item.ruleId.endsWith(suffix));
  if (!result) throw new Error(`Missing rule result: ${suffix}`);
  return {
    status: result.status,
    actual: result.actual,
    message: result.message,
    evidenceTotal: result.evidenceTotal ?? 0,
  };
}

function scopedDocument(content) {
  const parsed = parseDocumentXml(documentXml(content));
  const marked = markRequiredSectionHeadings(parsed, RULES);
  const headed = normalizeDocumentHeadings(marked, RULES);
  return normalizeAcademicDocumentScopes(headed, RULES);
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
  return [
    '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr>',
    `<w:r><w:t>${text}</w:t></w:r></w:p>`,
  ].join("");
}

function inlinePicture() {
  return [
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline>',
    '<wp:docPr id="1" name="Inline Picture"/>',
    pictureGraphic(),
    '</wp:inline></w:drawing></w:r></w:p>',
  ].join("");
}

function anchorPicture(options = {}) {
  return anchorDrawing(pictureGraphic(), options);
}

function anchorChart(options = {}) {
  return anchorDrawing('<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart/></a:graphicData></a:graphic>', options);
}

function anchorDiagram(options = {}) {
  return anchorDrawing('<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds/></a:graphicData></a:graphic>', options);
}

function anchorGroup(options = {}) {
  return anchorDrawing('<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp/></a:graphicData></a:graphic>', options);
}

function anchorTextbox(options = {}) {
  return anchorDrawing('<a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>Textbox</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic>', options);
}

function anchorDrawing(graphic, options = {}) {
  return `<w:p>${anchorRun(graphic, options)}</w:p>`;
}

function anchorRun(graphic, options = {}) {
  const positionH = options.positionH ?? { relativeFrom: "column", align: "center" };
  const positionV = options.positionV ?? { relativeFrom: "paragraph", value: "0" };
  const wrap = options.wrap ?? '<wp:wrapSquare wrapText="bothSides"/>';
  return [
    '<w:r>',
    options.prefixText ? `<w:t>${options.prefixText}</w:t>` : "",
    '<w:drawing><wp:anchor simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1" distT="0" distB="0" distL="114300" distR="114300">',
    '<wp:simplePos x="0" y="0"/>',
    `<wp:positionH relativeFrom="${positionH.relativeFrom}"><wp:align>${positionH.align}</wp:align></wp:positionH>`,
    `<wp:positionV relativeFrom="${positionV.relativeFrom}"><wp:posOffset>${positionV.value}</wp:posOffset></wp:positionV>`,
    '<wp:extent cx="1828800" cy="914400"/>',
    wrap,
    '<wp:docPr id="2" name="Anchor Object"/>',
    graphic,
    '</wp:anchor></w:drawing></w:r>',
  ].join("");
}

function pictureGraphic() {
  return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>';
}

function alternateContent(choice, fallback) {
  return [
    '<mc:AlternateContent>',
    `<mc:Choice Requires="wp">${choice}</mc:Choice>`,
    `<mc:Fallback>${fallback}</mc:Fallback>`,
    '</mc:AlternateContent>',
  ].join("");
}

function deletedAnchor() {
  return `<w:p><w:del w:id="1">${anchorRun(pictureGraphic())}</w:del></w:p>`;
}

function moveFromAnchor() {
  return `<w:p><w:moveFrom w:id="3">${anchorRun(pictureGraphic())}</w:moveFrom></w:p>`;
}

function movedVisibleAnchor() {
  return `<w:p><w:moveTo w:id="2">${anchorRun(pictureGraphic())}</w:moveTo></w:p>`;
}

function tableCellAnchor() {
  return [
    '<w:tbl><w:tr><w:tc>',
    anchorPicture(),
    '</w:tc></w:tr></w:tbl>',
  ].join("");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(`${message}: expected value different from ${expected}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
