const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");

const {
  parseDocumentXml,
} = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  isRunVisibleInCurrentDocument,
} = require("../../src/features/analysis/parsers/revisionVisibility.ts");

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TRACKED_MOVE_FIXTURE = "tests/fixtures/comu/food-technology/experimental/tracked-move-synthetic.docx";
const TRACKED_MOVE_SEMANTIC_FIXTURE =
  "tests/fixtures/comu/food-technology/experimental/tracked-move-semantic-collision-synthetic.docx";
const MOVED_TEXT = "TG_MOVED_TEXT";
const SECTION_TEXT = "KAYNAKLAR";

async function main() {
  assertDirectVisibilityPolicy();
  assertParsedVisibilityPolicy();
  await assertTrackedMoveFixtures();

  console.log("Revision visibility regression passed.");
}

function assertDirectVisibilityPolicy() {
  const document = parseXml(bodyXml(
    paragraphXml(
      runXml("normal") +
      revisionXml("del", runXml("deleted")) +
      revisionXml("ins", runXml("inserted")) +
      revisionXml("moveFrom", runXml("moved source")) +
      revisionXml("moveTo", runXml("moved destination")) +
      revisionXml("moveFrom", hyperlinkXml(runXml("source link"))) +
      revisionXml("moveTo", hyperlinkXml(runXml("destination link"))) +
      hyperlinkXml(revisionXml("moveFrom", runXml("nested source"))) +
      hyperlinkXml(revisionXml("moveTo", runXml("nested destination"))),
    ),
  ));
  const runs = Array.from(document.getElementsByTagNameNS(WORD_NAMESPACE, "r"));
  const visibilityByText = new Map(
    runs.map((run) => [extractRunText(run), isRunVisibleInCurrentDocument(run)]),
  );

  assertEqual(visibilityByText.get("normal"), true, "normal run visible");
  assertEqual(visibilityByText.get("deleted"), false, "w:del run invisible");
  assertEqual(visibilityByText.get("inserted"), true, "w:ins run visible");
  assertEqual(visibilityByText.get("moved source"), false, "w:moveFrom run invisible");
  assertEqual(visibilityByText.get("moved destination"), true, "w:moveTo run visible");
  assertEqual(visibilityByText.get("source link"), false, "moveFrom hyperlink run invisible");
  assertEqual(visibilityByText.get("destination link"), true, "moveTo hyperlink run visible");
  assertEqual(visibilityByText.get("nested source"), false, "moveFrom inside hyperlink invisible");
  assertEqual(visibilityByText.get("nested destination"), true, "moveTo inside hyperlink visible");
}

function assertParsedVisibilityPolicy() {
  const document = parseDocumentXml(bodyXml(
    paragraphXml(
      runXml("normal ") +
      revisionXml("del", runXml("deleted ")) +
      revisionXml("ins", runXml("inserted ")) +
      revisionXml("moveFrom", runXml("moved source ")) +
      revisionXml("moveTo", runXml("moved destination ")) +
      revisionXml("moveFrom", hyperlinkXml(runXml("source link "))) +
      revisionXml("moveTo", hyperlinkXml(runXml("destination link "))) +
      hyperlinkXml(revisionXml("moveFrom", runXml("nested source "))) +
      hyperlinkXml(revisionXml("moveTo", runXml("nested destination"))),
    ),
  ));
  const paragraph = document.paragraphs[0];

  assertEqual(
    paragraph.text,
    "normal inserted moved destination destination link nested destination",
    "current-document paragraph reconstruction",
  );
  assertEqual(paragraph.runs.length, 5, "current-document visible run count");
}

async function assertTrackedMoveFixtures() {
  const base = await runAnalysisFixture(TRACKED_MOVE_FIXTURE);
  const baseParagraph = base.document.paragraphs.find((paragraph) =>
    paragraph.text.includes(MOVED_TEXT),
  );

  assert(baseParagraph !== undefined, "tracked move marker paragraph exists");
  assertEqual(countRunOccurrences(base.document, MOVED_TEXT), 1, "moved marker normalized once");
  assertEqual(baseParagraph.text.endsWith(` ${MOVED_TEXT}`), true, "moveTo marker remains visible");
  assertEqual(base.report.passedRules, 46, "tracked move base fixture passed rules");
  assertEqual(base.report.failedRules, 0, "tracked move base fixture failed rules");

  const semantic = await runAnalysisFixture(TRACKED_MOVE_SEMANTIC_FIXTURE);
  const sectionParagraphs = semantic.document.paragraphs.filter(
    (paragraph) => paragraph.text === SECTION_TEXT,
  );
  const sectionFacts = semantic.document.sections.filter(
    (section) => section.displayName === SECTION_TEXT,
  );

  assertEqual(countRunOccurrences(semantic.document, SECTION_TEXT), 1, "semantic marker normalized once");
  assertEqual(sectionParagraphs.length, 1, "inactive moveFrom semantic marker absent");
  assertEqual(sectionFacts.length, 1, "active moveTo semantic marker present");
  assertEqual(semantic.report.totalRules, 46, "semantic fixture total rules");
  assertEqual(semantic.report.passedRules, 46, "semantic fixture passed rules");
  assertEqual(semantic.report.failedRules, 0, "semantic fixture failed rules");
  assertEqual(semantic.report.notApplicableRules, 0, "semantic fixture N/A rules");
}

function parseXml(xml) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function bodyXml(content) {
  return [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<w:body>",
    content,
    "</w:body>",
    "</w:document>",
  ].join("");
}

function paragraphXml(content) {
  return `<w:p>${content}</w:p>`;
}

function revisionXml(localName, content) {
  return `<w:${localName} w:id="1" w:author="ThesisGuard Test" w:date="2026-09-13T00:00:00Z">${content}</w:${localName}>`;
}

function hyperlinkXml(content) {
  return `<w:hyperlink r:id="rIdVisibility">${content}</w:hyperlink>`;
}

function runXml(text) {
  return `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function extractRunText(run) {
  return Array.from(run.getElementsByTagNameNS(WORD_NAMESPACE, "t"))
    .map((textElement) => textElement.textContent ?? "")
    .join("");
}

function countRunOccurrences(document, marker) {
  return document.paragraphs.reduce(
    (total, paragraph) => total + paragraph.runs.filter((run) => run.text.includes(marker)).length,
    0,
  );
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
