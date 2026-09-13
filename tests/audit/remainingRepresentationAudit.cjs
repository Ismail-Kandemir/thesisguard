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
const TRACKED_MOVE_DOCX = path.join(FIXTURE_DIR, "tracked-move-synthetic.docx");
const TRACKED_MOVE_SEMANTIC_DOCX = path.join(
  FIXTURE_DIR,
  "tracked-move-semantic-collision-synthetic.docx",
);

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TARGET_PARAGRAPH_TEXT = "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.";
const MOVED_TEXT = " TG_MOVED_TEXT";
const SECTION_TEXT = "KAYNAKLAR";
const SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";
const FIGURE_REFERENCE_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference";

async function main() {
  await createFixtures();

  const moveSummary = await inspectTrackedMoveFixture(TRACKED_MOVE_DOCX, {
    marker: MOVED_TEXT.trim(),
    expectedMoveFrom: 1,
    expectedMoveTo: 1,
  });
  const semanticSummary = await inspectTrackedMoveFixture(TRACKED_MOVE_SEMANTIC_DOCX, {
    marker: SECTION_TEXT,
    expectedMoveFrom: 1,
    expectedMoveTo: 1,
  });

  assertEqual(moveSummary.normalized.markerRunOccurrences, 1, "tracked move marker run occurrences");
  assertEqual(semanticSummary.normalized.markerRunOccurrences, 1,
    "tracked move semantic marker run occurrences");
  assertEqual(semanticSummary.report.failed, 0, "tracked move semantic failed rule count");
  assertEqual(semanticSummary.report.passed, 46, "tracked move semantic passed rule count");

  console.log(JSON.stringify({
    selectedTarget: "w:moveFrom / w:moveTo tracked move revisions",
    expectedLogicalSemantics:
      "Current-document semantics should not treat both the old moved source and current moved destination as simultaneously visible academic content.",
    riskRanking: createRiskRanking(),
    parserDiscovery: inspectParserDiscovery(),
    fixtureEvidence: [moveSummary, semanticSummary],
    wrapperDiagnostics: inspectWrapperDiagnostics(),
  }, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);
  await createTrackedMoveFixture(source);
  await createTrackedMoveSemanticFixture(source);
}

async function createTrackedMoveFixture(source) {
  const zip = await JSZip.loadAsync(source);
  const documentXml = await readDocumentXml(zip);
  const paragraphMatch = findParagraphByText(documentXml, TARGET_PARAGRAPH_TEXT);
  if (!paragraphMatch) throw new Error("Target paragraph not found.");

  const revisionXml = createMoveFromXml(MOVED_TEXT, 24) + createMoveToXml(MOVED_TEXT, 24);
  const mutatedParagraph = paragraphMatch.paragraphXml.replace("</w:p>", `${revisionXml}</w:p>`);

  zip.file("word/document.xml", splice(documentXml, paragraphMatch.start, paragraphMatch.end, mutatedParagraph));
  fs.writeFileSync(TRACKED_MOVE_DOCX, await zip.generateAsync({ type: "nodebuffer" }));
}

async function createTrackedMoveSemanticFixture(source) {
  const zip = await JSZip.loadAsync(source);
  const documentXml = await readDocumentXml(zip);
  const paragraphMatch = findParagraphByText(documentXml, SECTION_TEXT);
  if (!paragraphMatch) throw new Error("KAYNAKLAR paragraph not found.");

  const revisionXml = createMoveFromXml(SECTION_TEXT, 24) + createMoveToXml(SECTION_TEXT, 24);
  const mutatedParagraph = paragraphMatch.paragraphXml.replace(
    paragraphMatch.paragraphXml,
    paragraphXml(revisionXml),
  );

  zip.file("word/document.xml", splice(documentXml, paragraphMatch.start, paragraphMatch.end, mutatedParagraph));
  fs.writeFileSync(TRACKED_MOVE_SEMANTIC_DOCX, await zip.generateAsync({ type: "nodebuffer" }));
}

async function inspectTrackedMoveFixture(fixturePath, options) {
  const ooxml = await inspectTrackedMoveOoxml(fixturePath, options.marker);
  const { document, report } = await runAnalysisFixture(fixturePath);
  const markerParagraphs = findParagraphsContaining(document, options.marker);
  const sectionFacts = document.sections
    .filter((section) => section.displayName === SECTION_TEXT)
    .map((section) => ({
      displayName: section.displayName,
      paragraphId: section.paragraphId,
      paragraphIndex: section.paragraphIndex,
      isRuleDefinedHeading: section.isRuleDefinedHeading,
    }));

  assertEqual(ooxml.moveFromCount, options.expectedMoveFrom, `${fixturePath} moveFrom count`);
  assertEqual(ooxml.moveToCount, options.expectedMoveTo, `${fixturePath} moveTo count`);

  return {
    fixture: path.relative(process.cwd(), fixturePath),
    ooxml,
    normalized: {
      markerParagraphOccurrences: markerParagraphs.length,
      markerRunOccurrences: countRunOccurrences(document, options.marker),
      markerParagraphs,
      sectionFactCount: sectionFacts.length,
      sectionFacts,
      objectReferences: document.objectReferences.items,
      captions: document.captions.items.map((caption) => ({
        id: caption.id,
        kind: caption.kind,
        number: caption.number,
        paragraphIndex: caption.paragraphIndex,
        text: caption.text,
      })),
      figures: document.figures.items.map((figure) => ({
        id: figure.id,
        paragraphId: figure.paragraphId,
        paragraphIndex: figure.paragraphIndex,
        captionId: figure.captionId,
        captionPosition: figure.captionPosition,
      })),
    },
    report: summarizeReport(report),
    relevantRuleResults: [
      SECTION_ORDER_RULE_ID,
      FONT_SIZE_RULE_ID,
      FIGURE_REFERENCE_RULE_ID,
    ].map((ruleId) => summarizeResult(report.results.find((result) => result.ruleId === ruleId))),
    nonPassedResults: report.results
      .filter((result) => result.status !== "PASSED")
      .map(summarizeResult),
  };
}

function inspectWrapperDiagnostics() {
  return {
    hyperlink: summarizeSyntheticDocument(bodyXml(paragraphXml(
      '<w:hyperlink r:id="rIdHyperlinkAudit">' +
      runXml("DNA", 24) +
      runXml(" analizi", 24) +
      '</w:hyperlink>',
    )), "DNA analizi"),
    sdtContent: summarizeSyntheticDocument(bodyXml(
      '<w:sdt><w:sdtContent>' + paragraphXml(runXml("TG_SDT_TEXT", 24)) + '</w:sdtContent></w:sdt>',
    ), "TG_SDT_TEXT"),
    customXml: summarizeSyntheticDocument(bodyXml(
      '<w:customXml>' + paragraphXml(runXml("TG_CUSTOM_XML_TEXT", 24)) + '</w:customXml>',
    ), "TG_CUSTOM_XML_TEXT"),
    smartTag: summarizeSyntheticDocument(bodyXml(
      '<w:smartTag>' + paragraphXml(runXml("TG_SMARTTAG_TEXT", 24)) + '</w:smartTag>',
    ), "TG_SMARTTAG_TEXT"),
    simpleField: summarizeSyntheticDocument(bodyXml(paragraphXml(
      '<w:fldSimple w:instr="REF _RefFigure1 \\h">' +
      runXml("Şekil 1", 24) +
      '</w:fldSimple>',
    )), "Şekil 1"),
    comments: {
      bodyReference: summarizeSyntheticDocument(bodyXml(paragraphXml(
        runXml("Yorum işareti") +
        '<w:r><w:commentReference w:id="7"/></w:r>',
      )), "Yorum işareti"),
      packageReaderReadsCommentsXml: false,
      rationale: "readDocxAnalysisXmlParts has no comments.xml field; comment body text would be cross-part content.",
    },
  };
}

function summarizeSyntheticDocument(xml, marker) {
  const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
  const { normalizeDocumentObjectReferences } = require(
    "../../src/features/analysis/parsers/documentObjectReferencesNormalizer.ts"
  );
  const parsed = parseDocumentXml(xml);
  const document = {
    ...parsed,
    objectReferences: normalizeDocumentObjectReferences(parsed),
  };

  return {
    paragraphCount: document.paragraphs.length,
    markerParagraphOccurrences: document.paragraphs
      .filter((paragraph) => paragraph.text.includes(marker)).length,
    markerRunOccurrences: countRunOccurrences(document, marker),
    paragraphs: findParagraphsContaining(document, marker),
    objectReferences: document.objectReferences.items,
    sections: document.sections
      .filter((section) => section.displayName.includes(marker))
      .map((section) => ({
        displayName: section.displayName,
        paragraphIndex: section.paragraphIndex,
      })),
  };
}

function createRiskRanking() {
  return [
    {
      candidate: "w:moveFrom / w:moveTo tracked move revisions",
      risk: "High",
      evidence: "documentXmlParser uses the shared current-document revision visibility policy: w:del and w:moveFrom are invisible; w:ins and w:moveTo remain visible.",
      possibleAffectedRules: [
        "section-order",
        "required sections",
        "typography",
        "abbreviations",
        "object references",
        "caption detection",
      ],
      testability: "High; deterministic synthetic OOXML can wrap body text and section headings.",
    },
    {
      candidate: "w:hyperlink wrapper",
      risk: "Low",
      evidence: "Run and text traversal descends through wrappers while nearest owning paragraph/run checks preserve ownership.",
      possibleAffectedRules: ["typography", "object references", "abbreviations"],
      testability: "High; mini diagnostic confirms visible text reconstruction.",
    },
    {
      candidate: "w:sdt / w:sdtContent",
      risk: "Medium",
      evidence: "Transparent descendant traversal parses inner paragraphs; TOC already uses sdt marker logic.",
      possibleAffectedRules: ["section detection", "table/object facts", "TOC ownership"],
      testability: "Medium; current mini diagnostic confirms no duplicate outer/inner paragraph for simple text.",
    },
    {
      candidate: "customXml / smartTag wrappers",
      risk: "Low",
      evidence: "Wrappers are transparent around WordprocessingML descendants; no outer paragraph duplication observed in simple diagnostics.",
      possibleAffectedRules: ["typography", "sections", "references"],
      testability: "High.",
    },
    {
      candidate: "w:fldSimple",
      risk: "Low",
      evidence: "Instruction is an attribute, cached result descendants are parsed as visible; complex fields are already covered.",
      possibleAffectedRules: ["object references", "TOC", "paragraph text"],
      testability: "High.",
    },
    {
      candidate: "comments.xml / commentReference",
      risk: "Medium",
      evidence: "comments.xml is not read; body commentReference has no w:t and does not alter text reconstruction.",
      possibleAffectedRules: ["comment text analysis only if product semantics require it"],
      testability: "Medium; cross-part content similar to footnotes/endnotes.",
    },
    {
      candidate: "header/footer semantic leakage",
      risk: "Low",
      evidence: "Header/footer parts are read only for page numbering, not merged into document paragraphs/sections.",
      possibleAffectedRules: ["page-number", "body sections if future merging is added"],
      testability: "Medium.",
    },
    {
      candidate: "charts / SmartArt / OLE generic drawing classification",
      risk: "Medium",
      evidence: "Figure detector still treats non-textbox w:drawing as figure-like; representation-specific classification remains shallow.",
      possibleAffectedRules: ["figure alignment", "figure caption placement", "figure reference"],
      testability: "Medium; realistic chart/SmartArt payload would need careful fixture design.",
    },
  ];
}

function inspectParserDiscovery() {
  const files = [
    "src/features/analysis/readers/docxPackageReader.ts",
    "src/features/analysis/parsers/documentXmlParser.ts",
    "src/features/analysis/parsers/revisionVisibility.ts",
    "src/features/analysis/parsers/documentCaptionsNormalizer.ts",
    "src/features/analysis/parsers/documentSectionsParser.ts",
    "src/features/analysis/parsers/documentHeadingsNormalizer.ts",
    "src/features/analysis/parsers/tableOfContentsXmlParser.ts",
    "src/features/analysis/parsers/headerFooterXmlParser.ts",
    "src/features/analysis/parsers/markupCompatibilityResolver.ts",
    "src/features/analysis/rules/validators/bodyParagraphs.ts",
  ];
  const combined = files.map((filePath) => fs.readFileSync(path.join(process.cwd(), filePath), "utf8")).join("\n");

  return {
    inspectedFiles: files,
    excludesDeletedRuns: /\bdel\b/.test(combined) && combined.includes("isRunVisibleInCurrentDocument"),
    mentionsMoveFrom: /\bmoveFrom\b/.test(combined),
    mentionsMoveTo: /\bmoveTo\b/.test(combined),
    mentionsHyperlink: /\bhyperlink\b/.test(combined),
    mentionsCommentsXml: /comments\.xml/.test(combined),
    usesSemanticMceTraversal: combined.includes("getSemanticDescendantsByTagNameNS"),
    readerReturnsCommentsXml: /commentsXml/.test(combined),
  };
}

async function inspectTrackedMoveOoxml(fixturePath, marker) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentXml = await readDocumentXml(zip);
  const moveFromBlocks = Array.from(documentXml.matchAll(/<w:moveFrom\b[\s\S]*?<\/w:moveFrom>/g));
  const moveToBlocks = Array.from(documentXml.matchAll(/<w:moveTo\b[\s\S]*?<\/w:moveTo>/g));

  return {
    moveFromCount: moveFromBlocks.length,
    moveToCount: moveToBlocks.length,
    moveFromTexts: moveFromBlocks.map((match) => extractText(match[0])),
    moveToTexts: moveToBlocks.map((match) => extractText(match[0])),
    containsMarkerInMoveFrom: moveFromBlocks.some((match) => extractText(match[0]).includes(marker)),
    containsMarkerInMoveTo: moveToBlocks.some((match) => extractText(match[0]).includes(marker)),
    hasDeterministicRevisionMetadata:
      documentXml.includes('w:id="714"') &&
      documentXml.includes('w:author="ThesisGuard Audit"') &&
      documentXml.includes('w:date="2026-09-13T00:00:00Z"'),
  };
}

async function readDocumentXml(zip) {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("word/document.xml not found.");
  return documentFile.async("string");
}

function createMoveFromXml(text, halfPoints) {
  return [
    '<w:moveFrom w:id="714" w:author="ThesisGuard Audit" w:date="2026-09-13T00:00:00Z">',
    runXml(text, halfPoints),
    '</w:moveFrom>',
  ].join("");
}

function createMoveToXml(text, halfPoints) {
  return [
    '<w:moveTo w:id="715" w:author="ThesisGuard Audit" w:date="2026-09-13T00:00:00Z">',
    runXml(text, halfPoints),
    '</w:moveTo>',
  ].join("");
}

function paragraphXml(content) {
  return `<w:p>${content}</w:p>`;
}

function runXml(text, halfPoints = 24) {
  return [
    '<w:r>',
    '<w:rPr>',
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>',
    `<w:sz w:val="${halfPoints}"/>`,
    '</w:rPr>',
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`,
    '</w:r>',
  ].join("");
}

function bodyXml(content) {
  return [
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:body>',
    content,
    '</w:body>',
    '</w:document>',
  ].join("");
}

function findParagraphByText(documentXml, expectedText) {
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphPattern.exec(documentXml)) !== null) {
    const paragraphXmlValue = match[0];
    const text = extractText(paragraphXmlValue);

    if (text === expectedText) {
      return {
        paragraphXml: paragraphXmlValue,
        start: match.index,
        end: match.index + paragraphXmlValue.length,
      };
    }
  }

  return null;
}

function extractText(xml) {
  return Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((textMatch) => decodeXml(textMatch[1]))
    .join("");
}

function splice(value, start, end, replacement) {
  return value.slice(0, start) + replacement + value.slice(end);
}

function countRunOccurrences(document, marker) {
  return document.paragraphs.reduce(
    (total, paragraph) => total + paragraph.runs.filter((run) => run.text.includes(marker)).length,
    0,
  );
}

function findParagraphsContaining(document, marker) {
  return document.paragraphs
    .map((paragraph, index) => ({
      index,
      id: paragraph.id,
      text: paragraph.text,
      contentScope: paragraph.contentScope,
      runCount: paragraph.runs.length,
      matchingRuns: paragraph.runs
        .map((run, runIndex) => ({
          runIndex,
          text: run.text,
          fontSize: run.fontSize,
          fontFamily: run.fontFamily,
        }))
        .filter((run) => run.text.includes(marker)),
    }))
    .filter((paragraph) => paragraph.text.includes(marker));
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
