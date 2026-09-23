const path = require("path");

require("../golden/experimentalGoldenRegression.cjs");

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeBibliographySemantics,
} = require("../../src/features/analysis/parsers/bibliographySemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  BibliographyReferencesValidator,
} = require("../../src/features/analysis/rules/validators/BibliographyReferencesValidator.ts");

function main() {
  assertValidBibliographySection();
  assertMissingBibliographySection();
  assertEmptyBibliographySection();
  assertMultipleEntries();
  assertDuplicateLookingEntriesPreserved();
  assertSplitRunEntry();
  assertDeletedTextExcluded();
  assertTextboxFalsePositiveExcluded();
  assertTocFalsePositiveExcluded();
  assertNextSectionBoundaryProtection();
  assertBlankParagraphSafety();
  assertFormattingFactsCaptured();
  assertMultiParagraphAmbiguityIsMarked();
  assertTableCellExclusion();
  assertHyperlinkAndFieldVisibleText();
  assertNoRawSubstringSectionDetection();

  console.log(JSON.stringify({
    phase: "4F-07",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertValidBibliographySection() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Gida teknolojisi arastirmalari."),
  );

  assertEqual(result.status, "PASSED", "valid bibliography status");
  assertEqual(document.bibliography.status, "SECTION_PRESENT_WITH_ENTRIES", "valid bibliography status fact");
  assertEqual(document.bibliography.entries.length, 1, "valid bibliography entry count");
  assertEqual(document.bibliography.entries[0].boundaryStatus, "DEFINITE_ENTRY", "valid entry boundary");
}

function assertMissingBibliographySection() {
  const { result } = analyze(heading("GiriÅŸ") + paragraph("Metin."));

  assertEqual(result.status, "FAILED", "missing bibliography status");
  assertEqual(result.actual, "Tespit edilmedi", "missing bibliography actual");
}

function assertEmptyBibliographySection() {
  const { document, result } = analyze(heading("Kaynaklar") + blankParagraph());

  assertEqual(result.status, "FAILED", "empty bibliography status");
  assertEqual(document.bibliography.status, "SECTION_PRESENT_EMPTY", "empty bibliography semantic status");
  assertEqual(document.bibliography.entries.length, 0, "empty bibliography entry count");
}

function assertMultipleEntries() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Gida teknolojisi.") +
      paragraph("Demir, B. (2023). Fermentasyon calismalari."),
  );

  assertEqual(result.status, "PASSED", "multiple entries status");
  assertEqual(document.bibliography.entries.length, 2, "multiple entries count");
}

function assertDuplicateLookingEntriesPreserved() {
  const duplicate = "Yilmaz, A. (2024). Gida teknolojisi.";
  const { document } = analyze(
    heading("Kaynaklar") +
      paragraph(duplicate) +
      paragraph(duplicate),
  );

  assertEqual(document.bibliography.entries.length, 2, "duplicate-looking entries preserved");
  assertEqual(document.bibliography.entries[0].normalizedText, document.bibliography.entries[1].normalizedText,
    "duplicate-looking normalized text remains equal");
  assertNotEqual(document.bibliography.entries[0].id, document.bibliography.entries[1].id,
    "duplicate-looking entries keep separate ids");
}

function assertSplitRunEntry() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      paragraphRuns(["Smith", ", ", "2024", ". ", "Title"]),
  );

  assertEqual(result.status, "PASSED", "split-run entry status");
  assertEqual(document.bibliography.entries[0].visibleText, "Smith, 2024. Title", "split-run visible text");
}

function assertDeletedTextExcluded() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      `<w:p><w:del w:id="1"><w:r><w:t>Deleted, D. (2020). Hidden.</w:t></w:r></w:del></w:p>`,
  );

  assertEqual(result.status, "FAILED", "deleted-only entry fails as empty");
  assertEqual(document.bibliography.entries.length, 0, "deleted-only entry excluded");
}

function assertTextboxFalsePositiveExcluded() {
  const { document, result } = analyze(
    paragraph("Body") +
      textboxParagraph("Kaynaklar") +
      textboxParagraph("Hidden, H. (2022). Textbox source."),
  );

  assertEqual(result.status, "FAILED", "textbox false-positive status");
  assertEqual(document.bibliography.status, "SECTION_MISSING", "textbox heading excluded");
}

function assertTocFalsePositiveExcluded() {
  const { document, result } = analyze(
    tocParagraph("Kaynaklar") +
      tocParagraph("Yilmaz, A. (2024). Gida teknolojisi."),
  );

  assertEqual(result.status, "FAILED", "TOC false-positive status");
  assertEqual(document.bibliography.status, "SECTION_MISSING", "TOC heading excluded");
}

function assertNextSectionBoundaryProtection() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Gida teknolojisi.") +
      heading("Ã–zgeÃ§miÅŸ") +
      paragraph("Bu paragraf kaynak girdisi degildir."),
    [referencesRule(), requiredRule("Ã–zgeÃ§miÅŸ")],
  );

  assertEqual(result.status, "PASSED", "next-section boundary status");
  assertEqual(document.bibliography.entries.length, 1, "next-section leakage prevented");
  assertEqual(document.bibliography.entries[0].visibleText.includes("Ozgecmis"), false, "next-section text absent");
}

function assertBlankParagraphSafety() {
  const { document } = analyze(
    heading("Kaynaklar") +
      blankParagraph() +
      paragraph("Yilmaz, A. (2024). Gida teknolojisi.") +
      blankParagraph(),
  );

  assertEqual(document.bibliography.entries.length, 1, "blank paragraphs excluded");
}

function assertFormattingFactsCaptured() {
  const { document } = analyze(
    heading("Kaynaklar") +
      `<w:p><w:pPr><w:spacing w:line="240" w:before="120" w:after="0"/><w:ind w:start="720" w:hanging="360"/><w:jc w:val="both"/></w:pPr><w:r><w:t>Yilmaz, A. (2024). Gida teknolojisi.</w:t></w:r></w:p>`,
  );
  const formatting = document.bibliography.entries[0].formatting;

  assertEqual(formatting.alignment, "justify", "formatting alignment captured");
  assertEqual(formatting.lineSpacing, 240, "formatting line spacing captured");
  assertEqual(formatting.paragraphFormatting.indentation.leftTwips, 720, "left indent captured");
  assertEqual(formatting.paragraphFormatting.indentation.hangingTwips, 360, "hanging indent captured");
}

function assertMultiParagraphAmbiguityIsMarked() {
  const { document } = analyze(
    heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Gida teknolojisi") +
      paragraph("devam eden baslik bilgisi."),
  );

  assertEqual(document.bibliography.status, "SECTION_PRESENT_UNRESOLVED_CONTENT", "multi-paragraph ambiguity status");
  assertEqual(document.bibliography.entries[1].boundaryStatus, "POSSIBLE_CONTINUATION", "continuation marked");
  assertEqual(document.bibliography.unresolvedParagraphIds.length, 1, "unresolved paragraph tracked");
}

function assertTableCellExclusion() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      `<w:tbl><w:tr><w:tc>${paragraph("Yilmaz, A. (2024). Table cell source.")}</w:tc></w:tr></w:tbl>`,
  );

  assertEqual(result.status, "FAILED", "table-cell-only bibliography fails");
  assertEqual(document.bibliography.entries.length, 0, "table-cell paragraph excluded");
}

function assertHyperlinkAndFieldVisibleText() {
  const { document, result } = analyze(
    heading("Kaynaklar") +
      `<w:p><w:hyperlink><w:r><w:t>Online, O. (2024). Web source. https://example.com</w:t></w:r></w:hyperlink></w:p>` +
      `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF Hidden </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Field, F. (2023). Cached source.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`,
  );

  assertEqual(result.status, "PASSED", "hyperlink and field status");
  assertEqual(document.bibliography.entries.length, 2, "hyperlink and field entry count");
  assertEqual(document.bibliography.entries[0].visibleText.includes("https://example.com"), true,
    "hyperlink visible text preserved");
  assertEqual(document.bibliography.entries[1].visibleText, "Field, F. (2023). Cached source.",
    "field cached visible text preserved");
}

function assertNoRawSubstringSectionDetection() {
  const { document, result } = analyze(
    paragraph("Bu paragrafta Kaynaklar kelimesi geciyor.") +
      paragraph("Yilmaz, A. (2024). Gida teknolojisi."),
  );

  assertEqual(result.status, "FAILED", "raw substring section detection blocked");
  assertEqual(document.bibliography.status, "SECTION_MISSING", "raw substring did not create section");
}

function analyze(bodyXml, rules = [referencesRule()]) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const document = normalizeBibliographySemantics(sectioned, rules);
  const result = new BibliographyReferencesValidator().validate(document, referencesRule());

  return { document, result };
}

function referencesRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.references",
    type: "REQUIRED_SECTION",
    title: "Kaynaklar BÃ¶lÃ¼mÃ¼",
    description: "",
    category: "structure",
    expected: { section: "Kaynaklar", required: true },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function requiredRule(section) {
  return {
    ...referencesRule(),
    id: `required.${section}`,
    title: `${section} required`,
    expected: { section, required: true },
  };
}

function wrapDocumentXml(content) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}</w:body></w:document>`;
}

function heading(text) {
  return paragraph(text);
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraphRuns(values) {
  return `<w:p>${values.map((value) => `<w:r><w:t>${value}</w:t></w:r>`).join("")}</w:p>`;
}

function blankParagraph() {
  return "<w:p><w:r><w:t>   </w:t></w:r></w:p>";
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent>${paragraph(text)}</w:txbxContent></w:pict></w:r></w:p>`;
}

function tocParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(`${message}: did not expect ${expected}`);
  }
}

main();
