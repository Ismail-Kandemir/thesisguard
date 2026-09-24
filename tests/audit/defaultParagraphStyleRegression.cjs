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
  EffectiveFormattingResolver,
} = require("../../src/features/analysis/parsers/effectiveFormattingResolver.ts");

function main() {
  assertDefaultParagraphStyleAlignment();
  assertExplicitParagraphStyleWins();
  assertDirectParagraphAlignmentWins();
  assertDefaultParagraphStyleBasedOnChain();

  console.log("Default paragraph style regression passed.");
}

function assertDefaultParagraphStyleAlignment() {
  const resolver = createResolver(
    [style("Normal", { alignment: "justify" })],
    { defaultParagraphStyleId: "Normal" },
  );

  assertEqual(
    resolver.resolveParagraphAlignment(null, null),
    "justify",
    "default paragraph style should provide effective alignment",
  );
}

function assertExplicitParagraphStyleWins() {
  const resolver = createResolver(
    [
      style("Normal", { alignment: "justify" }),
      style("BodyLeft", { alignment: "left" }),
    ],
    { defaultParagraphStyleId: "Normal" },
  );

  assertEqual(
    resolver.resolveParagraphAlignment("BodyLeft", null),
    "left",
    "explicit paragraph style should win over default paragraph style",
  );
}

function assertDirectParagraphAlignmentWins() {
  const resolver = createResolver(
    [
      style("Normal", { alignment: "justify" }),
      style("BodyLeft", { alignment: "left" }),
    ],
    { defaultParagraphStyleId: "Normal" },
  );

  assertEqual(
    resolver.resolveParagraphAlignment("BodyLeft", "center"),
    "center",
    "direct paragraph alignment should win over explicit and default styles",
  );
}

function assertDefaultParagraphStyleBasedOnChain() {
  const resolver = createResolver(
    [
      style("BaseBody", { alignment: "justify" }),
      style("Normal", { basedOn: "BaseBody" }),
    ],
    { defaultParagraphStyleId: "Normal" },
  );

  assertEqual(
    resolver.resolveParagraphAlignment(null, null),
    "justify",
    "default paragraph style should resolve basedOn inheritance",
  );
}

function createResolver(styles, overrides = {}) {
  return new EffectiveFormattingResolver(styles, {
    defaultParagraphStyleId: overrides.defaultParagraphStyleId ?? null,
    fontFamily: null,
    fontFamilyReference: null,
    fontSize: null,
    bold: null,
    italic: null,
    underline: null,
    lineSpacing: null,
    alignment: null,
    paragraphFormatting: emptyParagraphFormatting(),
  });
}

function style(id, overrides = {}) {
  return {
    id,
    type: "paragraph",
    name: id,
    basedOn: overrides.basedOn ?? null,
    nextStyle: null,
    fontFamily: null,
    fontFamilyReference: null,
    fontSize: null,
    bold: null,
    italic: null,
    underline: null,
    lineSpacing: null,
    paragraphFormatting: emptyParagraphFormatting(),
    alignment: overrides.alignment ?? null,
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
