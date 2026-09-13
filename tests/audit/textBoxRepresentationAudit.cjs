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
const TEXTBOX_FONT_SIZE_DOCX = path.join(FIXTURE_DIR, "textbox-font-size-synthetic.docx");
const TEXTBOX_SEMANTIC_DOCX = path.join(FIXTURE_DIR, "textbox-semantic-collision-synthetic.docx");
const TARGET_PARAGRAPH_TEXT =
  "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.";
const TEXTBOX_FONT_TEXT = "Textbox diagnostic content";
const TEXTBOX_SECTION_TEXT = "KAYNAKLAR";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";
const SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order";
const FIGURE_REFERENCE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference";

async function main() {
  await createFixtures();
  const summaries = [];

  for (const fixturePath of [TEXTBOX_FONT_SIZE_DOCX, TEXTBOX_SEMANTIC_DOCX]) {
    summaries.push(await inspectRuntime(fixturePath));
  }

  console.log(JSON.stringify(summaries, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);

  await createFixture(source, TEXTBOX_FONT_SIZE_DOCX, {
    text: TEXTBOX_FONT_TEXT,
    halfPoints: 22,
  });
  await createFixture(source, TEXTBOX_SEMANTIC_DOCX, {
    text: TEXTBOX_SECTION_TEXT,
    halfPoints: 24,
  });
}

async function createFixture(source, targetPath, options) {
  const zip = await JSZip.loadAsync(source);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("word/document.xml bulunamadi.");

  const documentXml = await documentFile.async("string");
  const mutatedXml = insertTextboxCarrierParagraph(documentXml, createTextboxParagraphXml(options));

  zip.file("word/document.xml", mutatedXml);
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
}

function insertTextboxCarrierParagraph(documentXml, carrierParagraphXml) {
  const paragraphMatch = findParagraphByText(documentXml, TARGET_PARAGRAPH_TEXT);
  if (!paragraphMatch) throw new Error("Hedef paragraf bulunamadi.");

  return (
    documentXml.slice(0, paragraphMatch.end) +
    carrierParagraphXml +
    documentXml.slice(paragraphMatch.end)
  );
}

function createTextboxParagraphXml({ text, halfPoints }) {
  return [
    '<w:p>',
    '<w:pPr><w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="0"/><w:ind w:firstLine="850"/><w:jc w:val="both"/></w:pPr>',
    '<w:r>',
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr>',
    '<w:pict>',
    '<v:shape id="textbox-audit-shape" type="#_x0000_t202" style="position:absolute;width:200pt;height:40pt">',
    '<v:textbox>',
    '<w:txbxContent>',
    '<w:p>',
    '<w:pPr><w:spacing w:line="360" w:lineRule="auto" w:before="0" w:after="0"/><w:ind w:firstLine="850"/><w:jc w:val="both"/></w:pPr>',
    '<w:r>',
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${halfPoints}"/></w:rPr>`,
    `<w:t>${escapeXml(text)}</w:t>`,
    '</w:r>',
    '</w:p>',
    '</w:txbxContent>',
    '</v:textbox>',
    '</v:shape>',
    '</w:pict>',
    '</w:r>',
    '</w:p>',
  ].join("");
}

function findParagraphByText(documentXml, expectedText) {
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphPattern.exec(documentXml)) !== null) {
    const paragraphXml = match[0];
    const text = Array.from(paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");

    if (text === expectedText) {
      return {
        paragraphXml,
        start: match.index,
        end: match.index + paragraphXml.length,
      };
    }
  }

  return null;
}

async function inspectRuntime(fixturePath) {
  const ooxml = await inspectFixtureOoxml(fixturePath);
  const { document, report } = await runAnalysisFixture(fixturePath);
  const textboxText = fixturePath === TEXTBOX_FONT_SIZE_DOCX
    ? TEXTBOX_FONT_TEXT
    : TEXTBOX_SECTION_TEXT;
  const paragraphsWithTextboxText = document.paragraphs
    .map((paragraph, index) => ({
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
    }))
    .filter((paragraph) => paragraph.text.includes(textboxText));
  const innerTextboxParagraphs = paragraphsWithTextboxText.filter(
    (paragraph) => paragraph.contentScope === "textbox",
  );
  const outerCarrierParagraph = innerTextboxParagraphs[0]
    ? summarizeParagraph(document.paragraphs[innerTextboxParagraphs[0].index - 1], innerTextboxParagraphs[0].index - 1)
    : null;
  const fontSizeResult = report.results.find((result) => result.ruleId === FONT_SIZE_RULE_ID);
  const sectionOrderResult = report.results.find((result) =>
    result.ruleId === SECTION_ORDER_RULE_ID,
  );
  const figureReferenceResult = report.results.find((result) =>
    result.ruleId === FIGURE_REFERENCE_RULE_ID,
  );
  const figureReferences = document.objectReferences.items.filter(
    (item) => item.kind === "figure",
  );
  const matchingSections = document.sections
    .filter((section) => section.displayName.includes(textboxText))
    .map((section) => ({
      displayName: section.displayName,
      paragraphIndex: section.paragraphIndex,
      isRuleDefinedHeading: section.isRuleDefinedHeading,
    }));

  return {
    fixture: path.relative(process.cwd(), fixturePath),
    ooxml,
    normalizedTextboxTextOccurrences: paragraphsWithTextboxText.length,
    textboxOwnedOccurrences: innerTextboxParagraphs.length,
    documentOwnedOccurrences: paragraphsWithTextboxText.length - innerTextboxParagraphs.length,
    outerCarrierParagraph,
    innerTextboxParagraphs,
    paragraphsWithTextboxText,
    figureReferences,
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
    figureReferenceResult: summarizeResult(figureReferenceResult),
  };
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
        runCount: Array.from(paragraphXml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)).length,
        halfPointSizes: Array.from(paragraphXml.matchAll(/<w:sz w:val="([^"]+)"/g))
          .map((sizeMatch) => sizeMatch[1]),
      };
    }),
  );

  return {
    representation: "VML textbox with w:txbxContent",
    textBoxContentCount: textBoxContents.length,
    textBoxParagraphs,
    hasVmlShape: documentXml.includes("<v:shape"),
    hasDrawingMlShape: documentXml.includes("wps:txbx") || documentXml.includes("<a:txBody"),
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
