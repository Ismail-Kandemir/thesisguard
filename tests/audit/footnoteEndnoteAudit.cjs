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
const FOOTNOTE_DOCX = path.join(FIXTURE_DIR, "footnote-visible-content-synthetic.docx");
const ENDNOTE_DOCX = path.join(FIXTURE_DIR, "endnote-visible-content-synthetic.docx");
const FOOTNOTE_SECTION_DOCX = path.join(FIXTURE_DIR, "footnote-section-collision-synthetic.docx");
const FOOTNOTE_TEXT = "Footnote diagnostic visible content";
const ENDNOTE_TEXT = "Endnote diagnostic visible content";
const FOOTNOTE_SECTION_TEXT = "TG_FOOTNOTE_ONLY_KAYNAKLAR_MARKER";
const DOCUMENT_SECTION_TEXT = "KAYNAKLAR";
const BODY_TARGET_TEXT = "Örneklerin değerlendirilmesinde DNA analizi kullanılmıştır.";
const SECTION_ORDER_RULE_ID =
  "comu.applied-sciences.food-technology.bachelor.experimental.section-order";
const FONT_SIZE_RULE_ID = "comu.bachelor.typography.font-size";

async function main() {
  await createFixtures();

  const summaries = [
    await inspectFixture(FOOTNOTE_DOCX, {
      kind: "footnote",
      noteText: FOOTNOTE_TEXT,
      expectedReferenceIds: ["2"],
      expectedNormalizedOccurrences: 0,
    }),
    await inspectFixture(ENDNOTE_DOCX, {
      kind: "endnote",
      noteText: ENDNOTE_TEXT,
      expectedReferenceIds: ["2"],
      expectedNormalizedOccurrences: 0,
    }),
    await inspectFixture(FOOTNOTE_SECTION_DOCX, {
      kind: "footnote",
      noteText: FOOTNOTE_SECTION_TEXT,
      expectedReferenceIds: ["2"],
      expectedNormalizedOccurrences: 0,
      expectedDocumentSectionOccurrences: 1,
    }),
  ];

  console.log(JSON.stringify(summaries, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);

  await createNoteFixture(source, FOOTNOTE_DOCX, {
    kind: "footnote",
    noteText: FOOTNOTE_TEXT,
    noteId: "2",
    halfPoints: 20,
  });
  await createNoteFixture(source, ENDNOTE_DOCX, {
    kind: "endnote",
    noteText: ENDNOTE_TEXT,
    noteId: "2",
    halfPoints: 20,
  });
  await createNoteFixture(source, FOOTNOTE_SECTION_DOCX, {
    kind: "footnote",
    noteText: FOOTNOTE_SECTION_TEXT,
    noteId: "2",
    halfPoints: 24,
  });
}

async function createNoteFixture(source, targetPath, options) {
  const zip = await JSZip.loadAsync(source);
  const documentFile = zip.file("word/document.xml");
  const relationshipsFile = zip.file("word/_rels/document.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (!documentFile) throw new Error("word/document.xml bulunamadi.");
  if (!relationshipsFile) throw new Error("word/_rels/document.xml.rels bulunamadi.");
  if (!contentTypesFile) throw new Error("[Content_Types].xml bulunamadi.");

  const documentXml = await documentFile.async("string");
  const relationshipsXml = await relationshipsFile.async("string");
  const contentTypesXml = await contentTypesFile.async("string");

  zip.file("word/document.xml", insertNoteReference(documentXml, options));
  zip.file("word/_rels/document.xml.rels", addNoteRelationship(relationshipsXml, options.kind));
  zip.file("[Content_Types].xml", addNoteContentType(contentTypesXml, options.kind));
  zip.file(`word/${options.kind}s.xml`, createNotesXml(options));
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
}

function insertNoteReference(documentXml, { kind, noteId }) {
  const paragraphMatch = findParagraphByText(documentXml, BODY_TARGET_TEXT);
  if (!paragraphMatch) throw new Error("Hedef akademik govde paragrafi bulunamadi.");

  const referenceRun = [
    '<w:r>',
    '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr>',
    `<w:${kind}Reference w:id="${noteId}"/>`,
    '</w:r>',
  ].join("");
  const mutatedParagraph = paragraphMatch.paragraphXml.replace("</w:p>", `${referenceRun}</w:p>`);

  return (
    documentXml.slice(0, paragraphMatch.start) +
    mutatedParagraph +
    documentXml.slice(paragraphMatch.end)
  );
}

function addNoteRelationship(relationshipsXml, kind) {
  const typeName = kind === "footnote" ? "footnotes" : "endnotes";
  if (relationshipsXml.includes(`/relationships/${typeName}`)) return relationshipsXml;

  const relationship = `<Relationship Id="rIdThesisGuard${capitalize(typeName)}Audit" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${typeName}" Target="${typeName}.xml"/>`;
  return relationshipsXml.replace("</Relationships>", `${relationship}</Relationships>`);
}

function addNoteContentType(contentTypesXml, kind) {
  const typeName = kind === "footnote" ? "footnotes" : "endnotes";
  const partName = `/word/${typeName}.xml`;
  if (contentTypesXml.includes(`PartName="${partName}"`)) return contentTypesXml;

  const override = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${typeName}+xml"/>`;
  return contentTypesXml.replace("</Types>", `${override}</Types>`);
}

function createNotesXml({ kind, noteId, noteText, halfPoints }) {
  const collectionName = `${kind}s`;
  const itemName = kind;
  const separatorName = `${kind}Separator`;
  const continuationName = `${kind}ContinuationSeparator`;
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<w:${collectionName} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`,
    `<w:${itemName} w:type="separator" w:id="-1"><w:p><w:r><w:${separatorName}/></w:r></w:p></w:${itemName}>`,
    `<w:${itemName} w:type="continuationSeparator" w:id="0"><w:p><w:r><w:${continuationName}/></w:r></w:p></w:${itemName}>`,
    `<w:${itemName} w:id="${noteId}">`,
    '<w:p>',
    '<w:pPr><w:spacing w:line="240" w:lineRule="auto" w:before="0" w:after="0"/></w:pPr>',
    '<w:r>',
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="${halfPoints}"/></w:rPr>`,
    `<w:t>${escapeXml(noteText)}</w:t>`,
    '</w:r>',
    '</w:p>',
    `</w:${itemName}>`,
    `</w:${collectionName}>`,
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

async function inspectFixture(fixturePath, options) {
  const packageInspection = await inspectPackage(fixturePath, options.kind);
  const productionReaderInspection = await inspectProductionReader(fixturePath, options.noteText);
  const { document, report } = await runAnalysisFixture(fixturePath);
  const paragraphsWithNoteText = document.paragraphs
    .map((paragraph, index) => summarizeParagraph(paragraph, index))
    .filter((paragraph) => paragraph.text.includes(options.noteText));
  const documentSectionParagraphs = document.paragraphs
    .map((paragraph, index) => summarizeParagraph(paragraph, index))
    .filter((paragraph) => paragraph.text === DOCUMENT_SECTION_TEXT);
  const bodyParagraph = document.paragraphs
    .map((paragraph, index) => summarizeParagraph(paragraph, index))
    .find((paragraph) => paragraph.text.includes("DNA analizi")) ?? null;
  const sectionOrderResult = report.results.find((result) => result.ruleId === SECTION_ORDER_RULE_ID);
  const fontSizeResult = report.results.find((result) => result.ruleId === FONT_SIZE_RULE_ID);

  assertArrayEqual(packageInspection.referenceIds, options.expectedReferenceIds,
    `${fixturePath} reference ids`);
  assert(packageInspection.notePartExists, `${fixturePath} note part missing`);
  assert(packageInspection.relationshipExists, `${fixturePath} note relationship missing`);
  assert(packageInspection.contentTypeExists, `${fixturePath} note content type missing`);
  assert(
    packageInspection.realNotes.some((note) => note.text === options.noteText),
    `${fixturePath} note text missing in note part`,
  );
  assertEqual(productionReaderInspection.noteTextPresentInReadParts, false,
    `${fixturePath} production reader note text leakage`);
  assertEqual(paragraphsWithNoteText.length, options.expectedNormalizedOccurrences,
    `${fixturePath} normalized note text occurrences`);
  if (options.expectedDocumentSectionOccurrences !== undefined) {
    assertEqual(documentSectionParagraphs.length, options.expectedDocumentSectionOccurrences,
      `${fixturePath} real document KAYNAKLAR occurrences`);
  }
  assertEqual(bodyParagraph?.text, BODY_TARGET_TEXT, `${fixturePath} body reference reconstruction`);
  assert(
    bodyParagraph?.runs.some((run) => run.text === "") === true,
    `${fixturePath} note reference empty run`,
  );

  return {
    fixture: path.relative(process.cwd(), fixturePath),
    kind: options.kind,
    packageInspection,
    productionReaderInspection,
    bodyParagraph,
    normalizedNoteTextOccurrences: paragraphsWithNoteText.length,
    paragraphsWithNoteText,
    documentSectionOccurrences: documentSectionParagraphs.length,
    documentSectionParagraphs,
    matchingSections: document.sections
      .filter((section) => section.displayName.includes(options.noteText))
      .map((section) => ({
        displayName: section.displayName,
        paragraphIndex: section.paragraphIndex,
        isRuleDefinedHeading: section.isRuleDefinedHeading,
      })),
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
    falseRuleResultEvidence: report.results
      .filter((result) => result.status !== "PASSED")
      .map(summarizeResult),
    fontSizeResult: summarizeResult(fontSizeResult),
    sectionOrderResult: summarizeResult(sectionOrderResult),
  };
}

async function inspectPackage(fixturePath, kind) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const collectionName = `${kind}s`;
  const partPath = `word/${collectionName}.xml`;
  const referenceName = `${kind}Reference`;
  const notePart = zip.file(partPath);
  const documentXml = await zip.file("word/document.xml").async("string");
  const relationshipsXml = await zip.file("word/_rels/document.xml.rels").async("string");
  const contentTypesXml = await zip.file("[Content_Types].xml").async("string");
  const noteXml = notePart ? await notePart.async("string") : "";
  const notes = inspectNotesXml(noteXml, kind);

  return {
    notePartPath: partPath,
    notePartExists: notePart !== null,
    relationshipExists: relationshipsXml.includes(`/relationships/${collectionName}`) &&
      relationshipsXml.includes(`Target="${collectionName}.xml"`),
    contentTypeExists: contentTypesXml.includes(`PartName="/word/${collectionName}.xml"`) &&
      contentTypesXml.includes(`wordprocessingml.${collectionName}+xml`),
    relationshipTargets: Array.from(
      relationshipsXml.matchAll(
        new RegExp(`<Relationship\\b[^>]*Type="[^"]*/${collectionName}"[^>]*Target="([^"]+)"`, "g"),
      ),
    ).map((match) => match[1]),
    contentTypeOverrides: Array.from(
      contentTypesXml.matchAll(
        new RegExp(`<Override\\b[^>]*PartName="/word/${collectionName}\\.xml"[^>]*ContentType="([^"]+)"`, "g"),
      ),
    ).map((match) => match[1]),
    referenceIds: Array.from(documentXml.matchAll(new RegExp(`<w:${referenceName}\\b[^>]*w:id="([^"]+)"`, "g")))
      .map((match) => match[1]),
    specialNotes: notes.filter((note) => note.isSpecial),
    realNotes: notes.filter((note) => !note.isSpecial),
    noteVisibleText: notes.filter((note) => !note.isSpecial).map((note) => note.text),
  };
}

async function inspectProductionReader(fixturePath, noteText) {
  const { readDocxAnalysisXmlParts } = require("../../src/features/analysis/readers/docxPackageReader.ts");
  const parts = await readDocxAnalysisXmlParts(createNodeDocxReaderInput(fixturePath));
  const keys = Object.keys(parts).sort();
  const stringParts = Object.fromEntries(
    Object.entries(parts)
      .filter((entry) => typeof entry[1] === "string")
      .map(([key, value]) => [key, value]),
  );
  const headerFooterText = parts.headerFooterXmlParts
    .map((part) => part.xml)
    .join("");
  const readableXml = Object.values(stringParts).join("") + headerFooterText;

  return {
    returnedKeys: keys,
    hasFootnotesXmlField: keys.includes("footnotesXml"),
    hasEndnotesXmlField: keys.includes("endnotesXml"),
    noteTextPresentInReadParts: readableXml.includes(noteText),
  };
}

function createNodeDocxReaderInput(filePath) {
  const buffer = fs.readFileSync(filePath);
  const exactFixtureBytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const bytes = new Uint8Array(exactFixtureBytes);

  Object.defineProperties(bytes, {
    name: { value: path.basename(filePath), enumerable: true },
    size: { value: bytes.byteLength, enumerable: true },
    type: {
      value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      enumerable: true,
    },
  });

  return bytes;
}

function inspectNotesXml(noteXml, kind) {
  const itemPattern = new RegExp(`<w:${kind}\\b([\\s\\S]*?)>([\\s\\S]*?)<\\/w:${kind}>`, "g");
  return Array.from(noteXml.matchAll(itemPattern)).map((match) => {
    const attributes = match[1];
    const body = match[2];
    const id = /w:id="([^"]+)"/.exec(attributes)?.[1] ?? null;
    const type = /w:type="([^"]+)"/.exec(attributes)?.[1] ?? null;
    const text = Array.from(body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");

    return {
      id,
      type,
      isSpecial: type !== null || (id !== null && Number(id) < 1),
      text,
    };
  });
}

function summarizeParagraph(paragraph, index) {
  return {
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function assertArrayEqual(actual, expected, label) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
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
