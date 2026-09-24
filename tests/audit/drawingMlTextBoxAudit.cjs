const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");
const {
  getDeclaredAcademicFigures,
} = require("../../src/features/analysis/rules/objectApplicability.ts");

const FIXTURE_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
);
const SOURCE_DOCX = path.join(FIXTURE_DIR, "full-correct.docx");
const OWNERSHIP_DOCX = path.join(FIXTURE_DIR, "drawingml-textbox-ownership-synthetic.docx");
const FONT_SIZE_DOCX = path.join(FIXTURE_DIR, "drawingml-textbox-font-size-synthetic.docx");
const SEMANTIC_DOCX = path.join(FIXTURE_DIR, "drawingml-textbox-semantic-collision-synthetic.docx");
const OWNERSHIP_TEXT = "DrawingML textbox diagnostic content";
const FONT_SIZE_TEXT = "DrawingML textbox 11pt diagnostic content";
const SECTION_TEXT = "KAYNAKLAR";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";
const SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order";
const FIGURE_ALIGNMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment";
const FIGURE_CAPTION_PLACEMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement";

async function main() {
  await createFixtures();

  const summaries = [
    await inspectRuntime(OWNERSHIP_DOCX, OWNERSHIP_TEXT, {
      expectedTotalOccurrences: 1,
      expectedDocumentOwnedOccurrences: 0,
    }),
    await inspectRuntime(FONT_SIZE_DOCX, FONT_SIZE_TEXT, {
      expectedTotalOccurrences: 1,
      expectedDocumentOwnedOccurrences: 0,
    }),
    await inspectRuntime(SEMANTIC_DOCX, SECTION_TEXT, {
      expectedTotalOccurrences: 2,
      expectedDocumentOwnedOccurrences: 1,
    }),
  ];

  console.log(JSON.stringify(summaries, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);

  await createFixture(source, OWNERSHIP_DOCX, {
    text: OWNERSHIP_TEXT,
    halfPoints: 24,
  });
  await createFixture(source, FONT_SIZE_DOCX, {
    text: FONT_SIZE_TEXT,
    halfPoints: 22,
  });
  await createFixture(source, SEMANTIC_DOCX, {
    text: SECTION_TEXT,
    halfPoints: 24,
  });
}

async function createFixture(source, targetPath, options) {
  const zip = await JSZip.loadAsync(source);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("word/document.xml bulunamadi.");

  const documentXml = await documentFile.async("string");
  const mutatedXml = insertAfterAcademicBodyParagraph(
    documentXml,
    createDrawingMlTextboxParagraphXml(options),
  );

  zip.file("word/document.xml", mutatedXml);
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
}

function insertAfterAcademicBodyParagraph(documentXml, carrierParagraphXml) {
  const paragraphMatch = findParagraphContainingText(documentXml, "DNA analizi");
  if (!paragraphMatch) throw new Error("Hedef akademik govde paragrafi bulunamadi.");

  return (
    documentXml.slice(0, paragraphMatch.end) +
    carrierParagraphXml +
    documentXml.slice(paragraphMatch.end)
  );
}

function createDrawingMlTextboxParagraphXml({ text, halfPoints }) {
  return [
    '<w:p>',
    '<w:pPr><w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="0"/><w:ind w:firstLine="850"/><w:jc w:val="both"/></w:pPr>',
    '<w:r>',
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr>',
    '<w:drawing>',
    '<wp:inline distT="0" distB="0" distL="0" distR="0">',
    '<wp:extent cx="2540000" cy="508000"/>',
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
    '<wp:docPr id="9001" name="drawingml-textbox-audit"/>',
    '<wp:cNvGraphicFramePr/>',
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">',
    '<wps:wsp>',
    '<wps:cNvSpPr txBox="1"/>',
    '<wps:spPr>',
    '<a:xfrm><a:off x="0" y="0"/><a:ext cx="2540000" cy="508000"/></a:xfrm>',
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
    '<a:noFill/>',
    '<a:ln><a:noFill/></a:ln>',
    '</wps:spPr>',
    '<wps:txbx>',
    '<w:txbxContent>',
    '<w:p>',
    '<w:pPr><w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="0"/><w:ind w:firstLine="850"/><w:jc w:val="both"/></w:pPr>',
    '<w:r>',
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${halfPoints}"/></w:rPr>`,
    `<w:t>${escapeXml(text)}</w:t>`,
    '</w:r>',
    '</w:p>',
    '</w:txbxContent>',
    '</wps:txbx>',
    '<wps:bodyPr/>',
    '</wps:wsp>',
    '</a:graphicData>',
    '</a:graphic>',
    '</wp:inline>',
    '</w:drawing>',
    '</w:r>',
    '</w:p>',
  ].join("");
}

function findParagraphContainingText(documentXml, expectedText) {
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphPattern.exec(documentXml)) !== null) {
    const paragraphXml = match[0];
    const text = Array.from(paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");

    if (text.includes(expectedText)) {
      return {
        start: match.index,
        end: match.index + paragraphXml.length,
      };
    }
  }

  return null;
}

async function inspectRuntime(fixturePath, textboxText, expected) {
  const ooxml = await inspectFixtureOoxml(fixturePath);
  const { document, report } = await runAnalysisFixture(fixturePath);
  const paragraphsWithTextboxText = document.paragraphs
    .map((paragraph, index) => summarizeParagraph(paragraph, index))
    .filter((paragraph) => paragraph.text.includes(textboxText));
  const innerTextboxParagraphs = paragraphsWithTextboxText.filter(
    (paragraph) => paragraph.contentScope === "textbox",
  );
  const outerCarrierParagraph = innerTextboxParagraphs[0]
    ? summarizeParagraph(
        document.paragraphs[innerTextboxParagraphs[0].index - 1],
        innerTextboxParagraphs[0].index - 1,
      )
    : null;
  const fontSizeResult = report.results.find((result) => result.ruleId === FONT_SIZE_RULE_ID);
  const sectionOrderResult = report.results.find((result) =>
    result.ruleId === SECTION_ORDER_RULE_ID,
  );
  const figureAlignmentResult = report.results.find((result) =>
    result.ruleId === FIGURE_ALIGNMENT_RULE_ID,
  );
  const figureCaptionPlacementResult = report.results.find((result) =>
    result.ruleId === FIGURE_CAPTION_PLACEMENT_RULE_ID,
  );
  const objectRepresentations = document.objectSemantics.representations.map((representation) => ({
    id: representation.id,
    kind: representation.kind,
    scope: representation.scope,
    paragraphId: representation.paragraphId,
    paragraphIndex: representation.paragraphIndex,
    blockIndex: representation.blockIndex,
    drawingType: representation.drawingType,
    alignment: representation.alignment,
    alignmentSource: representation.alignmentSource,
  }));
  const textboxOwnedRepresentations = objectRepresentations.filter(
    (representation) =>
      representation.kind === "textbox" &&
      representation.paragraphIndex === outerCarrierParagraph?.index,
  );
  const textboxOwnedRepresentationIds = new Set(
    textboxOwnedRepresentations.map((representation) => representation.id),
  );
  const textboxOwnedResolutions = document.objectSemantics.resolutions.filter((resolution) =>
    textboxOwnedRepresentationIds.has(resolution.objectId),
  );
  const declaredAcademicFigureIds = new Set(
    getDeclaredAcademicFigures(document).map((figure) => figure.representation.id),
  );
  const pictureRepresentations = objectRepresentations.filter((representation) => representation.kind === "picture");
  const matchingSections = document.sections
    .filter((section) => section.displayName.includes(textboxText))
    .map((section) => ({
      displayName: section.displayName,
      paragraphIndex: section.paragraphIndex,
      isRuleDefinedHeading: section.isRuleDefinedHeading,
    }));
  const summary = {
    fixture: path.relative(process.cwd(), fixturePath),
    ooxml,
    normalizedTextboxTextOccurrences: paragraphsWithTextboxText.length,
    textboxOwnedOccurrences: innerTextboxParagraphs.length,
    documentOwnedOccurrences: paragraphsWithTextboxText.length - innerTextboxParagraphs.length,
    outerCarrierParagraph,
    innerTextboxParagraphs,
    paragraphsWithTextboxText,
    objectRepresentations,
    pictureRepresentationCount: pictureRepresentations.length,
    textboxOwnedRepresentations,
    textboxOwnedResolutions,
    matchingSections,
    report: {
      total: report.totalRules,
      passed: report.passedRules,
      failed: report.failedRules,
      notApplicable: report.notApplicableRules,
      score: report.score,
    },
    failedResults: report.results
      .filter((result) => result.status === "FAILED")
      .map(summarizeResult),
    fontSizeResult: summarizeResult(fontSizeResult),
    sectionOrderResult: summarizeResult(sectionOrderResult),
    figureAlignmentResult: summarizeResult(figureAlignmentResult),
    figureCaptionPlacementResult: summarizeResult(figureCaptionPlacementResult),
  };

  assertDrawingMlOoxml(ooxml, fixturePath);
  assertEqual(paragraphsWithTextboxText.length, expected.expectedTotalOccurrences,
    `${fixturePath} textbox occurrence count`);
  assertEqual(innerTextboxParagraphs.length, 1, `${fixturePath} textbox-owned occurrence count`);
  assertEqual(
    summary.documentOwnedOccurrences,
    expected.expectedDocumentOwnedOccurrences,
    `${fixturePath} document-owned occurrence count`,
  );
  assert(outerCarrierParagraph !== null, `${fixturePath} outer carrier paragraph missing`);
  assert(!outerCarrierParagraph.text.includes(textboxText),
    `${fixturePath} outer paragraph leaked textbox text`);
  assert(!outerCarrierParagraph.runs.some((run) => run.text.includes(textboxText)),
    `${fixturePath} outer paragraph leaked textbox run`);
  assertEqual(innerTextboxParagraphs[0].text, textboxText, `${fixturePath} textbox paragraph text`);
  assertEqual(innerTextboxParagraphs[0].contentScope, "textbox", `${fixturePath} textbox scope`);
  assertEqual(innerTextboxParagraphs[0].runs.length, 1, `${fixturePath} textbox run count`);
  assertEqual(innerTextboxParagraphs[0].runs[0].text, textboxText, `${fixturePath} textbox run text`);
  assertEqual(pictureRepresentations.length, 1, `${fixturePath} picture representation count`);
  assertEqual(textboxOwnedRepresentations.length, 1, `${fixturePath} textbox-owned representation count`);
  assertEqual(textboxOwnedRepresentations[0].kind, "textbox", `${fixturePath} textbox representation kind`);
  assertEqual(textboxOwnedResolutions.length, 1, `${fixturePath} textbox-owned resolution count`);
  assertEqual(textboxOwnedResolutions[0].status, "excluded", `${fixturePath} textbox-owned resolution status`);
  assertEqual(textboxOwnedResolutions[0].academicType, null, `${fixturePath} textbox-owned academic type`);
  assert(
    !declaredAcademicFigureIds.has(textboxOwnedRepresentations[0].id),
    `${fixturePath} textbox representation must not be a declared academic figure`,
  );
  assert(
    pictureRepresentations.some((representation) => representation.alignment === "center"),
    `${fixturePath} normal picture representation detection`,
  );
  assertEqual(report.failedRules, 0, `${fixturePath} failed rule count`);
  assertEqual(fontSizeResult?.status, "PASSED", `${fixturePath} font-size status`);
  assertEqual(sectionOrderResult?.status, "PASSED", `${fixturePath} section-order status`);
  assertEqual(figureAlignmentResult?.status, "PASSED", `${fixturePath} figure alignment status`);
  assertEqual(figureCaptionPlacementResult?.status, "PASSED",
    `${fixturePath} figure caption placement status`);

  return summary;
}

function assertDrawingMlOoxml(ooxml, label) {
  assertEqual(ooxml.vmlTextboxCount, 0, `${label} v:textbox count`);
  assertAtLeast(ooxml.drawingCount, 1, `${label} w:drawing count`);
  assertAtLeast(ooxml.inlineCount + ooxml.anchorCount, 1, `${label} wp inline/anchor count`);
  assertAtLeast(ooxml.graphicCount, 1, `${label} a:graphic count`);
  assertAtLeast(ooxml.wordprocessingShapeCount, 1, `${label} wps:wsp count`);
  assertAtLeast(ooxml.wordprocessingShapeTextboxCount, 1, `${label} wps:txbx count`);
  assertEqual(ooxml.textBoxContentCount, 1, `${label} w:txbxContent count`);
  assertEqual(ooxml.textBoxParagraphs.length, 1, `${label} textbox paragraph count`);
}

function summarizeParagraph(paragraph, index) {
  return paragraph
    ? {
        index,
        id: paragraph.id,
        text: paragraph.text,
        contentScope: paragraph.contentScope,
        runs: paragraph.runs.map((run, runIndex) => ({
          runIndex,
          text: run.text,
          fontSize: run.fontSize,
          fontFamily: run.fontFamily,
        })),
        isInTableCell: paragraph.isInTableCell,
        isTableOfContentsEntry: paragraph.isTableOfContentsEntry,
        isEmpty: paragraph.isEmpty,
      }
    : null;
}

async function inspectFixtureOoxml(fixturePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentXml = await zip.file("word/document.xml").async("string");
  const textBoxContents = Array.from(documentXml.matchAll(/<w:txbxContent\b[\s\S]*?<\/w:txbxContent>/g));
  const textBoxParagraphs = textBoxContents.flatMap((match) =>
    Array.from(match[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)).map((paragraphMatch) => {
      const paragraphXml = paragraphMatch[0];
      const text = Array.from(paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
        .map((textMatch) => decodeXml(textMatch[1]))
        .join("");

      return {
        text,
        runCount: countMatches(paragraphXml, /<w:r\b/g),
        halfPointSizes: Array.from(paragraphXml.matchAll(/<w:sz w:val="([^"]+)"/g))
          .map((sizeMatch) => sizeMatch[1]),
      };
    }),
  );

  return {
    representation: "DrawingML WordprocessingShape textbox with w:txbxContent",
    drawingCount: countMatches(documentXml, /<w:drawing\b/g),
    inlineCount: countMatches(documentXml, /<wp:inline\b/g),
    anchorCount: countMatches(documentXml, /<wp:anchor\b/g),
    graphicCount: countMatches(documentXml, /<a:graphic\b/g),
    wordprocessingShapeCount: countMatches(documentXml, /<wps:wsp\b/g),
    wordprocessingShapeTextboxCount: countMatches(documentXml, /<wps:txbx\b/g),
    textBoxContentCount: textBoxContents.length,
    textBoxParagraphs,
    vmlTextboxCount: countMatches(documentXml, /<v:textbox\b/g),
    hasVmlShape: documentXml.includes("<v:shape"),
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

function countMatches(value, pattern) {
  return Array.from(value.matchAll(pattern)).length;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function assertAtLeast(actual, expected, label) {
  if (actual < expected) {
    throw new Error(`${label}: expected at least ${expected}, received ${actual}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
