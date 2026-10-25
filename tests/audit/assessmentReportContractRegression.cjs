const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
require("../golden/experimentalGoldenRegression.cjs");
const { createAssessmentReport, AssessmentReportContractError } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");

const candidates = [...sections.candidates, ...margins.candidates];
const rules = candidates.map((candidate) => candidate.rule);
const bindings = candidates.map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    source: { kind: "frozen-source", title: source.title, url: source.url, frozenSourceSha256: source.frozenSourceSha256,
      claim: source.claim, references: candidate.references ?? [{ section: source.section, printedPage: source.printedPage }] } };
});
const syntheticRule = { ...rules[0], id: "audit.synthetic-transport.section" };
const syntheticBinding = { inventoryId: "SYNTHETIC-TRANSPORT-ONLY", executionId: syntheticRule.id, contract: syntheticRule,
  source: { kind: "synthetic-transport", label: "Synthetic transport test only; no academic applicability or source claim." } };
const proof = [{ kind: "document-format", property: "synthetic-transport-only", actual: true }];
const roundTrip = (value) => JSON.parse(JSON.stringify(value));
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fixtureDirectory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const filenames = ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"];
let cases = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }
function rejects(run, code) {
  assert.throws(run, (error) => error instanceof AssessmentReportContractError && error.code === code);
}

function transportAssessment(decision) {
  const reference = { kind: "rule", id: syntheticRule.id };
  if (decision === "not-applicable") return { reference,
    applicability: { state: "not-applicable", reason: "Synthetic transport stub; not an SDU source-based N/A.", evidence: proof } };
  return { reference, applicability: { state: "applicable", evidence: proof },
    coverage: { population: "closed", excludedSubjects: [] }, observations: [decision === "undetermined"
      ? { state: "undetermined", subject: { kind: "document" }, identity: { certainty: "unresolved", reason: "Synthetic identity uncertainty" }, evidence: { certainty: "sufficient", items: proof } }
      : { state: "confirmed", subject: { kind: "document" }, identity: { certainty: "not-required" }, evidence: { certainty: "sufficient", items: proof }, finding: decision }] };
}
function entryFor(assessment) {
  return { kind: "assessment", ruleId: assessment.reference.id, assessment, decision: decideRuleAssessment(assessment) };
}

async function main() {
  const fixtureHashes = new Map(filenames.map((name) => [name, digest(fs.readFileSync(path.join(fixtureDirectory, name)))]));
  try {
    for (const decision of ["compliant", "violation", "undetermined", "not-applicable"]) {
      await check(`synthetic transport only: ${decision} survives executor, report and JSON round-trip`, () => {
        const assessment = transportAssessment(decision);
        const registry = new ValidatorRegistry([["REQUIRED_SECTION", {
          assess: () => assessment, validate() { throw new Error("No legacy fallback"); },
        }]]);
        const executor = new AssessmentExecutionService(registry, [{ inventoryId: syntheticBinding.inventoryId, readiness: "assessment-ready", rule: syntheticRule }]);
        const input = executor.run({}, [syntheticRule]);
        const report = createAssessmentReport(input, [syntheticBinding]);
        assert.equal(report.schemaVersion, "assessment-report/v1");
        assert.deepEqual(report.scoring, { mode: "unscored", legacyContribution: "none" });
        assert.equal(report.records[0].execution.decision, decision);
        assert.deepEqual(report.records[0].execution, input[0]);
        assert.deepEqual(report.records[0].source, syntheticBinding.source);
        assert.deepEqual(roundTrip(report), report);
        assert.deepEqual(createAssessmentReport(roundTrip(input), roundTrip([syntheticBinding])), report);
      });
    }
    await check("uncertain applicability, open coverage, exclusions and all identity/evidence certainty survive", () => {
      const assessments = [
        { ...transportAssessment("undetermined"), applicability: { state: "undetermined", reason: "Synthetic applicability unresolved" } },
        ...["ambiguous", "unresolved"].map((certainty) => ({ ...transportAssessment("undetermined"),
          coverage: { population: "open", excludedSubjects: [{ subject: { kind: "paragraph", paragraphId: "excluded" }, reason: "Synthetic exclusion", evidence: proof }],
            unresolvedSubjects: [{ kind: "paragraph", paragraphId: "unresolved" }], reason: "Synthetic open coverage" },
          observations: [{ state: "undetermined", subject: { kind: "document" }, identity: { certainty, reason: "Synthetic identity uncertainty" }, evidence: { certainty: "sufficient", items: proof } }] })),
        ...[{ certainty: "missing", reason: "Synthetic missing evidence" },
          { certainty: "unsupported", boundary: "rendered-layout", reason: "Synthetic unsupported evidence" }].map((evidence) => ({
          ...transportAssessment("undetermined"), observations: [{ state: "undetermined", subject: { kind: "document" }, identity: { certainty: "not-required" }, evidence }],
        })),
        { ...transportAssessment("compliant"), observations: [{ state: "confirmed", subject: { kind: "academic-section", occurrenceId: "synthetic-section" },
          identity: { certainty: "confirmed", evidence: proof }, evidence: { certainty: "sufficient", items: proof }, finding: "compliant" }] },
      ];
      for (const assessment of assessments) {
        const entry = entryFor(assessment);
        const report = createAssessmentReport([entry], [syntheticBinding]);
        assert.deepEqual(roundTrip(report).records[0].execution, entry);
      }
    });
    await check("invalid, legacy and evidence-inconsistent decisions fail closed", () => {
      const entry = entryFor(transportAssessment("undetermined"));
      for (const decision of ["PASSED", "FAILED", "NOT_APPLICABLE", "unknown", undefined, "compliant", "violation", "not-applicable"]) {
        rejects(() => createAssessmentReport([{ ...entry, decision }], [syntheticBinding]), "invalid-assessment");
      }
      for (const reference of [{ kind: "inventory", id: syntheticRule.id }, { kind: "rule", id: "wrong.execution" }]) {
        rejects(() => createAssessmentReport([{ ...entry, assessment: { ...entry.assessment, reference } }], [syntheticBinding]), "invalid-assessment");
      }
      rejects(() => createAssessmentReport([{ ...entry, assessment: {} }], [syntheticBinding]), "invalid-assessment");
      rejects(() => createAssessmentReport([{ ...entry, assessment: { ...entry.assessment, coverage: undefined } }], [syntheticBinding]), "invalid-assessment");
    });
    await check("error and rejection codes remain execution outcomes, never academic decisions", () => {
      for (const [kind, codes] of [["error", ["missing-validator", "missing-assess", "invalid-assessment", "runtime-error"]],
        ["rejected", ["unknown-rule", "missing-readiness", "not-assessment-ready", "ambiguous-readiness", "rule-contract-mismatch"]]]) {
        for (const code of codes) {
          const entry = { kind, ruleId: syntheticRule.id, code, message: "Synthetic execution outcome" };
          const report = createAssessmentReport([entry], [syntheticBinding]);
          assert.deepEqual(roundTrip(report).records[0].execution, entry);
          assert.equal(Object.hasOwn(report.records[0].execution, "decision"), false);
          assert.equal(Object.hasOwn(report.records[0].execution, "assessment"), false);
        }
      }
    });
    await check("errors/rejections cannot carry academic finding, decision or legacy status fields", () => {
      for (const kind of ["error", "rejected"]) {
        const entry = { kind, ruleId: syntheticRule.id, code: kind === "error" ? "runtime-error" : "unknown-rule", message: "Synthetic failure" };
        for (const fields of [{ decision: "violation" }, { finding: "compliant" }, { assessment: transportAssessment("compliant") },
          { observations: [] }, { status: "FAILED" }, { passed: false }, { score: 0 }]) {
          rejects(() => createAssessmentReport([{ ...entry, ...fields }], [syntheticBinding]), "invalid-execution");
        }
        for (const fields of [{ code: "unknown-code" }, { message: " " }]) {
          rejects(() => createAssessmentReport([{ ...entry, ...fields }], [syntheticBinding]), "invalid-execution");
        }
      }
      rejects(() => createAssessmentReport([{ kind: "rejected", ruleId: syntheticRule.id, inventoryId: "wrong-inventory", code: "unknown-rule", message: "Synthetic rejection" }], [syntheticBinding]), "invalid-mapping");
      rejects(() => createAssessmentReport([{ ...entryFor(transportAssessment("compliant")), status: "PASSED" }], [syntheticBinding]), "invalid-execution");
      rejects(() => createAssessmentReport([{ kind: "unknown", ruleId: syntheticRule.id }], [syntheticBinding]), "invalid-execution");
    });
    await check("duplicate execution IDs and duplicate bindings are rejected, not deduplicated", () => {
      const entry = entryFor(transportAssessment("compliant"));
      rejects(() => createAssessmentReport([entry, entry], [syntheticBinding]), "duplicate-execution-id");
      rejects(() => createAssessmentReport([entry, { kind: "error", ruleId: entry.ruleId, code: "runtime-error", message: "Duplicate failure" }], [syntheticBinding]), "duplicate-execution-id");
      rejects(() => createAssessmentReport([entry], [syntheticBinding, syntheticBinding]), "duplicate-execution-id");
    });
    await check("missing inventory mapping fails the whole report for every execution kind", () => {
      for (const entry of [entryFor(transportAssessment("compliant")),
        { kind: "rejected", ruleId: syntheticRule.id, code: "unknown-rule", message: "Synthetic rejection" },
        { kind: "error", ruleId: syntheticRule.id, code: "runtime-error", message: "Synthetic error" }]) {
        rejects(() => createAssessmentReport([entry], []), "missing-inventory-mapping");
      }
      const entry = entryFor(transportAssessment("compliant"));
      for (const fields of [{ inventoryId: "" }, { inventoryId: undefined }, { executionId: "wrong-id" }, { contract: undefined }, { contract: {} }]) {
        rejects(() => createAssessmentReport([entry], [{ ...syntheticBinding, ...fields }]), "invalid-mapping");
      }
    });
    await check("required frozen provenance is never inferred or filled with placeholders", () => {
      const entry = { ...entryFor(transportAssessment("compliant")), ruleId: rules[0].id,
        assessment: { ...transportAssessment("compliant"), reference: { kind: "rule", id: rules[0].id } } };
      const binding = bindings[0];
      for (const field of ["title", "url", "frozenSourceSha256", "claim", "references"]) {
        rejects(() => createAssessmentReport([entry], [{ ...binding, source: { ...binding.source, [field]: undefined } }]), "invalid-provenance");
      }
      for (const fields of [{ url: "invalid-url" }, { url: "file:///source.pdf" }, { frozenSourceSha256: "not-a-hash" }, { references: [] },
        { references: [{ section: "", printedPage: 3 }] }, { references: [{ section: "1", printedPage: 0 }] },
        { references: [{ section: "1", printedPage: 3, item: -1 }] }, { kind: "unknown-source" }]) {
        rejects(() => createAssessmentReport([entry], [{ ...binding, source: { ...binding.source, ...fields } }]), "invalid-provenance");
      }
      rejects(() => createAssessmentReport([entry], [{ ...binding, source: undefined }]), "invalid-provenance");
      rejects(() => createAssessmentReport([], [{ ...syntheticBinding, source: { kind: "synthetic-transport", label: "" } }]), "invalid-provenance");
    });
    await check("report snapshots preserve provenance and proof after caller mutation", () => {
      const inputs = structuredClone({ entries: [entryFor(transportAssessment("compliant"))], bindings: [syntheticBinding] });
      const report = createAssessmentReport(inputs.entries, inputs.bindings);
      const before = roundTrip(report);
      inputs.entries[0].assessment.observations[0].evidence.items[0].actual = false;
      inputs.entries[0].decision = "violation";
      inputs.bindings[0].source.label = "changed";
      inputs.bindings[0].contract.expected.section = "changed";
      assert.deepEqual(report, before);
      assert.equal(Object.isFrozen(report.records[0].contract.expected), true);
      assert.equal(Object.isFrozen(report.records[0].execution.assessment.observations[0].evidence.items), true);
      assert.equal(Reflect.set(report.records[0].execution, "decision", "violation"), false);
    });
    await check("empty execution batch is explicitly unscored and has no legacy percentage or counters", () => {
      const report = createAssessmentReport([], []);
      assert.deepEqual(report, { schemaVersion: "assessment-report/v1", scoring: { mode: "unscored", legacyContribution: "none" }, records: [] });
    });

    for (const filename of filenames) {
      const bytes = fs.readFileSync(path.join(fixtureDirectory, filename));
      const document = await readDocx(bytes);
      const original = JSON.stringify(document);
      const entries = runSections(document, new AssessmentExecutionService(undefined, candidates), rules);
      await check(`${filename}: all eleven SDU contracts/provenance and assessment proof survive`, () => {
        const inputsBefore = JSON.stringify({ entries, bindings });
        const report = createAssessmentReport(entries, bindings);
        assert.equal(report.records.length, 11);
        assert.deepEqual(report.records.map((record) => record.execution), entries);
        assert.deepEqual(report.records.map(({ execution, ...binding }) => {
          assert.equal(execution.kind, "assessment");
          assert.notEqual(execution.decision, "not-applicable");
          return binding;
        }), bindings);
        assert.deepEqual(report.records.map((record) => record.execution.decision),
          ["compliant", "undetermined", "undetermined", "violation", "violation", "undetermined", "violation", "violation", "undetermined", "violation", "compliant"]);
        assert.deepEqual(roundTrip(report), report);
        assert.equal(JSON.stringify({ entries, bindings }), inputsBefore);
        assert.equal(Object.isFrozen(bindings[0]), false);
        assert.equal(JSON.stringify(document), original);
      });
      await check(`${filename}: real rejected and error entries remain visible alongside nine assessments`, () => {
        const defaultDenied = new AssessmentExecutionService().run(document, [rules[0]])[0];
        const registry = new ValidatorRegistry();
        const lookup = registry.getValidator.bind(registry);
        registry.getValidator = (rule) => {
          if (rule.id === rules[1].id) throw new Error("Synthetic injected execution fault");
          return lookup(rule);
        };
        const faulty = runSections(document, new AssessmentExecutionService(registry, candidates), rules);
        const input = [defaultDenied, ...faulty.slice(1)];
        const report = createAssessmentReport(input, bindings);
        assert.equal(report.records.length, 11);
        assert.deepEqual(report.records.map((record) => record.execution), input);
        assert.equal(report.records[0].execution.kind, "rejected");
        assert.equal(report.records[1].execution.kind, "error");
        assert.deepEqual(report.records.slice(2).map((record) => record.execution), entries.slice(2));
      });
      await check(`${filename}: legacy counts, score and reports remain unchanged for COMU 46/47`, () => {
        const builder = new ReportBuilder();
        const engine = new RuleEngine();
        for (const selection of [{ facultyId: "applied-sciences", departmentId: "food-technology", studyTypeId: "experimental" }, { facultyId: "engineering", departmentId: "computer-engineering" }]) {
          const resolved = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", thesisTypeId: "bachelor", ...selection }));
          assert.equal(resolved.length, selection.departmentId === "food-technology" ? 46 : 47);
          const legacy = engine.run(document, resolved);
          const before = structuredClone(builder.build(legacy));
          const legacyBefore = JSON.stringify(legacy);
          const report = createAssessmentReport(entries, bindings);
          for (const key of ["score", "passedRules", "failedRules", "evaluatedRules", "notApplicableRules", "results"]) {
            assert.equal(Object.hasOwn(report, key), false);
          }
          assert.ok(report.records.some((record) => record.execution.decision === "undetermined"));
          assert.deepEqual(builder.build(legacy), before);
          assert.equal(JSON.stringify(legacy), legacyBefore);
          assert.deepEqual(engine.run(document, resolved), legacy);
        }
      });
    }
    await check("TypeScript separates assessment reports, execution outcomes, source kinds and legacy scoring", () => {
      const filename = path.resolve("tests/audit/assessmentReportContract.typecheck.ts");
      const source = `
import type { AssessmentReport, AssessmentReportExecution, AssessmentReportSource } from "../../src/features/analysis/report/AssessmentReport";
import type { RuleResult } from "../../src/features/analysis/types/RuleResult";
import type { RuleAssessment } from "../../src/features/analysis/types/RuleAssessment";
import { ReportBuilder } from "../../src/features/analysis/report/ReportBuilder";
declare const report: AssessmentReport;
declare const legacy: RuleResult[];
declare const assessment: RuleAssessment;
declare const rejected: Extract<AssessmentReportExecution, { kind: "rejected" }>;
declare const error: Extract<AssessmentReportExecution, { kind: "error" }>;
// @ts-expect-error assessment records are not RuleResults, even in a mutable array
const results: RuleResult[] = [...report.records];
// @ts-expect-error execution entries are not RuleResults either
const executions: RuleResult[] = report.records.map(record => record.execution);
// @ts-expect-error mixed legacy and assessment records cannot enter legacy scoring
new ReportBuilder().build([...legacy, ...report.records]);
// @ts-expect-error the assessment report itself is not a legacy report
new ReportBuilder().build(report);
// @ts-expect-error rejected entries cannot carry an academic decision
const rejectedFinding: typeof rejected = { ...rejected, decision: "violation" };
// @ts-expect-error error entries cannot carry academic assessments
const errorFinding: typeof error = { ...error, assessment: {} };
// @ts-expect-error unknown decision is not one of the four assessment decisions
const invalidDecision: Extract<AssessmentReportExecution, { kind: "assessment" }> = { kind: "assessment", ruleId: "test", assessment, decision: "PASSED" };
// @ts-expect-error frozen sources cannot omit required provenance
const missingSource: AssessmentReportSource = { kind: "frozen-source", title: "missing provenance" };
// @ts-expect-error synthetic transport needs an explicit label
const unlabeledSynthetic: AssessmentReportSource = { kind: "synthetic-transport" };
// @ts-expect-error reports cannot claim a legacy percentage
const score: number = report.score;
// @ts-expect-error report scoring cannot be activated
const scored: AssessmentReport["scoring"] = { mode: "scored", legacyContribution: "none" };
void [results, executions, rejectedFinding, errorFinding, invalidDecision, missingSource, unlabeledSynthetic, score, scored];
`;
      const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, esModuleInterop: true };
      const host = ts.createCompilerHost(options);
      const original = host.getSourceFile.bind(host);
      host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => path.resolve(file) === filename
        ? ts.createSourceFile(file, source, languageVersion, true) : original(file, languageVersion, onError, shouldCreateNewSourceFile);
      const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
      assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
      }));
      assert.equal(fs.existsSync(filename), false);
    });
  } finally {
    for (const [filename, before] of fixtureHashes) assert.equal(digest(fs.readFileSync(path.join(fixtureDirectory, filename))), before);
  }
  console.log(JSON.stringify({ audit: "assessmentReportContract", result: "PASS", cases, sduPilots: 11,
    diskPackages: 2, fixtureWrites: 0, temporaryFiles: 0, syntheticNA: "transport-only; not source-based" }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
