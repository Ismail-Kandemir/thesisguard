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
  normalizeFigureListSemantics,
} = require("../../src/features/analysis/parsers/figureListSemanticsNormalizer.ts");
const {
  normalizeTableListSemantics,
} = require("../../src/features/analysis/parsers/tableListSemanticsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  getDeclaredAcademicFigures,
} = require("../../src/features/analysis/rules/objectApplicability.ts");
const {
  ConditionalRequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");
const {
  ObjectInTextReferenceValidator,
} = require("../../src/features/analysis/rules/validators/ObjectInTextReferenceValidator.ts");

function main() {
  assertNoAcademicFigure();
  assertGenericDrawingOnly();
  assertTextboxDrawingOnly();
  assertOneResolvedAcademicFigure();
  assertMultipleResolvedFigures();
  assertAmbiguousFigureExcludedFromEligibility();
  assertExcludedRepresentationExcludedFromEligibility();
  assertValidListOfFiguresSection();
  assertMissingListOfFiguresSection();
  assertEmptyListOfFiguresSection();
  assertMultipleListEntries();
  assertDuplicateListEntriesPreserved();
  assertSplitRunListEntry();
  assertListPageNumberSuffixIgnored();
  assertFigureListMatch();
  assertMissingListEntry();
  assertOrphanListEntry();
  assertAmbiguousAssociation();
  assertSekilOneVsTenCollisionProtection();
  assertTableFigureKindIsolation();
  assertTocFalsePositiveProtection();
  assertDeletedRevisionProtection();
  assertTextboxProtection();
  assertNextSectionBoundary();
  assertHyperlinkAndFieldVisibleText();
  assertNoRenderedPaginationAssertion();
  assertNoFigureConditionalNotApplicable();
  assertFigureExistsListMissingFailure();
  assertExistingFigureCaptionSemanticsUnchanged();
  assertGenericDrawingNeverBecomesAcademicFigure();

  console.log(JSON.stringify({
    phase: "4F-09",
    result: "PASS",
    audit: path.basename(__filename),
  }, null, 2));
}

function assertNoAcademicFigure() {
  const document = semanticDocument(paragraph("Giriş") + paragraph("Metin."));

  assertEqual(getDeclaredAcademicFigures(document).length, 0, "no academic figure count");
  assertEqual(document.figureList.status, "LIST_SECTION_MISSING", "no figure list status");
}

function assertGenericDrawingOnly() {
  const document = semanticDocument(paragraph("Giriş") + inlinePicture(1));
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfFiguresRule());

  assertEqual(getDeclaredAcademicFigures(document).length, 0, "generic drawing no academic figure");
  assertEqual(document.figureList.figureAssociations.length, 0, "generic drawing no list association");
  assertEqual(result.status, "NOT_APPLICABLE", "generic drawing does not trigger list requirement");
}

function assertTextboxDrawingOnly() {
  const document = semanticDocument(paragraph("Giriş") + drawingTextboxParagraph());

  assertEqual(getDeclaredAcademicFigures(document).length, 0, "textbox no academic figure");
  assertEqual(document.figureList.figureAssociations.length, 0, "textbox no figure association");
}

function assertOneResolvedAcademicFigure() {
  const document = semanticDocument(paragraph("Giriş") + inlinePicture(2) + caption("Şekil 1. Deney"));
  const figures = getDeclaredAcademicFigures(document);

  assertEqual(figures.length, 1, "one declared academic figure");
  assertEqual(figures[0].semanticCaption.semantic.status, "declared", "caption semantic declared");
  assertEqual(figures[0].semanticCaption.semantic.number, "1", "caption semantic number");
}

function assertMultipleResolvedFigures() {
  const document = semanticDocument(
    paragraph("Giriş") +
      inlinePicture(3) +
      caption("Şekil 1. Bir") +
      paragraph("Ara") +
      inlinePicture(4) +
      caption("Şekil 2. Iki"),
  );

  assertEqual(getDeclaredAcademicFigures(document).length, 2, "multiple declared figures");
}

function assertAmbiguousFigureExcludedFromEligibility() {
  const document = semanticDocument(
    paragraph("Giriş") + caption("Şekil 1. Ön") + inlinePicture(5) + caption("Şekil 2. Son"),
  );

  assertEqual(getDeclaredAcademicFigures(document).length, 0, "ambiguous figure not eligible");
  assertEqual(document.objectSemantics.resolutions[0].status, "ambiguous", "resolution ambiguous");
  assertEqual(document.figureList.figureAssociations.length, 0, "ambiguous figure not associated");
}

function assertExcludedRepresentationExcludedFromEligibility() {
  const document = semanticDocument(paragraph("Giriş") + drawingTextboxParagraph());

  assertEqual(document.objectSemantics.resolutions[0].status, "excluded", "textbox excluded");
  assertEqual(getDeclaredAcademicFigures(document).length, 0, "excluded not eligible");
}

function assertValidListOfFiguresSection() {
  const document = semanticDocument(
    paragraph("Giriş") +
      inlinePicture(6) +
      caption("Şekil 1. Deney") +
      heading("Şekiller Listesi") +
      paragraph("Şekil 1. Deney"),
  );

  assertEqual(document.figureList.status, "LIST_SECTION_PRESENT_WITH_ENTRIES", "valid figure list status");
  assertEqual(document.figureList.entries.length, 1, "valid figure list entry count");
}

function assertMissingListOfFiguresSection() {
  const document = semanticDocument(paragraph("Giriş") + inlinePicture(7) + caption("Şekil 1. Deney"));
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfFiguresRule());

  assertEqual(document.figureList.status, "LIST_SECTION_MISSING", "missing figure list status");
  assertEqual(result.status, "FAILED", "missing figure list production failure remains");
}

function assertEmptyListOfFiguresSection() {
  const document = semanticDocument(
    paragraph("Giriş") + inlinePicture(8) + caption("Şekil 1. Deney") + heading("Şekiller Listesi") + blankParagraph(),
  );
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfFiguresRule());

  assertEqual(document.figureList.status, "LIST_SECTION_PRESENT_EMPTY", "empty figure list status");
  assertEqual(result.status, "PASSED", "empty list does not add unsupported production failure");
}

function assertMultipleListEntries() {
  const document = semanticDocument(
    paragraph("Giriş") + heading("Şekiller Listesi") + paragraph("Şekil 1. Deney") + paragraph("Şekil 2. Sonuc"),
  );

  assertEqual(document.figureList.entries.length, 2, "multiple figure list entries");
}

function assertDuplicateListEntriesPreserved() {
  const document = semanticDocument(
    paragraph("Giriş") +
      inlinePicture(9) +
      caption("Şekil 1. Deney") +
      heading("Şekiller Listesi") +
      paragraph("Şekil 1. Deney") +
      paragraph("Şekil 1. Deney"),
  );

  assertEqual(document.figureList.entries.length, 2, "duplicate figure list entries preserved");
  assertNotEqual(document.figureList.entries[0].id, document.figureList.entries[1].id,
    "duplicate figure list entries keep occurrence ids");
  assertEqual(document.figureList.figureAssociations[0].status, "AMBIGUOUS", "duplicate entries ambiguous");
}

function assertSplitRunListEntry() {
  const document = semanticDocument(
    paragraph("Giriş") + heading("Şekiller Listesi") + splitRunParagraph(["Şe", "kil ", "3", ". ", "Başlık"]),
  );

  assertEqual(document.figureList.entries[0].number, "3", "split-run figure list number");
  assertEqual(document.figureList.entries[0].title, "Başlık", "split-run figure list title");
}

function assertListPageNumberSuffixIgnored() {
  const document = semanticDocument(
    paragraph("Giriş") + heading("Şekiller Listesi") + paragraph("Şekil 2.1 Deney sonuçları ........ 14"),
  );
  const entry = document.figureList.entries[0];

  assertEqual(entry.number, "2.1", "figure list entry number");
  assertEqual(entry.title, "Deney sonuçları", "page number suffix ignored");
  assertEqual(entry.evidence.includes("page-number-suffix-ignored"), true, "page suffix evidence");
}

function assertFigureListMatch() {
  const document = semanticDocument(
    paragraph("Giriş") + inlinePicture(10) + caption("Şekil 1. Deney") + heading("Şekiller Listesi") + paragraph("Şekil 1. Deney"),
  );

  assertEqual(document.figureList.figureAssociations[0].status, "MATCHED", "figure to list matched");
  assertEqual(document.figureList.entryAssociations[0].status, "MATCHED", "list to figure matched");
}

function assertMissingListEntry() {
  const document = semanticDocument(
    paragraph("Giriş") + inlinePicture(11) + caption("Şekil 1. Deney") + heading("Şekiller Listesi") + paragraph("Şekil 2. Baska"),
  );

  assertEqual(document.figureList.figureAssociations[0].status, "MISSING_LIST_ENTRY",
    "missing figure list entry preserved");
}

function assertOrphanListEntry() {
  const document = semanticDocument(paragraph("Giriş") + heading("Şekiller Listesi") + paragraph("Şekil 9. Olmayan"));

  assertEqual(document.figureList.entryAssociations[0].status, "ORPHAN_LIST_ENTRY",
    "orphan figure list entry preserved");
}

function assertAmbiguousAssociation() {
  const document = semanticDocument(
    paragraph("Giriş") +
      inlinePicture(12) +
      caption("Şekil 1. Bir") +
      paragraph("Ara") +
      inlinePicture(13) +
      caption("Şekil 1. Iki") +
      heading("Şekiller Listesi") +
      paragraph("Şekil 1. Deney"),
  );

  assertEqual(document.figureList.entryAssociations[0].status, "AMBIGUOUS",
    "duplicate caption number makes figure list association ambiguous");
}

function assertSekilOneVsTenCollisionProtection() {
  const document = semanticDocument(
    paragraph("Giriş") + inlinePicture(14) + caption("Şekil 1. Deney") + paragraph("Metinde Şekil 10 anildi."),
  );
  const result = new ObjectInTextReferenceValidator().validate(document, figureReferenceRule());

  assertEqual(document.objectReferences.items.some((item) => item.kind === "figure" && item.number === "1"), false,
    "Şekil 10 does not create Şekil 1 reference");
  assertEqual(result.status, "FAILED", "unresolved body figure reference does not satisfy figure 1");
}

function assertTableFigureKindIsolation() {
  const document = semanticDocument(
    paragraph("Giriş") +
      heading("Şekiller Listesi") +
      paragraph("Tablo 2. Yanlış tür") +
      paragraph("Şekil 2. Doğru tür"),
  );

  assertEqual(document.figureList.entries.length, 1, "table entry excluded from figure list");
  assertEqual(document.figureList.entries[0].label, "Şekil", "figure list kind");
}

function assertTocFalsePositiveProtection() {
  const document = semanticDocument(tocParagraph("Şekiller Listesi") + tocParagraph("Şekil 1. Deney"));

  assertEqual(document.figureList.status, "LIST_SECTION_MISSING", "TOC figure list false positive excluded");
}

function assertDeletedRevisionProtection() {
  const document = semanticDocument(paragraph("Giriş") + heading("Şekiller Listesi") + deletedParagraph("Şekil 1. Silinmis"));

  assertEqual(document.figureList.status, "LIST_SECTION_PRESENT_EMPTY", "deleted figure list entry excluded");
}

function assertTextboxProtection() {
  const document = semanticDocument(textboxParagraph("Şekiller Listesi") + textboxParagraph("Şekil 1. Textbox"));

  assertEqual(document.figureList.status, "LIST_SECTION_MISSING", "textbox figure list false positive excluded");
}

function assertNextSectionBoundary() {
  const document = semanticDocument(
    paragraph("Giriş") +
      heading("Şekiller Listesi") +
      paragraph("Şekil 1. Deney") +
      heading("Kaynaklar") +
      paragraph("Şekil 2. Listeye sizmamali"),
    [listOfFiguresRule(), requiredRule("Kaynaklar")],
  );

  assertEqual(document.figureList.entries.length, 1, "next section leakage prevented");
  assertEqual(document.figureList.entries[0].number, "1", "only first figure list entry included");
}

function assertHyperlinkAndFieldVisibleText() {
  const document = semanticDocument(
    paragraph("Giriş") +
      heading("Şekiller Listesi") +
      hyperlinkParagraph("Şekil 1. Web kaynakli ........ 7") +
      fieldParagraph("Şekil 2. Field sonucu ........ 8"),
  );

  assertEqual(document.figureList.entries.length, 2, "hyperlink and field visible entries");
  assertEqual(document.figureList.entries[0].title, "Web kaynakli", "hyperlink visible title");
  assertEqual(document.figureList.entries[1].title, "Field sonucu", "field cached visible title");
}

function assertNoRenderedPaginationAssertion() {
  const document = semanticDocument(paragraph("Giriş") + heading("Şekiller Listesi") + paragraph("Şekil 1. Deney ........ 999"));

  assertEqual(document.figureList.entries[0].number, "1", "rendered page number ignored");
  assertEqual(document.figureList.entries[0].title, "Deney", "rendered page number not title");
}

function assertNoFigureConditionalNotApplicable() {
  const document = semanticDocument(paragraph("Giriş") + heading("Şekiller Listesi") + paragraph("Şekil 1. Yetim"));
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfFiguresRule());

  assertEqual(getDeclaredAcademicFigures(document).length, 0, "orphan list entry does not create figure");
  assertEqual(result.status, "NOT_APPLICABLE", "no figure conditional not applicable");
}

function assertFigureExistsListMissingFailure() {
  const document = semanticDocument(paragraph("Giriş") + inlinePicture(15) + caption("Şekil 1. Deney"));
  const result = new ConditionalRequiredSectionValidator().validate(document, listOfFiguresRule());

  assertEqual(result.status, "FAILED", "semantic figure missing list failure");
}

function assertExistingFigureCaptionSemanticsUnchanged() {
  const document = semanticDocument(paragraph("Giriş") + inlinePicture(16) + caption("Şekil 3.2. Deney"));
  const captionOccurrence = document.objectSemantics.captions[0];

  assertEqual(captionOccurrence.semantic.status, "declared", "existing caption semantic declared");
  assertEqual(captionOccurrence.semantic.number, "3.2", "existing caption semantic number unchanged");
}

function assertGenericDrawingNeverBecomesAcademicFigure() {
  const document = semanticDocument(paragraph("Giriş") + chartDrawing(17));

  assertEqual(getDeclaredAcademicFigures(document).length, 0, "chart without semantic caption no figure");
  assertEqual(document.figureList.figureAssociations.length, 0, "chart without semantic figure no association");
}

function semanticDocument(bodyXml, rules = [listOfFiguresRule(), figureReferenceRule(), listOfTablesRule()]) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules);
  const headed = normalizeDocumentHeadings(marked, rules);
  const scoped = normalizeAcademicDocumentScopes(headed, rules);
  const sectioned = normalizeAcademicSections(scoped, rules);
  const tableListed = normalizeTableListSemantics(sectioned, rules);
  const figureListed = normalizeFigureListSemantics(tableListed, rules);

  return {
    ...figureListed,
    objectReferences: normalizeDocumentObjectReferences(figureListed),
  };
}

function listOfFiguresRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.list-of-figures",
    type: "CONDITIONAL_REQUIRED_SECTION",
    title: "Şekiller Listesi",
    description: "",
    category: "structure",
    expected: { section: "Şekiller Listesi", requiredWhen: { fact: "hasFigures", equals: true } },
    severity: "error",
    score: 10,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
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

function figureReferenceRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.figure-in-text-reference",
    type: "OBJECT_IN_TEXT_REFERENCE",
    title: "Şekil Metin Ici Atfi",
    description: "",
    category: "citation",
    expected: { object: "figure" },
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
  return [
    '<w:document',
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
    ' xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"',
    ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">',
    '<w:body>',
    content,
    '</w:body>',
    '</w:document>',
  ].join("");
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

function inlinePicture(id) {
  return [
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline>',
    `<wp:docPr id="${id}" name="Inline ${id}"/>`,
    pictureGraphic(),
    '</wp:inline></w:drawing></w:r></w:p>',
  ].join("");
}

function pictureGraphic() {
  return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>';
}

function chartDrawing(id) {
  return [
    '<w:p><w:r><w:drawing><wp:inline>',
    `<wp:docPr id="${id}" name="Chart ${id}"/>`,
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart/></a:graphicData></a:graphic>',
    '</wp:inline></w:drawing></w:r></w:p>',
  ].join("");
}

function drawingTextboxParagraph() {
  return '<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>Şekil 1. Textbox</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
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
  return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> REF FigureListEntry </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${resultText}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
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
