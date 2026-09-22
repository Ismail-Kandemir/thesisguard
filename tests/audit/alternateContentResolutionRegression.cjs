require("../golden/experimentalGoldenRegression.cjs");

const {
  getSemanticDescendantsByTagNameNS,
} = require("../../src/features/analysis/parsers/markupCompatibilityResolver.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const WPS_NS = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape";
const WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const UNSUPPORTED_NS = "urn:thesisguard:unsupported";

function main() {
  assertText("supported Choice selected", body(alternate({
    choiceRequires: "wps",
    namespaces: `xmlns:wps="${WPS_NS}"`,
    choice: paragraph("CHOICE"),
    fallback: paragraph("FALLBACK"),
  })), ["CHOICE"]);

  assertText("unsupported Choice falls back", body(alternate({
    choiceRequires: "bad",
    namespaces: `xmlns:bad="${UNSUPPORTED_NS}"`,
    choice: paragraph("CHOICE"),
    fallback: paragraph("FALLBACK"),
  })), ["FALLBACK"]);

  assertText("first supported Choice wins", body([
    '<mc:AlternateContent>',
    `<mc:Choice Requires="bad" xmlns:bad="${UNSUPPORTED_NS}">${paragraph("UNSUPPORTED")}</mc:Choice>`,
    `<mc:Choice Requires="wp" xmlns:wp="${WP_NS}">${paragraph("FIRST_SUPPORTED")}</mc:Choice>`,
    `<mc:Choice Requires="wps" xmlns:wps="${WPS_NS}">${paragraph("SECOND_SUPPORTED")}</mc:Choice>`,
    `<mc:Fallback>${paragraph("FALLBACK")}</mc:Fallback>`,
    '</mc:AlternateContent>',
  ].join("")), ["FIRST_SUPPORTED"]);

  assertText("all Requires prefixes must be supported", body(alternate({
    choiceRequires: "wps bad",
    namespaces: `xmlns:wps="${WPS_NS}" xmlns:bad="${UNSUPPORTED_NS}"`,
    choice: paragraph("CHOICE"),
    fallback: paragraph("FALLBACK"),
  })), ["FALLBACK"]);

  assertText("unresolved prefix falls back", body(alternate({
    choiceRequires: "missing",
    namespaces: "",
    choice: paragraph("CHOICE"),
    fallback: paragraph("FALLBACK"),
  })), ["FALLBACK"]);

  assertText("no fallback yields no semantic branch", body([
    '<mc:AlternateContent>',
    `<mc:Choice Requires="bad" xmlns:bad="${UNSUPPORTED_NS}">${paragraph("HIDDEN")}</mc:Choice>`,
    '</mc:AlternateContent>',
  ].join("")), []);

  assertText("nested AlternateContent resolves recursively", body(alternate({
    choiceRequires: "wps",
    namespaces: `xmlns:wps="${WPS_NS}" xmlns:bad="${UNSUPPORTED_NS}"`,
    choice: alternate({
      choiceRequires: "bad",
      namespaces: `xmlns:bad="${UNSUPPORTED_NS}"`,
      choice: paragraph("NESTED_HIDDEN"),
      fallback: paragraph("NESTED_FALLBACK"),
    }),
    fallback: paragraph("OUTER_FALLBACK"),
  })), ["NESTED_FALLBACK"]);

  assertText("duplicate branch text appears once", body(alternate({
    choiceRequires: "wps",
    namespaces: `xmlns:wps="${WPS_NS}"`,
    choice: paragraph("DUPLICATE"),
    fallback: paragraph("DUPLICATE"),
  })), ["DUPLICATE"]);

  assertText("inactive semantic marker is absent", body(alternate({
    choiceRequires: "wps",
    namespaces: `xmlns:wps="${WPS_NS}"`,
    choice: paragraph("KAYNAKLAR"),
    fallback: paragraph("HIDDEN_KAYNAKLAR"),
  })), ["KAYNAKLAR"]);

  const drawingDocument = parseDocumentXml(body(alternate({
    choiceRequires: "wp",
    namespaces: `xmlns:wp="${WP_NS}"`,
    choice: figureParagraph(),
    fallback: figureParagraph(),
  })));
  assertEqual(
    drawingDocument.objectSemantics.representations.length,
    1,
    "inactive branch drawing absent from semantic facts",
  );

  console.log("AlternateContent resolution regression passed.");
}

function assertText(label, xml, expectedTexts) {
  const xmlDocument = new DOMParser().parseFromString(xml, "application/xml");
  const paragraphs = getSemanticDescendantsByTagNameNS(xmlDocument, W_NS, "p");
  const texts = paragraphs.map((item) =>
    getSemanticDescendantsByTagNameNS(item, W_NS, "t")
      .map((textElement) => textElement.textContent ?? "")
      .join(""),
  );

  assertEqual(JSON.stringify(texts), JSON.stringify(expectedTexts), label);
}

function body(content) {
  return [
    `<w:document xmlns:w="${W_NS}" xmlns:mc="${MC_NS}">`,
    '<w:body>',
    content,
    '</w:body>',
    '</w:document>',
  ].join("");
}

function alternate({ choiceRequires, namespaces, choice, fallback }) {
  return [
    '<mc:AlternateContent>',
    `<mc:Choice Requires="${choiceRequires}" ${namespaces}>${choice}</mc:Choice>`,
    fallback === undefined ? "" : `<mc:Fallback>${fallback}</mc:Fallback>`,
    '</mc:AlternateContent>',
  ].join("");
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function figureParagraph() {
  return [
    '<w:p>',
    '<w:r>',
    '<w:drawing>',
    '<wp:inline/>',
    '</w:drawing>',
    '</w:r>',
    '</w:p>',
  ].join("");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

main();
