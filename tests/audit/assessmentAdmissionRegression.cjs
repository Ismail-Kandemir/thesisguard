const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
require("../golden/experimentalGoldenRegression.cjs");
const { admitAssessmentBatch, AssessmentAdmissionError } = require("../../src/features/analysis/engine/AssessmentAdmission.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { AssessmentReadinessGate } = require("../../src/features/analysis/engine/AssessmentReadinessGate.ts");
const { createAssessmentReport } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins, sduAssessmentReadiness: marginPolicy } = require("./sduMarginAssessmentPilot.ts");

// No reviewed SDU department/program scope was supplied. This is an explicit
// synthetic scope for contract mechanics only, never an academic authorization.
const syntheticScope = { university: { id: "sdu" }, faculty: { id: "engineering" },
  department: { id: "synthetic-department-not-a-source-claim" }, programLevel: { id: "synthetic-level" },
  workType: { id: "synthetic-work-type" } };
const pilots = [...sections.candidates, ...margins.candidates];
const policy = pilots.map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    readiness: candidate.readiness, academicScope: syntheticScope,
    source: { kind: "frozen-source", title: source.title, url: source.url, frozenSourceSha256: source.frozenSourceSha256,
      claim: source.claim, references: candidate.references ?? [{ section: source.section, printedPage: source.printedPage }] } };
});
const request = () => structuredClone({ purpose: "assessment-only", academicScope: syntheticScope, candidates: policy });
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const roundTrip = (value) => JSON.parse(JSON.stringify(value));
let cases = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }
async function denied(input, code, trusted = policy) {
  await assert.rejects(() => admitAssessmentBatch(input, trusted), (error) => error instanceof AssessmentAdmissionError && error.code === code);
}

async function main() {
  const originalPolicy = JSON.stringify([policy, sections, margins, marginPolicy]);
  await check("default-deny, production purpose denial and no production-ready authority", async () => {
    await assert.rejects(() => admitAssessmentBatch(request()), (error) => error.code === "unknown-execution-id");
    await denied({ ...request(), purpose: "production" }, "production-not-authorized");
    await denied({ ...request(), purpose: undefined }, "production-not-authorized");
    for (const readiness of ["deferred", "production-ready"]) {
      const trusted = structuredClone(policy);
      trusted[0].readiness = readiness;
      const input = request(); input.candidates[0].readiness = readiness;
      await denied(input, "not-assessment-ready", trusted);
      await denied(request(), "not-assessment-ready", trusted);
    }
  });
  await check("all eleven source bindings remain exact; synthetic scope is not a real SDU scope claim", async () => {
    const admission = await admitAssessmentBatch(request(), policy);
    assert.equal(admission.bindings.length, 11);
    assert.equal(new Set(admission.bindings.map((binding) => binding.inventoryId)).size, 11);
    assert.equal(new Set(admission.bindings.map((binding) => binding.executionId)).size, 11);
    assert.equal(admission.schemaVersion, "assessment-admission/v1");
    assert.equal(admission.productionAuthorization, "not-granted");
    admission.bindings.forEach((binding, index) => {
      assert.equal(binding.inventoryId, pilots[index].inventoryId);
      assert.equal(binding.executionId, pilots[index].rule.id);
      assert.deepEqual(binding.contract, pilots[index].rule);
      assert.deepEqual(binding.source, policy[index].source);
      assert.deepEqual(binding.academicScope, syntheticScope);
      assert.equal(binding.source.url, "https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf");
      assert.equal(binding.source.frozenSourceSha256, "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44");
      assert.deepEqual(binding.admission, { readiness: "assessment-ready", productionAuthorization: "not-granted",
        sourceVerification: { state: "registered-hash-only" } });
    });
    assert.deepEqual(admission.bindings[7].source.references, [{ section: "1", printedPage: 3, item: 19 }, { section: "4.8", printedPage: 17 }, { section: "4.8", printedPage: 18 }]);
    assert.deepEqual(admission.bindings[8].source.references, [{ section: "1", printedPage: 3, item: 22 }, { section: "4.11", printedPage: 19 }]);
  });
  await check("missing scope is denied for the request and every candidate/policy field", async () => {
    await denied({ ...request(), academicScope: undefined }, "missing-academic-scope");
    for (const field of ["university", "faculty", "department", "programLevel", "workType"]) {
      const input = request(); delete input.academicScope[field];
      await denied(input, "missing-academic-scope");
      const missingCandidate = request(); delete missingCandidate.candidates[0].academicScope[field];
      await denied(missingCandidate, "missing-academic-scope");
      const incompletePolicy = structuredClone(policy); delete incompletePolicy[0].academicScope[field];
      await denied(request(), "missing-academic-scope", incompletePolicy);
    }
    const actualUnscoped = policy.map(({ academicScope, ...candidate }) => { assert.ok(academicScope); return candidate; });
    await denied({ purpose: "assessment-only", academicScope: syntheticScope, candidates: actualUnscoped }, "missing-academic-scope");
  });
  await check("wrong university, faculty, department, level and work type cannot inherit admission", async () => {
    for (const field of ["university", "faculty", "department", "programLevel", "workType"]) {
      const input = request(); input.academicScope[field].id = "wrong-scope";
      await denied(input, "scope-mismatch");
      const altered = request(); altered.candidates[0].academicScope[field].id = "wrong-scope";
      await denied(altered, "scope-mismatch");
    }
  });
  await check("duplicate inventory, execution and readiness metadata fail in policy and request", async () => {
    for (const target of ["policy", "request"]) {
      for (const [kind, expected] of [["inventory", "duplicate-inventory-id"], ["execution", "duplicate-execution-id"], ["readiness", "duplicate-readiness-metadata"]]) {
        const input = request(); const trusted = structuredClone(policy);
        const list = target === "policy" ? trusted : input.candidates;
        const duplicate = structuredClone(list[0]);
        if (kind === "inventory") { duplicate.executionId = list[1].executionId + ".duplicate"; duplicate.contract.id = duplicate.executionId; }
        if (kind === "execution") duplicate.inventoryId = "different-inventory";
        list.push(duplicate);
        await denied(input, expected, trusted);
      }
    }
  });
  await check("unknown, inventory-as-execution, swapped inventory and altered contracts are denied", async () => {
    for (const id of ["unknown.execution", policy[0].inventoryId]) {
      const input = request(); input.candidates[0].executionId = id; input.candidates[0].contract.id = id;
      await denied(input, "unknown-execution-id");
    }
    const swapped = request(); swapped.candidates = [swapped.candidates[0]]; swapped.candidates[0].inventoryId = policy[1].inventoryId;
    await denied(swapped, "contract-mismatch");
    for (const patch of [{ expected: { section: "Other section", required: true } }, { type: "SECTION_ORDER" }, { score: 1 }, { enabled: false }]) {
      const input = request(); Object.assign(input.candidates[0].contract, patch);
      await denied(input, "contract-mismatch");
    }
  });
  await check("missing/altered source chain is denied without fabricated provenance", async () => {
    const missing = request(); delete missing.candidates[0].source;
    await denied(missing, "provenance-mismatch");
    for (const patch of [{ url: "https://example.org/wrong.pdf" }, { frozenSourceSha256: "0".repeat(64) }, { claim: "Wrong claim" },
      { references: [{ section: "1", printedPage: 3, item: 99 }] }, { title: "Wrong guide" }]) {
      const input = request(); Object.assign(input.candidates[0].source, patch);
      await denied(input, "provenance-mismatch");
    }
    const incomplete = request(); delete incomplete.candidates[0].source.frozenSourceSha256;
    await denied(incomplete, "invalid-metadata");
    const forged = request(); forged.candidates[0].admission = { readiness: "assessment-ready", productionAuthorization: "not-granted", sourceVerification: { state: "supplied-pdf-hash-match", sha256: policy[0].source.frozenSourceSha256 } };
    await denied(forged, "invalid-metadata");
  });
  await check("supplied PDF hashing differs from registered hash, with synthetic bytes only", async () => {
    // Not an SDU PDF and never a fresh SDU source verification assertion.
    const bytes = new TextEncoder().encode("%PDF-1.7\nSynthetic hash transport only\n%%EOF");
    const trusted = structuredClone([policy[0]]);
    trusted[0].source.url = "https://example.org/synthetic-transport.pdf";
    trusted[0].source.title = "Synthetic hash transport test";
    trusted[0].source.frozenSourceSha256 = hash(bytes);
    const input = { purpose: "assessment-only", academicScope: syntheticScope, candidates: structuredClone(trusted),
      sourceArtifacts: [{ url: trusted[0].source.url, pdfBytes: bytes }] };
    const admitted = await admitAssessmentBatch(input, trusted);
    assert.deepEqual(admitted.bindings[0].admission.sourceVerification, { state: "supplied-pdf-hash-match", sha256: hash(bytes) });
    input.sourceArtifacts[0].pdfBytes = new TextEncoder().encode("%PDF-1.7\nWrong bytes");
    await denied(input, "source-hash-mismatch", trusted);
    input.sourceArtifacts[0].pdfBytes = new Uint8Array();
    await denied(input, "invalid-metadata", trusted);
    input.sourceArtifacts[0].pdfBytes = bytes;
    input.sourceArtifacts.push(input.sourceArtifacts[0]);
    await denied(input, "invalid-metadata", trusted);
    const wrongSduBytes = { ...request(), sourceArtifacts: [{ url: policy[0].source.url, pdfBytes: bytes }] };
    await denied(wrongSduBytes, "source-hash-mismatch");
  });
  await check("caller mutation, key order and candidate order do not change the trusted snapshot", async () => {
    const input = request(); const trusted = structuredClone(policy);
    const pending = admitAssessmentBatch(input, trusted);
    input.candidates[0].source.claim = "mutated"; trusted[0].readiness = "production-ready";
    const admission = await pending;
    assert.equal(admission.bindings[0].source.claim, policy[0].source.claim);
    assert.equal(admission.bindings[0].admission.readiness, "assessment-ready");
    assert.equal(Reflect.set(admission.bindings[0].academicScope.department, "id", "changed"), false);
    const reversed = request(); reversed.candidates.reverse();
    const reordered = await admitAssessmentBatch(reversed, policy);
    assert.deepEqual([...reordered.bindings].reverse(), admission.bindings);
  });
  await check("report v1 rejects incomplete scope and contradictory admission provenance", async () => {
    const admission = await admitAssessmentBatch(request(), policy);
    for (const fields of [{ academicScope: undefined }, { academicScope: { university: { id: "sdu" } } },
      { admission: { ...admission.bindings[0].admission, productionAuthorization: "granted" } }]) {
      assert.throws(() => createAssessmentReport([], [{ ...admission.bindings[0], ...fields }]), (error) => error.code === "invalid-mapping");
    }
    assert.throws(() => createAssessmentReport([], [{ ...admission.bindings[0], admission: {
      ...admission.bindings[0].admission, sourceVerification: { state: "supplied-pdf-hash-match", sha256: "0".repeat(64) },
    } }]), (error) => error.code === "invalid-provenance");
  });
  for (const filename of ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"]) {
    await check(`${filename}: report v1 preserves all eleven chains and synthetic academic scope`, async () => {
      const filePath = path.join(__dirname, "../fixtures/comu/food-technology/experimental", filename);
      const bytes = fs.readFileSync(filePath); const before = hash(bytes);
      const admission = await admitAssessmentBatch(request(), policy);
      const readiness = admission.bindings.map((binding) => ({ inventoryId: binding.inventoryId,
        readiness: binding.admission.readiness, rule: binding.contract }));
      const document = await readDocx(bytes);
      const executor = new AssessmentExecutionService(undefined, readiness);
      const entries = runSections(document, executor, admission.bindings.map((binding) => binding.contract));
      const report = createAssessmentReport(entries, admission.bindings);
      assert.equal(report.records.length, 11);
      assert.deepEqual(report.records.map((record) => record.execution), entries);
      report.records.forEach(({ execution, ...binding }, index) => {
        assert.equal(execution.kind, "assessment");
        assert.notEqual(execution.decision, "not-applicable");
        assert.deepEqual(binding, admission.bindings[index]);
      });
      assert.deepEqual(roundTrip(report), report);
      const engine = new RuleEngine(); const builder = new ReportBuilder();
      const legacy = engine.run(document, pilots.map((candidate) => candidate.rule));
      const legacyBefore = structuredClone(builder.build(legacy));
      createAssessmentReport(entries, admission.bindings);
      assert.deepEqual(builder.build(legacy), legacyBefore);
      assert.equal(hash(fs.readFileSync(filePath)), before);
    });
  }
  await check("gate policy, production discovery and existing test-only pilots remain unchanged", () => {
    assert.equal(JSON.stringify([policy, sections, margins, marginPolicy]), originalPolicy);
    const gate = new AssessmentReadinessGate(marginPolicy);
    for (const candidate of sections.candidates) assert.equal(gate.check(candidate.rule).code, "unknown-rule");
    assert.equal(loadAvailableRuleSets().some((set) => set.metadata.university.id === "sdu"), false);
  });
  await check("TypeScript preserves required scope, PDF verification states and production denial", () => {
    const filename = path.resolve("tests/audit/assessmentAdmission.typecheck.ts");
    const source = `
import { admitAssessmentBatch } from "../../src/features/analysis/engine/AssessmentAdmission";
import type { AssessmentAdmissionCandidate, AssessmentAdmissionRequest, AssessmentAdmission } from "../../src/features/analysis/engine/AssessmentAdmission";
import type { AssessmentAcademicScope, AssessmentSourceVerification, AssessmentReportBinding } from "../../src/features/analysis/report/AssessmentReport";
declare const candidate: AssessmentAdmissionCandidate;
declare const request: AssessmentAdmissionRequest;
declare const admission: AssessmentAdmission;
// @ts-expect-error missing academic scope cannot form a request
const missingScope: AssessmentAdmissionRequest = { purpose: "assessment-only", candidates: [] };
// @ts-expect-error department cannot be omitted
const incompleteScope: AssessmentAcademicScope = { university: {id:"sdu"}, faculty: {id:"engineering"}, programLevel: {id:"bachelor"}, workType: {id:"work"} };
// @ts-expect-error production is not an assessment purpose
admitAssessmentBatch({ ...request, purpose: "production" });
// @ts-expect-error verified PDF state requires the actual compared hash
const verification: AssessmentSourceVerification = { state: "supplied-pdf-hash-match" };
// @ts-expect-error candidate cannot self-assert verification or authorization
const forged: AssessmentAdmissionCandidate = { ...candidate, admission: {} };
// @ts-expect-error admission never grants production
const production: "granted" = admission.productionAuthorization;
const compatible: readonly AssessmentReportBinding[] = admission.bindings;
void [missingScope, incompleteScope, verification, forged, production, compatible];
`;
    const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, esModuleInterop: true };
    const host = ts.createCompilerHost(options); const original = host.getSourceFile.bind(host);
    host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => path.resolve(file) === filename
      ? ts.createSourceFile(file, source, languageVersion, true) : original(file, languageVersion, onError, shouldCreateNewSourceFile);
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
    }));
    assert.equal(fs.existsSync(filename), false);
  });
  console.log(JSON.stringify({ audit: "assessmentAdmission", result: "PASS", cases, sduPilots: 11,
    sourceHashVerification: "registered only for SDU; supplied-byte success tested with synthetic PDF only",
    academicScope: "synthetic test scope only; real SDU department/program scope remains unconfirmed",
    productionAuthorization: "not-granted", fixtureWrites: 0, temporaryFiles: 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
