const path = require("path");

require("../golden/experimentalGoldenRegression.cjs");

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  normalizeSectionName,
} = require("../../src/features/analysis/parsers/documentSectionsParser.ts");
const {
  RequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/RequiredSectionValidator.ts");
const {
  SectionOrderValidator,
} = require("../../src/features/analysis/rules/validators/SectionOrderValidator.ts");

function main() {
  assertRecognized("GIRIS", "plain ASCII heading");
  assertRecognized("Giriş", "mixed case Turkish heading");
  assertRecognized("1 GİRİŞ", "manual number without dot");
  assertRecognized("1.   GİRİŞ", "manual number with spaced dot");
  assertRecognized("Gİ" + "RİŞ", "split-run reconstructed heading");
  assertRecognizedWithWordNumbering();
  assertExcludedFromParser(tocHeading("Giriş"), "TOC heading");
  assertExcludedFromParser(textboxHeading("Giriş"), "textbox heading");
  assertExcludedFromParser(tableCellHeading("Giriş"), "table-cell heading");
  assertExcludedFromParser(deletedHeading("Giriş"), "deleted heading");
  assertCaptionExclusion();
  assertNoSubstringMatch();
  assertDuplicatesPreserved();
  assertNestedBoundary();
  assertUnknownH1Boundary();
  assertOrderUsesSemanticOccurrences();
  assertAmbiguousIdentityDoesNotPass();

  console.log(JSON.stringify({
    phase: "4F-02",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertRecognized(text, label) {
  const document = semanticDocumentFromXml(heading(text), [requiredRule("Giriş")]);
  const result = new RequiredSectionValidator().validate(document, requiredRule("Giriş"));

  assertEqual(result.status, "PASSED", `${label} required section status`);
  assertEqual(document.academicSections.occurrences.length, 1, `${label} occurrence count`);
  assertEqual(document.academicSections.occurrences[0].identity, normalizeSectionName("Giriş"), `${label} identity`);
}

function assertRecognizedWithWordNumbering() {
  const document = semanticDocumentFromXml(
    wordNumberedHeading("Giriş"),
    [requiredRule("Giriş")],
  );
  const occurrence = document.academicSections.occurrences[0];

  assertEqual(occurrence.recognitionEvidence.includes("automatic-numbering"), true, "word numbering evidence");
  assertEqual(new RequiredSectionValidator().validate(document, requiredRule("Giriş")).status, "PASSED", "word numbering pass");
}

function assertExcludedFromParser(xml, label) {
  const document = semanticDocumentFromXml(xml, [requiredRule("Giriş")]);
  const result = new RequiredSectionValidator().validate(document, requiredRule("Giriş"));

  assertEqual(document.academicSections.occurrences.length, 0, `${label} no occurrence`);
  assertEqual(result.status, "FAILED", `${label} does not pass required section`);
}

function assertCaptionExclusion() {
  const rules = [requiredRule("Tablo 1. Giriş")];
  const parsed = parseDocumentXml(wrapDocumentXml(heading("Tablo 1. Giriş")));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const document = normalizeAcademicSections(marked, rules);
  const result = new RequiredSectionValidator().validate(document, rules[0]);

  assertEqual(document.academicSections.occurrences.length, 0, "caption paragraph no occurrence");
  assertEqual(result.status, "FAILED", "caption paragraph does not pass required section");
}

function assertNoSubstringMatch() {
  const document = semanticDocumentFromXml(heading("Ön Giriş Notu"), [requiredRule("Giriş")]);
  assertEqual(document.academicSections.occurrences.length, 0, "substring heading no occurrence");
}

function assertDuplicatesPreserved() {
  const rules = [requiredRule("Giriş")];
  const document = semanticDocumentFromXml(
    heading("Giriş") + paragraph("a") + heading("Giriş"),
    rules,
  );

  assertEqual(document.academicSections.occurrences.length, 2, "duplicate occurrences preserved");
}

function assertNestedBoundary() {
  const rules = [requiredRule("Giriş"), requiredRule("Sonuç")];
  const document = semanticMock(
    ["Giriş", "metin", "Problem", "metin", "Amaç", "metin", "Sonuç"],
    [
      headingOccurrence(0, 0, "Giriş", true),
      headingOccurrence(2, 1, "Problem", false),
      headingOccurrence(4, 2, "Amaç", false),
      headingOccurrence(6, 0, "Sonuç", true),
    ],
    rules,
  );

  const intro = document.academicSections.occurrences.find((item) => item.canonicalName === "Giriş");
  assertEqual(intro.boundary.endParagraphIndex, 5, "H1 boundary crosses nested H2/H3");
}

function assertUnknownH1Boundary() {
  const rules = [requiredRule("Giriş"), requiredRule("Sonuç")];
  const document = semanticMock(
    ["Giriş", "metin", "metin", "Bilinmeyen", "metin", "metin", "Sonuç"],
    [
      headingOccurrence(0, 0, "Giriş", true),
      headingOccurrence(3, 0, "Bilinmeyen", false),
      headingOccurrence(6, 0, "Sonuç", true),
    ],
    rules,
  );

  const intro = document.academicSections.occurrences.find((item) => item.canonicalName === "Giriş");
  assertEqual(intro.boundary.endParagraphIndex, 2, "unknown H1 cuts previous H1 boundary");
}

function assertOrderUsesSemanticOccurrences() {
  const rule = sectionOrderRule(["Giriş", "Sonuç"]);
  const document = semanticDocumentFromXml(heading("Sonuç") + heading("Giriş"), [rule]);
  const result = new SectionOrderValidator().validate(document, rule);

  assertEqual(result.status, "FAILED", "semantic order detects reversed sections");
}

function assertAmbiguousIdentityDoesNotPass() {
  const introRule = requiredRule("Giriş");
  const ambiguousAliasRule = requiredRule("Özet", ["Giriş"]);
  const document = semanticDocumentFromXml(
    heading("Giriş"),
    [introRule, ambiguousAliasRule],
  );
  const result = new RequiredSectionValidator().validate(document, introRule);

  assertEqual(document.academicSections.occurrences[0].status, "ambiguous", "ambiguous occurrence status");
  assertEqual(result.status, "FAILED", "ambiguous occurrence does not pass required section");
}

function semanticDocumentFromXml(bodyXml, rules) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  return normalizeAcademicSections(scoped, rules);
}

function semanticMock(texts, headings, rules) {
  const paragraphs = texts.map((text, index) => paragraphObject(text, index));
  const baseDocument = {
    paragraphs,
    styles: [],
    documentDefaults: {
      fontFamily: null,
      fontSize: null,
      bold: null,
      italic: null,
      underline: null,
      lineSpacing: null,
      alignment: null,
      paragraphFormatting: emptyParagraphFormatting(),
    },
    numberingDefinitions: [],
    pageMargins: { left: null, right: null, top: null, bottom: null },
    pageSections: [],
    pageNumbering: { hasPageNumbers: false, fields: [], sections: [] },
    tableOfContents: { entries: [], detected: false },
    tables: { items: [] },
    blocks: paragraphs.map((item, index) => ({
      id: `block-${index + 1}`,
      blockIndex: index,
      type: "paragraph",
      paragraphId: item.id,
    })),
    captions: { items: [], orphanCaptionIds: [] },
    objectSemantics: {
      representations: [],
      captions: [],
      associations: [],
      resolutions: [],
    },
    academicScopes: {
      paragraphs: paragraphs.map(() => ({
        scope: "unknown",
        reason: "missing-main-boundary",
        boundaryParagraphId: null,
        boundaryParagraphIndex: null,
      })),
      blocks: paragraphs.map(() => ({
        scope: "unknown",
        reason: "missing-main-boundary",
        boundaryParagraphId: null,
        boundaryParagraphIndex: null,
      })),
      mainContentBoundary: null,
    },
    objectReferences: { items: [] },
    abbreviations: { items: [], count: 0, hasAbbreviations: false },
    academicSections: { occurrences: [] },
    sections: paragraphs.map((paragraph, index) => ({
      normalizedName: normalizeSectionName(paragraph.text),
      displayName: paragraph.text,
      paragraphId: paragraph.id,
      paragraphIndex: index,
      isRuleDefinedHeading: rules.some((rule) =>
        JSON.stringify(rule.expected).includes(paragraph.text),
      ),
      isObjectReferenceExcluded: false,
    })),
    headings,
  };

  return normalizeAcademicSections(baseDocument, rules);
}

function paragraphObject(text, index) {
  return {
    id: `paragraph-${index + 1}`,
    text,
    runs: [{ text, bold: null, italic: null, underline: null, fontFamily: null, fontSize: null }],
    contentScope: "document",
    alignment: null,
    lineSpacing: null,
    paragraphFormatting: emptyParagraphFormatting(),
    styleId: null,
    numbering: { source: "none", numId: null, level: null, visibleLabel: null },
    isTableOfContentsEntry: false,
    isInTableCell: false,
    isEmpty: text.length === 0,
  };
}

function headingOccurrence(paragraphIndex, level, text, isRuleDefinedSection) {
  return {
    id: `heading-${paragraphIndex + 1}`,
    paragraphId: `paragraph-${paragraphIndex + 1}`,
    paragraphIndex,
    blockIndex: paragraphIndex,
    text,
    normalizedText: normalizeSectionName(text),
    level,
    numberingLevel: level,
    numberingSource: "none",
    numId: null,
    visibleLabel: null,
    styleId: null,
    styleName: null,
    sectionName: isRuleDefinedSection ? text : null,
    isRuleDefinedSection,
    isAcademicHeading: true,
  };
}

function requiredRule(section, aliases = []) {
  return {
    id: `rule.required.${normalizeSectionName(section)}`,
    type: "REQUIRED_SECTION",
    title: `${section} required`,
    description: "",
    category: "structure",
    expected: { section, aliases, required: true },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function sectionOrderRule(sections) {
  return {
    id: "rule.order",
    type: "SECTION_ORDER",
    title: "order",
    description: "",
    category: "structure",
    expected: { sections: sections.map((section) => ({ section })) },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>';
}

function heading(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function wordNumberedHeading(text) {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocHeading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textboxHeading(text) {
  return `<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>`;
}

function tableCellHeading(text) {
  return `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
}

function deletedHeading(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function emptyParagraphFormatting() {
  return {
    indentation: {
      leftTwips: null,
      rightTwips: null,
      firstLineTwips: null,
      hangingTwips: null,
      leftChars: null,
      rightChars: null,
      firstLineChars: null,
      hangingChars: null,
    },
    spacing: { beforeTwips: null, afterTwips: null, beforeLines: null, afterLines: null },
  };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
