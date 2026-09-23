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
  normalizeSectionName,
} = require("../../src/features/analysis/parsers/documentSectionsParser.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  getAcademicSectionContentParagraphs,
} = require("../../src/features/analysis/rules/sectionContent.ts");
const {
  SectionWordCountValidator,
} = require("../../src/features/analysis/rules/validators/SectionWordCountValidator.ts");
const {
  SectionKeywordsValidator,
} = require("../../src/features/analysis/rules/validators/SectionKeywordsValidator.ts");

function main() {
  assertSummaryLookupAndBoundary();
  assertAbstractLookupAndBoundary();
  assertNestedHeadingDoesNotCutSummary();
  assertUnknownHeadingCutsSummary();
  assertTocTextboxDeletedAndSubstringFalsePositives();
  assertSplitRunKeywordLine();
  assertEmptySummaryDetectable();
  assertCrossSectionKeywordOwnership();
  assertKeywordCountConstraints();
  assertKeywordFalsePositives();
  assertDuplicateSummarySafety();
  assertAmbiguousSummarySafety();

  console.log(JSON.stringify({
    phase: "4F-03",
    result: "PASS",
    audit: "summaryAbstractKeywordsSemanticRegression.cjs",
  }, null, 2));
}

function assertSummaryLookupAndBoundary() {
  const document = semanticDocumentFromXml(
    heading("ÖZET") +
      paragraph("bir iki üç") +
      paragraph("Anahtar Kelimeler: gıda, kalite, analiz") +
      heading("ABSTRACT") +
      paragraph("abstract text"),
    rules(),
  );
  const summary = occurrence(document, "Özet");
  const content = getAcademicSectionContentParagraphs(document, summary).map((item) => item.text);

  assertEqual(content.includes("abstract text"), false, "summary content does not leak into abstract");
  assertEqual(new SectionWordCountValidator().validate(document, wordRule("Özet", 20)).status, "PASSED", "summary word count semantic pass");
  assertEqual(new SectionKeywordsValidator().validate(document, keywordRule("Özet", ["Anahtar Kelimeler"])).status, "PASSED", "summary keyword semantic pass");
}

function assertAbstractLookupAndBoundary() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("özet metni") +
      heading("Abstract") +
      paragraph("one two three") +
      paragraph("Keyword: food, quality, analysis") +
      heading("Kaynaklar") +
      paragraph("Keyword appears in references."),
    rules(),
  );
  const abstract = occurrence(document, "Abstract");
  const content = getAcademicSectionContentParagraphs(document, abstract).map((item) => item.text);

  assertEqual(content.includes("özet metni"), false, "abstract content excludes Turkish summary");
  assertEqual(content.includes("Keyword appears in references."), false, "abstract content stops before references");
  assertEqual(new SectionKeywordsValidator().validate(document, keywordRule("Abstract", ["Keyword"])).status, "PASSED", "abstract keyword semantic pass");
}

function assertNestedHeadingDoesNotCutSummary() {
  const document = semanticMock(
    ["Özet", "ilk metin", "Alt Başlık", "ikinci metin", "Anahtar Kelimeler: a, b, c", "Abstract"],
    [
      headingOccurrence(0, 0, "Özet", true),
      headingOccurrence(2, 1, "Alt Başlık", false),
      headingOccurrence(5, 0, "Abstract", true),
    ],
    rules(),
  );
  const summary = occurrence(document, "Özet");
  const content = getAcademicSectionContentParagraphs(document, summary).map((item) => item.text);

  assertEqual(content.includes("ikinci metin"), true, "nested lower heading does not cut summary");
  assertEqual(content.includes("Abstract"), false, "summary excludes next section heading");
}

function assertUnknownHeadingCutsSummary() {
  const document = semanticMock(
    ["Özet", "ilk metin", "Bilinmeyen", "sonraki metin", "Abstract"],
    [
      headingOccurrence(0, 0, "Özet", true),
      headingOccurrence(2, 0, "Bilinmeyen", false),
      headingOccurrence(4, 0, "Abstract", true),
    ],
    rules(),
  );
  const summary = occurrence(document, "Özet");
  const content = getAcademicSectionContentParagraphs(document, summary).map((item) => item.text);

  assertEqual(content.includes("ilk metin"), true, "summary includes owned text before unknown H1");
  assertEqual(content.includes("sonraki metin"), false, "unknown H1 cuts summary boundary");
}

function assertTocTextboxDeletedAndSubstringFalsePositives() {
  const falsePositiveCases = [
    { label: "TOC Özet", xml: tocHeading("Özet") + paragraph("Anahtar Kelimeler: a, b, c") },
    { label: "TOC Abstract", xml: tocHeading("Abstract") + paragraph("Keyword: a, b, c") },
    { label: "textbox keyword", xml: heading("Özet") + textboxParagraph("Anahtar Kelimeler: a, b, c") },
    { label: "deleted keyword", xml: heading("Özet") + deletedParagraph("Anahtar Kelimeler: a, b, c") },
    { label: "body substring özet", xml: paragraph("Bu çalışma özet kavramını tartışır.") },
    { label: "body substring abstract", xml: paragraph("This abstract idea is discussed.") },
  ];

  for (const item of falsePositiveCases) {
    const document = semanticDocumentFromXml(item.xml, rules());
    const summaryKeywords = new SectionKeywordsValidator().validate(
      document,
      keywordRule("Özet", ["Anahtar Kelimeler"]),
    );
    const abstractKeywords = new SectionKeywordsValidator().validate(
      document,
      keywordRule("Abstract", ["Keyword"]),
    );

    assertEqual(summaryKeywords.status === "PASSED" || abstractKeywords.status === "PASSED", false, `${item.label} does not satisfy keywords`);
  }
}

function assertSplitRunKeywordLine() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      splitTextParagraph(["Anahtar ", "Kelimeler", ": gıda, kalite, analiz"]),
    rules(),
  );
  const result = new SectionKeywordsValidator().validate(
    document,
    keywordRule("Özet", ["Anahtar Kelimeler"]),
  );

  assertEqual(result.status, "PASSED", "split-run keyword line passes");
}

function assertEmptySummaryDetectable() {
  const document = semanticDocumentFromXml(heading("Özet") + heading("Abstract"), rules());
  const result = new SectionWordCountValidator().validate(document, wordRule("Özet", undefined, 1));

  assertEqual(result.status, "FAILED", "empty summary fails min word count when rule requires content");
  assertEqual(result.actual, "0 kelime", "empty summary word count is zero");
}

function assertCrossSectionKeywordOwnership() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("Anahtar Kelimeler: gıda, kalite, analiz") +
      heading("Abstract") +
      paragraph("Anahtar Kelimeler: wrong, label, here") +
      paragraph("Keyword: food, quality, analysis"),
    rules(),
  );

  assertEqual(new SectionKeywordsValidator().validate(document, keywordRule("Özet", ["Anahtar Kelimeler"])).status, "PASSED", "TR keywords owned by summary");
  assertEqual(new SectionKeywordsValidator().validate(document, keywordRule("Abstract", ["Keyword"])).status, "PASSED", "EN keywords owned by abstract");
}

function assertKeywordCountConstraints() {
  const below = semanticDocumentFromXml(
    heading("Özet") + paragraph("Anahtar Kelimeler: gıda, kalite"),
    rules(),
  );
  const within = semanticDocumentFromXml(
    heading("Özet") + paragraph("Anahtar Kelimeler: gıda, kalite, analiz"),
    rules(),
  );
  const above = semanticDocumentFromXml(
    heading("Özet") + paragraph("Anahtar Kelimeler: a, b, c, d, e, f"),
    rules(),
  );

  assertEqual(new SectionKeywordsValidator().validate(below, keywordRule("Özet", ["Anahtar Kelimeler"])).status, "FAILED", "below min keywords fails");
  assertEqual(new SectionKeywordsValidator().validate(within, keywordRule("Özet", ["Anahtar Kelimeler"])).status, "PASSED", "within keyword range passes");
  assertEqual(new SectionKeywordsValidator().validate(above, keywordRule("Özet", ["Anahtar Kelimeler"])).status, "FAILED", "above max keywords fails");
}

function assertKeywordFalsePositives() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("Bu çalışmanın anahtar kelimeleri literatürde önemlidir.") +
      paragraph("Anahtar Kelimeler:") +
      heading("Kaynaklar") +
      paragraph("Anahtar Kelimeler: kaynak, metin, dizin"),
    rules(),
  );
  const result = new SectionKeywordsValidator().validate(
    document,
    keywordRule("Özet", ["Anahtar Kelimeler"]),
  );

  assertEqual(result.status, "FAILED", "keyword sentence and empty label do not satisfy count");
}

function assertDuplicateSummarySafety() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("Anahtar Kelimeler: a, b, c") +
      heading("Özet") +
      paragraph("Anahtar Kelimeler: d, e, f"),
    rules(),
  );
  const result = new SectionKeywordsValidator().validate(
    document,
    keywordRule("Özet", ["Anahtar Kelimeler"]),
  );

  assertEqual(result.status, "FAILED", "duplicate summary does not silently pick first");
}

function assertAmbiguousSummarySafety() {
  const ambiguousRule = requiredRule("Kısa Özet", ["Özet"]);
  const document = semanticDocumentFromXml(heading("Özet") + paragraph("bir iki"), [
    ...rules(),
    ambiguousRule,
  ]);
  const result = new SectionWordCountValidator().validate(document, wordRule("Özet", 20));

  assertEqual(document.academicSections.occurrences[0].status, "ambiguous", "summary occurrence is ambiguous");
  assertEqual(result.status, "FAILED", "ambiguous summary does not pass word count");
}

function semanticDocumentFromXml(bodyXml, activeRules) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, activeRules);
  const headed = normalizeDocumentHeadings(marked, activeRules);
  const scoped = normalizeAcademicDocumentScopes(headed, activeRules);
  return normalizeAcademicSections(scoped, activeRules);
}

function semanticMock(texts, headings, activeRules) {
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
    objectSemantics: { representations: [], captions: [], associations: [], resolutions: [] },
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
      isRuleDefinedHeading: activeRules.some((rule) =>
        JSON.stringify(rule.expected).includes(paragraph.text),
      ),
      isObjectReferenceExcluded: false,
    })),
    headings,
  };

  return normalizeAcademicSections(baseDocument, activeRules);
}

function occurrence(document, section) {
  const identity = normalizeSectionName(section);
  const found = document.academicSections.occurrences.find((item) => item.identity === identity);

  if (!found) {
    throw new Error(`Expected occurrence not found: ${section}`);
  }

  return found;
}

function rules() {
  return [
    requiredRule("Özet"),
    requiredRule("Abstract"),
    requiredRule("Kaynaklar"),
    wordRule("Özet", 200),
    wordRule("Abstract", 200),
    keywordRule("Özet", ["Anahtar Kelimeler"]),
    keywordRule("Abstract", ["Keyword"]),
  ];
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

function wordRule(section, max, min) {
  return {
    id: `rule.word.${normalizeSectionName(section)}`,
    type: "SECTION_WORD_COUNT",
    title: `${section} word count`,
    description: "",
    category: "structure",
    expected: {
      section,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function keywordRule(section, labels) {
  return {
    id: `rule.keywords.${normalizeSectionName(section)}`,
    type: "SECTION_KEYWORDS",
    title: `${section} keywords`,
    description: "",
    category: "structure",
    expected: {
      section,
      labels,
      min: 3,
      max: 5,
      separators: [","],
      placement: "section-end",
    },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
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

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>';
}

function heading(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocHeading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function splitTextParagraph(parts) {
  return `<w:p>${parts.map((text) => `<w:r><w:t>${text}</w:t></w:r>`).join("")}</w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>`;
}

function deletedParagraph(text) {
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
