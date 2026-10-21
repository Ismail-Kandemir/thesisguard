const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require("../golden/experimentalGoldenRegression.cjs");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { sduMarginAssessmentPilot: pilot, sduAssessmentReadiness: policy, runSduMarginAssessmentPilot: runPilot } = require("./sduMarginAssessmentPilot.ts");
const [top, bottom] = pilot.candidates.map((candidate) => candidate.rule);
const clone = (value) => structuredClone(value);
const testRule = (id) => ({ ...clone(top), id });
const metadata = (rule, readiness = "assessment-ready") => ({ inventoryId: `TEST-${rule.id}`, readiness, rule });
const document = (topValue = "1417", bottomValue = "1417") => parseDocumentXml(
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/><w:sectPr><w:pgMar' +
  (topValue === null ? "" : ` w:top="${topValue}"`) +
  (bottomValue === null ? "" : ` w:bottom="${bottomValue}"`) +
  '/></w:sectPr></w:body></w:document>',
);
function instrumented(candidates = policy) {
  const registry = new ValidatorRegistry();
  const original = registry.getValidator.bind(registry);
  const lookups = [];
  registry.getValidator = (rule) => { lookups.push(rule.id); return original(rule); };
  return { executor: new AssessmentExecutionService(registry, candidates), lookups };
}
function rejected(entry, code) {
  assert.equal(entry.kind, "rejected");
  assert.equal(entry.code, code);
  for (const field of ["assessment", "decision", "status", "score"]) assert.equal(Object.hasOwn(entry, field), false);
}
let cases = 0;
function check(label, run) { run(); cases += 1; console.log(`PASS ${label}`); }

check("SDU policy explicitly records 0 production, 2 assessment-ready and 16 deferred candidates", () => {
  assert.equal(policy.length, 18);
  assert.equal(new Set(policy.map((candidate) => candidate.inventoryId)).size, 18);
  const counts = policy.reduce((result, candidate) => ({ ...result, [candidate.readiness]: (result[candidate.readiness] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { "assessment-ready": 2, deferred: 16 });
  assert.deepEqual(policy.filter((candidate) => candidate.readiness === "assessment-ready").map((candidate) => candidate.inventoryId), ["SDU-INV-LAY-05", "SDU-INV-LAY-06"]);
  assert.ok(policy.filter((candidate) => candidate.readiness === "deferred").every((candidate) => candidate.rule === undefined));
});
check("explicit allowlist executes both eligible candidates and preserves order", () => {
  const { executor, lookups } = instrumented();
  const result = executor.run(document(), [bottom, top]);
  assert.deepEqual(result.map((entry) => entry.kind), ["assessment", "assessment"]);
  assert.deepEqual(result.map((entry) => entry.ruleId), [bottom.id, top.id]);
  assert.deepEqual(lookups, [bottom.id, top.id]);
});
check("direct service calls without readiness cannot bypass the pilot gate", () => {
  const { executor, lookups } = instrumented([]);
  executor.run(document(), [top, bottom]).forEach((entry) => rejected(entry, "unknown-rule"));
  // Extra per-call metadata is not an admission option: only constructor policy is trusted.
  executor.run(document(), [top], policy).forEach((entry) => rejected(entry, "unknown-rule"));
  assert.deepEqual(lookups, []);
});
check("unknown rule IDs fail closed even when a validator and apparent readiness exist", () => {
  const { executor, lookups } = instrumented();
  const unknown = { ...testRule("pilot.unknown"), readiness: "assessment-ready" };
  rejected(executor.run(document(), [unknown])[0], "unknown-rule");
  rejected(executor.run(document(), [{ ...unknown, enabled: false }])[0], "unknown-rule");
  assert.deepEqual(lookups, []);
});
check("missing or unrecognized readiness metadata never defaults to permission", () => {
  for (const patch of [{ readiness: undefined }, { readiness: "ready" }, { inventoryId: "" }]) {
    const { executor, lookups } = instrumented([{ ...metadata(top), ...patch }]);
    rejected(executor.run(document(), [top])[0], "missing-readiness");
    assert.deepEqual(lookups, []);
  }
  const { executor } = instrumented([{ inventoryId: "TEST-MISSING-CONTRACT", readiness: "assessment-ready" }]);
  rejected(executor.run(document(), [top])[0], "unknown-rule");
});
check("deferred candidate with an execution contract is rejected before lookup", () => {
  const deferred = testRule("readiness-test.deferred");
  const { executor, lookups } = instrumented([metadata(deferred, "deferred")]);
  const result = executor.run(document(), [deferred])[0];
  rejected(result, "not-assessment-ready");
  assert.equal(result.inventoryId, `TEST-${deferred.id}`);
  assert.deepEqual(lookups, []);
});
check("all sixteen deferred SDU inventory IDs cannot masquerade as execution rule IDs", () => {
  const { executor, lookups } = instrumented();
  const requested = policy.filter((candidate) => candidate.readiness === "deferred").map((candidate) => testRule(candidate.inventoryId));
  const result = executor.run(document(), requested);
  assert.equal(result.length, 16);
  result.forEach((entry) => rejected(entry, "unknown-rule"));
  assert.deepEqual(lookups, []);
});
check("assessment-ready execution can remain undetermined without changing readiness", () => {
  const before = JSON.stringify(policy);
  const result = runPilot(document(null));
  assert.deepEqual(result.map((entry) => entry.decision), ["undetermined", "compliant"]);
  assert.equal(result[0].assessment.observations[0].evidence.certainty, "missing");
  assert.equal(JSON.stringify(policy), before);
});
check("partial rejections do not execute rejected candidates or discard eligible outcomes", () => {
  const deferred = testRule("readiness-test.deferred");
  const unknown = testRule("readiness-test.unknown");
  const { executor, lookups } = instrumented([...policy, metadata(deferred, "deferred")]);
  const entries = executor.run(document(null), [unknown, top, deferred, bottom]);
  rejected(entries[0], "unknown-rule");
  assert.equal(entries[1].decision, "undetermined");
  rejected(entries[2], "not-assessment-ready");
  assert.equal(entries[3].decision, "compliant");
  assert.deepEqual(lookups, [top.id, bottom.id]);
});
check("production-ready is neither inferred from compliance nor admitted by this assessment-only gate", () => {
  const before = JSON.stringify(policy);
  assert.deepEqual(runPilot(document()).map((entry) => entry.decision), ["compliant", "compliant"]);
  assert.equal(JSON.stringify(policy), before);
  assert.equal(policy.filter((candidate) => candidate.readiness === "production-ready").length, 0);
  const production = testRule("readiness-test.production");
  const { executor, lookups } = instrumented([metadata(production, "production-ready")]);
  rejected(executor.run(document(), [production])[0], "not-assessment-ready");
  assert.deepEqual(lookups, []);
});
check("same-ID expected, type or enabled tampering cannot bypass the admitted contract", () => {
  const { executor, lookups } = instrumented();
  for (const patch of [{ expected: { value: 3, unit: "cm" } }, { type: "MARGIN_BOTTOM" }, { enabled: false }]) {
    rejected(executor.run(document(), [{ ...top, ...patch }])[0], "rule-contract-mismatch");
  }
  assert.deepEqual(lookups, []);
  const reordered = Object.fromEntries(Object.entries(clone(top)).reverse());
  reordered.expected = { unit: "cm", value: 2.5 };
  assert.equal(executor.run(document(), [reordered])[0].decision, "compliant");
});
check("post-construction policy mutation cannot promote deferred candidates or change admitted contracts", () => {
  const deferred = testRule("readiness-test.snapshot-deferred");
  const ready = clone(top);
  const candidates = [metadata(deferred, "deferred"), metadata(ready)];
  const { executor, lookups } = instrumented(candidates);
  candidates[0].readiness = "assessment-ready";
  ready.expected.value = 3;
  const extra = testRule("readiness-test.added-later");
  candidates.push(metadata(extra));
  rejected(executor.run(document(), [deferred])[0], "not-assessment-ready");
  rejected(executor.run(document(), [ready])[0], "rule-contract-mismatch");
  rejected(executor.run(document(), [extra])[0], "unknown-rule");
  assert.deepEqual(lookups, []);
  assert.equal(executor.run(document(), [top])[0].decision, "compliant");
});
check("duplicate readiness records fail closed without blocking other admitted candidates", () => {
  const { executor, lookups } = instrumented([...policy, metadata(top)]);
  const entries = executor.run(document(), [top, bottom]);
  rejected(entries[0], "ambiguous-readiness");
  assert.equal(entries[1].decision, "compliant");
  assert.deepEqual(lookups, [bottom.id]);
});
check("gated assessment never invokes legacy validate", () => {
  const registry = new ValidatorRegistry();
  const restore = [];
  for (const rule of [top, bottom]) {
    const validator = registry.getValidator(rule);
    const original = validator.validate;
    restore.push(() => { validator.validate = original; });
    validator.validate = () => { throw new Error("Legacy validate invoked"); };
  }
  try {
    assert.deepEqual(new AssessmentExecutionService(registry, policy).run(document(), [top, bottom]).map((entry) => entry.decision), ["compliant", "compliant"]);
  } finally { restore.forEach((run) => run()); }
});
check("legacy results and scores remain unchanged and no assessment entry contains a score", () => {
  const registry = new ValidatorRegistry();
  const engine = new RuleEngine(registry);
  const builder = new ReportBuilder();
  const input = document(null);
  const rules = [top, bottom];
  const before = engine.run(input, rules);
  const report = builder.build(before);
  assert.equal(report.score, 50);
  const entries = new AssessmentExecutionService(registry, policy).run(input, [...rules, testRule("readiness-test.unknown")]);
  entries.forEach((entry) => assert.equal(Object.hasOwn(entry, "score"), false));
  assert.deepEqual(engine.run(input, rules), before);
  assert.deepEqual(builder.build(before), report);
});
check("readiness policy and execution IDs remain outside production discovery", () => {
  const sets = loadAvailableRuleSets();
  assert.equal(sets.some((set) => set.metadata.university.id === "sdu"), false);
  const ids = new Set(sets.flatMap((set) => set.rules.map((rule) => rule.id)));
  assert.ok(policy.every((candidate) => !ids.has(candidate.inventoryId) && (!candidate.rule || !ids.has(candidate.rule.id))));
});
check("TypeScript keeps readiness, assessment decisions and unbound candidates distinct", () => {
  const filename = path.resolve("tests/audit/assessmentReadinessGate.typecheck.ts");
  const source = `
import { AssessmentExecutionService } from "../../src/features/analysis/engine/AssessmentExecutionService";
import type { CandidateReadiness, AssessmentCandidateReadiness } from "../../src/features/analysis/engine/AssessmentReadinessGate";
import type { RuleAssessmentDecision } from "../../src/features/analysis/types/RuleAssessment";
import type { NormalizedDocument, RuleDefinition } from "../../src/features/analysis/types";
declare const decision: RuleAssessmentDecision;
declare const rule: RuleDefinition;
declare const document: NormalizedDocument;
// @ts-expect-error document decisions are not admission metadata
const readiness: CandidateReadiness = decision;
// @ts-expect-error missing readiness cannot form an admission record
const missing: AssessmentCandidateReadiness = { inventoryId: "TEST", rule };
// @ts-expect-error assessment-ready must bind an execution contract
const unbound: AssessmentCandidateReadiness = { inventoryId: "TEST", readiness: "assessment-ready" };
const deferred: AssessmentCandidateReadiness = { inventoryId: "TEST", readiness: "deferred" };
// @ts-expect-error per-call metadata cannot override constructor admission policy
new AssessmentExecutionService().run(document, [rule], [deferred]);
void [readiness, missing, unbound, deferred];
`;
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
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
console.log(JSON.stringify({ audit: "assessmentReadinessGateRegression", result: "PASS", cases,
  sduReadiness: { "production-ready": 0, "assessment-ready": 2, deferred: 16 }, fixturesWritten: 0 }));
