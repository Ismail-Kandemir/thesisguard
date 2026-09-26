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
  ParagraphIndentationValidator,
} = require("../../src/features/analysis/rules/validators/ParagraphIndentationValidator.ts");

const GOOD_FIRST_LINE_TWIPS = 850;

function main() {
  assertStatus("direct firstLine twips", bodyParagraph(ind({ firstLine: GOOD_FIRST_LINE_TWIPS })), "PASSED");
  assertStatus("inherited style firstLine", bodyParagraphWithStyle("BodyIndent", ""), "PASSED", {
    styles: [style("BodyIndent", { firstLineTwips: GOOD_FIRST_LINE_TWIPS })],
  });
  assertStatus("direct firstLine overrides style", bodyParagraphWithStyle("BodyIndent", ind({ firstLine: 0 })), "FAILED", {
    styles: [style("BodyIndent", { firstLineTwips: GOOD_FIRST_LINE_TWIPS })],
    expectedActual: 0,
  });
  assertStatus("direct hanging", bodyParagraph(ind({ hanging: 360 })), "FAILED", { expectedActual: -0.64 });
  assertUnresolved("direct firstLineChars", bodyParagraph(ind({ firstLineChars: 100 })));
  assertUnresolved("direct hangingChars", bodyParagraph(ind({ hangingChars: 100 })));
  assertUnresolved("firstLine plus firstLineChars", bodyParagraph(ind({ firstLine: GOOD_FIRST_LINE_TWIPS, firstLineChars: 100 })));
  assertUnresolved("hanging plus hangingChars", bodyParagraph(ind({ hanging: 360, hangingChars: 100 })));
  assertUnresolved("inherited character indentation", bodyParagraphWithStyle("BodyChars", ""), {
    styles: [style("BodyChars", { firstLineChars: 100 })],
  });
  assertScopeExclusions();

  console.log(JSON.stringify({
    phase: "paragraph-indentation-character-units",
    result: "PASS",
    audit: "paragraphIndentationCharacterUnitsRegression.cjs",
  }, null, 2));
}

function assertScopeExclusions() {
  const styles = [
    style("Heading1", {}, { name: "Heading 1" }),
    style("Caption", {}),
  ];
  const body = [
    requiredIntroHeading(),
    paragraphWithStyle("Heading1", "Heading styled paragraph", ind({ firstLine: 0 })),
    tocParagraph("TOC paragraph"),
    tableCellParagraph("Table cell paragraph", ind({ firstLine: 0 })),
    listParagraph("List paragraph", ind({ firstLine: 0 })),
    paragraphWithStyle("Caption", "Caption paragraph", ind({ firstLine: 0 })),
  ].join("");
  const model = createDocument(body, { styles });
  model.captions = {
    ...model.captions,
    items: [{ paragraphId: "paragraph-6" }],
  };
  const result = validate(model);

  assertEqual(result.status, "NOT_APPLICABLE", "excluded paragraphs should leave no candidates");
}

function assertUnresolved(label, bodyXml, options = {}) {
  assertStatus(label, bodyXml, "FAILED", {
    ...options,
    expectedActual: null,
    expectUnresolvedSummary: true,
  });
}

function assertStatus(label, bodyXml, expectedStatus, options = {}) {
  const result = validate(createDocument(requiredIntroHeading() + bodyXml, options));

  assertEqual(result.status, expectedStatus, `${label}: status`);

  if (expectedStatus === "FAILED") {
    assertEqual(result.evidence?.[0]?.actual ?? null, options.expectedActual ?? null, `${label}: evidence actual`);
    assertEqual(result.evidenceTotal, 1, `${label}: evidence total`);
  }

  if (options.expectUnresolvedSummary) {
    assertEqual(result.actual.includes("karakter"), true, `${label}: unresolved summary`);
  }
}

function createDocument(bodyXml, options = {}) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const withStyles = {
    ...parsed,
    styles: options.styles ?? [],
  };
  const marked = markRequiredSectionHeadings(withStyles, rules());
  const headed = normalizeDocumentHeadings(marked, rules());
  const scoped = normalizeAcademicDocumentScopes(headed, rules());

  return normalizeAcademicSections(scoped, rules());
}

function validate(model) {
  return new ParagraphIndentationValidator().validate(model, indentationRule());
}

function rules() {
  return [indentationRule(), requiredRule("Giriş")];
}

function indentationRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.paragraph-indentation",
    type: "PARAGRAPH_INDENTATION",
    title: "Akademik Ana Gövde Paragraf İlk Satır Girintisi",
    description: "",
    category: "spacing",
    expected: {
      firstLineCm: 1.5,
      toleranceTwips: 1,
      sections: ["Giriş"],
    },
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
    id: `required.${normalizeSectionName(section)}`,
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
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    content +
    "</w:body></w:document>";
}

function requiredIntroHeading() {
  return paragraph("Giriş");
}

function bodyParagraph(indentation) {
  return `<w:p>${indentation}<w:r><w:t>Akademik gövde paragrafı.</w:t></w:r></w:p>`;
}

function bodyParagraphWithStyle(styleId, indentation) {
  return paragraphWithStyle(styleId, "Akademik gövde paragrafı.", indentation);
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraphWithStyle(styleId, text, indentation) {
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/>${indentation}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:ind w:firstLine="0"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tableCellParagraph(text, indentation) {
  return `<w:tbl><w:tr><w:tc><w:p>${indentation}<w:r><w:t>${text}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
}

function listParagraph(text, indentation) {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>${indentation}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function ind(values) {
  const attributes = [
    attr("firstLine", values.firstLine),
    attr("hanging", values.hanging),
    attr("firstLineChars", values.firstLineChars),
    attr("hangingChars", values.hangingChars),
  ].filter(Boolean).join(" ");

  return attributes ? `<w:pPr><w:ind ${attributes}/></w:pPr>` : "";
}

function attr(name, value) {
  return value === undefined ? "" : `w:${name}="${value}"`;
}

function style(id, indentation = {}, options = {}) {
  return {
    id,
    type: "paragraph",
    name: options.name ?? id,
    basedOn: options.basedOn ?? null,
    nextStyle: null,
    fontFamily: null,
    fontFamilyReference: null,
    fontSize: null,
    bold: null,
    italic: null,
    underline: null,
    lineSpacing: null,
    paragraphFormatting: {
      ...emptyParagraphFormatting(),
      indentation: {
        ...emptyParagraphFormatting().indentation,
        firstLineTwips: indentation.firstLineTwips ?? null,
        hangingTwips: indentation.hangingTwips ?? null,
        firstLineChars: indentation.firstLineChars ?? null,
        hangingChars: indentation.hangingChars ?? null,
      },
    },
    alignment: null,
    tableAlignment: null,
    numbering: null,
  };
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
    spacing: {
      beforeTwips: null,
      afterTwips: null,
      beforeLines: null,
      afterLines: null,
    },
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

main();
