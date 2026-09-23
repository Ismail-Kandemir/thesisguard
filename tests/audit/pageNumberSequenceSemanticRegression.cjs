require("../golden/experimentalGoldenRegression.cjs");

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  parseHeaderFooterPageNumbering,
} = require("../../src/features/analysis/parsers/headerFooterXmlParser.ts");
const {
  normalizePageNumberingSemantics,
} = require("../../src/features/analysis/parsers/pageNumberingSemantics.ts");
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
  PageNumberValidator,
} = require("../../src/features/analysis/rules/validators/PageNumberValidator.ts");
const {
  PageNumberSequenceValidator,
} = require("../../src/features/analysis/rules/validators/PageNumberSequenceValidator.ts");

function main() {
  assertWordSectionReconstruction();
  assertPageFieldDetection();
  assertFooterOwnershipAndFalsePositives();
  assertInheritedFooterHandling();
  assertRomanDecimalAcademicTransition();
  assertMissingStartFailsRestart();
  assertMissingFormatDoesNotInventDecimal();

  console.log(JSON.stringify({
    phase: "4F-05",
    result: "PASS",
    audit: "pageNumberSequenceSemanticRegression.cjs",
  }, null, 2));
}

function assertWordSectionReconstruction() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("front") +
      sectionBreakParagraph("front break", {
        format: "lowerRoman",
        footerId: "rFooterFront",
      }) +
      heading("Giriş") +
      paragraph("main") +
      bodySectPr({
        format: "decimal",
        start: 1,
        footerId: "rFooterMain",
        titlePg: true,
      }),
    relationshipsXml([
      relationship("rFooterFront", "footer1.xml", "footer"),
      relationship("rFooterMain", "footer2.xml", "footer"),
    ]),
    [
      footerPart("word/footer1.xml", complexPageField("center")),
      footerPart("word/footer2.xml", simplePageField("center")),
    ],
  );

  assertEqual(document.pageNumbering.sections.length, 2, "two Word sections reconstructed");
  assertEqual(document.pageNumbering.sections[0].source, "paragraph", "paragraph sectPr source");
  assertEqual(document.pageNumbering.sections[1].source, "body", "body-level sectPr source");
  assertEqual(document.pageNumbering.sections[0].startParagraphIndex, 0, "front section start");
  assertEqual(document.pageNumbering.sections[0].endParagraphIndex, 2, "front section end");
  assertEqual(document.pageNumbering.sections[1].startParagraphIndex, 3, "main section start");
  assertEqual(document.pageNumbering.sections[1].format, "decimal", "main format");
  assertEqual(document.pageNumbering.sections[1].start, 1, "explicit start preserved");
  assertEqual(document.pageNumbering.sections[1].startSemantics, "explicit-start", "explicit start semantics");
  assertEqual(document.pageNumbering.sections[1].differentFirstPage, true, "titlePg preserved");
}

function assertPageFieldDetection() {
  const numbering = parseHeaderFooterPageNumbering([
    footerPart("word/footer1.xml", simplePageField("center")),
    footerPart("word/footer2.xml", complexPageField("right")),
    footerPart("word/footer3.xml", complexField("NUMPAGES", "center")),
    footerPart("word/footer4.xml", paragraph("PAGE")),
  ]);

  assertEqual(numbering.fields.length, 2, "only PAGE instructions detected");
  assertEqual(numbering.fields.some((field) => field.structure === "fldSimple"), true, "simple PAGE field detected");
  assertEqual(numbering.fields.some((field) => field.structure === "instrText"), true, "complex PAGE field detected");
  assertEqual(numbering.fields.some((field) => field.sourcePath === "word/footer3.xml"), false, "NUMPAGES is not PAGE");
  assertEqual(numbering.fields.some((field) => field.sourcePath === "word/footer4.xml"), false, "plain PAGE text is not PAGE field");
}

function assertFooterOwnershipAndFalsePositives() {
  const document = semanticDocumentFromXml(
    heading("Giriş") +
      paragraph("main") +
      bodySectPr({ format: "decimal", start: 1, footerId: "rFooterEmpty" }),
    relationshipsXml([
      relationship("rFooterEmpty", "footer-empty.xml", "footer"),
      relationship("rFooterPage", "footer-page.xml", "footer"),
    ]),
    [
      footerPart("word/footer-empty.xml", paragraph("1")),
      footerPart("word/footer-page.xml", simplePageField("center")),
    ],
  );
  const result = new PageNumberValidator().validate(document, pageNumberRule());

  assertEqual(result.status, "FAILED", "PAGE field in unrelated footer is not proof");
}

function assertInheritedFooterHandling() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("front") +
      sectionBreakParagraph("front break", {
        format: "lowerRoman",
        footerId: "rFooterShared",
      }) +
      heading("Giriş") +
      paragraph("main") +
      bodySectPr({ format: "decimal", start: 1 }),
    relationshipsXml([
      relationship("rFooterShared", "footer1.xml", "footer"),
    ]),
    [footerPart("word/footer1.xml", simplePageField("center"))],
  );
  const inheritedReference = document.pageNumbering.sections[1].headerFooterReferences.find(
    (reference) => reference.location === "footer" && reference.type === "default",
  );

  assertEqual(inheritedReference.resolution, "inherited", "footer reference inherited");
  assertEqual(inheritedReference.hasPageField, true, "inherited footer carries PAGE field");
  assertEqual(new PageNumberValidator().validate(document, pageNumberRule()).status, "PASSED", "inherited PAGE field satisfies presence");
}

function assertRomanDecimalAcademicTransition() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("front") +
      sectionBreakParagraph("front break", {
        format: "lowerRoman",
        footerId: "rFooterFront",
      }) +
      heading("Giriş") +
      paragraph("main") +
      bodySectPr({
        format: "decimal",
        start: 1,
        footerId: "rFooterMain",
      }),
    relationshipsXml([
      relationship("rFooterFront", "footer1.xml", "footer"),
      relationship("rFooterMain", "footer2.xml", "footer"),
    ]),
    [
      footerPart("word/footer1.xml", simplePageField("center")),
      footerPart("word/footer2.xml", simplePageField("center")),
    ],
  );
  const result = new PageNumberSequenceValidator().validate(document, sequenceRule());

  assertEqual(
    document.academicSections.occurrences.some((occurrence) => occurrence.identity === normalizeSectionName("Giriş")),
    true,
    "academic transition section mapped",
  );
  assertEqual(result.status, "PASSED", "Roman to decimal transition passes");
}

function assertMissingStartFailsRestart() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("front") +
      sectionBreakParagraph("front break", { format: "lowerRoman" }) +
      heading("Giriş") +
      paragraph("main") +
      bodySectPr({ format: "decimal" }),
    relationshipsXml([]),
    [],
  );
  const result = new PageNumberSequenceValidator().validate(document, sequenceRule());

  assertEqual(result.status, "FAILED", "missing explicit start does not satisfy restart");
}

function assertMissingFormatDoesNotInventDecimal() {
  const document = semanticDocumentFromXml(
    heading("Özet") +
      paragraph("front") +
      sectionBreakParagraph("front break", { format: "lowerRoman" }) +
      heading("Giriş") +
      paragraph("main") +
      bodySectPr({ start: 1 }),
    relationshipsXml([]),
    [],
  );
  const result = new PageNumberSequenceValidator().validate(document, sequenceRule());

  assertEqual(result.status, "FAILED", "missing format does not invent decimal");
}

function semanticDocumentFromXml(bodyXml, documentRelationshipsXml, headerFooterXmlParts) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const pageNumbering = normalizePageNumberingSemantics(
    {
      ...parseHeaderFooterPageNumbering(headerFooterXmlParts),
      sections: parsed.pageNumbering.sections,
    },
    documentRelationshipsXml,
  );
  const withPageNumbering = { ...parsed, pageNumbering };
  const marked = markRequiredSectionHeadings(withPageNumbering, rules());
  const headed = normalizeDocumentHeadings(marked, rules());
  const scoped = normalizeAcademicDocumentScopes(headed, rules());

  return normalizeAcademicSections(scoped, rules());
}

function rules() {
  return [
    requiredRule("Özet"),
    requiredRule("Giriş"),
    sequenceRule(),
  ];
}

function requiredRule(section) {
  return {
    id: `rule.required.${normalizeSectionName(section)}`,
    type: "REQUIRED_SECTION",
    title: `${section} required`,
    description: "",
    category: "structure",
    expected: { section, required: true },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function sequenceRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.page-number-sequence",
    type: "PAGE_NUMBER_SEQUENCE",
    title: "Sayfa Numarası Sırası",
    description: "",
    category: "structure",
    expected: {
      transitionSection: "Giriş",
      beforeFormat: "lowerRoman",
      fromFormat: "decimal",
      restartAt: 1,
    },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function pageNumberRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.page-number",
    type: "PAGE_NUMBER",
    title: "Sayfa Numarası",
    description: "",
    category: "structure",
    expected: { required: true, location: "footer", alignment: "center" },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + content + "</w:body></w:document>";
}

function heading(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function sectionBreakParagraph(text, options) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r><w:pPr>${sectPr(options)}</w:pPr></w:p>`;
}

function bodySectPr(options) {
  return sectPr(options);
}

function sectPr(options) {
  return `<w:sectPr>${options.titlePg ? "<w:titlePg/>" : ""}${options.footerId ? `<w:footerReference w:type="default" r:id="${options.footerId}"/>` : ""}${pgNumType(options)}</w:sectPr>`;
}

function pgNumType(options) {
  const attributes = [
    options.format ? `w:fmt="${options.format}"` : "",
    options.start !== undefined ? `w:start="${options.start}"` : "",
  ].filter(Boolean).join(" ");

  return attributes ? `<w:pgNumType ${attributes}/>` : "";
}

function relationshipsXml(items) {
  return '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + items.join("") + "</Relationships>";
}

function relationship(id, target, location) {
  const type = location === "footer" ? "footer" : "header";

  return `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
}

function footerPart(path, content) {
  return {
    path,
    location: "footer",
    xml: `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${content}</w:ftr>`,
  };
}

function simplePageField(alignment) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:fldSimple w:instr=" PAGE \\* MERGEFORMAT "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>`;
}

function complexPageField(alignment) {
  return complexField(" PAGE \\* MERGEFORMAT ", alignment);
}

function complexField(instruction, alignment) {
  return `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${instruction}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
