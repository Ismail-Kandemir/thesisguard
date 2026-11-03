const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { classifySectionEvidence: classify } = require("./sectionEvidenceClassifier.ts");
const { evaluateAnalysisReadiness: evaluate, runReadinessGatePilot: pilot, AnalysisReadinessDeferredError } = require("./analysisReadinessGatePilot.ts");
const { createNormalizedDocumentFromDocx } = require("../../src/features/analysis/analysisService.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "tests/fixtures/comu/food-technology/experimental");
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" };
const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
const margins = rules.filter((rule) => rule.category === "margin");
const good = '<w:pgMar w:top="1701" w:bottom="1417" w:left="1701" w:right="1417"/>';
const section = (margin = good) => `<w:sectPr>${margin}</w:sectPr>`;
const paragraph = (margin = good) => `<w:p><w:pPr>${section(margin)}</w:pPr></w:p>`;
const math = '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath></m:oMathPara>';
const mc = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:u="urn:unsupported-test"';
const alternate = (choice, fallback) => `<mc:AlternateContent ${mc}><mc:Choice Requires="u">${choice}</mc:Choice>${fallback === null ? "" : `<mc:Fallback>${fallback}</mc:Fallback>`}</mc:AlternateContent>`;
const scenarios = [
  { id: "complete-single", body: `<w:p/>${section()}`, ready: true },
  { id: "complete-multi-different-margins", body: paragraph('<w:pgMar w:top="3cm" w:bottom="2.5cm" w:left="3.2cm" w:right="2.5cm"/>') + `<w:p/>${section()}`, ready: true },
  { id: "equation-only", body: `<w:p/>${math}${section()}`, ready: true },
  { id: "foreign-text-only", body: `<w:p/><a:t xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">text</a:t>${section()}`, ready: true },
  { id: "missing-terminal", body: paragraph() + "<w:p/>", ready: false, reason: "terminal-section-unverified" },
  { id: "missing-all-sections", body: "<w:p/>", ready: false, reason: "section-mapping-mismatch" },
  { id: "missing-pgMar", body: `<w:p/>${section("")}`, ready: false, reason: "margin-element-unverified" },
  { id: "missing-top", body: `<w:p/>${section(good.replace(' w:top="1701"', ""))}`, ready: false, reason: "margin-value-unavailable" },
  { id: "malformed-top", body: `<w:p/>${section(good.replace('w:top="1701"', 'w:top="0x589"'))}`, ready: false, reason: "margin-value-unavailable" },
  { id: "negative-unsigned-left", body: `<w:p/>${section(good.replace('w:left="1701"', 'w:left="-1701"'))}`, ready: false, reason: "margin-value-unavailable" },
  { id: "duplicate-pgMar", body: `<w:p/>${section(good + good)}`, ready: false, reason: "margin-element-unverified" },
  { id: "missing-earlier-margin-with-later-violation", body: paragraph("") + `<w:p/>${section(good.replace('w:left="1701"', 'w:left="1900"'))}`, ready: false, reason: "margin-element-unverified" },
  ...["altChunk", "subDoc", "contentPart"].map((carrier) => ({ id: `unsupported-${carrier}`, body: `<w:p/><w:${carrier}/>${section()}`, ready: false, reason: "unsupported-section-carrier" })),
  { id: "equation-plus-altChunk", body: `<w:p/>${math}<w:altChunk/>${section()}`, ready: false, reason: "unsupported-section-carrier" },
  { id: "equation-without-terminal", body: paragraph() + math, ready: false, reason: "terminal-section-unverified" },
  { id: "duplicate-terminal", body: `<w:p/>${section()}${section()}`, ready: false, reason: "terminal-section-unverified" },
  { id: "trailing-paragraph-after-terminal", body: `<w:p/>${section()}<w:p/>`, ready: false, reason: "terminal-section-unverified" },
  { id: "table-cell-section", body: `<w:tbl><w:tr><w:tc>${paragraph()}</w:tc></w:tr></w:tbl>${section()}`, ready: false, reason: "section-placement-unverified" },
  { id: "equation-containing-section", body: `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${paragraph()}</m:oMath>${section()}`, ready: false, reason: "section-placement-unverified" },
  { id: "unresolved-MCE", body: `<w:p/>${alternate("<w:altChunk/>", null)}${section()}`, ready: false, reason: "unresolved-alternate-content" },
  { id: "selected-fallback-carrier", body: `<w:p/>${alternate("<w:p/>", "<w:altChunk/>")}${section()}`, ready: false, reason: "unsupported-section-carrier" },
  { id: "inactive-choice-carrier", body: `<w:p/>${alternate("<w:altChunk/>", "<w:p/>")}${section()}`, ready: true },
  { id: "selected-fallback-section", body: alternate("<w:altChunk/>", paragraph()) + section(), ready: true },
  { id: "deleted-carrier", body: `<w:p/><w:del><w:altChunk/></w:del>${section()}`, ready: true },
  { id: "renamed-prefix", body: `<x:p xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/><x:sectPr xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><x:pgMar x:top="1701" x:bottom="1417" x:left="1701" x:right="1417"/></x:sectPr>`, ready: true },
];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function scan(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? scan(file) : /\.docx$/i.test(file) ? [file] : [];
  });
}
function input(bytes, name) {
  const result = new Uint8Array(bytes);
  Object.defineProperties(result, { name: { value: name }, size: { value: result.byteLength }, type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
  return result;
}
function ready(evidence) {
  return evidence.boundaries === "reliable" && evidence.marginEvidence === "complete" && evidence.sectionCoverage === "closed";
}
function exercise(document, raw, expectedReady, label) {
  let engines = 0; let builders = 0;
  const callback = () => { engines++; const results = new RuleEngine().run(document, margins);
    builders++; return new ReportBuilder().build(results); };
  const snapshot = structuredClone(document);
  const readiness = evaluate(document, rules, undefined, raw);
  assert.equal(readiness.kind, expectedReady ? "ready" : "deferred", label);
  if (expectedReady) {
    const report = pilot(document, rules, callback, raw);
    assert.deepEqual(report, new ReportBuilder().build(new RuleEngine().run(document, margins)), label);
  } else {
    assert.throws(() => pilot(document, rules, callback, raw), (error) => {
      assert.ok(error instanceof AnalysisReadinessDeferredError);
      for (const key of ["status", "passed", "report", "score"]) assert.equal(Object.hasOwn(error, key), false);
      return true;
    });
  }
  assert.equal(engines, expectedReady ? 1 : 0);
  assert.equal(builders, expectedReady ? 1 : 0);
  assert.deepEqual(document, snapshot);
}

async function main() {
  const files = scan(path.join(root, "tests")).sort();
  assert.equal(files.length, 44);
  const hashes = new Map(files.map((file) => [file, hash(fs.readFileSync(file))]));
  const results = []; const comparison = [];
  let equation;
  try {
    const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
    for (const scenario of scenarios) {
      const zip = await JSZip.loadAsync(base);
      const original = await zip.file("word/document.xml").async("string");
      const raw = original.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${scenario.body}</w:body>`);
      zip.file("word/document.xml", raw);
      const data = input(await zip.generateAsync({ type: "uint8array" }), `${scenario.id}.docx`);
      const document = await createNormalizedDocumentFromDocx(data);
      const evidence = classify(document, raw);
      assert.equal(ready(evidence), scenario.ready, scenario.id);
      if (scenario.reason) assert.ok(evidence.reasons.includes(scenario.reason), `${scenario.id}: ${JSON.stringify(evidence)}`);
      exercise(document, raw, scenario.ready, scenario.id);
      results.push({ id: scenario.id, expected: scenario.ready ? "ready" : "deferred", evidence });
      console.log(`PASS ${scenario.id}`);
    }
    for (const file of files) {
      const bytes = fs.readFileSync(file);
      const raw = await (await JSZip.loadAsync(bytes, { checkCRC32: true })).file("word/document.xml").async("string");
      const document = await createNormalizedDocumentFromDocx(input(bytes, path.basename(file)));
      const before = evaluate(document, rules);
      const evidence = classify(document, raw);
      assert.equal(ready(evidence), true, file);
      exercise(document, raw, true, file);
      comparison.push({ file: path.relative(root, file).split(path.sep).join("/"), before: before.kind, after: "ready" });
      if (path.basename(file) === "equation-object-synthetic.docx") {
        assert.equal(before.kind, "deferred");
        assert.equal(evidence.text.generalExtraction, "open");
        assert.equal(evidence.text.equationElements, 2);
        assert.deepEqual(evidence.sections.map((item) => item.placement), ["paragraph", "body"]);
        equation = { sha256: hashes.get(file), evidence, boundaries: document.pageSections.map(({ index, startParagraphIndex, endParagraphIndex, source }) =>
          ({ index, startParagraphIndex, endParagraphIndex, source })) };
      }
      // Missing/raw-mismatched evidence can never authorize the classified path.
      assert.equal(ready(classify(document, null)), false);
    }
    const controlXml = await (await JSZip.loadAsync(base)).file("word/document.xml").async("string");
    const control = await createNormalizedDocumentFromDocx(input(base, "control.docx"));
    const tampered = structuredClone(control); tampered.pageSections[0].pageMargins.top = 99;
    assert.ok(classify(tampered, controlXml).reasons.includes("section-mapping-mismatch"));
    exercise(tampered, controlXml, false, "tampered-normalized-margins");
    exercise(control, null, false, "explicit-missing-raw");
    const invalidBody = controlXml.replace("<w:body>", "<w:body/><w:body>");
    assert.ok(classify(control, invalidBody).reasons.includes("body-unavailable"));
    assert.equal(comparison.filter((item) => item.before === "deferred").length, 1);
    const summary = { scenarios: scenarios.length, additionalIntegrityChecks: 3, fixtures: files.length,
      beforeReady: 43, beforeDeferred: 1, afterReady: 44, afterDeferred: 0,
      falseAccepts: 0, falseDefers: 0, productionIntegrated: false, productionFalsePassClosed: false, fixtureWrites: 0 };
    console.log(JSON.stringify({ summary, equation, scenarios: results, comparison }));
  } finally {
    assert.deepEqual(scan(path.join(root, "tests")).sort(), files);
    for (const [file, before] of hashes) assert.equal(hash(fs.readFileSync(file)), before, file);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
