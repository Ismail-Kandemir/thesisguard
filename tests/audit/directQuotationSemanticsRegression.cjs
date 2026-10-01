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
  normalizeCitationSemantics,
} = require("../../src/features/analysis/parsers/citationSemanticsNormalizer.ts");
const {
  normalizeDirectQuotationSemantics,
} = require("../../src/features/analysis/parsers/directQuotationSemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");

function main() {
  assertStraightQuote();
  assertSmartQuote();
  assertSplitRunQuotedText();
  assertSplitRunDelimiters();
  assertSingleCitationSinglePage();
  assertPageRange();
  assertMalformedPageMarker();
  assertMultipleQuotesWithMultipleCitations();
  assertMultipleQuotesWithOneCitationAmbiguous();
  assertOneQuoteWithMultipleCitationsAmbiguous();
  assertCitationBeforeQuoteUnresolved();
  assertCitationSameParagraphDifferentRun();
  assertQuoteAndCitationSplitRuns();
  assertUnmatchedQuote();
  assertNestedAmbiguity();
  assertTocExcluded();
  assertTextboxExcluded();
  assertHeadingCaptionAndTableCellExcluded();
  assertWordBoundaries();
  assertDeterministicRunSpanMapping();
  assertCitationSemanticsUnchanged();
  assertScareQuoteWithoutCitationNotHighConfidence();

  console.log(JSON.stringify({
    phase: "direct-quotation-semantics-sprint-4",
    result: "PASS",
    audit: path.basename(__filename),
    shortQuotationPolicy: "<40 words is inline short-quotation eligible; 40+ words is not high-confidence inline",
  }, null, 2));
}

function assertStraightQuote() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('Yildirim bilimi "olgulari aciklama cabasi" olarak tanimlar (Yilmaz, 2024).'),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.rawText, "olgulari aciklama cabasi", "straight raw text");
  assertEqual(quote.delimiterEvidence[0].kind, "straight-double", "straight opening evidence");
  assertEqual(quote.delimiterEvidence[1].kind, "straight-double", "straight closing evidence");
}

function assertSmartQuote() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Yildirim bilimi “olgulari aciklama cabasi” olarak tanimlar (Yilmaz, 2024)."),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.rawText, "olgulari aciklama cabasi", "smart raw text");
  assertEqual(quote.delimiterEvidence[0].kind, "smart-left-double", "smart opening evidence");
  assertEqual(quote.delimiterEvidence[1].kind, "smart-right-double", "smart closing evidence");
}

function assertSplitRunQuotedText() {
  const document = semanticDocument(
    heading("Giris") +
      paragraphRuns([
        'Yildirim "olgulari ',
        "aciklama ",
        'cabasi" olarak tanimlar ',
        "(Yilmaz, 2024).",
      ]),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.rawText, "olgulari aciklama cabasi", "split quoted text reconstructed");
  assertEqual(quote.textSpan.runSegments.length, 3, "split quoted text segment count");
}

function assertSplitRunDelimiters() {
  const document = semanticDocument(
    heading("Giris") +
      paragraphRuns([
        "Yildirim ",
        '"',
        "olgulari aciklama cabasi",
        '"',
        " olarak tanimlar ",
        "(Yilmaz, 2024).",
      ]),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.rawText, "olgulari aciklama cabasi", "split delimiter raw text");
  assertEqual(quote.delimiterEvidence[0].span.runSegments[0].runIndex, 1, "opening delimiter run index");
  assertEqual(quote.delimiterEvidence[1].span.runSegments[0].runIndex, 3, "closing delimiter run index");
}

function assertSingleCitationSinglePage() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('"Birinci alinti" (Yilmaz, 2024, s. 95).'),
  );
  const quote = onlyHighConfidenceQuote(document);
  const citationEvidence = quote.citationEvidence[0];

  assertEqual(citationEvidence.associationStatus, "associated", "single citation associated");
  assertEqual(citationEvidence.associationMethod, "same-paragraph-single-following-citation",
    "single citation association method");
  assertEqual(citationEvidence.pageEvidence.hasPageMarker, true, "single page marker present");
  assertEqual(citationEvidence.pageEvidence.marker, "s.", "single page marker kind");
  assertEqual(citationEvidence.pageEvidence.pageStart, "95", "single page value");
  assertEqual(citationEvidence.pageEvidence.pageEnd, null, "single page has no range end");
}

function assertPageRange() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('"Aralikli alinti" (Yilmaz, 2024, ss. 95-97).'),
  );
  const pageEvidence = onlyHighConfidenceQuote(document).citationEvidence[0].pageEvidence;

  assertEqual(pageEvidence.hasPageMarker, true, "page range marker present");
  assertEqual(pageEvidence.marker, "ss.", "page range marker kind");
  assertEqual(pageEvidence.rawText, "ss. 95-97", "page range raw evidence");
  assertEqual(pageEvidence.pageStart, "95", "page range start");
  assertEqual(pageEvidence.pageEnd, "97", "page range end");
}

function assertMalformedPageMarker() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('"Bozuk sayfa alintisi" (Yilmaz, 2024, s. abc).'),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.citationEvidence[0].associationStatus, "associated",
    "malformed page marker citation still associated");
  assertEqual(quote.citationEvidence[0].pageEvidence.hasPageMarker, false,
    "malformed page marker not parsed as page evidence");
}

function assertMultipleQuotesWithMultipleCitations() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('"Birinci alinti" (Yilmaz, 2024, s. 11). "Ikinci alinti" (Demir, 2023, s. 12).'),
  );
  const quotes = document.directQuotations.occurrences;

  assertEqual(quotes.length, 2, "multiple inline quote count");
  assertEqual(quotes.every((quote) => quote.confidence === "high"), true,
    "multiple quote multiple citation high confidence");
  assertEqual(quotes[0].citationEvidence[0].associationMethod,
    "same-paragraph-sequential-following-citation", "first sequential association");
  assertEqual(quotes[1].citationEvidence[0].pageEvidence.pageStart, "12",
    "second sequential page evidence");
}

function assertMultipleQuotesWithOneCitationAmbiguous() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('"Birinci alinti" ve "ikinci alinti" ayni paragraftadir (Yilmaz, 2024, s. 95).'),
  );
  const quotes = document.directQuotations.occurrences.filter((quote) => quote.kind === "inline");

  assertEqual(quotes.length, 2, "multiple quote one citation quote count");
  assertEqual(quotes.every((quote) => quote.confidence === "low"), true,
    "multiple quote one citation low confidence");
  assertEqual(quotes.every((quote) =>
    quote.citationEvidence[0].ambiguityReason === "multiple-quotes-one-citation"), true,
  "multiple quote one citation ambiguity reason");
}

function assertOneQuoteWithMultipleCitationsAmbiguous() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('"Tek alinti" (Yilmaz, 2024, s. 95) ve ayrica (Demir, 2023, s. 12).'),
  );
  const quote = onlyQuote(document);

  assertEqual(quote.confidence, "low", "one quote multiple citation low confidence");
  assertEqual(quote.citationEvidence[0].associationStatus, "ambiguous",
    "one quote multiple citation ambiguous");
  assertEqual(quote.citationEvidence[0].ambiguityReason, "multiple-candidate-citations",
    "one quote multiple citation ambiguity reason");
}

function assertCitationBeforeQuoteUnresolved() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('(Yilmaz, 2024, s. 95) yazarina gore "once citation sonra quote".'),
  );
  const quote = onlyQuote(document);

  assertEqual(quote.confidence, "low", "citation before quote low confidence");
  assertEqual(quote.citationEvidence[0].associationStatus, "unresolved",
    "citation before quote unresolved");
  assertEqual(quote.citationEvidence[0].ambiguityReason, "citation-before-quote",
    "citation before quote reason");
}

function assertCitationSameParagraphDifferentRun() {
  const document = semanticDocument(
    heading("Giris") +
      paragraphRuns([
        'Yildirim "olgulari aciklama cabasi"',
        " olarak tanimlar ",
        "(Yilmaz, 2024, s. 95).",
      ]),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.citationOccurrenceIds.length, 1, "different run citation association");
  assertEqual(document.citationSemantics.occurrences[0].matchedText, "(Yilmaz, 2024, s. 95)",
    "existing citation occurrence preserved");
}

function assertQuoteAndCitationSplitRuns() {
  const document = semanticDocument(
    heading("Giris") +
      paragraphRuns([
        '"Bolunmus ',
        'alinti" ',
        "(Yilmaz, ",
        "2024, s. ",
        "95).",
      ]),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.rawText, "Bolunmus alinti", "split quote text");
  assertEqual(quote.citationEvidence[0].pageEvidence.pageStart, "95",
    "split citation page evidence");
}

function assertUnmatchedQuote() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('Yildirim "acik kalan alinti (Yilmaz, 2024).'),
  );
  const quote = document.directQuotations.occurrences[0];

  assertEqual(quote.kind, "ambiguous", "unmatched quote kind");
  assertEqual(quote.confidence, "low", "unmatched quote confidence");
  assertIncludes(quote.exclusionEvidence, "unmatched-delimiter", "unmatched quote evidence");
}

function assertNestedAmbiguity() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Yildirim “dis alinti “ic alinti” devam” olarak tanimlar (Yilmaz, 2024)."),
  );
  const quote = document.directQuotations.occurrences[0];

  assertEqual(quote.kind, "ambiguous", "nested quote kind");
  assertEqual(quote.confidence, "low", "nested quote confidence");
  assertIncludes(quote.exclusionEvidence, "nested-double-quote", "nested quote evidence");
}

function assertTocExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      tocParagraph('"TOC alintisi" (Yilmaz, 2024).'),
  );
  const quote = document.directQuotations.occurrences[0];

  assertEqual(quote.confidence, "low", "TOC quote low confidence");
  assertIncludes(quote.exclusionEvidence, "toc-excluded", "TOC exclusion evidence");
}

function assertTextboxExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      textboxParagraph('"Textbox alintisi" (Yilmaz, 2024).'),
  );
  const quote = document.directQuotations.occurrences[0];

  assertEqual(quote.confidence, "low", "textbox quote low confidence");
  assertIncludes(quote.exclusionEvidence, "textbox-excluded", "textbox exclusion evidence");
}

function assertHeadingCaptionAndTableCellExcluded() {
  const headingDocument = semanticDocument(
    heading("Giris") +
      heading('"Baslik alintisi" (Yilmaz, 2024)'),
    [
      requiredRule("Giris"),
      requiredRule('"Baslik alintisi" (Yilmaz, 2024)'),
      requiredRule("Kaynaklar"),
    ],
  );
  const captionDocument = semanticDocument(
    heading("Giris") +
      paragraph('Tablo 1. "Caption alintisi" (Yilmaz, 2024).'),
  );
  const tableCellDocument = semanticDocument(
    heading("Giris") +
      `<w:tbl><w:tr><w:tc>${paragraph('"Hucre alintisi" (Yilmaz, 2024).')}</w:tc></w:tr></w:tbl>`,
  );

  assertIncludes(headingDocument.directQuotations.occurrences[0].exclusionEvidence,
    "heading-excluded", "heading exclusion evidence");
  assertIncludes(captionDocument.directQuotations.occurrences[0].exclusionEvidence,
    "caption-excluded", "caption exclusion evidence");
  assertIncludes(tableCellDocument.directQuotations.occurrences[0].exclusionEvidence,
    "table-cell-excluded", "table-cell exclusion evidence");
}

function assertWordBoundaries() {
  const document39 = semanticDocument(heading("Giris") + paragraph(quotedWords(39)));
  const document40 = semanticDocument(heading("Giris") + paragraph(quotedWords(40)));
  const document41 = semanticDocument(heading("Giris") + paragraph(quotedWords(41)));

  assertEqual(onlyQuote(document39).wordCount, 39, "39 word quote count");
  assertEqual(onlyQuote(document39).confidence, "high", "39 word quote high confidence");
  assertEqual(onlyQuote(document40).wordCount, 40, "40 word quote count");
  assertEqual(onlyQuote(document40).confidence, "low", "40 word quote low confidence");
  assertIncludes(onlyQuote(document40).exclusionEvidence, "word-count-not-short-quote",
    "40 word quote boundary evidence");
  assertEqual(onlyQuote(document41).wordCount, 41, "41 word quote count");
  assertEqual(onlyQuote(document41).confidence, "low", "41 word quote low confidence");
}

function assertDeterministicRunSpanMapping() {
  const document = semanticDocument(
    heading("Giris") +
      paragraphRuns([
        'A "bir ',
        "iki ",
        'uc" ',
        "(Yilmaz, 2024).",
      ]),
  );
  const quote = onlyHighConfidenceQuote(document);

  assertEqual(quote.textSpan.startOffset, 3, "span start offset");
  assertEqual(quote.textSpan.endOffset, 13, "span end offset");
  assertEqual(quote.textSpan.offsetUnit, "utf16-code-unit", "span offset unit");
  assertEqual(JSON.stringify(quote.textSpan.runSegments), JSON.stringify([
    { runIndex: 0, startOffset: 3, endOffset: 7, text: "bir " },
    { runIndex: 1, startOffset: 0, endOffset: 4, text: "iki " },
    { runIndex: 2, startOffset: 0, endOffset: 2, text: "uc" },
  ]), "run segment mapping");
}

function assertCitationSemanticsUnchanged() {
  const before = citationDocument(
    heading("Giris") +
      paragraph('Yildirim "olgulari aciklama cabasi" olarak tanimlar (Yilmaz, 2024).'),
  );
  const citationSnapshot = JSON.stringify(before.citationSemantics);
  const after = normalizeDirectQuotationSemantics(before);

  assertEqual(JSON.stringify(after.citationSemantics), citationSnapshot,
    "direct quotation normalization does not mutate citation semantics");
}

function assertScareQuoteWithoutCitationNotHighConfidence() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph('Bu terim "akilli" olarak adlandirilir.'),
  );
  const quote = onlyQuote(document);

  assertEqual(quote.confidence, "low", "scare quote without citation low confidence");
  assertIncludes(quote.exclusionEvidence, "citation-association-missing",
    "scare quote citation evidence missing");
}

function onlyHighConfidenceQuote(document) {
  const quotes = document.directQuotations.occurrences.filter((quote) => quote.confidence === "high");

  assertEqual(quotes.length, 1, "single high-confidence quote");
  return quotes[0];
}

function onlyQuote(document) {
  assertEqual(document.directQuotations.occurrences.length, 1, "single quote occurrence");
  return document.directQuotations.occurrences[0];
}

function semanticDocument(bodyXml, rules = defaultRules()) {
  return normalizeDirectQuotationSemantics(citationDocument(bodyXml, rules));
}

function citationDocument(bodyXml, rules = defaultRules()) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const withBibliography = normalizeBibliographySemantics(sectioned, rules);

  return normalizeCitationSemantics(withBibliography);
}

function defaultRules() {
  return [requiredRule("Giris"), requiredRule("Kaynaklar")];
}

function requiredRule(section) {
  return {
    id: `required.${section}`,
    type: "REQUIRED_SECTION",
    title: `${section} required`,
    description: "",
    category: "structure",
    expected: { section, required: true },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function quotedWords(count) {
  return `"${words(count)}" (Yilmaz, 2024, s. 95).`;
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `kelime${index + 1}`).join(" ");
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

function tocParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent>${paragraph(text)}</w:txbxContent></w:pict></w:r></w:p>`;
}

function assertIncludes(values, expected, label) {
  if (!values.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(values)} to include ${expected}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main();
