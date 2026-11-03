const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { readBoundPackage, evaluateBoundReadiness, runBoundMarginPilot, inspectBoundEvidence } = require("./packageBoundReadinessPilot.ts");
const { createNormalizedDocumentFromDocx } = require("../../src/features/analysis/analysisService.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "tests/fixtures/comu/food-technology/experimental");
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" };
const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection)).filter((rule) => rule.category === "margin");
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
const counts = { ACCEPT: 0, DEFER: 0, falseAccept: 0, falseDefer: 0 };

async function open(data) {
  const original = JSZip.loadAsync;
  let reads = 0;
  JSZip.loadAsync = function (...args) { reads++; return original.apply(this, args); };
  let handles;
  try { handles = await readBoundPackage(data); }
  finally { JSZip.loadAsync = original; }
  assert.equal(reads, 1, "The bound factory must invoke exactly one ZIP read");
  assert.ok(Object.isFrozen(handles) && Object.isFrozen(handles.package) && Object.isFrozen(handles.evidence));
  return handles;
}
function check(label, packageToken, evidenceToken, accept, reason) {
  const engine = RuleEngine.prototype.run;
  const builder = ReportBuilder.prototype.build;
  let engines = 0; let builders = 0;
  RuleEngine.prototype.run = function (...args) { engines++; return engine.apply(this, args); };
  ReportBuilder.prototype.build = function (...args) { builders++; return builder.apply(this, args); };
  let result;
  try { result = runBoundMarginPilot(packageToken, evidenceToken, rules); }
  finally { RuleEngine.prototype.run = engine; ReportBuilder.prototype.build = builder; }
  counts[result.decision]++;
  if (result.decision === "ACCEPT" && !accept) counts.falseAccept++;
  if (result.decision === "DEFER" && accept) counts.falseDefer++;
  assert.equal(result.decision, accept ? "ACCEPT" : "DEFER", label);
  assert.equal(engines, accept ? 1 : 0, label);
  assert.equal(builders, accept ? 1 : 0, label);
  if (!accept) {
    for (const key of ["report", "score", "status", "passed"]) assert.equal(Object.hasOwn(result, key), false, label);
    assert.ok(result.reasons.length > 0);
    if (reason) assert.ok(result.reasons.includes(reason), `${label}: ${JSON.stringify(result)}`);
  }
  rows.push({ id: label, decision: result.decision, reasons: result.reasons ?? [], engineCalls: engines, builderCalls: builders });
  return result;
}

async function main() {
  const files = scan(path.join(root, "tests")).sort();
  assert.equal(files.length, 44);
  const hashes = new Map(files.map((file) => [file, hash(fs.readFileSync(file))]));
  const artifacts = new Map();
  try {
    const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
    for (const scenario of cases) {
      const zip = await JSZip.loadAsync(base);
      const original = await zip.file("word/document.xml").async("string");
      if (scenario.missing) zip.remove("word/document.xml");
      else zip.file("word/document.xml", scenario.raw ?? original.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${scenario.body}</w:body>`));
      const bytes = scenario.bytes ?? await zip.generateAsync({ type: "uint8array" });
      const handles = await open(input(bytes));
      const result = check(scenario.id, handles.package, handles.evidence, scenario.accept, scenario.reason);
      if (scenario.id === "multiple-sections-different-margins") {
        assert.equal(result.report.results.find((row) => row.ruleId.endsWith("margin.left")).status, "FAILED");
      }
      artifacts.set(scenario.id, { bytes, handles });
    }
    const clean = artifacts.get("complete"); const dirty = artifacts.get("equation-altChunk");
    const cleanRaw = await (await JSZip.loadAsync(clean.bytes)).file("word/document.xml").async("string");
    check("raw-evidence-token-absent", clean.handles.package, undefined, false, "unregistered-evidence");
    check("null-evidence-token", clean.handles.package, null, false, "unregistered-evidence");
    check("foreign-raw-XML-instead-of-evidence", dirty.handles.package, cleanRaw, false, "unregistered-evidence");
    check("foreign-clean-evidence-for-dirty-package", dirty.handles.package, clean.handles.evidence, false, "package-binding-mismatch");
    check("foreign-dirty-evidence-for-clean-package", clean.handles.package, dirty.handles.evidence, false, "package-binding-mismatch");
    const reopened = await open(input(clean.bytes));
    check("same-bytes-separate-package-read", clean.handles.package, reopened.evidence, false, "package-binding-mismatch");
    check("copied-token-metadata", clean.handles.package, { ...clean.handles.evidence }, false, "unregistered-evidence");
    check("serialized-token-metadata", clean.handles.package, JSON.parse(JSON.stringify(clean.handles.evidence)), false, "unregistered-evidence");
    check("forged-hash-provenance", dirty.handles.package, { kind: "package-evidence", sha256: hash(dirty.bytes), verified: true, origin: "Microsoft Word", documentXml: "forged" }, false, "unregistered-evidence");
    check("forged-package-token", { ...clean.handles.package }, clean.handles.evidence, false, "unregistered-package-read");
    const spoofed = input(dirty.bytes);
    Object.defineProperties(spoofed, { sha256: { value: hash(clean.bytes) }, provenance: { value: "verified" }, documentXml: { value: cleanRaw } });
    const spoofedHandles = await open(spoofed);
    check("same-name-forged-hash-different-content", spoofedHandles.package, spoofedHandles.evidence, false, "unsupported-section-carrier");
    const copy = inspectBoundEvidence(clean.handles.package, clean.handles.evidence);
    copy.document.pageSections[0].pageMargins.top = 99;
    check("mutated-inspection-copy-cannot-replace-evidence", clean.handles.package, copy.evidence, false, "unregistered-evidence");
    const after = check("owned-document-unchanged-by-inspection", clean.handles.package, clean.handles.evidence, true);
    assert.equal(after.report.results.find((row) => row.ruleId.endsWith("margin.top")).actual, 3);
    const mutable = input(clean.bytes);
    const pending = open(mutable);
    mutable.fill(0); // mutate caller-owned bytes while asynchronous ZIP work runs
    const owned = await pending;
    check("caller-byte-mutation-after-snapshot", owned.package, owned.evidence, true);
    const actualFile = new File([clean.bytes], "same-name.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    let fileReads = 0;
    Object.defineProperty(actualFile, "arrayBuffer", { value: async () => { fileReads++; return File.prototype.arrayBuffer.call(actualFile); } });
    const fileHandles = await open(actualFile);
    assert.equal(fileReads, 1, "The File adapter must acquire exactly one byte snapshot");
    check("File-input-one-byte-read-one-ZIP-read", fileHandles.package, fileHandles.evidence, true);

    const fixtureRows = [];
    for (const file of files) {
      const data = input(fs.readFileSync(file), path.basename(file));
      const handles = await open(data);
      const observed = inspectBoundEvidence(handles.package, handles.evidence);
      const oracle = await createNormalizedDocumentFromDocx(data); // independent QA oracle; NOT a second candidate read
      assert.deepEqual(observed.document, oracle, `${file}: one-read normalization parity`);
      const result = check(path.basename(file), handles.package, handles.evidence, true);
      assert.deepEqual(result.report, new ReportBuilder().build(new RuleEngine().run(oracle, rules)), file);
      fixtureRows.push({ file: path.relative(root, file).split(path.sep).join("/"), decision: result.decision });
    }
    assert.equal(counts.falseAccept, 0); assert.equal(counts.falseDefer, 0);
    console.log(JSON.stringify({ scenarios: rows, fixtures: fixtureRows }));
    console.log(JSON.stringify({ audit: "Sprint 47", result: "PASS", negativeAndControlCases: rows.length - files.length,
      fixtures: files.length, decisions: counts, singleCandidateZipRead: true, normalizationParity: "44/44",
      productionIntegrated: false, productionFalsePassClosed: false, fixtureWrites: 0 }));
  } finally {
    assert.deepEqual(scan(path.join(root, "tests")).sort(), files);
    for (const [file, before] of hashes) assert.equal(hash(fs.readFileSync(file)), before, file);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
