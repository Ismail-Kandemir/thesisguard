require("../golden/experimentalGoldenRegression.cjs");

const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const {
  normalizeAcademicDocumentScopes,
} = require("../../src/features/analysis/parsers/academicDocumentScopeNormalizer.ts");
const {
  normalizeAcademicSections,
} = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const {
  normalizeDocumentHeadings,
} = require("../../src/features/analysis/parsers/documentHeadingsNormalizer.ts");
const {
  normalizeSectionName,
} = require("../../src/features/analysis/parsers/documentSectionsParser.ts");
const {
  markRequiredSectionHeadings,
} = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { countWords } = require("../../src/features/analysis/rules/wordCount.ts");

const SUMMARY_WORD_RULE_ID =
  "comu.engineering.computer-engineering.bachelor.summary-word-count";
const COMPUTER_SELECTION = {
  universityId: "comu",
  facultyId: "engineering",
  departmentId: "computer-engineering",
  thesisTypeId: "bachelor",
};
const FOOD_SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};

function main() {
  assertWordCountingPolicy();
  assertSummaryWordLimit(299, "PASSED");
  assertSummaryWordLimit(300, "PASSED");
  assertSummaryWordLimit(301, "FAILED");
  assertHeadingTextExcluded();
  assertNextAcademicSectionExcluded();
  assertTocSummaryOccurrenceExcluded();
  assertDeletedAndTextboxTextExcluded();
  assertCrossNamespaceRegistryDispatch();
  assertMalformedExpectedDoesNotPassSilently();
  assertFoodTechnologyBaseline();

  console.log(JSON.stringify({
    audit: "comuComputerEngineeringSummaryWordCountRegression.cjs",
    result: "PASS",
    ruleType: "SECTION_WORD_COUNT",
    wordPolicy: "Unicode letter/number tokens; punctuation and whitespace are separators; section heading is excluded",
    boundary: "AcademicSectionOccurrence",
    limits: { 299: "PASS", 300: "PASS", 301: "FAIL" },
  }, null, 2));
}

function assertWordCountingPolicy() {
  assertEqual(
    countWords(["  Türkçe, metin;  noktalama\nve\tboşluk 123  "]),
    6,
    "word count policy handles Turkish, punctuation and whitespace",
  );
}

function assertSummaryWordLimit(wordCount, expectedStatus) {
  const result = validateSummary(
    heading("ÖZET") +
      paragraph(words(wordCount)) +
      heading("Kaynaklar") +
      paragraph("kaynak metni"),
  );

  assertEqual(result.status, expectedStatus, `${wordCount} word summary status`);
  assertEqual(result.actual, `${wordCount} kelime`, `${wordCount} word summary actual`);
}

function assertHeadingTextExcluded() {
  const result = validateSummary(
    heading("ÖZET") +
      paragraph(words(300)) +
      heading("Kaynaklar"),
  );

  assertEqual(result.status, "PASSED", "heading text excluded from summary count");
  assertEqual(result.actual, "300 kelime", "heading text excluded actual count");
}

function assertNextAcademicSectionExcluded() {
  const result = validateSummary(
    heading("ÖZET") +
      paragraph(words(300)) +
      heading("Kaynaklar") +
      paragraph(words(50)),
  );

  assertEqual(result.status, "PASSED", "next academic section is excluded");
  assertEqual(result.actual, "300 kelime", "next academic section excluded actual count");
}

function assertTocSummaryOccurrenceExcluded() {
  const result = validateSummary(
    tocHeading("ÖZET") +
      paragraph(words(301)) +
      heading("ÖZET") +
      paragraph(words(300)) +
      heading("Kaynaklar"),
  );

  assertEqual(result.status, "PASSED", "TOC summary occurrence excluded");
  assertEqual(result.actual, "300 kelime", "TOC summary text excluded actual count");
}

function assertDeletedAndTextboxTextExcluded() {
  const result = validateSummary(
    heading("ÖZET") +
      deletedParagraph(words(301)) +
      textboxParagraph(words(301)) +
      paragraph(words(300)) +
      heading("Kaynaklar"),
  );

  assertEqual(result.status, "PASSED", "deleted and textbox false positives excluded");
  assertEqual(result.actual, "300 kelime", "deleted and textbox excluded actual count");
}

function assertCrossNamespaceRegistryDispatch() {
  const validator = new ValidatorRegistry().getValidator({
    ...summaryWordRule(),
    id: "second-university.engineering.software.bachelor.summary-word-count",
  });

  assertEqual(
    validator?.constructor.name,
    "SectionWordCountValidator",
    "cross namespace SECTION_WORD_COUNT dispatch",
  );
}

function assertMalformedExpectedDoesNotPassSilently() {
  const malformedRule = {
    ...summaryWordRule(),
    id: "comu.engineering.computer-engineering.bachelor.malformed-summary-word-count",
    expected: { section: "Özet", max: 300.5 },
  };
  const document = semanticDocumentFromXml(
    heading("ÖZET") + paragraph(words(299)),
    [requiredRule("Özet"), malformedRule],
  );

  assertThrows(
    () => new RuleEngine(new ValidatorRegistry()).run(document, [malformedRule]),
    "SECTION_WORD_COUNT kuralı",
    "malformed expected does not pass silently",
  );
}

function assertFoodTechnologyBaseline() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(FOOD_SELECTION));
  const coverageCounts = countBy(rules, (rule) => metadata(rule).coverage);
  const trustCounts = countBy(rules, (rule) => metadata(rule).trust);

  assertEqual(rules.length, 46, "food technology rule count");
  assertCounts(coverageCounts, { COMPLETE: 45, PARTIAL: 1, SHALLOW: 0, MISSING: 0 }, "food coverage");
  assertCounts(trustCounts, { HIGH: 45, MEDIUM: 1, LOW: 0 }, "food trust");
}

function validateSummary(bodyXml) {
  const document = semanticDocumentFromXml(bodyXml, summaryRules());
  const [result] = new RuleEngine(new ValidatorRegistry()).run(
    document,
    [summaryWordRule()],
  );

  return result;
}

function summaryRules() {
  return [
    requiredRule("Özet"),
    requiredRule("Kaynaklar"),
    summaryWordRule(),
  ];
}

function summaryWordRule() {
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(COMPUTER_SELECTION));
  const rule = rules.find((candidate) => candidate.id === SUMMARY_WORD_RULE_ID);

  if (!rule) {
    throw new Error(`Rule not resolved: ${SUMMARY_WORD_RULE_ID}`);
  }

  return rule;
}

function semanticDocumentFromXml(bodyXml, activeRules) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const marked = markRequiredSectionHeadings(parsed, activeRules);
  const headed = normalizeDocumentHeadings(marked, activeRules);
  const scoped = normalizeAcademicDocumentScopes(headed, activeRules);

  return normalizeAcademicSections(scoped, activeRules);
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

function heading(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocHeading(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>`;
}

function deletedParagraph(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
}

function wrapDocumentXml(content) {
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>';
}

function words(count) {
  return Array.from({ length: count }, (_, index) => `kelime${index + 1}`).join(" ");
}

function metadata(rule) {
  if (!rule.validation) {
    throw new Error(`${rule.id}: validation metadata missing`);
  }

  return rule.validation;
}

function countBy(items, getKey) {
  const counts = {};

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function assertCounts(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assertEqual(actual[key] ?? 0, value, `${label}.${key}`);
  }
}

function assertThrows(fn, expectedMessagePart, message) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessagePart)) {
      return;
    }

    throw new Error(`${message}: unexpected error ${error}`);
  }

  throw new Error(`${message}: expected throw`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
