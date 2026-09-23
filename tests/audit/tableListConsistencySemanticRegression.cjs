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
  normalizeDocumentObjectReferences,
} = require("../../src/features/analysis/parsers/documentObjectReferencesNormalizer.ts");
const {
  normalizeTableListSemantics,
} = require("../../src/features/analysis/parsers/tableListSemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  ConditionalRequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");
const {
  ObjectCaptionPlacementValidator,
} = require("../../src/features/analysis/rules/validators/ObjectCaptionPlacementValidator.ts");
const {
  ObjectInTextReferenceValidator,
} = require("../../src/features/analysis/rules/validators/ObjectInTextReferenceValidator.ts");

function main() {
  assertRealTableDetectedStructurally();
  assertPlainTabloTextDoesNotCreateTable();
  assertValidCaptionAssociation();
  assertMissingCaption();
  assertAmbiguousCaptionAssociation();
  assertCaptionPlacementBeforeAfter();
  assertSplitRunCaption();
  assertDuplicateCaptionNumberPreserved();
  assertValidListOfTablesSection();
  assertMissingListOfTablesSection();
  assertEmptyListOfTablesSection();
  assertMultipleListEntries();
  assertDuplicateListEntriesPreserved();
  assertListEntryPageNumberSuffixIgnored();
  assertTableListMatch();
  assertTableMissingFromList();
  assertOrphanListEntry();
  assertAmbiguousListAssociation();
  assertBodyReferenceResolves();
  assertBodyReferenceUnresolved();
  assertTabloOneVsTenCollisionProtection();
  assertCaptionNotCountedAsBodyReference();
  assertListEntryNotCountedAsBodyReference();
  assertTocFalsePositiveProtection();
  assertDeletedRevisionProtection();
  assertTextboxProtection();
  assertTableCellFalsePositiveProtection();
  assertNextSectionLeakageProtection();
  assertFieldAndHyperlinkVisibleText();
  assertNoRenderedPageNumberAssertion();

  console.log(JSON.stringify({
    phase: "4F-08",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertRealTableDetectedStructurally() {
  const document = semanticDocument(caption("Tablo 1. Deney") + tableXml());

  assertEqual(document.tables.hasTables, true, "real table structural fact");
  assertEqual(document.tables.items.length, 1, "real table count");
}

function assertPlainTabloTextDoesNotCreateTable() {
  const document = semanticDocument(paragraph("Tablo 1. Deney"));

  assertEqual(document.tables.hasTables, false, "plain text no table fact");
  assertEqual(document.captions.items.length, 1, "plain caption text can be caption");
}

function assertValidCaptionAssociation() {
  const document = semanticDocument(caption("Tablo 1. Deney") + tableXml());
  const table = document.tables.items[0];

  assertEqual(table.captionPosition, "before", "caption associated before table");
  assertEqual(table.captionId, "caption-1", "caption id associated");
}

function assertMissingCaption() {
  const document = semanticDocument(tableXml());
  const table = document.tables.items[0];

  assertEqual(table.captionPosition, "none", "missing caption position");
  assertEqual(table.captionId, null, "missing caption id");
}

function assertAmbiguousCaptionAssociation() {
  const document = semanticDocument(
    caption("Tablo 1. Once") + tableXml() + caption("Tablo 2. Sonra"),
  );

  assertEqual(document.tables.items[0].captionPosition, "ambiguous", "ambiguous caption position");
}

function assertCaptionPlacementBeforeAfter() {
  const valid = semanticDocument(caption("Tablo 1. Once") + tableXml());
  const invalid = semanticDocument(tableXml() + caption("Tablo 1. Sonra"));
  const rule = tableCaptionPlacementRule();

  assertEqual(new ObjectCaptionPlacementValidator().validate(valid, rule).status, "PASSED",
    "caption before table passes");
  assertEqual(new ObjectCaptionPlacementValidator().validate(invalid, rule).status, "FAILED",
    "caption after table fails placement");
}

function assertSplitRunCaption() {
  const document = semanticDocument(splitRunParagraph(["Tab", "lo ", "3", ". ", "Baslik"]) + tableXml());

  assertEqual(document.captions.items[0].number, "3", "split-run caption number");
  assertEqual(document.tables.items[0].captionId, document.captions.items[0].id, "split-run association");
}

function assertDuplicateCaptionNumberPreserved() {
  const document = semanticDocument(
    caption("Tablo 1. Bir") + tableXml() +
      caption("Tablo 1. Iki") + tableXml(),
  );

  assertEqual(document.tables.items.length, 2, "duplicate table occurrences preserved");
  assertEqual(document.captions.items.filter((item) => item.kind === "table" && item.number === "1").length, 2,
    "duplicate caption numbers preserved");
}

function assertValidListOfTablesSection() {
  const document = semanticDocument(
    caption("Tablo 1. Deney") + tableXml() +
      heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney"),
  );

  assertEqual(document.tableList.status, "LIST_SECTION_PRESENT_WITH_ENTRIES", "valid table list status");
  assertEqual(document.tableList.entries.length, 1, "valid table list entry count");
}

function assertMissingListOfTablesSection() {
  const document = semanticDocument(caption("Tablo 1. Deney") + tableXml());
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfTablesRule());

  assertEqual(document.tableList.status, "LIST_SECTION_MISSING", "missing list status");
  assertEqual(result.status, "FAILED", "missing list production failure remains");
}

function assertEmptyListOfTablesSection() {
  const document = semanticDocument(
    caption("Tablo 1. Deney") + tableXml() +
      heading("Tablolar Listesi") +
      blankParagraph(),
  );
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfTablesRule());

  assertEqual(document.tableList.status, "LIST_SECTION_PRESENT_EMPTY", "empty list status");
  assertEqual(result.status, "PASSED", "empty list does not become unsupported production failure");
}

function assertMultipleListEntries() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney") +
      paragraph("Tablo 2. Sonuc"),
  );

  assertEqual(document.tableList.entries.length, 2, "multiple list entries");
}

function assertDuplicateListEntriesPreserved() {
  const document = semanticDocument(
    caption("Tablo 1. Deney") + tableXml() +
      heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney") +
      paragraph("Tablo 1. Deney"),
  );

  assertEqual(document.tableList.entries.length, 2, "duplicate list entries preserved");
  assertNotEqual(document.tableList.entries[0].id, document.tableList.entries[1].id,
    "duplicate list entries keep occurrence ids");
}

function assertListEntryPageNumberSuffixIgnored() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      paragraph("Tablo 2.1 Deney sonuclari ........ 14"),
  );
  const entry = document.tableList.entries[0];

  assertEqual(entry.number, "2.1", "list entry number");
  assertEqual(entry.title, "Deney sonuclari", "page number suffix ignored");
  assertEqual(entry.evidence.includes("page-number-suffix-ignored"), true, "page suffix evidence");
}

function assertTableListMatch() {
  const document = semanticDocument(
    caption("Tablo 1. Deney") + tableXml() +
      heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney"),
  );

  assertEqual(document.tableList.tableAssociations[0].status, "MATCHED", "table to list matched");
  assertEqual(document.tableList.entryAssociations[0].status, "MATCHED", "list to table matched");
}

function assertTableMissingFromList() {
  const document = semanticDocument(
    caption("Tablo 1. Deney") + tableXml() +
      heading("Tablolar Listesi") +
      paragraph("Tablo 2. Baska"),
  );

  assertEqual(document.tableList.tableAssociations[0].status, "MISSING_LIST_ENTRY",
    "missing table list entry preserved");
}

function assertOrphanListEntry() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      paragraph("Tablo 9. Olmayan"),
  );

  assertEqual(document.tableList.entryAssociations[0].status, "ORPHAN_LIST_ENTRY",
    "orphan list entry preserved");
}

function assertAmbiguousListAssociation() {
  const document = semanticDocument(
    caption("Tablo 1. Bir") + tableXml() +
      paragraph("Ara metin.") +
      caption("Tablo 1. Iki") + tableXml() +
      heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney"),
  );

  assertEqual(document.tableList.entryAssociations[0].status, "AMBIGUOUS",
    "duplicate caption number makes list association ambiguous");
}

function assertBodyReferenceResolves() {
  const document = semanticDocument(
    paragraph("Tablo 1 metinde anildi.") +
      caption("Tablo 1. Deney") +
      tableXml(),
  );
  const result = new ObjectInTextReferenceValidator().validate(document, tableReferenceRule());

  assertEqual(result.status, "PASSED", "body table reference resolves");
}

function assertBodyReferenceUnresolved() {
  const document = semanticDocument(
    paragraph("Tablo 10 metinde anildi.") +
      caption("Tablo 1. Deney") +
      tableXml(),
  );
  const result = new ObjectInTextReferenceValidator().validate(document, tableReferenceRule());

  assertEqual(result.status, "FAILED", "unresolved body table reference does not satisfy table 1");
}

function assertTabloOneVsTenCollisionProtection() {
  const document = semanticDocument(
    paragraph("Tablo 10 metinde anildi.") +
      caption("Tablo 1. Deney") +
      tableXml(),
  );

  assertEqual(document.objectReferences.items.some((item) => item.kind === "table" && item.number === "1"), false,
    "Tablo 10 does not create Tablo 1 reference");
}

function assertCaptionNotCountedAsBodyReference() {
  const document = semanticDocument(caption("Tablo 1. Deney") + tableXml());
  const result = new ObjectInTextReferenceValidator().validate(document, tableReferenceRule());

  assertEqual(result.status, "FAILED", "caption itself is not body reference");
}

function assertListEntryNotCountedAsBodyReference() {
  const document = semanticDocument(
    caption("Tablo 1. Deney") + tableXml() +
      heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney"),
  );
  const result = new ObjectInTextReferenceValidator().validate(document, tableReferenceRule());

  assertEqual(result.status, "FAILED", "list entry is not body reference");
}

function assertTocFalsePositiveProtection() {
  const document = semanticDocument(tocParagraph("Tablolar Listesi") + tocParagraph("Tablo 1. Deney"));

  assertEqual(document.tableList.status, "LIST_SECTION_MISSING", "TOC table list false positive excluded");
}

function assertDeletedRevisionProtection() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      deletedParagraph("Tablo 1. Silinmis"),
  );

  assertEqual(document.tableList.status, "LIST_SECTION_PRESENT_EMPTY", "deleted list entry excluded");
}

function assertTextboxProtection() {
  const document = semanticDocument(
    textboxParagraph("Tablolar Listesi") +
      textboxParagraph("Tablo 1. Textbox"),
  );

  assertEqual(document.tableList.status, "LIST_SECTION_MISSING", "textbox table list false positive excluded");
}

function assertTableCellFalsePositiveProtection() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      tableCellParagraph("Tablo 1. Hucre"),
  );

  assertEqual(document.tableList.entries.length, 0, "table-cell list entry excluded");
}

function assertNextSectionLeakageProtection() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney") +
      heading("Kaynaklar") +
      paragraph("Tablo 2. Listeye sizmamali"),
    [listOfTablesRule(), requiredRule("Kaynaklar")],
  );

  assertEqual(document.tableList.entries.length, 1, "next section leakage prevented");
  assertEqual(document.tableList.entries[0].number, "1", "only first list entry included");
}

function assertFieldAndHyperlinkVisibleText() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      hyperlinkParagraph("Tablo 1. Web kaynakli ........ 7") +
      fieldParagraph("Tablo 2. Field sonucu ........ 8"),
  );

  assertEqual(document.tableList.entries.length, 2, "hyperlink and field visible entries");
  assertEqual(document.tableList.entries[0].title, "Web kaynakli", "hyperlink visible title");
  assertEqual(document.tableList.entries[1].title, "Field sonucu", "field cached visible title");
}

function assertNoRenderedPageNumberAssertion() {
  const document = semanticDocument(
    heading("Tablolar Listesi") +
      paragraph("Tablo 1. Deney ........ 999"),
  );

  assertEqual(document.tableList.entries[0].number, "1", "rendered page number ignored");
  assertEqual(document.tableList.entries[0].title, "Deney", "rendered page number not title");
}

function semanticDocument(bodyXml, rules = [listOfTablesRule(), tableReferenceRule()]) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const listed = normalizeTableListSemantics(sectioned, rules);

  return {
    ...listed,
    objectReferences: normalizeDocumentObjectReferences(listed),
  };
}

function listOfTablesRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.list-of-tables",
    type: "CONDITIONAL_REQUIRED_SECTION",
    title: "Tablolar Listesi",
    description: "",
    category: "structure",
    expected: { section: "Tablolar Listesi", requiredWhen: { fact: "hasTables", equals: true } },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function tableReferenceRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.table-in-text-reference",
    type: "OBJECT_IN_TEXT_REFERENCE",
    title: "Tablo Metin Ici Atfi",
    description: "",
    category: "citation",
    expected: { object: "table" },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function tableCaptionPlacementRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.table-caption-placement",
    type: "OBJECT_CAPTION_PLACEMENT",
    title: "Tablo Basligi Konumu",
    description: "",
    category: "format",
    expected: { object: "table", position: "before" },
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

function caption(text) {
  return paragraph(text);
}

function blankParagraph() {
  return paragraph("   ");
}

function splitRunParagraph(values) {
  return `<w:p>${values.map((value) => `<w:r><w:t>${value}</w:t></w:r>`).join("")}</w:p>`;
}

function tableXml() {
  return '<w:tbl><w:tblPr><w:jc w:val="center"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Hucre</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
}

function tableCellParagraph(text) {
  return `<w:tbl><w:tr><w:tc>${paragraph(text)}</w:tc></w:tr></w:tbl>`;
}

function tocParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function deletedParagraph(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent>${paragraph(text)}</w:txbxContent></w:pict></w:r></w:p>`;
}

function hyperlinkParagraph(text) {
  return `<w:p><w:hyperlink><w:r><w:t>${text}</w:t></w:r></w:hyperlink></w:p>`;
}

function fieldParagraph(resultText) {
  return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF TableListEntry </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${resultText}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
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
