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
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");

function main() {
  assertBodyCitationLikeCandidatePreserved();
  assertSingleAuthorYearItem();
  assertTwoAuthorVeItem();
  assertEtAlItem();
  assertYearSuffixItems();
  assertAnonymousItem();
  assertReliableMultipleCitationGroup();
  assertNormalParentheticalTextExcluded();
  assertBareYearExcluded();
  assertBareYearCandidateDoesNotCreateItem();
  assertAmbiguousCandidatePreservesOccurrenceWithoutItem();
  assertOrganizationAndNamedAuthorKinds();
  assertBibliographyContentExcluded();
  assertTocExcluded();
  assertTextboxExcluded();
  assertDeletedAndMoveFromExcluded();
  assertHeadingExcluded();
  assertCaptionExcluded();
  assertFrontMatterAndListSectionExcluded();
  assertDuplicateVisibleOccurrencesPreserved();
  assertDuplicateVisibleCitationItemsPreserved();
  assertSyntheticSecondUniversityUsesGenericSemantics();

  console.log(JSON.stringify({
    phase: "citation-bibliography-sprint-4",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertBodyCitationLikeCandidatePreserved() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Bu bulgu onceki calismayla uyumludur (Yilmaz, 2024)."),
  );
  const occurrence = document.citationSemantics.occurrences[0];

  assertEqual(document.citationSemantics.occurrences.length, 1, "body citation occurrence count");
  assertEqual(occurrence.matchedText, "(Yilmaz, 2024)", "body citation matched text");
  assertEqual(occurrence.scope, "body", "body citation scope");
  assertEqual(occurrence.confidence, "medium", "body citation confidence");
  assertEqual(occurrence.evidence.includes("visible-document-paragraph"), true, "visible evidence");
  assertEqual(occurrence.evidence.includes("author-year-parenthetical-pattern"), true, "pattern evidence");
}

function assertSingleAuthorYearItem() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Bu bulgu onceki calismayla uyumludur (Yilmaz, 2024)."),
  );
  const item = document.citationSemantics.occurrences[0].items[0];

  assertEqual(document.citationSemantics.occurrences[0].items.length, 1, "single author item count");
  assertEqual(item.authorKind, "named", "single author kind");
  assertEqual(item.authors[0], "Yilmaz", "single author value");
  assertEqual(item.year, "2024", "single author year");
  assertEqual(item.yearSuffix, null, "single author suffix");
  assertEqual(item.context, "parenthetical", "single author context");
  assertEqual(item.confidence, "high", "single author confidence");
}

function assertTwoAuthorVeItem() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Iki yazarli calisma kullanildi (Yilmaz ve Demir, 2024)."),
  );
  const item = document.citationSemantics.occurrences[0].items[0];

  assertEqual(item.authorKind, "named", "two-author kind");
  assertEqual(item.authors.length, 2, "two-author count");
  assertEqual(item.authors[0], "Yilmaz", "two-author first");
  assertEqual(item.authors[1], "Demir", "two-author second");
  assertEqual(item.parseEvidence.includes("two-author-ve-pattern"), true, "two-author evidence");
}

function assertEtAlItem() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Cok yazarli calisma kullanildi (Yilmaz vd., 2020)."),
  );
  const item = document.citationSemantics.occurrences[0].items[0];

  assertEqual(item.authorKind, "named", "et-al kind");
  assertEqual(item.authors.length, 1, "et-al lead author only");
  assertEqual(item.authors[0], "Yilmaz", "et-al lead author");
  assertEqual(item.year, "2020", "et-al year");
  assertEqual(item.parseEvidence.includes("et-al-pattern"), true, "et-al evidence");
}

function assertYearSuffixItems() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Ayni yazar calismalari ayrildi (Yilmaz, 2020a; Yilmaz, 2020b)."),
  );
  const items = document.citationSemantics.occurrences[0].items;

  assertEqual(items.length, 2, "year suffix item count");
  assertEqual(items[0].year, "2020", "first suffix year");
  assertEqual(items[0].yearSuffix, "a", "first suffix value");
  assertEqual(items[1].yearSuffix, "b", "second suffix value");
  assertEqual(items[0].parseEvidence.includes("year-suffix"), true, "year suffix evidence");
}

function assertAnonymousItem() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Kaynak anonim olarak verilmistir (Anonim, 2024)."),
  );
  const item = document.citationSemantics.occurrences[0].items[0];

  assertEqual(item.authorKind, "anonymous", "anonymous kind");
  assertEqual(item.authors[0], "Anonim", "anonymous value");
  assertEqual(item.year, "2024", "anonymous year");
}

function assertReliableMultipleCitationGroup() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Birden fazla kaynak birlikte verildi (Yilmaz, 2024; Demir, 2023)."),
  );
  const items = document.citationSemantics.occurrences[0].items;

  assertEqual(items.length, 2, "multiple group item count");
  assertEqual(items[0].authors[0], "Yilmaz", "multiple group first author");
  assertEqual(items[1].authors[0], "Demir", "multiple group second author");
  assertEqual(items[1].parseEvidence.includes("semicolon-item-separator"), true,
    "multiple group separator evidence");
}

function assertNormalParentheticalTextExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Bu ifade normal bir aciklamadir (bkz. 2024 raporu)."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "normal parenthetical excluded");
}

function assertBareYearExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Proje takvimi (2024) yilinda tamamlanmistir."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "bare year excluded");
}

function assertBareYearCandidateDoesNotCreateItem() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Bu metinde yalniz yil vardir (2024)."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "bare year occurrence absent");
}

function assertAmbiguousCandidatePreservesOccurrenceWithoutItem() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Belirsiz ekip referansi korunur (Research Team, 2024)."),
  );
  const occurrence = document.citationSemantics.occurrences[0];

  assertEqual(document.citationSemantics.occurrences.length, 1, "ambiguous occurrence preserved");
  assertEqual(occurrence.items.length, 0, "ambiguous item absent");
}

function assertOrganizationAndNamedAuthorKinds() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Kurumsal kaynak ayrilir (World Health Organization, 2024).") +
      paragraph("Kisi yazari ayrilir (Yilmaz, 2024)."),
  );
  const organizationItem = document.citationSemantics.occurrences[0].items[0];
  const namedItem = document.citationSemantics.occurrences[1].items[0];

  assertEqual(organizationItem.authorKind, "organization", "organization author kind");
  assertEqual(organizationItem.authors[0], "World Health Organization", "organization author value");
  assertEqual(namedItem.authorKind, "named", "named author kind preserved");
  assertEqual(namedItem.authors[0], "Yilmaz", "named author value preserved");
}

function assertBibliographyContentExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Metin.") +
      heading("Kaynaklar") +
      paragraph("Yilmaz, A. (2024). Kaynak basligi."),
  );

  assertEqual(document.bibliography.entries.length, 1, "bibliography entry exists");
  assertEqual(document.citationSemantics.occurrences.length, 0, "bibliography content excluded");
}

function assertTocExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      tocParagraph("Metinde (Yilmaz, 2024) geciyor."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "TOC citation excluded");
}

function assertTextboxExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      textboxParagraph("Metinde (Yilmaz, 2024) geciyor."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "textbox citation excluded");
}

function assertDeletedAndMoveFromExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      deletedParagraph("Silinen (Yilmaz, 2024)") +
      moveFromParagraph("Tasinan (Demir, 2023)"),
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "deleted and moveFrom excluded");
}

function assertHeadingExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      heading("Bulgular (Yilmaz, 2024)") +
      paragraph("Metin."),
    [
      requiredRule("Giris"),
      requiredRule("Kaynaklar"),
      requiredRule("Bulgular (Yilmaz, 2024)"),
    ],
  );

  assertEqual(document.citationSemantics.occurrences.length, 0, "heading citation excluded");
}

function assertCaptionExcluded() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Şekil 1. Deney duzeni (Yilmaz, 2024)") +
      paragraph("Metin."),
  );

  assertEqual(document.captions.items.length, 1, "caption detected");
  assertEqual(document.citationSemantics.occurrences.length, 0, "caption citation excluded");
}

function assertFrontMatterAndListSectionExcluded() {
  const document = semanticDocument(
    paragraph("Kapak metni (Yilmaz, 2024)") +
      heading("Giris") +
      heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney (Demir, 2023)") +
      heading("Bulgular") +
      paragraph("Ana metin (Kaya, 2022)."),
    [
      requiredRule("Giris"),
      requiredRule("Kaynaklar"),
      requiredRule("Tablolar Listesi"),
      requiredRule("Bulgular"),
    ],
  );

  assertEqual(document.citationSemantics.occurrences.length, 1, "only body outside list preserved");
  assertEqual(document.citationSemantics.occurrences[0].matchedText, "(Kaya, 2022)", "body occurrence preserved");
}

function assertDuplicateVisibleOccurrencesPreserved() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Ilk atif (Yilmaz, 2024).") +
      paragraph("Ikinci atif (Yilmaz, 2024)."),
  );

  assertEqual(document.citationSemantics.occurrences.length, 2, "duplicate occurrence count");
  assertNotEqual(document.citationSemantics.occurrences[0].id, document.citationSemantics.occurrences[1].id,
    "duplicate occurrences keep separate ids");
  assertEqual(document.citationSemantics.occurrences[0].normalizedMatchedText,
    document.citationSemantics.occurrences[1].normalizedMatchedText,
    "duplicate normalized text remains deterministic");
}

function assertDuplicateVisibleCitationItemsPreserved() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Ilk atif (Yilmaz, 2024).") +
      paragraph("Ikinci atif (Yilmaz, 2024)."),
  );
  const firstItem = document.citationSemantics.occurrences[0].items[0];
  const secondItem = document.citationSemantics.occurrences[1].items[0];

  assertNotEqual(firstItem.id, secondItem.id, "duplicate item ids differ");
  assertEqual(firstItem.normalizedText, secondItem.normalizedText,
    "duplicate item normalized text deterministic");
}

function assertSyntheticSecondUniversityUsesGenericSemantics() {
  const document = semanticDocument(
    heading("Giris") +
      paragraph("Generic rule set ile de calisir (Smith, 2021)."),
    [
      {
        ...requiredRule("Giris"),
        id: "synthetic.university.program.introduction",
      },
      {
        ...requiredRule("Kaynaklar"),
        id: "synthetic.university.program.references",
      },
    ],
  );

  assertEqual(document.citationSemantics.occurrences.length, 1, "synthetic university occurrence count");
  assertEqual(document.citationSemantics.occurrences[0].matchedText, "(Smith, 2021)",
    "synthetic university generic semantics");
  assertEqual(document.citationSemantics.occurrences[0].items[0].authors[0], "Smith",
    "synthetic university generic item parser");
}

function semanticDocument(bodyXml, rules = [requiredRule("Giris"), requiredRule("Kaynaklar")]) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const withBibliography = normalizeBibliographySemantics(sectioned, rules);

  return normalizeCitationSemantics(withBibliography);
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

function wrapDocumentXml(content) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}</w:body></w:document>`;
}

function heading(text) {
  return paragraph(text);
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocParagraph(text) {
  return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\o "1-3" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${text}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx><w:txbxContent>${paragraph(text)}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function deletedParagraph(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function moveFromParagraph(text) {
  return `<w:p><w:moveFrom w:id="2"><w:r><w:t>${text}</w:t></w:r></w:moveFrom></w:p>`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNotEqual(actual, expected, label) {
  if (actual === expected) {
    throw new Error(`${label}: expected values to differ, both were ${JSON.stringify(actual)}`);
  }
}

main();



