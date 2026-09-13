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
const TEXT_DOCX = path.join(FIXTURE_DIR, "alternate-content-text-synthetic.docx");
const SEMANTIC_DOCX = path.join(FIXTURE_DIR, "alternate-content-semantic-collision-synthetic.docx");
const FIGURE_DOCX = path.join(FIXTURE_DIR, "alternate-content-figure-synthetic.docx");

const BODY_TARGET_TEXT = "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.";
const SECTION_ANCHOR_TEXT = "KAYNAKLAR";
const CHOICE_MARKER = "TG_ALT_CHOICE";
const FALLBACK_MARKER = "TG_ALT_FALLBACK";
const IDENTICAL_MARKER = "TG_ALT_TEXT_MARKER";
const SECTION_MARKER = "KAYNAKLAR";
const MARKUP_COMPATIBILITY_NAMESPACE =
  "http://schemas.openxmlformats.org/markup-compatibility/2006";
const SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order";
const FIGURE_ALIGNMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-object-alignment";
const FIGURE_CAPTION_PLACEMENT_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.figure-caption-placement";

async function main() {
  await createFixtures();

  const summaries = [
    await inspectFixture(TEXT_DOCX, {
      fixtureKind: "text",
      expectedAlternateContentCount: 2,
      markerTexts: [CHOICE_MARKER, FALLBACK_MARKER, IDENTICAL_MARKER],
      assertSummary(summary) {
        assertEqual(summary.normalized.markerOccurrences[CHOICE_MARKER], 1,
          "Choice marker paragraph occurrence");
        assertEqual(summary.normalized.markerOccurrences[FALLBACK_MARKER], 0,
          "Fallback marker paragraph occurrence");
        assertEqual(summary.normalized.runOccurrences[IDENTICAL_MARKER], 1,
          "Identical marker run occurrence");
        assertEqual(summary.report.failed, 0, "Text fixture failed rule count");
      },
    }),
    await inspectFixture(SEMANTIC_DOCX, {
      fixtureKind: "semantic",
      expectedAlternateContentCount: 1,
      markerTexts: [SECTION_MARKER],
      assertSummary(summary) {
        assertEqual(summary.normalized.sectionMarkerSectionCount, 1,
          "Semantic fixture KAYNAKLAR section count");
        assertEqual(summary.report.failed, 0, "Semantic fixture failed rule count");
      },
    }),
    await inspectFixture(FIGURE_DOCX, {
      fixtureKind: "figure",
      expectedAlternateContentCount: 1,
      markerTexts: [],
      assertSummary(summary) {
        assertEqual(summary.ooxml.drawingCount, 2, "Figure fixture OOXML drawing count");
        assertEqual(summary.normalized.figures.length, 1, "Figure fixture normalized figure count");
        assertEqual(summary.report.failed, 0, "Figure fixture failed rule count");
        assertEqual(summary.report.notApplicable, 0, "Figure fixture N/A rule count");
      },
    }),
  ];

  console.log(JSON.stringify({
    productionAlternateContentLogic: inspectProductionAlternateContentLogic(),
    summaries,
  }, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);
  await createTextFixture(source);
  await createSemanticFixture(source);
  await createFigureFixture(source);
}

async function createTextFixture(source) {
  const zip = await JSZip.loadAsync(source);
  const documentXml = await readDocumentXml(zip);
  const paragraphMatch = findParagraphByText(documentXml, BODY_TARGET_TEXT);
  if (!paragraphMatch) throw new Error("Target body paragraph not found.");

  const alternateContent =
    createInlineAlternateContent(textRunXml(` ${CHOICE_MARKER}`, 24), textRunXml(` ${FALLBACK_MARKER}`, 24)) +
    createInlineAlternateContent(textRunXml(` ${IDENTICAL_MARKER}`, 24), textRunXml(` ${IDENTICAL_MARKER}`, 24));
  const mutatedParagraph = paragraphMatch.paragraphXml.replace("</w:p>", `${alternateContent}</w:p>`);

  zip.file("word/document.xml", addMarkupCompatibilityNamespace(
    splice(documentXml, paragraphMatch.start, paragraphMatch.end, mutatedParagraph),
  ));
  fs.writeFileSync(TEXT_DOCX, await zip.generateAsync({ type: "nodebuffer" }));
}

async function createSemanticFixture(source) {
  const zip = await JSZip.loadAsync(source);
  const documentXml = await readDocumentXml(zip);
  const paragraphMatch = findParagraphByText(documentXml, SECTION_ANCHOR_TEXT);
  if (!paragraphMatch) throw new Error("Section anchor paragraph not found.");

  const alternateContent = createBlockAlternateContent(
    paragraphXml(textRunXml(SECTION_MARKER, 24)),
    paragraphXml(textRunXml(SECTION_MARKER, 24)),
  );

  zip.file("word/document.xml", addMarkupCompatibilityNamespace(
    splice(documentXml, paragraphMatch.start, paragraphMatch.end, alternateContent),
  ));
  fs.writeFileSync(SEMANTIC_DOCX, await zip.generateAsync({ type: "nodebuffer" }));
}

async function createFigureFixture(source) {
  const zip = await JSZip.loadAsync(source);
  const documentXml = await readDocumentXml(zip);
  const drawingIndex = documentXml.indexOf("<w:drawing");
  if (drawingIndex === -1) {
    throw new Error("Drawing not found.");
  }

  const runStart = documentXml.lastIndexOf("<w:r", drawingIndex);
  const drawingEnd = documentXml.indexOf("</w:drawing>", drawingIndex);
  const runEnd = drawingEnd === -1 ? -1 : documentXml.indexOf("</w:r>", drawingEnd);
  if (runStart === -1 || runEnd === -1) {
    throw new Error("Drawing run not found.");
  }

  const drawingRunXml = documentXml.slice(runStart, runEnd + "</w:r>".length);
  const alternateContent = createInlineAlternateContent(drawingRunXml, drawingRunXml);

  zip.file("word/document.xml", addMarkupCompatibilityNamespace(
    splice(
      documentXml,
      runStart,
      runStart + drawingRunXml.length,
      alternateContent,
    ),
  ));
  fs.writeFileSync(FIGURE_DOCX, await zip.generateAsync({ type: "nodebuffer" }));
}

async function inspectFixture(fixturePath, options) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentXml = await readDocumentXml(zip);
  const ooxml = inspectAlternateContentXml(documentXml);
  const { document, report } = await runAnalysisFixture(fixturePath);
  const markerOccurrences = Object.fromEntries(
    options.markerTexts.map((marker) => [marker, countParagraphOccurrences(document, marker)]),
  );
  const runOccurrences = Object.fromEntries(
    options.markerTexts.map((marker) => [marker, countRunOccurrences(document, marker)]),
  );
  const sectionMarkerSections = document.sections
    .filter((section) => section.displayName === SECTION_MARKER)
    .map((section) => ({
      displayName: section.displayName,
      paragraphIndex: section.paragraphIndex,
      paragraphId: section.paragraphId,
      isRuleDefinedHeading: section.isRuleDefinedHeading,
    }));

  assertEqual(ooxml.alternateContentCount, options.expectedAlternateContentCount,
    `${fixturePath} AlternateContent count`);

  const summary = {
    fixture: path.relative(process.cwd(), fixturePath),
    fixtureKind: options.fixtureKind,
    ooxml,
    normalized: {
      paragraphCount: document.paragraphs.length,
      markerOccurrences,
      runOccurrences,
      markerParagraphs: options.markerTexts.flatMap((marker) =>
        findParagraphsContaining(document, marker).map((paragraph) => ({ marker, ...paragraph })),
      ),
      sectionMarkerSectionCount: sectionMarkerSections.length,
      sectionMarkerSections,
      captions: document.captions.items.map((caption) => ({
        id: caption.id,
        kind: caption.kind,
        number: caption.number,
        paragraphIndex: caption.paragraphIndex,
        blockIndex: caption.blockIndex,
        text: caption.text,
      })),
      objectReferences: document.objectReferences.items,
      figures: document.figures.items.map((figure) => ({
        id: figure.id,
        paragraphId: figure.paragraphId,
        paragraphIndex: figure.paragraphIndex,
        blockIndex: figure.blockIndex,
        drawingType: figure.drawingType,
        alignment: figure.alignment,
        alignmentSource: figure.alignmentSource,
        captionId: figure.captionId,
        captionPosition: figure.captionPosition,
      })),
    },
    report: summarizeReport(report),
    relevantRuleResults: [
      SECTION_ORDER_RULE_ID,
      FIGURE_ALIGNMENT_RULE_ID,
      FIGURE_CAPTION_PLACEMENT_RULE_ID,
    ].map((ruleId) => summarizeResult(report.results.find((result) => result.ruleId === ruleId))),
    nonPassedResults: report.results
      .filter((result) => result.status !== "PASSED")
      .map(summarizeResult),
  };
  options.assertSummary?.(summary);
  return summary;
}

function inspectAlternateContentXml(documentXml) {
  const blocks = Array.from(documentXml.matchAll(
    /<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g,
  )).map((match, index) => inspectAlternateContentBlock(match[0], index));

  return {
    namespaceDeclared: documentXml.includes(`xmlns:mc="${MARKUP_COMPATIBILITY_NAMESPACE}"`),
    alternateContentCount: blocks.length,
    choiceCount: countMatches(documentXml, /<mc:Choice\b/g),
    fallbackCount: countMatches(documentXml, /<mc:Fallback\b/g),
    drawingCount: countMatches(documentXml, /<w:drawing\b/g),
    pictCount: countMatches(documentXml, /<w:pict\b/g),
    blocks,
  };
}

function inspectAlternateContentBlock(xml, index) {
  const choiceMatch = /<mc:Choice\b([^>]*)>([\s\S]*?)<\/mc:Choice>/.exec(xml);
  const fallbackMatch = /<mc:Fallback\b[^>]*>([\s\S]*?)<\/mc:Fallback>/.exec(xml);
  const choiceXml = choiceMatch?.[2] ?? "";
  const fallbackXml = fallbackMatch?.[1] ?? "";

  return {
    index,
    requires: parseRequires(choiceMatch?.[1] ?? ""),
    choiceTextMarkers: extractDiagnosticMarkers(choiceXml),
    fallbackTextMarkers: extractDiagnosticMarkers(fallbackXml),
    choiceDrawingCount: countMatches(choiceXml, /<w:drawing\b/g),
    fallbackDrawingCount: countMatches(fallbackXml, /<w:drawing\b/g),
    choicePictCount: countMatches(choiceXml, /<w:pict\b/g),
    fallbackPictCount: countMatches(fallbackXml, /<w:pict\b/g),
  };
}

function inspectProductionAlternateContentLogic() {
  const files = [
    "src/features/analysis/parsers/documentXmlParser.ts",
    "src/features/analysis/parsers/documentCaptionsNormalizer.ts",
    "src/features/analysis/parsers/documentHeadingsNormalizer.ts",
    "src/features/analysis/parsers/documentSectionsParser.ts",
    "src/features/analysis/rules/validators/bodyParagraphs.ts",
    "src/features/analysis/parsers/markupCompatibilityResolver.ts",
  ];
  const combined = files.map((filePath) => fs.readFileSync(path.join(process.cwd(), filePath), "utf8")).join("\n");

  return {
    inspectedFiles: files,
    mentionsAlternateContent: /AlternateContent/.test(combined),
    mentionsMarkupCompatibilityNamespace: /markup-compatibility/.test(combined),
    mentionsChoice: /\bChoice\b/.test(combined),
    mentionsFallback: /\bFallback\b/.test(combined),
    mentionsRequires: /\bRequires\b/.test(combined),
    usesDescendantTraversal: /getElementsByTagNameNS/.test(combined),
  };
}

async function readDocumentXml(zip) {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("word/document.xml not found.");
  return documentFile.async("string");
}

function addMarkupCompatibilityNamespace(documentXml) {
  if (documentXml.includes(`xmlns:mc="${MARKUP_COMPATIBILITY_NAMESPACE}"`)) {
    return documentXml;
  }

  return documentXml.replace(
    /<w:document\b/,
    `<w:document xmlns:mc="${MARKUP_COMPATIBILITY_NAMESPACE}"`,
  );
}

function createInlineAlternateContent(choiceXml, fallbackXml) {
  return [
    '<mc:AlternateContent>',
    '<mc:Choice Requires="wps">',
    choiceXml,
    '</mc:Choice>',
    '<mc:Fallback>',
    fallbackXml,
    '</mc:Fallback>',
    '</mc:AlternateContent>',
  ].join("");
}

function createBlockAlternateContent(choiceXml, fallbackXml) {
  return createInlineAlternateContent(choiceXml, fallbackXml);
}

function paragraphXml(content) {
  return `<w:p>${content}</w:p>`;
}

function textRunXml(value, halfPoints) {
  return [
    '<w:r>',
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${halfPoints}"/></w:rPr>`,
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t>`,
    '</w:r>',
  ].join("");
}

function findParagraphByText(documentXml, expectedText) {
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphPattern.exec(documentXml)) !== null) {
    const paragraphXmlValue = match[0];
    const text = Array.from(paragraphXmlValue.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");

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

function splice(value, start, end, replacement) {
  return value.slice(0, start) + replacement + value.slice(end);
}

function countParagraphOccurrences(document, marker) {
  return document.paragraphs.filter((paragraph) => paragraph.text.includes(marker)).length;
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

function parseRequires(attributes) {
  return /Requires="([^"]+)"/.exec(attributes)?.[1]?.split(/\s+/).filter(Boolean) ?? [];
}

function extractDiagnosticMarkers(xml) {
  return Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((match) => decodeXml(match[1]))
    .filter((text) =>
      text.includes("TG_ALT") ||
      text.includes(SECTION_MARKER),
    );
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
