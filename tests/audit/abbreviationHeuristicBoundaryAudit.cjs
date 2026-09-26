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
  ConditionalRequiredSectionValidator,
} = require("../../src/features/analysis/rules/validators/ConditionalRequiredSectionValidator.ts");

const CASES = [
  {
    label: "all-caps ordinary word LABORATUVAR",
    text: "LABORATUVAR sonuçları değerlendirildi.",
    expectedCandidates: ["LABORATUVAR"],
  },
  {
    label: "all-caps ordinary word ARAŞTIRMA",
    text: "ARAŞTIRMA sonuçları değerlendirildi.",
    expectedCandidates: ["ARAŞTIRMA"],
  },
  {
    label: "bare DNA",
    text: "DNA analiz edildi.",
    expectedCandidates: ["DNA"],
  },
  {
    label: "bare PCR",
    text: "PCR uygulandı.",
    expectedCandidates: ["PCR"],
  },
  {
    label: "bare MAP",
    text: "MAP koşullarında depolandı.",
    expectedCandidates: ["MAP"],
  },
  {
    label: "expansion before DNA",
    text: "Deoksiribonükleik asit (DNA) analiz edildi.",
    expectedCandidates: ["DNA"],
  },
  {
    label: "DNA before expansion",
    text: "DNA (Deoksiribonükleik asit) analiz edildi.",
    expectedCandidates: ["DNA"],
  },
  {
    label: "Turkish uppercase ÇOMÜ",
    text: "ÇOMÜ bünyesinde gerçekleştirildi.",
    expectedCandidates: ["ÇOMÜ"],
  },
  {
    label: "Turkish uppercase TÜBİTAK",
    text: "TÜBİTAK tarafından desteklendi.",
    expectedCandidates: ["TÜBİTAK"],
  },
  {
    label: "alphanumeric CO2",
    text: "CO2 seviyesi ölçüldü.",
    expectedCandidates: ["CO2"],
  },
  {
    label: "alphanumeric H2O",
    text: "H2O kullanıldı.",
    expectedCandidates: ["H2O"],
  },
  {
    label: "hyphenated UV-VIS",
    text: "UV-VIS analizi yapıldı.",
    expectedCandidates: ["UV-VIS"],
  },
  {
    label: "mixed-case pH",
    text: "pH ölçüldü.",
    expectedCandidates: [],
  },
];

function main() {
  const bodyResults = CASES.map(assertBodyScenario);
  const exclusionResults = assertScopeExclusions();

  console.log(JSON.stringify({
    phase: "abbreviation-heuristic-boundary-audit",
    result: "PASS",
    audit: "abbreviationHeuristicBoundaryAudit.cjs",
    bodyScenarios: bodyResults,
    exclusionScenarios: exclusionResults,
    decision:
      "The current heuristic cannot distinguish all-caps ordinary words from bare acronyms without extra semantic evidence.",
  }, null, 2));
}

function assertBodyScenario(item) {
  const model = documentModel(academicBodyParagraph(item.text));
  const result = validate(model);
  const candidates = model.abbreviations.items.map((entry) => entry.value);
  const expectedStatus = item.expectedCandidates.length > 0 ? "FAILED" : "NOT_APPLICABLE";

  assertArrayEqual(candidates, item.expectedCandidates, `${item.label}: candidates`);
  assertEqual(model.abbreviations.hasAbbreviations, item.expectedCandidates.length > 0, `${item.label}: hasAbbreviations`);
  assertEqual(result.status, expectedStatus, `${item.label}: rule status`);

  return reportScenario(item.label, item.text, model, result, "academic body paragraph");
}

function assertScopeExclusions() {
  const tokens = CASES.flatMap((item) => item.expectedCandidates);
  const uniqueTokens = Array.from(new Set(tokens));
  const contexts = [
    { label: "Heading", build: heading1Paragraph },
    { label: "TOC", build: tocParagraph },
    { label: "textbox", build: textboxParagraph },
    { label: "deleted revision", build: deletedParagraph },
  ];
  const reports = [];

  for (const token of uniqueTokens) {
    for (const context of contexts) {
      const model = documentModel(requiredIntroHeading() + context.build(`${token} kapsam dışı metin`));
      const result = validate(model);
      const candidates = model.abbreviations.items.map((entry) => entry.value);

      assertArrayEqual(candidates, [], `${context.label} ${token}: excluded candidates`);
      assertEqual(model.abbreviations.hasAbbreviations, false, `${context.label} ${token}: hasAbbreviations`);
      assertEqual(result.status, "NOT_APPLICABLE", `${context.label} ${token}: rule status`);

      reports.push(reportScenario(
        `${context.label}: ${token}`,
        `${token} kapsam dışı metin`,
        model,
        result,
        `${context.label} exclusion`,
      ));
    }
  }

  return reports;
}

function reportScenario(label, text, model, result, scope) {
  const candidates = model.abbreviations.items.map((entry) => entry.value);

  return {
    label,
    text,
    scope,
    candidates,
    hasAbbreviations: model.abbreviations.hasAbbreviations,
    listOfAbbreviationsResult: result.status,
    semanticEvidence: createSemanticEvidence(scope, candidates),
  };
}

function createSemanticEvidence(scope, candidates) {
  if (candidates.length === 0) {
    return [
      `${scope}: no eligible token reached document.abbreviations.items`,
      "conditional rule stayed NOT_APPLICABLE because hasAbbreviations=false",
    ];
  }

  return [
    `${scope}: Unicode token matched uppercase-letter/number/hyphen abbreviation heuristic`,
    `detected candidates: ${candidates.join(", ")}`,
    "conditional rule became applicable because hasAbbreviations=true",
  ];
}

function documentModel(bodyXml) {
  const parsed = parseDocumentXml(wrapDocumentXml(bodyXml));
  const withStyles = {
    ...parsed,
    styles: [
      {
        id: "Heading1",
        type: "paragraph",
        name: "Heading 1",
        basedOn: null,
        nextStyle: null,
        fontFamily: null,
        fontSize: null,
        bold: null,
        italic: null,
        underline: null,
        lineSpacing: null,
        paragraphFormatting: emptyParagraphFormatting(),
        alignment: null,
        tableAlignment: null,
        numbering: null,
      },
    ],
  };
  const marked = markRequiredSectionHeadings(withStyles, rules());
  const headed = normalizeDocumentHeadings(marked, rules());
  const scoped = normalizeAcademicDocumentScopes(headed, rules());
  const sectioned = normalizeAcademicSections(scoped, rules());

  return {
    ...sectioned,
    abbreviations: normalizeDocumentAbbreviations(sectioned),
  };
}

function validate(model) {
  return new ConditionalRequiredSectionValidator().validate(model, abbreviationListRule());
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
  return '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + "</w:body></w:document>";
}

function academicBodyParagraph(text) {
  return requiredIntroHeading() + paragraph(text);
}

function requiredIntroHeading() {
  return paragraph("Giriş");
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function heading1Paragraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function tocParagraph(text) {
  return `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function textboxParagraph(text) {
  return `<w:p><w:r><w:pict><w:txbxContent>${paragraph(text)}</w:txbxContent></w:pict></w:r></w:p>`;
}

function deletedParagraph(text) {
  return `<w:p><w:del w:id="1"><w:r><w:t>${text}</w:t></w:r></w:del></w:p>`;
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

function assertArrayEqual(actual, expected, message) {
  assertEqual(actual.join(","), expected.join(","), message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
