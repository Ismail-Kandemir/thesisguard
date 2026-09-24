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
  normalizeFigureListSemantics,
} = require("../../src/features/analysis/parsers/figureListSemanticsNormalizer.ts");
const {
  normalizeDocumentAbbreviations,
} = require("../../src/features/analysis/parsers/documentAbbreviationsNormalizer.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const {
  ConditionalRequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");

function main() {
  assertListOfTablesContract();
  assertListOfFiguresContract();
  assertListOfAbbreviationsContract();

  console.log(JSON.stringify({
    phase: "4F-11",
    result: "PASS",
    audit: "conditionalListValidationClosureRegression.cjs",
  }, null, 2));
}

function assertListOfTablesContract() {
  assertStatus(document(paragraph("Giriş") + paragraph("Metinde Tablo 1 yazıyor.")), listOfTablesRule(), "NOT_APPLICABLE", "table-like text does not trigger");
  assertStatus(document(heading("Tablolar Listesi") + paragraph("Tablo 1. Yetim liste")), listOfTablesRule(), "NOT_APPLICABLE", "list entry alone does not trigger");
  assertStatus(document(tableXml() + heading("Tablolar Listesi")), listOfTablesRule(), "PASSED", "real table plus section passes");
  assertStatus(document(tableXml()), listOfTablesRule(), "FAILED", "real table missing section fails");
  assertStatus(document(tableXml() + tocParagraph("Tablolar Listesi")), listOfTablesRule(), "FAILED", "TOC section does not satisfy");
  assertStatus(document(tableXml() + deletedParagraph("Tablolar Listesi")), listOfTablesRule(), "FAILED", "deleted section does not satisfy");
  assertStatus(document(tableXml() + textboxParagraph("Tablolar Listesi")), listOfTablesRule(), "FAILED", "textbox section does not satisfy");
}

function assertListOfFiguresContract() {
  assertStatus(document(paragraph("Giriş")), listOfFiguresRule(), "NOT_APPLICABLE", "no figure not applicable");
  assertStatus(document(inlinePicture(1)), listOfFiguresRule(), "NOT_APPLICABLE", "generic drawing without caption does not trigger");
  assertStatus(document(drawingTextboxParagraph()), listOfFiguresRule(), "NOT_APPLICABLE", "textbox drawing does not trigger");
  assertStatus(document(chartDrawing(2)), listOfFiguresRule(), "NOT_APPLICABLE", "excluded unresolved drawing does not trigger");
  assertStatus(document(heading("Şekiller Listesi") + paragraph("Şekil 1. Yetim")), listOfFiguresRule(), "NOT_APPLICABLE", "list entry alone does not trigger");
  assertStatus(document(inlinePicture(3) + caption("Şekil 1. Deney") + heading("Şekiller Listesi")), listOfFiguresRule(), "PASSED", "declared figure plus section passes");
  assertStatus(document(inlinePicture(4) + caption("Şekil 1. Deney")), listOfFiguresRule(), "FAILED", "declared figure missing section fails");
  assertStatus(document(inlinePicture(5) + caption("Şekil 1. Deney") + tocParagraph("Şekiller Listesi")), listOfFiguresRule(), "FAILED", "TOC figure list does not satisfy");
  assertStatus(document(inlinePicture(6) + caption("Şekil 1. Deney") + deletedParagraph("Şekiller Listesi")), listOfFiguresRule(), "FAILED", "deleted figure list does not satisfy");
  assertStatus(document(inlinePicture(7) + caption("Şekil 1. Deney") + textboxParagraph("Şekiller Listesi")), listOfFiguresRule(), "FAILED", "textbox figure list does not satisfy");
}

function assertListOfAbbreviationsContract() {
  assertStatus(document(paragraph("Giriş") + paragraph("Laboratuvar sonucu")), listOfAbbreviationsRule(), "NOT_APPLICABLE", "no abbreviation not applicable");
  assertStatus(document(paragraph("Giriş") + paragraph("preDNApost sonucu")), listOfAbbreviationsRule(), "NOT_APPLICABLE", "substring collision does not create configured abbreviation");
  assertStatus(document(heading("Simgeler ve Kısaltmalar Listesi") + heading("Giriş") + paragraph("DNA kullanıldı.")), listOfAbbreviationsRule(), "PASSED", "abbreviation plus section passes");
  assertStatus(document(heading("Giriş") + paragraph("DNA kullanıldı.")), listOfAbbreviationsRule(), "FAILED", "abbreviation missing section fails");
  assertStatus(document(tocParagraph("Simgeler ve Kısaltmalar Listesi") + heading("Giriş") + paragraph("DNA kullanıldı.")), listOfAbbreviationsRule(), "FAILED", "TOC abbreviation list does not satisfy");
  assertStatus(document(deletedParagraph("DNA kullanıldı.") + heading("Giriş")), listOfAbbreviationsRule(), "NOT_APPLICABLE", "deleted abbreviation does not trigger");
  assertStatus(document(textboxParagraph("DNA kullanıldı.") + heading("Giriş")), listOfAbbreviationsRule(), "NOT_APPLICABLE", "textbox abbreviation does not trigger");
  assertStatus(document(heading("Simgeler ve Kısaltmalar Listesi") + paragraph("DNA: Bir") + paragraph("DNA: İki") + heading("Giriş") + paragraph("DNA kullanıldı.")), listOfAbbreviationsRule(), "PASSED", "duplicate entries remain safe");
  assertStatus(document(heading("Simgeler ve Kısaltmalar Listesi") + paragraph("DNA:") + heading("Giriş") + paragraph("DNA kullanıldı.")), listOfAbbreviationsRule(), "PASSED", "malformed entry does not invent unsupported failure");
}

function assertStatus(documentModel, rule, expectedStatus, label) {
  const result = new ConditionalRequiredSectionValidator().validate(documentModel, rule);

  assertEqual(result.status, expectedStatus, label);

  if (expectedStatus === "FAILED") {
    assertEqual(result.evidence?.[0]?.kind, "section", `${label}: evidence kind`);
    assertEqual(result.evidence?.[0]?.actual, "Tespit edilmedi", `${label}: evidence actual`);
  }
}

function document(bodyXml) {
  const rules = [listOfTablesRule(), listOfFiguresRule(), listOfAbbreviationsRule(), requiredRule("Giriş")];
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
    abbreviations: normalizeDocumentAbbreviations(figureListed),
  };
}

function listOfTablesRule() {
  return conditionalRule("comu.applied-sciences.food-technology.bachelor.list-of-tables", "Tablolar Listesi", "hasTables");
}

function listOfFiguresRule() {
  return conditionalRule("comu.applied-sciences.food-technology.bachelor.list-of-figures", "Şekiller Listesi", "hasFigures");
}

function listOfAbbreviationsRule() {
  return conditionalRule("comu.applied-sciences.food-technology.bachelor.list-of-abbreviations", "Simgeler ve Kısaltmalar Listesi", "hasAbbreviations");
}

function conditionalRule(id, section, fact) {
  return {
    id,
    type: "CONDITIONAL_REQUIRED_SECTION",
    title: section,
    description: "",
    category: "structure",
    expected: { section, requiredWhen: { fact, equals: true } },
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

function tableXml() {
  return '<w:tbl><w:tblPr><w:jc w:val="center"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Hucre</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
}

function inlinePicture(id) {
  return [
    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline>',
    `<wp:docPr id="${id}" name="Inline ${id}"/>`,
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>',
    '</wp:inline></w:drawing></w:r></w:p>',
  ].join("");
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
