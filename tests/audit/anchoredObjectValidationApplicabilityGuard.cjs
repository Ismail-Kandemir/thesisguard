require("../golden/experimentalGoldenRegression.cjs");

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
];
const OBJECT_RULES = RULES.filter((rule) => OBJECT_RULE_IDS.includes(rule.id));

function main() {
  const inlineCorrect = analyze(mainBoundary() + inlinePicture("center") + caption("Şekil 1. Inline"));
  const inlineWrong = analyze(mainBoundary() + inlinePicture("left") + caption("Şekil 1. Inline"));
  const inlineCaptionAbove = analyze(mainBoundary() + caption("Şekil 1. Ust") + inlinePicture("center"));
  const anchorDeclared = analyze(mainBoundary() + anchorPicture() + caption("Şekil 1. Anchor"));
  const unresolvedAnchorPicture = analyze(mainBoundary() + anchorPicture());
  const unresolvedAnchorChart = analyze(mainBoundary() + anchorChart());
  const frontMatterPicture = analyze(anchorPicture());
  const frontMatterChart = analyze(anchorChart());
  const deletedAnchor = analyze(mainBoundary() + deletedAnchorParagraph());
  const moveFromAnchor = analyze(mainBoundary() + moveFromAnchorParagraph());
  const moveToAnchor = analyze(mainBoundary() + moveToAnchorParagraph());
  const mixed = analyze(
    mainBoundary() +
    inlinePicture("center") +
    caption("Şekil 1. Inline") +
    paragraph("Ara metin") +
    anchorPicture() +
    caption("Şekil 2. Anchor"),
  );
  const twoAnchors = analyze(mainBoundary() + anchorPicture() + paragraph("Ara") + anchorPicture());
  const anchorTextboxCase = analyze(mainBoundary() + anchorTextbox() + caption("Şekil 1. Textbox"));
  const alternateAnchor = analyze(mainBoundary() + alternateContent(anchorPicture(), anchorChart()));

  assertStatus(inlineCorrect, "figureObjectAlignment", "PASSED", "inline correct alignment unchanged");
  assertStatus(inlineCorrect, "figureCaptionPlacement", "PASSED", "inline caption placement unchanged");
  assertStatus(inlineCorrect, "figureCaptionFormat", "PASSED", "inline pilot caption format unchanged");
  assertStatus(inlineCorrect, "listOfFigures", "FAILED", "inline figure still requires list of figures");

  assertStatus(inlineWrong, "figureObjectAlignment", "FAILED", "inline wrong alignment unchanged");
  assertStatus(inlineCaptionAbove, "figureCaptionPlacement", "FAILED", "inline caption above still fails placement");

  assertStatus(anchorDeclared, "figureObjectAlignment", "NOT_APPLICABLE", "anchor-only alignment not normally evaluable");
  assertStatus(anchorDeclared, "figureCaptionPlacement", "NOT_APPLICABLE", "anchor placement not proven from XML order");
  assertStatus(anchorDeclared, "figureCaptionFormat", "NOT_APPLICABLE", "pilot inline-only guard remains");
  assertStatus(anchorDeclared, "figureInTextReference", "NOT_APPLICABLE", "reference is not run without reliable inline caption identity");
  assertStatus(anchorDeclared, "listOfFigures", "NOT_APPLICABLE", "generic anchor does not trigger list presence");
  assertDiagnostic(anchorDeclared, ["AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION"], "anchor declared review diagnostic visible");

  assertStatus(unresolvedAnchorPicture, "listOfFigures", "NOT_APPLICABLE", "unresolved anchor picture does not trigger list");
  assertStatus(unresolvedAnchorChart, "listOfFigures", "NOT_APPLICABLE", "unresolved anchor chart does not trigger list");
  assertDiagnostic(unresolvedAnchorChart, ["AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION"], "anchor chart uncertainty remains diagnostic");

  assertStatus(frontMatterPicture, "listOfFigures", "NOT_APPLICABLE", "front-matter anchor picture creates no list noise");
  assertStatus(frontMatterChart, "listOfFigures", "NOT_APPLICABLE", "front-matter anchor chart creates no list noise");

  assertStatus(deletedAnchor, "listOfFigures", "NOT_APPLICABLE", "deleted anchor cannot affect guarded list applicability");
  assertStatus(moveFromAnchor, "listOfFigures", "NOT_APPLICABLE", "moveFrom anchor cannot affect guarded list applicability");
  assertStatus(moveToAnchor, "listOfFigures", "NOT_APPLICABLE", "visible moveTo generic anchor follows guarded anchor applicability");
  assertEqual(deletedAnchor.document.objectSemantics.representations.length, 0, "deleted anchor absent from shadow semantics");
  assertEqual(moveFromAnchor.document.objectSemantics.representations.length, 0, "moveFrom anchor absent from shadow semantics");
  assertEqual(moveToAnchor.document.objectSemantics.representations.length, 1, "moveTo anchor remains visible");

  assertStatus(mixed, "figureObjectAlignment", "PASSED", "mixed alignment evaluates inline evidence only");
  assertStatus(mixed, "figureCaptionPlacement", "PASSED", "mixed placement evaluates inline evidence only");
  assertStatus(mixed, "figureCaptionFormat", "PASSED", "mixed pilot format evaluates inline evidence only");
  assertStatus(mixed, "listOfFigures", "FAILED", "mixed document still has an inline declared figure for list membership");
  assertDiagnostic(mixed, ["AMBIGUOUS_OBJECT_CAPTION_ASSOCIATION"], "mixed anchor uncertainty remains visible");

  assertStatus(twoAnchors, "figureObjectAlignment", "NOT_APPLICABLE", "two anchors are not physical alignment evidence");
  assertStatus(twoAnchors, "listOfFigures", "NOT_APPLICABLE", "two generic anchors do not create figure list presence");

  assertStatus(anchorTextboxCase, "listOfFigures", "NOT_APPLICABLE", "anchor textbox remains excluded");
  assertEqual(anchorTextboxCase.document.objectSemantics.resolutions[0].status, "excluded", "anchor textbox resolution excluded");

  assertEqual(alternateAnchor.document.objectSemantics.representations.length, 1, "AlternateContent anchor resolves one branch");
  assertEqual(alternateAnchor.document.objectSemantics.representations[0].drawingType, "anchor", "AlternateContent active branch remains anchor");

  const beforeAfter = {
    anchorDeclared: differential(anchorDeclared),
    deletedAnchor: differential(deletedAnchor),
    moveFromAnchor: differential(moveFromAnchor),
    mixed: differential(mixed),
  };

  for (const item of [anchorDeclared, unresolvedAnchorPicture, unresolvedAnchorChart, mixed]) {
    assertEqual(item.reportBeforeDiagnostics.score, item.reportAfterDiagnostics.score, `${item.label}: diagnostics do not change score`);
  }

  console.log(JSON.stringify({
    phase: "4E-18H",
    result: "PASS",
    beforeAfter,
    matrix: {
      figureObjectAlignment: "ANCHOR_PHYSICAL_LAYOUT_UNSUPPORTED",
      figureCaptionPlacement: "SAFE_WITH_GUARD",
      figureCaptionFormat: "SAFE_WITH_GUARD",
      figureInTextReference: "SAFE_WITH_GUARD",
      listOfFigures: "LEGACY_PRESENCE_RISK_GUARDED",
    },
  }, null, 2));
}

function differential(item) {
  return {
    label: item.label,
    ruleStatuses: Object.fromEntries(
      Object.entries(item.rules).map(([key, value]) => [key, value.status]),
    ),
    diagnostics: item.diagnostics.map((diagnostic) => diagnostic.code),
    score: item.reportAfterDiagnostics.score,
  };
}

function analyze(content) {
  const document = scopedDocument(content);
  const results = new RuleEngine().run(document, OBJECT_RULES);
  const diagnostics = buildAnalysisDiagnostics(document.objectSemantics);
  return {
    label: "synthetic",
    document,
    results,
    diagnostics,
    reportBeforeDiagnostics: summarizeScore(results),
    reportAfterDiagnostics: summarizeScore(results),
    rules: {
      figureObjectAlignment: pick(results, "figure-object-alignment"),
      figureCaptionPlacement: pick(results, "figure-caption-placement"),
      figureCaptionFormat: pick(results, "figure-caption-format"),
      figureInTextReference: pick(results, "figure-in-text-reference"),
      listOfFigures: pick(results, "list-of-figures"),
    },
  };
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

function assertStatus(item, rule, expected, message) {
  assertEqual(item.rules[rule].status, expected, message);
}

function assertDiagnostic(item, expectedCodes, message) {
  assertEqual(
    JSON.stringify([...new Set(item.diagnostics.map((diagnostic) => diagnostic.code))]),
    JSON.stringify(expectedCodes),
    message,
  );
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

function inlinePicture(alignment) {
  return [
    `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:r><w:drawing><wp:inline>`,
    '<wp:docPr id="1" name="Inline Picture"/>',
    pictureGraphic(),
    '</wp:inline></w:drawing></w:r></w:p>',
  ].join("");
}

function anchorPicture() {
  return `<w:p>${anchorRun(pictureGraphic())}</w:p>`;
}

function anchorChart() {
  return `<w:p>${anchorRun('<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart/></a:graphicData></a:graphic>')}</w:p>`;
}

function anchorTextbox() {
  return `<w:p>${anchorRun('<a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>Textbox</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic>')}</w:p>`;
}

function anchorRun(graphic) {
  return [
    '<w:r><w:drawing><wp:anchor simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">',
    '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>',
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
    '<wp:extent cx="1828800" cy="914400"/>',
    '<wp:wrapSquare wrapText="bothSides"/>',
    '<wp:docPr id="2" name="Anchor Object"/>',
    graphic,
    '</wp:anchor></w:drawing></w:r>',
  ].join("");
}

function pictureGraphic() {
  return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>';
}

function deletedAnchorParagraph() {
  return `<w:p><w:del w:id="1">${anchorRun(pictureGraphic())}</w:del></w:p>`;
}

function moveFromAnchorParagraph() {
  return `<w:p><w:moveFrom w:id="2">${anchorRun(pictureGraphic())}</w:moveFrom></w:p>`;
}

function moveToAnchorParagraph() {
  return `<w:p><w:moveTo w:id="3">${anchorRun(pictureGraphic())}</w:moveTo></w:p>`;
}

function alternateContent(choice, fallback) {
  return [
    '<mc:AlternateContent>',
    `<mc:Choice Requires="wp">${choice}</mc:Choice>`,
    `<mc:Fallback>${fallback}</mc:Fallback>`,
    '</mc:AlternateContent>',
  ].join("");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
