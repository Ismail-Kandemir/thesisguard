const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { readBoundPackage, inspectBoundEvidence } = require("./packageBoundReadinessPilot.ts");
const { analyzeDocx, createNormalizedDocumentFromDocx } = require("../../src/features/analysis/analysisService.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "tests/fixtures/comu/food-technology/experimental");
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" };
const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection)).filter((rule) => rule.category === "margin");
const { AnalysisReadinessDeferredError, readinessMessage } = require("../../src/features/analysis/engine/AnalysisReadinessGate.ts");
const pgMar = '<w:pgMar w:top="1701" w:bottom="1417" w:left="1701" w:right="1417"/>';
const section = (margin = pgMar) => `<w:sectPr>${margin}</w:sectPr>`;
const paragraph = (margin = pgMar) => `<w:p><w:pPr>${section(margin)}</w:pPr></w:p>`;
const math = '<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>x=1</m:t></m:r></m:oMath></m:oMathPara>';
const cases = [
  { id: "complete", body: `<w:p/>${section()}`, accept: true },
  { id: "multiple-sections-different-margins", body: paragraph(pgMar.replace('w:left="1701"', 'w:left="1900"')) + `<w:p/>${section()}`, accept: true },
  { id: "equation", body: `<w:p/>${math}${section()}`, accept: true },
  { id: "equation-altChunk", body: `<w:p/>${math}<w:altChunk/>${section()}`, accept: false, reason: "unsupported-section-carrier" },
  { id: "duplicate-pgMar", body: `<w:p/>${section(pgMar + pgMar)}`, accept: false, reason: "margin-element-unverified" },
  { id: "conflicting-pgMar", body: `<w:p/>${section(pgMar + pgMar.replace('1701', '1900'))}`, accept: false, reason: "margin-element-unverified" },
  { id: "conflicting-top-attributes", body: `<w:p/>${section(pgMar.replace('w:top="1701"', 'w:top="1701" w:top="1900"'))}`, accept: false, reason: "DOCX_INVALID_XML" },
  { id: "duplicate-identical-attribute", body: `<w:p/>${section(pgMar.replace('w:top="1701"', 'w:top="1701" w:top="1701"'))}`, accept: false, reason: "DOCX_INVALID_XML" },
  { id: "namespace-alias-attribute-conflict", body: `<w:p/>${section(pgMar.replace('w:top="1701"', 'xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:top="1701" x:top="1900"'))}`, accept: false, reason: "DOCX_INVALID_XML" },
  { id: "missing-terminal", body: paragraph() + "<w:p/>", accept: false, reason: "terminal-section-unverified" },
  { id: "missing-pgMar", body: `<w:p/>${section("")}`, accept: false, reason: "margin-element-unverified" },
  { id: "missing-top", body: `<w:p/>${section(pgMar.replace(' w:top="1701"', ""))}`, accept: false, reason: "margin-value-unavailable" },
  { id: "malformed-margin", body: `<w:p/>${section(pgMar.replace('w:top="1701"', 'w:top="NaN"'))}`, accept: false, reason: "margin-value-unavailable" },
  { id: "duplicate-terminal", body: `<w:p/>${section()}${section()}`, accept: false, reason: "terminal-section-unverified" },
  { id: "table-cell-section", body: `<w:tbl><w:tr><w:tc>${paragraph()}</w:tc></w:tr></w:tbl>${section()}`, accept: false, reason: "section-placement-unverified" },
  { id: "unsupported-subDoc", body: `<w:p/><w:subDoc/>${section()}`, accept: false, reason: "unsupported-section-carrier" },
  { id: "wrong-OOXML-root", raw: '<foreign xmlns="urn:test"/>', accept: false, reason: "body-unavailable" },
  { id: "mismatched-XML-close", raw: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body></w:document>', accept: false, reason: "DOCX_INVALID_XML" },
  { id: "unclosed-XML", raw: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/>' + section(), accept: false, reason: "DOCX_INVALID_XML" },
  { id: "empty-raw-XML", raw: "", accept: false, reason: "DOCX_MALFORMED_PACKAGE" },
  { id: "missing-document-part", missing: true, accept: false, reason: "raw-evidence-unavailable" },
  { id: "invalid-ZIP", bytes: new Uint8Array([1, 2, 3]), accept: false, reason: "DOCX_MALFORMED_PACKAGE" },
];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function scan(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isSymbolicLink() ? [] : entry.isDirectory() ? scan(file) : /\.docx$/i.test(file) ? [file] : [];
  });
}
function input(bytes, name = "same-name.docx") {
  const data = new Uint8Array(bytes);
  Object.defineProperties(data, { name: { value: name }, size: { value: data.byteLength },
    type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
  return data;
}
const rows = [];
async function checkProduction(data, accept, label) {
  const engine = RuleEngine.prototype.run; const builder = ReportBuilder.prototype.build;
  const read = JSZip.loadAsync;
  let engines = 0; let builders = 0; let reads = 0; let report; let error;
  RuleEngine.prototype.run = function (...args) { engines++; return engine.apply(this, args); };
  ReportBuilder.prototype.build = function (...args) { builders++; return builder.apply(this, args); };
  JSZip.loadAsync = function (...args) { reads++; return read.apply(this, args); };
  try { report = await analyzeDocx(data, selection); } catch (caught) { error = caught; }
  finally { RuleEngine.prototype.run = engine; ReportBuilder.prototype.build = builder; JSZip.loadAsync = read; }
  assert.equal(reads, 1, label);
  assert.equal(engines, accept ? 1 : 0, label);
  assert.equal(builders, accept ? 1 : 0, label);
  if (accept) { assert.equal(error, undefined, label); assert.equal(report.totalRules, 46); }
  else {
    assert.ok(error, label); assert.equal(report, undefined);
    for (const key of ["report", "score", "status", "passed"]) assert.equal(Object.hasOwn(error, key), false, label);
    if (error instanceof AnalysisReadinessDeferredError) assert.equal(error.message, readinessMessage);
  }
  rows.push({ id: label, decision: report ? "ACCEPT" : "DEFER", engineCalls: engines, builderCalls: builders });
  return { report, error };
}
async function main() {
  const files = scan(path.join(root, "tests")).sort(); assert.equal(files.length, 44);
  const hashes = new Map(files.map((file) => [file, hash(fs.readFileSync(file))]));
  try {
    const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
    let cleanRaw;
    for (const scenario of cases) {
      const zip = await JSZip.loadAsync(base);
      const original = await zip.file("word/document.xml").async("string");
      const raw = scenario.raw ?? original.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${scenario.body}</w:body>`);
      if (scenario.id === "complete") cleanRaw = raw;
      if (scenario.missing) zip.remove("word/document.xml"); else zip.file("word/document.xml", raw);
      const data = input(scenario.bytes ?? await zip.generateAsync({ type: "uint8array" }));
      // Caller metadata, including another document's clean XML, cannot replace package evidence.
      Object.defineProperties(data, { documentXml: { value: cleanRaw }, evidence: { value: { verified: true } } });
      const result = await checkProduction(data, scenario.accept, scenario.id);
      if (!scenario.accept && !scenario.reason.startsWith("DOCX_") && scenario.reason !== "raw-evidence-unavailable") {
        assert.ok(result.error instanceof AnalysisReadinessDeferredError, scenario.id);
      }
      if (scenario.id === "multiple-sections-different-margins") assert.equal(result.report.results.find((r) => r.ruleId.endsWith("margin.left")).status, "FAILED");
    }
    for (const file of files) {
      const data = input(fs.readFileSync(file), path.basename(file));
      const bound = await readBoundPackage(data);
      const oracle = inspectBoundEvidence(bound.package, bound.evidence).document;
      assert.deepEqual(await createNormalizedDocumentFromDocx(data), oracle, file);
      const { report } = await checkProduction(data, true, path.basename(file));
      const actual = report.results.filter((row) => rules.some((rule) => rule.id === row.ruleId));
      assert.deepEqual(actual, new RuleEngine().run(oracle, rules), file);
    }
    console.log(JSON.stringify({ audit: "Sprint 48", result: "PASS", cases: cases.length, fixtures: files.length,
      normalizationParity: "44/44", marginParity: "44/44", falseAccept: 0, falseDefer: 0, rows }));
  } finally {
    for (const [file, before] of hashes) assert.equal(hash(fs.readFileSync(file)), before, file);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
