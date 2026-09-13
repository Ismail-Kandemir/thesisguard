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
const TRACKED_DELETED_FONT_DOCX = path.join(
  FIXTURE_DIR,
  "tracked-deleted-run-font-size-synthetic.docx",
);
const TRACKED_INSERTED_RUN_DOCX = path.join(
  FIXTURE_DIR,
  "tracked-inserted-run-synthetic.docx",
);
const TRACKED_DELETED_REFERENCE_DOCX = path.join(
  FIXTURE_DIR,
  "tracked-deleted-reference-synthetic.docx",
);
const TARGET_PARAGRAPH_TEXT =
  "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.";
const DELETED_FONT_TEXT = " silinmis takip degisikligi";
const INSERTED_TEXT = " eklenen gorunur metin";
const DELETED_REFERENCE_TEXT = " Şekil 99";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";

async function main() {
  await createFixtures();
  const summaries = [];

  for (const fixturePath of [
    TRACKED_DELETED_FONT_DOCX,
    TRACKED_INSERTED_RUN_DOCX,
    TRACKED_DELETED_REFERENCE_DOCX,
  ]) {
    summaries.push(await inspectRuntime(fixturePath));
  }

  console.log(JSON.stringify(summaries, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);
  await createFixture(source, TRACKED_DELETED_FONT_DOCX, createDeletedRunXml(DELETED_FONT_TEXT, 22));
  await createFixture(source, TRACKED_INSERTED_RUN_DOCX, createInsertedRunXml(INSERTED_TEXT, 24));
  await createFixture(source, TRACKED_DELETED_REFERENCE_DOCX, createDeletedRunXml(DELETED_REFERENCE_TEXT, 24));
}

async function createFixture(source, targetPath, revisionXml) {
  const zip = await JSZip.loadAsync(source);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("word/document.xml bulunamadi.");

  const documentXml = await documentFile.async("string");
  const mutatedXml = addRevisionToTargetParagraph(documentXml, revisionXml);

  zip.file("word/document.xml", mutatedXml);
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
}

function addRevisionToTargetParagraph(documentXml, revisionXml) {
  const paragraphMatch = findParagraphByText(documentXml, TARGET_PARAGRAPH_TEXT);
  if (!paragraphMatch) throw new Error("Hedef paragraf bulunamadi.");

  const mutatedParagraph = paragraphMatch.paragraphXml.replace(
    "</w:p>",
    `${revisionXml}</w:p>`,
  );

  return (
    documentXml.slice(0, paragraphMatch.start) +
    mutatedParagraph +
    documentXml.slice(paragraphMatch.end)
  );
}

function createDeletedRunXml(text, halfPoints) {
  return [
    '<w:del w:id="42" w:author="ThesisGuard Audit" w:date="2026-09-13T00:00:00Z">',
    createRunXml(text, halfPoints),
    '</w:del>',
  ].join("");
}

function createInsertedRunXml(text, halfPoints) {
  return [
    '<w:ins w:id="43" w:author="ThesisGuard Audit" w:date="2026-09-13T00:00:00Z">',
    createRunXml(text, halfPoints),
    '</w:ins>',
  ].join("");
}

function createRunXml(text, halfPoints) {
  return [
    '<w:r>',
    '<w:rPr>',
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>',
    `<w:sz w:val="${halfPoints}"/>`,
    '</w:rPr>',
    `<w:t>${escapeXml(text)}</w:t>`,
    '</w:r>',
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
  const targetParagraph = document.paragraphs.find((paragraph) =>
    paragraph.text.includes(TARGET_PARAGRAPH_TEXT),
  );
  const fontSizeResult = report.results.find((result) => result.ruleId === FONT_SIZE_RULE_ID);

  return {
    fixture: path.relative(process.cwd(), fixturePath),
    ooxml,
    normalizedTargetParagraph: targetParagraph
      ? {
          id: targetParagraph.id,
          text: targetParagraph.text,
          runs: targetParagraph.runs.map((run, index) => ({
            index,
            text: run.text,
            fontFamily: run.fontFamily,
            fontSize: run.fontSize,
          })),
        }
      : null,
    objectReferences: document.objectReferences.items.map((item) => ({
      kind: item.kind,
      number: item.number,
      paragraphIndex: item.paragraphIndex,
      matchedText: item.matchedText,
    })),
    report: {
      total: report.totalRules,
      passed: report.passedRules,
      failed: report.failedRules,
      notApplicable: report.notApplicableRules,
      score: report.score,
    },
    fontSizeResult: fontSizeResult
      ? {
          ruleId: fontSizeResult.ruleId,
          status: fontSizeResult.status,
          expected: fontSizeResult.expected,
          actual: fontSizeResult.actual,
          message: fontSizeResult.message,
          evidence: fontSizeResult.evidence ?? [],
          evidenceTotal: fontSizeResult.evidenceTotal,
        }
      : null,
  };
}

async function inspectFixtureOoxml(fixturePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentXml = await zip.file("word/document.xml").async("string");
  const deletedMatches = Array.from(documentXml.matchAll(/<w:del\b[\s\S]*?<\/w:del>/g));
  const insertedMatches = Array.from(documentXml.matchAll(/<w:ins\b[\s\S]*?<\/w:ins>/g));

  return {
    totalDeletedRanges: deletedMatches.length,
    totalInsertedRanges: insertedMatches.length,
    containsDeletedFontText: documentXml.includes(DELETED_FONT_TEXT),
    containsInsertedText: documentXml.includes(INSERTED_TEXT),
    containsDeletedReferenceText: documentXml.includes(DELETED_REFERENCE_TEXT),
    deletedFontSizeHalfPoints: documentXml.includes(DELETED_FONT_TEXT) ? 22 : null,
    insertedFontSizeHalfPoints: documentXml.includes(INSERTED_TEXT) ? 24 : null,
  };
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
