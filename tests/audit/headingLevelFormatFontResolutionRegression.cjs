const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  module._compile(output, filename);
};

const {
  HeadingLevelFormatValidator,
} = require("../../src/features/analysis/rules/validators/HeadingLevelFormatValidator.ts");

function main() {
  assertThemeFontPasses();
  assertCaseDifferencePasses();
  assertWhitespaceDifferencePasses();
  assertDifferentFontFails();
  assertFontSizeAndHeadingLevelBehaviorPreserved();

  console.log(JSON.stringify({
    phase: "heading-level-format-font-resolution",
    result: "PASS",
    audit: "headingLevelFormatFontResolutionRegression.cjs",
  }, null, 2));
}

function assertThemeFontPasses() {
  const document = documentWithHeading(run({
    fontFamilyReference: themeFontReference("minorAscii", "minorHAnsi"),
  }));
  const result = validate(document, rule({ fontFamily: "Times New Roman" }));

  assertEqual(result.status, "PASSED", "theme font resolves to expected family");
}

function assertCaseDifferencePasses() {
  const document = documentWithHeading(run({ fontFamily: "times new roman" }));
  const result = validate(document, rule({ fontFamily: "Times New Roman" }));

  assertEqual(result.status, "PASSED", "case-only font difference passes");
}

function assertWhitespaceDifferencePasses() {
  const document = documentWithHeading(run({ fontFamily: "Times   New   Roman" }));
  const result = validate(document, rule({ fontFamily: "Times New Roman" }));

  assertEqual(result.status, "PASSED", "extra font whitespace passes");
}

function assertDifferentFontFails() {
  const document = documentWithHeading(run({ fontFamily: "Arial" }));
  const result = validate(document, rule({ fontFamily: "Times New Roman" }));

  assertEqual(result.status, "FAILED", "different font fails");
}

function assertFontSizeAndHeadingLevelBehaviorPreserved() {
  const wrongSize = documentWithHeading(run({ fontFamily: "Times New Roman", fontSize: 11 }));
  const wrongLevel = documentWithHeading(
    run({ fontFamily: "Times New Roman", fontSize: 12 }),
    { numberingLevel: 1 },
  );

  assertEqual(
    validate(wrongSize, rule({ fontFamily: "Times New Roman", fontSize: 12 })).status,
    "FAILED",
    "font size mismatch still fails",
  );
  assertEqual(
    validate(wrongLevel, rule({ fontFamily: "Times New Roman", fontSize: 12, level: 0 })).status,
    "NOT_APPLICABLE",
    "non-matching heading level remains out of scope",
  );
}

function validate(document, validationRule) {
  return new HeadingLevelFormatValidator().validate(document, validationRule);
}

function rule(overrides) {
  return {
    id: "audit.heading-level-format.font-resolution",
    type: "HEADING_LEVEL_FORMAT",
    title: "Heading level format font resolution",
    description: "",
    category: "heading",
    expected: {
      level: overrides.level ?? 0,
      sections: [{ section: "Giriş" }],
      fontFamily: overrides.fontFamily,
      ...(overrides.fontSize === undefined ? {} : { fontSize: overrides.fontSize }),
      ...(overrides.bold === undefined ? {} : { bold: overrides.bold }),
    },
    severity: "error",
    score: 1,
    message: "",
    solution: "",
    enabled: true,
    version: "audit",
  };
}

function documentWithHeading(headingRun, options = {}) {
  const numberingLevel = options.numberingLevel ?? 0;
  const paragraph = {
    id: "paragraph-1",
    text: "1. Giriş",
    runs: [headingRun],
    contentScope: "document",
    alignment: null,
    lineSpacing: null,
    paragraphFormatting: emptyParagraphFormatting(),
    styleId: null,
    numbering: {
      source: "text",
      numId: null,
      level: numberingLevel,
      visibleLabel: "1.",
    },
    isTableOfContentsEntry: false,
    isInTableCell: false,
    isEmpty: false,
  };

  return {
    paragraphs: [paragraph],
    styles: [],
    documentDefaults: documentDefaults(),
    themeFonts: themeFonts(),
    numberingDefinitions: [],
    pageMargins: { left: null, right: null, top: null, bottom: null },
    pageSections: [],
    pageNumbering: { hasPageNumbers: false, fields: [], sections: [] },
    tableOfContents: { entries: [], detected: false },
    tables: { items: [] },
    blocks: [{ id: "block-1", blockIndex: 0, type: "paragraph", paragraphId: "paragraph-1" }],
    captions: { items: [], orphanCaptionIds: [] },
    objectSemantics: { representations: [], captions: [], associations: [], resolutions: [] },
    academicScopes: {
      paragraphs: [{
        scope: "main",
        reason: "main-boundary",
        boundaryParagraphId: "paragraph-1",
        boundaryParagraphIndex: 0,
      }],
      blocks: [{
        scope: "main",
        reason: "main-boundary",
        boundaryParagraphId: "paragraph-1",
        boundaryParagraphIndex: 0,
      }],
      mainContentBoundary: {
        paragraphId: "paragraph-1",
        paragraphIndex: 0,
        blockIndex: 0,
        sectionName: "Giriş",
      },
    },
    objectReferences: { items: [] },
    abbreviations: { items: [], count: 0, hasAbbreviations: false },
    academicSections: { occurrences: [] },
    sections: [{
      normalizedName: "giris",
      displayName: "Giriş",
      paragraphId: "paragraph-1",
      paragraphIndex: 0,
      isRuleDefinedHeading: true,
      isObjectReferenceExcluded: false,
    }],
    headings: [],
  };
}

function run(overrides) {
  return {
    text: "1. Giriş",
    styleId: null,
    fontFamilyReference: overrides.fontFamilyReference ?? null,
    bold: overrides.bold ?? true,
    italic: null,
    underline: null,
    fontFamily: overrides.fontFamily ?? null,
    fontSize: overrides.fontSize ?? 12,
  };
}

function themeFontReference(ascii, highAnsi) {
  return {
    ascii: { kind: "theme", value: ascii },
    highAnsi: { kind: "theme", value: highAnsi },
    eastAsia: null,
    complexScript: null,
  };
}

function themeFonts() {
  return {
    major: {
      latin: "Cambria",
      eastAsia: null,
      complexScript: null,
      scriptOverrides: {},
    },
    minor: {
      latin: "Times New Roman",
      eastAsia: null,
      complexScript: null,
      scriptOverrides: {},
    },
  };
}

function documentDefaults() {
  return {
    defaultParagraphStyleId: null,
    fontFamily: null,
    fontFamilyReference: null,
    fontSize: null,
    bold: null,
    italic: null,
    underline: null,
    lineSpacing: null,
    alignment: null,
    paragraphFormatting: emptyParagraphFormatting(),
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
