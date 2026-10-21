const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
require("../golden/experimentalGoldenRegression.cjs");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const rule = (id = "assessment-execution-test", patch = {}) => ({
  id, type: "MARGIN_TOP", category: "margin", expected: { value: 2.5, unit: "cm" }, title: id,
  description: "Test", severity: "error", score: 10, message: "Test", solution: "Test", enabled: true,
  version: "1.0.0", ...patch,
});
const proof = [{ kind: "document-format", property: "Test observation", actual: 2.5, expected: 2.5 }];
const observation = (finding = "compliant") => ({
  state: "confirmed", subject: { kind: "document" }, identity: { certainty: "not-required" },
  evidence: { certainty: "sufficient", items: proof }, finding,
});
const unknown = () => ({
  state: "undetermined", subject: { kind: "document" }, identity: { certainty: "not-required" },
  evidence: { certainty: "missing", reason: "Margin is unavailable" },
});
function assessment(r, decision = "compliant") {
  const reference = { kind: "rule", id: r.id };
  if (decision === "not-applicable") return {
    reference, applicability: { state: "not-applicable", reason: "Explicit condition proven false", evidence: proof },
  };
  return {
    reference, applicability: { state: "applicable", evidence: proof },
    coverage: { population: "closed", excludedSubjects: [] },
    observations: [decision === "undetermined" ? unknown() : observation(decision)],
  };
}
const noValidate = () => { throw new Error("Legacy validate must not be called"); };
const ready = (rules) => rules.map((rule) => ({ inventoryId: `TEST-${rule.id}`, readiness: "assessment-ready", rule }));
const service = (assess, rules = [rule()]) => new AssessmentExecutionService(
  new ValidatorRegistry([["MARGIN_TOP", { validate: noValidate, assess }]]), ready(rules),
);
const margins = { top: 2.5, bottom: 2.5, left: 3, right: 2.5 };
const document = () => ({ pageMargins: { ...margins }, pageSections: [{ index: 0, source: "body", pageMargins: { ...margins } }] });
let cases = 0;
function check(label, run) { run(); cases += 1; console.log(`PASS ${label}`); }

check("execution is explicit, scoped, ordered and skips disabled rules", () => {
  const calls = [];
  const selected = [rule("first"), rule("disabled", { enabled: false }), rule("last")];
  const executor = service((doc, r) => { calls.push(r.id); return assessment(r); }, selected);
  assert.deepEqual(calls, []);
  assert.deepEqual(executor.run({}, []), []);
  const before = JSON.stringify(selected);
  assert.deepEqual(executor.run({}, selected).map((entry) => entry.ruleId), ["first", "last"]);
  assert.deepEqual(calls, ["first", "last"]);
  assert.equal(JSON.stringify(selected), before);
});
check("all four decisions and original assessment evidence survive multiple-rule execution", () => {
  const decisions = ["compliant", "violation", "not-applicable", "undetermined"];
  const selected = decisions.map((decision) => rule(decision));
  const produced = selected.map((r) => assessment(r, r.id));
  const before = JSON.stringify(produced);
  const entries = service((doc, r) => produced[selected.indexOf(r)], selected).run({}, selected);
  assert.deepEqual(entries.map((entry) => entry.decision), decisions);
  entries.forEach((entry, index) => {
    assert.equal(entry.kind, "assessment");
    assert.strictEqual(entry.assessment, produced[index]);
    for (const key of ["status", "passed", "score"]) assert.equal(Object.hasOwn(entry, key), false);
  });
  assert.equal(JSON.stringify(produced), before);
});
check("missing assess is an explicit error without validate fallback", () => {
  const executor = new AssessmentExecutionService(new ValidatorRegistry([["MARGIN_TOP", { validate: noValidate }]]), ready([rule()]));
  assert.deepEqual(executor.run({}, [rule()]), [{
    kind: "error", ruleId: rule().id, code: "missing-assess", message: "The validator does not support opt-in assessment.",
  }]);
});
check("missing validators are errors, not academic failures or undetermined findings", () => {
  const executor = new AssessmentExecutionService(new ValidatorRegistry([]), ready([rule()]));
  const entry = executor.run({}, [rule()])[0];
  assert.equal(entry.kind, "error");
  assert.equal(entry.code, "missing-validator");
  assert.equal(Object.hasOwn(entry, "decision"), false);
  assert.equal(Object.hasOwn(entry, "assessment"), false);
});
check("unknown evidence and open coverage are preserved without status projection", () => {
  const r = rule();
  const input = assessment(r);
  input.coverage = { population: "open", excludedSubjects: [], unresolvedSubjects: [{ kind: "document" }], reason: "Incomplete inventory" };
  const entry = service(() => input).run({}, [r])[0];
  assert.equal(entry.decision, "undetermined");
  assert.strictEqual(entry.assessment.coverage, input.coverage);
  input.observations.push(unknown());
  assert.equal(service(() => input).run({}, [r])[0].decision, "undetermined");
  input.observations[0] = observation("violation");
  const mixed = service(() => input).run({}, [r])[0];
  assert.equal(mixed.decision, "violation");
  assert.strictEqual(mixed.assessment, input);
});
check("invalid contract results are isolated and never reported as successful assessments", () => {
  const invalid = [null, undefined, {}, {
    ...assessment(rule()), applicability: { state: "applicable", evidence: [] },
  }, {
    ...assessment(rule()), observations: [{ ...observation(), evidence: { certainty: "missing", reason: "Missing" } }],
  }];
  for (const value of invalid) {
    const selected = [rule("bad"), rule("next")];
    const entries = service((doc, r) => r.id === "bad" ? value : assessment(r), selected).run({}, selected);
    assert.equal(entries[0].kind, "error");
    assert.equal(entries[0].code, "invalid-assessment");
    assert.ok(entries[0].message.length > 0);
    assert.equal(entries[1].decision, "compliant");
  }
});
check("mismatched rule IDs and inventory references cannot masquerade as rule assessments", () => {
  for (const reference of [{ kind: "rule", id: "other-rule" }, { kind: "inventory", id: rule().id }]) {
    const entry = service(() => ({ ...assessment(rule()), reference })).run({}, [rule()])[0];
    assert.equal(entry.kind, "error");
    assert.equal(entry.code, "invalid-assessment");
  }
});
check("runtime failures do not stop remaining rules or invoke validate", () => {
  const selected = [rule("throws-error"), rule("throws-string"), rule("throws-null"), rule("next")];
  const executor = service((doc, r) => {
    if (r.id === "throws-error") throw new TypeError("Producer failed");
    if (r.id === "throws-string") throw "String failure";
    if (r.id === "throws-null") throw null;
    return assessment(r, "undetermined");
  }, selected);
  const entries = executor.run({}, selected);
  assert.deepEqual(entries.slice(0, 3).map((entry) => entry.code), Array(3).fill("runtime-error"));
  assert.match(entries[0].message, /Producer failed/);
  assert.equal(entries[1].message, "String failure");
  assert.equal(entries[3].decision, "undetermined");
});
check("registry runtime failures are also isolated per rule", () => {
  const registry = new ValidatorRegistry();
  const lookup = registry.getValidator.bind(registry);
  registry.getValidator = (r) => { if (r.id === "bad-lookup") throw new Error("Lookup failed"); return lookup(r); };
  const selected = [rule("bad-lookup"), rule("next")];
  const entries = new AssessmentExecutionService(registry, ready(selected)).run(document(), selected);
  assert.equal(entries[0].code, "runtime-error");
  assert.equal(entries[1].decision, "compliant");
});
check("real top and bottom margin assessments preserve unknowns and input state", () => {
  const doc = document();
  doc.pageSections[0].pageMargins.bottom = null;
  const selected = [rule("top"), rule("bottom", { type: "MARGIN_BOTTOM" })];
  const before = JSON.stringify({ doc, selected });
  const entries = new AssessmentExecutionService(undefined, ready(selected)).run(doc, selected);
  assert.deepEqual(entries.map((entry) => entry.decision), ["compliant", "undetermined"]);
  assert.equal(JSON.stringify({ doc, selected }), before);
  assert.equal(entries[1].assessment.observations[0].evidence.certainty, "missing");
});
check("legacy engine and production score remain unchanged before and after opt-in execution", () => {
  const registry = new ValidatorRegistry();
  const instance = registry.getValidator(rule());
  const original = instance.assess;
  let calls = 0;
  instance.assess = function (...args) { calls += 1; return original.apply(this, args); };
  const doc = document();
  doc.pageSections[0].pageMargins.top = null;
  const selected = [rule("unknown"), rule("known", { type: "MARGIN_BOTTOM" })];
  const engine = new RuleEngine(registry);
  const builder = new ReportBuilder();
  const results = engine.run(doc, selected);
  const report = builder.build(results);
  assert.equal(calls, 0);
  assert.equal(report.score, 50);
  const entries = new AssessmentExecutionService(registry, ready(selected)).run(doc, selected);
  assert.deepEqual(entries.map((entry) => entry.decision), ["undetermined", "compliant"]);
  assert.equal(calls, 1);
  assert.deepEqual(engine.run(doc, selected), results);
  assert.equal(calls, 1);
  assert.deepEqual(builder.build(results), report);
});
check("TypeScript keeps execution entries outside RuleResult and ReportBuilder contracts", () => {
  const filename = path.resolve("tests/audit/assessmentExecution.typecheck.ts");
  const source = `
import { AssessmentExecutionService } from "../../src/features/analysis/engine/AssessmentExecutionService";
import { ReportBuilder } from "../../src/features/analysis/report/ReportBuilder";
import type { NormalizedDocument, RuleDefinition, RuleResult } from "../../src/features/analysis/types";
declare const document: NormalizedDocument;
declare const rules: readonly RuleDefinition[];
const entries = new AssessmentExecutionService().run(document, rules);
// @ts-expect-error explicit rules are required
new AssessmentExecutionService().run(document);
// @ts-expect-error execution entries are not scoring inputs
new ReportBuilder().build(entries);
// @ts-expect-error copying the array does not turn entries into RuleResults
new ReportBuilder().build([...entries]);
// @ts-expect-error no implicit legacy projection
const results: readonly RuleResult[] = entries;
for (const entry of entries) {
  if (entry.kind === "assessment") { void entry.assessment; void entry.decision; }
  else {
    void entry.code; void entry.message;
    // @ts-expect-error execution errors have no academic decision
    void entry.decision;
  }
}
void results;
`;
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
  const host = ts.createCompilerHost(options);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => path.resolve(file) === filename
    ? ts.createSourceFile(file, source, languageVersion, true) : read(file, languageVersion, onError, shouldCreateNewSourceFile);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
  }));
  assert.equal(fs.existsSync(filename), false);
});
console.log(JSON.stringify({ audit: "assessmentExecutionRegression", result: "PASS", cases, fixturesWritten: 0 }));
