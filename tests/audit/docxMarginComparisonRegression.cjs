const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");

const fixtures = [
  { name: "ThesisGuard_margin_2_5cm_synthetic.docx", observed: [46, 3, 26, 17] },
  { name: "ThesisGuard_3cm_YENI_TEST.docx", observed: [46, 4, 24, 18] },
].map((fixture) => ({ ...fixture, file: path.join(__dirname, "manual-fixtures", fixture.name) }));
const sides = ["top", "bottom", "left", "right"];
const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const selection = { universityId: "comu", facultyId: "applied-sciences",
  departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" };
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Audit oracle: exact unit conversion followed by the documented two-decimal
// parser contract. Raw precision is retained separately; no academic tolerance.
function measure(raw, side) {
  if (raw === null) return { raw, cm: null, parserCm: null, issue: "missing" };
  const integer = raw.trim();
  let cm;
  if (/^[+-]?\d+$/.test(integer)) {
    const twips = Number(integer);
    if (!Number.isSafeInteger(twips) || (["left", "right"].includes(side) && twips < 0)) {
      return { raw, cm: null, parserCm: null, issue: "invalid-or-unsupported-integer" };
    }
    cm = twips * 2.54 / 1440;
  } else {
    const unit = /^(-?\d+(?:\.\d+)?)(mm|cm|in|pt|pc|pi)$/.exec(raw);
    if (!unit || (["left", "right"].includes(side) && unit[1].startsWith("-"))) {
      return { raw, cm: null, parserCm: null, issue: "invalid-lexeme" };
    }
    cm = Number(unit[1]) * ({ mm: 0.1, cm: 1, in: 2.54, pt: 2.54 / 72, pc: 2.54 / 6, pi: 2.54 / 6 })[unit[2]];
    if (!Number.isFinite(cm) || Math.abs(cm * 1440 / 2.54) > Number.MAX_SAFE_INTEGER) {
      return { raw, cm: null, parserCm: null, issue: "unsupported-magnitude" };
    }
  }
  const parserCm = Math.round(cm * 100) / 100;
  return { raw, cm, parserCm, roundingDeltaCm: parserCm - cm, issue: null };
}

async function main() {
  const missing = fixtures.filter(({ file }) => !fs.existsSync(file));
  assert.equal(missing.length, 0, `Sprint 41 BLOCKED: missing DOCX files:\n${missing.map(({ file }) => file).join("\n")}\nNo document results were produced.`);
  // Reuse only the existing Node TS/DOM harness, without running golden tests.
  require("../golden/experimentalGoldenRegression.cjs");
  const { analyzeDocx, createNormalizedDocumentFromDocx } = require("../../src/features/analysis/analysisService.ts");
  const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
  const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
  const { runSduGuardedAssessmentBatch: batch } = require("./sduGuardedAssessmentBatch.ts");
  const { runSduVersionedConservativePilot: versioned } = require("./sduConservativeDecisionGuardV2.ts");
  const rules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
  assert.equal(rules.length, 46);
  const hashes = new Map(fixtures.map(({ file }) => [file, digest(fs.readFileSync(file))]));
  try {
    for (const fixture of fixtures) {
      const bytes = fs.readFileSync(fixture.file);
      // The reader passes input directly to JSZip; a plain object exposing
      // arrayBuffer() is not a supported ZIP input. Match the golden harness.
      const input = new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      Object.defineProperties(input, {
        name: { value: fixture.name, enumerable: true },
        size: { value: input.byteLength, enumerable: true },
        type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", enumerable: true },
      });
      const zip = await JSZip.loadAsync(input, { checkCRC32: true });
      assert.ok(zip.file("[Content_Types].xml"), "[Content_Types].xml missing");
      assert.ok(zip.file("word/document.xml"), "word/document.xml missing");
      const raw = await zip.file("word/document.xml").async("string");
      const xml = new DOMParser().parseFromString(raw, "application/xml");
      const sections = Array.from(xml.getElementsByTagNameNS(word, "sectPr"));
      const rawSections = sections.map((section, index) => {
        const margins = Array.from(section.children).filter((child) => child.namespaceURI === word && child.localName === "pgMar");
        return { index, pgMarCount: margins.length, margins: Object.fromEntries(sides.map((side) =>
          [side, measure(margins[0]?.getAttributeNS(word, side) ?? null, side)])) };
      });
      const document = await createNormalizedDocumentFromDocx(input);
      const report = await analyzeDocx(input, selection);
      const actualCounts = [report.totalRules, report.passedRules, report.failedRules, report.notApplicableRules];
      console.log(JSON.stringify({ file: fixture.name, sha256: hashes.get(fixture.file), sectionCount: sections.length,
        rawSections, parser: document.pageSections, uiComparison: { observed: fixture.observed, actual: actualCounts,
          matches: actualCounts.every((value, index) => value === fixture.observed[index]) } }));
      assert.equal(document.pageSections.length, sections.length, "Raw/parser section mapping differs; inspect hidden or nested section properties");
      const comu = sides.map((side) => {
        const rule = rules.find((item) => item.category === "margin" && item.id.endsWith(`margin.${side}`));
        assert.ok(rule, `Missing resolved COMU margin rule: ${side}`);
        const result = report.results.find((item) => item.ruleId === rule.id);
        const values = rawSections.map((section, index) => {
          const value = section.margins[side];
          assert.equal(section.pgMarCount, 1, "Missing/duplicate pgMar: raw evidence requires investigation");
          assert.equal(document.pageSections[index].pageMargins[side], value.parserCm, `${fixture.name}/${index}/${side}: parser mismatch`);
          return value.parserCm;
        });
        const expected = rule.expected.value;
        assert.equal(result.status, values.length > 0 && values.every((value) => value === expected) ? "PASSED" : "FAILED");
        return { side, ruleId: rule.id, expected, values, status: result.status, reason: result.message };
      });
      console.log(JSON.stringify({ file: fixture.name, comu }));
      const v1 = await batch(bytes, { admissionPolicy: "synthetic-pilot", guardEnabled: true });
      assert.equal(v1.status, "completed");
      assert.equal(v1.originalReport.records.length, 11);
      assert.deepEqual(v1.executionErrors, []);
      assert.deepEqual(v1.guardErrors, []);
      const bindings = v1.admission.value.bindings;
      assert.ok(bindings.every((binding) => binding.academicScope.department.id.startsWith("synthetic-")));
      const v2 = await versioned(bytes, { enabled: true, version: "v2-experimental", bindings });
      assert.equal(v2.productionAuthorization, "not-granted");
      assert.deepEqual(v2.originalReport, v1.originalReport);
      assert.equal(v2.guardMetadata.length, 11);
      const guardRows = ["top", "bottom"].map((side) => {
        const id = `pilot.sdu.2026.margin.${side}`;
        const record = v1.originalReport.records.find((item) => item.executionId === id);
        const first = v1.guardMetadata.find((item) => item.executionId === id);
        const second = v2.guardMetadata.find((item) => item.executionId === id);
        const values = rawSections.map((section) => section.margins[side]);
        assert.deepEqual(first.evidenceReference.rawValues, values.map((value) => value.raw));
        assert.deepEqual(first.originalProvenance, second.originalProvenance);
        assert.equal(second.v1Decision, first.guardedDecision);
        // Integer OOXML proves only a representation interval in v2, never C.
        if (values.length && values.every((value) => value.issue === null && /^[+-]?\d+$/.test(value.raw.trim())) &&
          document.pageSections.at(-1)?.source === "body" && document.sectionExtractionCoverage.population === "closed") {
          const target = record.contract.expected.value;
          const original = values.some((value) => value.parserCm !== target) ? "violation" : "compliant";
          assert.equal(record.execution.decision, original);
          assert.equal(first.guardedDecision, "undetermined");
          assert.equal(first.reasonCode, "precision-unapproved");
          const excludes = values.some((value) => Math.abs(Number(value.raw) * 254 - target * 144000) > 974);
          assert.equal(second.guardedDecision, original === "violation" && excludes ? "violation" : "undetermined");
          assert.equal(second.reasonCode, original === "violation" && excludes ? "integer-violation-preserved" : "precision-unapproved");
        }
        return { side, original: record.execution.decision, coverage: record.execution.assessment.coverage,
          v1: first, v2: second };
      });
      console.log(JSON.stringify({ file: fixture.name, guardRows, productionAuthorization: "not-granted" }));
    }
  } finally {
    for (const [file, hash] of hashes) assert.equal(digest(fs.readFileSync(file)), hash, `DOCX modified: ${file}`);
  }
  console.log("PASS Sprint 41: two DOCX margin comparisons; fixture writes: 0");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
