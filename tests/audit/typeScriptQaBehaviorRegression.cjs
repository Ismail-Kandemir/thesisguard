const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Exercise private pure helpers without mounting React or exposing new APIs.
function functionsFrom(relativePath, names, bindings = {}) {
  const source = fs.readFileSync(path.resolve(relativePath), "utf8");
  const parsed = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = parsed.statements
    .filter((node) => ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text))
    .map((node) => node.getText(parsed)).join("\n");
  const compiled = ts.transpileModule(declarations, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `${compiled}\nreturn { ${names.join(", ")} };`)(...Object.values(bindings));
}

const root = "src/features/analysis/";
const ui = functionsFrom(root + "report/components/AnalysisReportView.tsx", [
  "hasResultValue", "formatRuleResultValue", "formatEvidenceValue",
]);

// Existing undefined presentation is a separately deferred UI bug, not fixed by
// this type-only recovery. Do not silently turn it into a new missing-value policy.
assert.equal(ui.hasResultValue(undefined), true);
assert.equal(ui.formatEvidenceValue(undefined, undefined, "actual"), "undefined");
assert.equal(ui.formatEvidenceValue(undefined, "cm", "actual"), "undefined cm");
assert.equal(ui.formatEvidenceValue(null, undefined, "actual"), "Belgede tespit edilmedi");
assert.equal(ui.formatEvidenceValue("", undefined, "expected"), "Belirtilmedi");
assert.equal(ui.formatEvidenceValue(0, "cm", "actual"), "0 cm");
assert.equal(ui.formatEvidenceValue(false, undefined, "actual"), "false");

const objectAlignment = functionsFrom(root + "rules/validators/ObjectAlignmentValidator.ts", ["toObjectAlignment"]);
for (const value of ["left", "center", "right"]) assert.equal(objectAlignment.toObjectAlignment(value), value);
for (const value of ["justify", "unknown", null]) assert.equal(objectAlignment.toObjectAlignment(value), "unknown");

for (const file of ["PageNumberValidator.ts", "PageNumberSequenceValidator.ts"]) {
  const helpers = functionsFrom(root + "rules/validators/" + file, ["formatAlignment"]);
  assert.equal(helpers.formatAlignment("left"), "Sol");
  assert.equal(helpers.formatAlignment("center"), "Orta");
  assert.equal(helpers.formatAlignment("right"), "Sağ");
  // Widening the input type must not introduce a label or change old fallthrough.
  assert.equal(helpers.formatAlignment("justify"), undefined);
}

const family = functionsFrom(root + "rules/validators/FontFamilyValidator.ts", ["getExpectedFontFamily"]);
assert.equal(family.getExpectedFontFamily("Times New Roman"), "Times New Roman");
assert.equal(family.getExpectedFontFamily({ value: "Arial" }), "Arial");
assert.equal(family.getExpectedFontFamily({ section: "Giriş", required: true }), "undefined");

for (const [file, name] of [["FontSizeValidator.ts", "getExpectedFontSize"], ["MarginValidator.ts", "getExpectedMargin"]]) {
  const helpers = functionsFrom(root + "rules/validators/" + file, [name]);
  assert.equal(helpers[name](2.5), 2.5);
  assert.equal(helpers[name]({ value: "2.5" }), 2.5);
  assert.throws(() => helpers[name]({ section: "Giriş", required: true }), Error);
}

const heading = functionsFrom(root + "rules/validators/HeadingValidator.ts", ["getExpected", "parseLevel"], {
  LEVELS: ["Heading1", "Heading2", "Heading3"],
});
for (const selector of [{ level: "Heading2" }, { value: "Heading 2" }]) {
  assert.deepEqual(heading.getExpected({ category: "heading", expected: {
    ...selector, fontFamily: "Times New Roman", fontSize: 12, bold: true,
  } }), { level: "Heading2", semanticLevel: 1, fontFamily: "Times New Roman", fontSize: 12, bold: true });
}
assert.throws(() => heading.getExpected({ category: "heading", expected: { value: "unknown" } }), Error);

console.log("TypeScript QA behavior regression passed: UI fallthrough, alignment unknown, legacy expected values preserved.");
