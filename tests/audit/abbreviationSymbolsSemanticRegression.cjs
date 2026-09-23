require("../golden/experimentalGoldenRegression.cjs");

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeDocumentAbbreviations,
  detectAbbreviations,
} = require("../../src/features/analysis/parsers/documentAbbreviationsNormalizer.ts");
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
  parseAcademicTermEntries,
} = require("../../src/features/analysis/rules/abbreviationListParser.ts");
const {
  getAcademicSectionContentParagraphs,
} = require("../../src/features/analysis/rules/sectionContent.ts");
const {
  ConditionalRequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");

function main() {
  assertSemanticSectionOwnership();
  assertTocTextboxAndRevisionExclusion();
  assertDuplicateAndMalformedEntries();
  assertSplitRunEntries();
  assertConditionalPresenceUsesSemanticOccurrence();
  assertAbbreviationTokenSafety();
  assertPunctuationAndUnicodeDetection();
  assertCaseSensitiveNormalization();
  assertSymbolParsingIsNotEnabledByDefault();

  console.log(JSON.stringify({
    phase: "4F-04",
    result: "PASS",
    audit: "abbreviationSymbolsSemanticRegression.cjs",
  }, null, 2));
}

function assertSemanticSectionOwnership() {
  const document = semanticDocumentFromXml(
    heading("Simgeler ve Kısaltmalar Listesi") +
      paragraph("DNA: Deoksiribonukleik asit") +
      heading("Giriş") +
      paragraph("DNA örneği burada kullanıldı."),
  );
  const list = occurrence(document, "Simgeler ve Kısaltmalar Listesi");
  const entries = parseAcademicTermEntries(
    getAcademicSectionContentParagraphs(document, list),
    list,
  );

  assertEqual(entries.length, 1, "owned entry count");
  assertEqual(entries[0].sourceSectionIdentity, normalizeSectionName("Simgeler ve Kısaltmalar Listesi"), "entry source section identity");
  assertEqual(entries[0].term, "DNA", "entry term");
  assertEqual(entries[0].definition, "Deoksiribonukleik asit", "entry definition");
}

function assertTocTextboxAndRevisionExclusion() {
  const falsePositiveCases = [
    { label: "TOC heading", xml: tocHeading("Simgeler ve Kısaltmalar Listesi") + paragraph("DNA: Wrong") },
    { label: "textbox heading", xml: textboxParagraph("Simgeler ve Kısaltmalar Listesi") + paragraph("DNA: Wrong") },
    { label: "deleted heading", xml: deletedParagraph("Simgeler ve Kısaltmalar Listesi") + paragraph("DNA: Wrong") },
  ];

  for (const item of falsePositiveCases) {
    const document = semanticDocumentFromXml(item.xml);
    assertEqual(
      document.academicSections.occurrences.some((entry) => entry.identity === normalizeSectionName("Simgeler ve Kısaltmalar Listesi")),
      false,
      `${item.label} does not create abbreviation section`,
    );
  }
}

function assertDuplicateAndMalformedEntries() {
  const document = semanticDocumentFromXml(
    heading("Simgeler ve Kısaltmalar Listesi") +
      paragraph("DNA: Deoksiribonukleik asit") +
      paragraph("DNA: Different definition") +
      paragraph("PCR:"),
  );
  const list = occurrence(document, "Simgeler ve Kısaltmalar Listesi");
  const entries = parseAcademicTermEntries(
    getAcademicSectionContentParagraphs(document, list),
    list,
  );

  assertEqual(entries.length, 3, "duplicates and malformed entries preserved");
  assertEqual(entries.filter((entry) => entry.term === "DNA").length, 2, "duplicate DNA occurrences preserved");
  assertEqual(entries.find((entry) => entry.term === "PCR").status, "malformed", "empty definition is malformed");
}

function assertSplitRunEntries() {
  const document = semanticDocumentFromXml(
    heading("Simgeler ve Kısaltmalar Listesi") +
      splitTextParagraph(["PC", "R", "\t", "Polimeraz zincir reaksiyonu"]),
  );
  const list = occurrence(document, "Simgeler ve Kısaltmalar Listesi");
  const entries = parseAcademicTermEntries(
    getAcademicSectionContentParagraphs(document, list),
    list,
  );

  assertEqual(entries.length, 1, "split-run entry parsed");
  assertEqual(entries[0].term, "PCR", "split-run term reconstructed");
  assertEqual(entries[0].definition, "Polimeraz zincir reaksiyonu", "split-run definition reconstructed");
}

function assertConditionalPresenceUsesSemanticOccurrence() {
  const positive = semanticDocumentFromXml(
    heading("Simgeler ve Kısaltmalar Listesi") +
      heading("Giriş") +
      paragraph("DNA kullanıldı."),
  );
  const tocOnly = semanticDocumentFromXml(
    tocHeading("Simgeler ve Kısaltmalar Listesi") +
      heading("Giriş") +
      paragraph("DNA kullanıldı."),
  );
  const validator = new ConditionalRequiredSectionValidator();

  assertEqual(validator.validate(positive, abbreviationListRule()).status, "PASSED", "semantic occurrence satisfies conditional list");
  assertEqual(validator.validate(tocOnly, abbreviationListRule()).status, "FAILED", "TOC occurrence does not satisfy conditional list");
}

function assertAbbreviationTokenSafety() {
  const bodyOnly = semanticDocumentFromXml(heading("Giriş") + paragraph("LABORATUVAR sonucunda örnek yok."));

  assertEqual(detectAbbreviations(["LABORATUVAR"]).some((item) => item.value === "AB"), false, "substring AB not detected inside larger word");
  assertEqual(bodyOnly.abbreviations.hasAbbreviations, true, "uppercase token heuristic remains conservative but active");
  assertEqual(detectAbbreviations(["DNA, PCR. (HPLC)"]).map((item) => item.value).join(","), "DNA,PCR,HPLC", "punctuation boundaries detected");
}

function assertPunctuationAndUnicodeDetection() {
  const detected = detectAbbreviations(["ÇOMÜ ve DNA kullanıldı."]);

  assertEqual(detected.some((item) => item.value === "ÇOMÜ"), true, "Turkish uppercase abbreviation detected");
  assertEqual(detected.some((item) => item.value === "DNA"), true, "sentence body abbreviation detected");
}

function assertCaseSensitiveNormalization() {
  const document = semanticDocumentFromXml(
    heading("Simgeler ve Kısaltmalar Listesi") +
      paragraph("DNA: Bir") +
      paragraph("Dna: İki"),
  );
  const list = occurrence(document, "Simgeler ve Kısaltmalar Listesi");
  const entries = parseAcademicTermEntries(
    getAcademicSectionContentParagraphs(document, list),
    list,
  );

  assertEqual(entries.some((entry) => entry.normalizedTerm === "DNA"), true, "uppercase abbreviation kept");
  assertEqual(entries.some((entry) => entry.normalizedTerm === "Dna"), false, "case variant is not lowercased into valid abbreviation");
}

function assertSymbolParsingIsNotEnabledByDefault() {
  const document = semanticDocumentFromXml(
    heading("Simgeler ve Kısaltmalar Listesi") +
      paragraph("%: Yüzde"),
  );
  const list = occurrence(document, "Simgeler ve Kısaltmalar Listesi");
  const entries = parseAcademicTermEntries(
    getAcademicSectionContentParagraphs(document, list),
    list,
  );

  assertEqual(entries.length, 0, "symbol entries are not parsed by default without source-supported symbol semantics");
}

function semanticDocumentFromXml(bodyXml) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, rules());
  const headed = normalizeDocumentHeadings(marked, rules());
  const scoped = normalizeAcademicDocumentScopes(headed, rules());
  const sectioned = normalizeAcademicSections(scoped, rules());

  return {
    ...sectioned,
    abbreviations: normalizeDocumentAbbreviations(sectioned),
  };
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
  return [abbreviationListRule(), requiredRule("Giriş")];
}

function abbreviationListRule() {
  return {
    id: "comu.applied-sciences.food-technology.bachelor.list-of-abbreviations",
    type: "CONDITIONAL_REQUIRED_SECTION",
    title: "Simgeler ve Kısaltmalar Listesi",
    description: "",
    category: "structure",
    expected: {
      section: "Simgeler ve Kısaltmalar Listesi",
      requiredWhen: { fact: "hasAbbreviations", equals: true },
    },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "test",
  };
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
