const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("../golden/experimentalGoldenRegression.cjs");
const { runSduGuardedAssessmentBatch: run, createSyntheticGuardedBatchRequest: request } = require("./sduGuardedAssessmentBatch.ts");
const { runSduConservativeDecisionPilot: sprint35, guardSduAssessmentReport: guard } = require("./sduConservativeDecisionGuard.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runOriginal } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { createAssessmentReport } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { readDocxAnalysisXmlParts } = require("../../src/features/analysis/readers/docxPackageReader.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const filenames = ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"];
const pilots = [...sections.candidates, ...margins.candidates];
const rules = pilots.map((item) => item.rule);
const enabled = { admissionPolicy: "synthetic-pilot", guardEnabled: true };
const roundTrip = (value) => JSON.parse(JSON.stringify(value));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
let cases = 0;
const matrix = [];
async function check(label, action) { await action(); cases++; console.log(`PASS ${label}`); }
function unchangedPeers(result, baseline, target) {
  assert.equal(result.status, "completed");
  for (const field of ["originalAssessmentResults", "guardedAssessmentResults", "guardMetadata"]) {
    assert.deepEqual(result[field].filter((item) => (item.executionId ?? item.ruleId) !== target),
      baseline[field].filter((item) => (item.executionId ?? item.ruleId) !== target), field);
  }
  assert.equal(result.originalReport.records.length, 11);
  assert.deepEqual(roundTrip(result), result);
  assert.equal(result.productionAuthorization, "not-granted");
}
async function main() {
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".docx"));
  const hashes = new Map(files.map((file) => [file, hash(fs.readFileSync(path.join(directory, file)))]));
  const policyBefore = JSON.stringify([sections, margins]);
  try {
    for (const filename of filenames) {
      const bytes = fs.readFileSync(path.join(directory, filename));
      let baseline;
      const document = await readDocx(bytes);
      const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, rules), rules);
      const { documentXml } = await readDocxAnalysisXmlParts(bytes);
      await check(`${filename}: one admitted execution batch; eleven original/guarded decisions`, async () => {
        let executionCalls = 0;
        baseline = await run(bytes, { ...enabled, hooks: { createExecutor(readiness) {
          const executor = new AssessmentExecutionService(undefined, readiness);
          return { run(document, requested) {
            executionCalls++;
            assert.equal(requested.length, 11);
            return executor.run(document, requested);
          } };
        } } });
        assert.equal(executionCalls, 1);
        assert.equal(baseline.status, "completed");
        assert.equal(baseline.admission.kind, "admitted");
        assert.equal(baseline.admission.value.bindings.length, 11);
        assert.equal(baseline.originalAssessmentResults.length, 11);
        assert.equal(baseline.guardedAssessmentResults.length, 11);
        assert.equal(baseline.guardMetadata.length, 11);
        assert.deepEqual(baseline.executionErrors, []);
        assert.deepEqual(baseline.rejectedRecords, []);
        assert.deepEqual(baseline.guardErrors, []);
        assert.equal(baseline.batchError, null);
        const original = runOriginal(document, new AssessmentExecutionService(undefined, pilots), rules);
        assert.deepEqual(baseline.originalAssessmentResults, original);
        const expected = guard(baseline.originalReport, qualified, documentXml, true);
        assert.deepEqual(baseline.guardMetadata, expected.guardMetadata);
        const sprint35Result = await sprint35(bytes, { enabled: true, bindings: baseline.admission.value.bindings });
        assert.deepEqual(baseline.originalReport, sprint35Result.originalReport);
        assert.deepEqual(baseline.guardMetadata, sprint35Result.guardMetadata);
        for (const row of baseline.guardedAssessmentResults) {
          const entry = original.find((item) => item.ruleId === row.executionId);
          const metadata = expected.guardMetadata.find((item) => item.executionId === row.executionId);
          const candidate = pilots.find((item) => item.rule.id === row.executionId);
          assert.equal(row.inventoryId, candidate.inventoryId);
          assert.equal(row.originalDecision, entry.decision);
          assert.equal(row.guardedDecision, metadata.guardedDecision);
          assert.equal(row.reasonCode, metadata.reasonCode);
          assert.equal(row.coverage, entry.assessment.coverage.population);
          assert.deepEqual(row.identityCertainty, [...new Set(entry.assessment.observations.map((item) => item.identity.certainty))]);
          assert.deepEqual(row.evidenceReference, metadata.evidenceReference);
          assert.equal(row.policyVersion, metadata.policyVersion);
          matrix.push({ docx: filename, ...row });
        }
      });
      await check(`${filename}: immutable JSON snapshot, provenance and report v1 isolation`, () => {
        assert.deepEqual(roundTrip(baseline), baseline);
        assert.ok(Object.isFrozen(baseline));
        assert.ok(Object.isFrozen(baseline.guardMetadata[0].evidenceReference.rawValues));
        assert.ok(Object.isFrozen(baseline.admission.value.bindings[0].source.references));
        const copy = roundTrip(baseline);
        assert.equal(Reflect.set(baseline.guardMetadata[0], "guardedDecision", "compliant"), false);
        assert.deepEqual(baseline, copy);
        assert.equal(baseline.originalReport.schemaVersion, "assessment-report/v1");
        assert.deepEqual(createAssessmentReport(baseline.originalReport.records.map((record) => record.execution),
          baseline.admission.value.bindings), baseline.originalReport);
        assert.deepEqual(baseline.originalReport.scoring, { mode: "unscored", legacyContribution: "none" });
        for (const [index, metadata] of baseline.guardMetadata.entries()) {
          assert.deepEqual(metadata.originalProvenance, baseline.admission.value.bindings[index]);
          assert.equal(metadata.originalProvenance.admission.sourceVerification.state, "registered-hash-only");
          assert.equal(metadata.originalProvenance.admission.productionAuthorization, "not-granted");
          assert.ok(metadata.originalProvenance.academicScope.department.id.startsWith("synthetic-"));
        }
        for (const row of baseline.guardedAssessmentResults) {
          for (const field of ["status", "passed", "score"]) assert.equal(Object.hasOwn(row, field), false);
        }
      });
      await check(`${filename}: opt-out preserves originals and never calls guard hook`, async () => {
        const off = await run(bytes, { admissionPolicy: "synthetic-pilot", hooks: { transformGuardOutput() {
          throw new Error("Disabled guard must never run");
        } } });
        assert.equal(off.guardEnabled, false);
        assert.deepEqual(off.originalReport, baseline.originalReport);
        assert.deepEqual(off.guardMetadata, []);
        assert.deepEqual(off.guardErrors, []);
        off.guardedAssessmentResults.forEach((row) => {
          assert.equal(row.guardedDecision, row.originalDecision);
          assert.equal(row.reasonCode, "guard-disabled");
          assert.equal(row.evidenceReference, null);
          assert.equal(row.policyVersion, null);
        });
      });
      for (const target of [rules[0].id, rules[9].id]) {
        for (const [fault, change] of [
          ["guard runtime error", () => { throw new Error("Controlled guard runtime failure"); }],
          ["missing metadata", (output) => { delete output.guardMetadata; return output; }],
          ["missing evidence reference", (output) => { delete output.guardMetadata[0].evidenceReference; return output; }],
          ["invalid decision", (output) => { output.guardMetadata[0].guardedDecision = "PASSED"; return output; }],
          ["invalid provenance", (output) => { output.guardMetadata[0].originalProvenance.source.claim = "Forged claim"; return output; }],
          ["changed policy version", (output) => { output.guardMetadata[0].policyVersion = "unknown"; return output; }],
          ["unauthorized valid decision", (output) => { output.guardMetadata[0].guardedDecision = output.guardMetadata[0].guardedDecision === "violation" ? "compliant" : "violation"; return output; }],
        ]) await check(`${filename}: ${fault} isolated to ${target}`, async () => {
          const result = await run(bytes, { ...enabled, hooks: { transformGuardOutput(id, output) {
            return id === target ? change(output) : output;
          } } });
          unchangedPeers(result, baseline, target);
          assert.deepEqual(result.originalReport, baseline.originalReport);
          assert.equal(result.guardMetadata.length, 10);
          assert.equal(result.guardErrors.length, 1);
          assert.equal(result.guardErrors[0].executionId, target);
          assert.equal(result.guardErrors[0].code, fault === "guard runtime error" ? "guard-runtime-error" : "invalid-guard-output");
          const failed = result.guardedAssessmentResults.find((row) => row.executionId === target);
          assert.equal(failed.guardedDecision, "undetermined");
          assert.equal(failed.reasonCode, "guard-failure");
          assert.equal(failed.evidenceReference, null);
          assert.equal(result.executionErrors.length, 0);
          assert.equal(result.rejectedRecords.length, 0);
        });
        for (const fault of ["runtime-error", "invalid-assessment", "invalid-execution-decision", "readiness-rejection"]) {
          await check(`${filename}: execution ${fault} preserves ten peers`, async () => {
            const result = await run(bytes, { ...enabled, hooks: { createExecutor(readiness) {
              if (fault === "readiness-rejection") return new AssessmentExecutionService(undefined, readiness.filter((item) => item.rule.id !== target));
              if (fault === "invalid-execution-decision") {
                const executor = new AssessmentExecutionService(undefined, readiness);
                return { run(document, rules) { return executor.run(document, rules).map((entry) => entry.ruleId === target
                  ? { ...entry, decision: "PASSED" } : entry); } };
              }
              const registry = new ValidatorRegistry();
              const lookup = registry.getValidator.bind(registry);
              registry.getValidator = (rule) => rule.id !== target ? lookup(rule) : {
                validate() { throw new Error("Legacy fallback forbidden"); },
                assess() { if (fault === "runtime-error") throw new Error("Controlled producer error"); return {}; },
              };
              return new AssessmentExecutionService(registry, readiness);
            } } });
            unchangedPeers(result, baseline, target);
            assert.equal(result.originalAssessmentResults.length, 10);
            assert.equal(result.guardedAssessmentResults.length, 10);
            assert.deepEqual(result.guardErrors, []);
            const collection = fault === "readiness-rejection" ? result.rejectedRecords : result.executionErrors;
            assert.equal(collection.length, 1);
            assert.equal(collection[0].ruleId, target);
            assert.equal(collection[0].code, fault === "readiness-rejection" ? "unknown-rule"
              : fault === "invalid-execution-decision" ? "invalid-assessment" : fault);
            assert.equal(Object.hasOwn(collection[0], "decision"), false);
            assert.equal(Object.hasOwn(collection[0], "assessment"), false);
          });
        }
      }
      await check(`${filename}: duplicate execution output rejects batch, never an academic violation`, async () => {
        const result = await run(bytes, { ...enabled, hooks: { createExecutor(readiness) {
          const executor = new AssessmentExecutionService(undefined, readiness);
          return { run(document, rules) { const entries = executor.run(document, rules); return [...entries, entries[0]]; } };
        } } });
        assert.equal(result.status, "batch-rejected");
        assert.equal(result.admission.kind, "admitted");
        assert.equal(result.batchError.code, "duplicate-execution-id");
        assert.equal(result.originalReport, null);
        assert.deepEqual(result.guardedAssessmentResults, []);
        assert.deepEqual(result.guardMetadata, []);
        assert.equal(Object.hasOwn(result.batchError, "decision"), false);
      });
      await check(`${filename}: legacy scores unchanged for both COMU departments`, async () => {
        const engine = new RuleEngine(); const builder = new ReportBuilder();
        for (const selection of [
          { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" },
          { universityId: "comu", facultyId: "engineering", departmentId: "computer-engineering", thesisTypeId: "bachelor" },
        ]) {
          const legacyRules = new RuleResolver().resolve(new RuleSetSelector().select(selection));
          assert.equal(legacyRules.length, selection.departmentId === "food-technology" ? 46 : 47);
          const before = structuredClone(builder.build(engine.run(document, legacyRules)));
          await run(bytes, enabled);
          await run(bytes, { admissionPolicy: "synthetic-pilot" });
          assert.deepEqual(builder.build(engine.run(document, legacyRules)), before);
        }
      });
    }
    for (const [name, mutate, policy, expectedCode] of [
      ["default deny", () => {}, undefined, "unknown-execution-id"],
      ["real SDU scope", (input) => {
        input.academicScope.department.id = "industrial-engineering";
        input.candidates.forEach((candidate) => { candidate.academicScope.department.id = "industrial-engineering"; });
      }, "synthetic-pilot", "scope-mismatch"],
      ["duplicate ID", (input) => { input.candidates.push(structuredClone(input.candidates[0])); }, "synthetic-pilot", "duplicate-readiness-metadata"],
      ["unknown ID", (input) => { input.candidates[0].executionId = "unknown"; input.candidates[0].contract.id = "unknown"; }, "synthetic-pilot", "unknown-execution-id"],
      ["changed contract", (input) => { input.candidates[0].contract.expected = { section: "Changed", required: true }; }, "synthetic-pilot", "contract-mismatch"],
      ["invalid provenance", (input) => { input.candidates[0].source.claim = "Forged source claim"; }, "synthetic-pilot", "provenance-mismatch"],
      ["missing provenance", (input) => { delete input.candidates[0].source; }, "synthetic-pilot", "provenance-mismatch"],
      ["missing metadata", (input) => { delete input.candidates[0].academicScope; }, "synthetic-pilot", "missing-academic-scope"],
      ["readiness admission rejection", (input) => { input.candidates[0].readiness = "production-ready"; }, "synthetic-pilot", "not-assessment-ready"],
    ]) await check(`${name}: admission rejects before any document/execution/guard access`, async () => {
      const input = request(); mutate(input);
      let calls = 0;
      const result = await run(null, { guardEnabled: true, admissionPolicy: policy, request: input, hooks: {
        createExecutor() { calls++; throw new Error("Must not execute"); },
        transformGuardOutput() { calls++; throw new Error("Must not guard"); },
      } });
      assert.equal(calls, 0);
      assert.equal(result.status, "admission-rejected");
      assert.equal(result.admission.error.code, expectedCode);
      assert.equal(result.originalReport, null);
      for (const field of ["originalAssessmentResults", "guardedAssessmentResults", "guardMetadata", "executionErrors", "rejectedRecords", "guardErrors"]) assert.deepEqual(result[field], []);
      assert.equal(Object.hasOwn(result.admission.error, "decision"), false);
      assert.deepEqual(roundTrip(result), result);
    });
    assert.equal(matrix.length, 22);
    assert.equal(new Set(matrix.map((row) => `${row.docx}:${row.executionId}`)).size, 22);
    assert.equal(JSON.stringify([sections, margins]), policyBefore);
    console.log(JSON.stringify({ decisionMatrix: matrix }));
  } finally {
    for (const [file, before] of hashes) assert.equal(hash(fs.readFileSync(path.join(directory, file))), before, file);
  }
  const transitions = {};
  for (const row of matrix) { const key = `${row.originalDecision} -> ${row.guardedDecision}`; transitions[key] = (transitions[key] ?? 0) + 1; }
  console.log(JSON.stringify({ audit: "sduGuardedAssessmentBatch", result: "PASS", cases, pilotEvaluations: matrix.length,
    transitions, productionAuthorization: "not-granted", realScopeAdmission: "denied", fixtureWrites: 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
