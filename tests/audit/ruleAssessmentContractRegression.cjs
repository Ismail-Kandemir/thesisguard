const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Reuse the read-only Node/TypeScript + discovery harness; its main is guarded.
require("../golden/experimentalGoldenRegression.cjs");

const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");

const proof = [{ kind: "document-format", property: "bounded test claim", actual: 2.5, expected: 2.5 }];
const certainIdentity = { certainty: "not-required" };
const sufficient = { certainty: "sufficient", items: proof };
const closed = { population: "closed", excludedSubjects: [] };
const open = { population: "open", excludedSubjects: [], reason: "Unknown relevant population", unresolvedSubjects: [] };
const confirmed = (finding = "compliant") => ({
  state: "confirmed", subject: { kind: "document" }, identity: certainIdentity, evidence: sufficient, finding,
});
const unknown = (evidence = { certainty: "missing", reason: "Value unavailable" }, identity = certainIdentity) => ({
  state: "undetermined", subject: { kind: "page-section", sectionIndex: 1 }, identity, evidence,
});
const assessment = (observations = [confirmed()], coverage = closed) => ({
  reference: { kind: "inventory", id: "contract-test" },
  applicability: { state: "applicable", evidence: proof }, coverage, observations,
});

let cases = 0;
function check(label, run) {
  run();
  cases += 1;
  console.log(`PASS ${label}`);
}

check("confirmed compliance; confirmed semantic identity with provenance", () => {
  assert.equal(decideRuleAssessment(assessment()), "compliant");
  assert.equal(decideRuleAssessment(assessment([
    { ...confirmed(), identity: { certainty: "confirmed", evidence: proof } },
  ])), "compliant");
});
check("confirmed violation", () => assert.equal(decideRuleAssessment(assessment([confirmed("violation")])), "violation"));
check("missing evidence is undetermined", () => assert.equal(decideRuleAssessment(assessment([unknown()])), "undetermined"));
check("unresolved and ambiguous semantic identity, despite readable evidence", () => {
  for (const certainty of ["unresolved", "ambiguous"]) {
    assert.equal(decideRuleAssessment(assessment([unknown(sufficient, { certainty, reason: "Name is not structural proof" })])), "undetermined");
  }
});
check("genuine non-applicability needs explicit proof", () => {
  assert.equal(decideRuleAssessment({
    reference: { kind: "inventory", id: "conditional-contract-test" },
    applicability: { state: "not-applicable", reason: "Source condition proven false", evidence: proof },
  }), "not-applicable");
});
check("undetermined applicability is not N/A", () => {
  assert.equal(decideRuleAssessment({
    ...assessment([unknown()]), applicability: { state: "undetermined", reason: "Condition unresolved" },
  }), "undetermined");
});
check("incomplete evaluated coverage blocks compliance", () => {
  assert.equal(decideRuleAssessment(assessment([confirmed(), unknown()])), "undetermined");
});
check("open population blocks compliance, including unidentified carriers", () => {
  assert.equal(decideRuleAssessment(assessment([confirmed()], open)), "undetermined");
  assert.equal(decideRuleAssessment(assessment([confirmed()], {
    ...open, unresolvedSubjects: [{ kind: "representation", representationId: "existing-unresolved-carrier" }],
  })), "undetermined");
});
check("rendered, physical and static unsupported evidence remain undetermined", () => {
  for (const boundary of ["rendered-layout", "physical-output", "static-docx"]) {
    assert.equal(decideRuleAssessment(assessment([unknown({ certainty: "unsupported", boundary, reason: "Beyond available static evidence" })])), "undetermined");
  }
});
check("confirmed violation survives unrelated unknown evidence and open coverage", () => {
  assert.equal(decideRuleAssessment(assessment([confirmed("violation"), unknown()], open)), "violation");
});
check("empty observations never prove compliance or N/A", () => {
  assert.equal(decideRuleAssessment(assessment([])), "undetermined");
  assert.equal(decideRuleAssessment(assessment([], open)), "undetermined");
});
check("excluded subjects need reasons and evidence; exclusions alone are not compliance", () => {
  const excludedSubjects = [{ subject: { kind: "representation", representationId: "existing-excluded" }, reason: "Proven out of claim scope", evidence: proof }];
  assert.equal(decideRuleAssessment(assessment([], { ...closed, excludedSubjects })), "undetermined");
  assert.equal(decideRuleAssessment(assessment([confirmed()], { ...closed, excludedSubjects })), "compliant");
});
check("pure decision preserves its input and produces no score or RuleResult", () => {
  const input = assessment([confirmed(), unknown()], open);
  const before = JSON.stringify(input);
  assert.equal(decideRuleAssessment(input), "undetermined");
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.hasOwn(input, "status"), false);
  assert.equal(Object.hasOwn(input, "score"), false);
});
check("invalid typed-contract combinations fail explicitly, never as academic FAIL", () => {
  const na = { reference: assessment().reference, applicability: { state: "not-applicable", reason: "Condition false", evidence: proof } };
  const invalid = [
    assessment([{ ...confirmed(), evidence: { certainty: "missing", reason: "Missing" } }]),
    assessment([{ ...confirmed(), identity: { certainty: "unresolved", reason: "Unresolved" } }]),
    assessment([{ ...confirmed(), evidence: { certainty: "sufficient", items: [] } }]),
    assessment([{ ...confirmed(), identity: { certainty: "confirmed", evidence: [] } }]),
    assessment([{ ...unknown(), finding: "violation" }]),
    assessment([unknown(sufficient)]),
    { ...assessment(), applicability: { state: "undetermined", reason: "Condition unknown" } },
    { ...assessment(), applicability: { state: "applicable", evidence: [] } },
    { ...na, observations: [] },
    { ...na, coverage: closed },
    { ...na, applicability: { ...na.applicability, evidence: [] } },
    assessment([confirmed()], { ...closed, unresolvedSubjects: [] }),
    assessment([unknown({ certainty: "unsupported", boundary: "guess", reason: "Not supported" })]),
    assessment([unknown({ certainty: "missing", reason: " " })]),
    assessment([confirmed()], { ...open, reason: "" }),
    assessment([confirmed()], { ...closed, excludedSubjects: [{ subject: { kind: "document" }, reason: "", evidence: proof }] }),
  ];
  for (const input of invalid) {
    assert.throws(() => decideRuleAssessment(input), { name: "TypeError", message: /^Invalid RuleAssessment:/ });
  }
});

const rule = {
  id: "contract-regression", type: "MARGIN_TOP", title: "Contract test", description: "Test only",
  category: "margin", expected: 2.5, severity: "error", score: 10, message: "Test", enabled: true,
};
function result(status) {
  return {
    ruleId: rule.id, ruleName: rule.title, status, passed: status === "PASSED", severity: "error",
    expected: 2.5, actual: status === "PASSED" ? 2.5 : null, message: "Legacy result",
  };
}

check("opt-in isolation: engine calls validate only, even with assess available", () => {
  let validateCalls = 0;
  let assessCalls = 0;
  const validator = {
    validate: () => { validateCalls += 1; return result("PASSED"); },
    assess: () => { assessCalls += 1; return assessment([unknown()]); },
  };
  const registry = new ValidatorRegistry([["MARGIN_TOP", validator]]);
  const engine = new RuleEngine(registry);
  const expected = [{ ...result("PASSED"), category: rule.category, solution: undefined }];
  assert.deepEqual(engine.run({}, [rule]), expected);
  assert.equal(validateCalls, 1);
  assert.equal(assessCalls, 0);
  const shadow = registry.getValidator(rule).assess({}, rule);
  assert.equal(decideRuleAssessment(shadow), "undetermined");
  assert.equal(validateCalls, 1);
  assert.equal(assessCalls, 1);
  assert.deepEqual(engine.run({}, [rule]), expected);
  assert.equal(assessCalls, 1);
});
check("validate-only validators remain valid; legacy success implies no assess capability", () => {
  const validator = { validate: () => result("PASSED") };
  const registry = new ValidatorRegistry([["MARGIN_TOP", validator]]);
  assert.equal(registry.getValidator(rule).assess, undefined);
  assert.equal(new RuleEngine(registry).run({}, [rule])[0].status, "PASSED");
  assert.equal(new RuleEngine(registry).run({}, [{ ...rule, enabled: false }]).length, 0);
});
check("existing RuleResult and scoring semantics are unchanged", () => {
  const builder = new ReportBuilder();
  const inputs = [result("PASSED"), result("FAILED"), result("NOT_APPLICABLE")];
  const before = JSON.stringify(inputs);
  const report = builder.build(inputs);
  assert.deepEqual([report.totalRules, report.evaluatedRules, report.passedRules, report.failedRules, report.notApplicableRules, report.score], [3, 2, 1, 1, 1, 50]);
  assert.equal(JSON.stringify(inputs), before);
  assert.deepEqual(report.results, inputs);
  assert.equal(builder.build([result("NOT_APPLICABLE")]).score, 0);
  assert.equal(builder.build([]).score, 0);
  assert.equal(builder.build([result("PASSED"), result("PASSED"), result("FAILED")]).score, 67);
  assert.equal(builder.build([{ ...result("PASSED"), passed: false, coverage: { status: "partial", evaluatedCount: 1, relevantCount: 2, unevaluatedCount: 1, reasons: ["unsupported-anchored-placement"] } }]).score, 100);
  decideRuleAssessment(assessment([unknown()]));
  assert.deepEqual(builder.build(inputs), report);
});
check("missing validator legacy behavior is unchanged", () => {
  const legacy = new RuleEngine(new ValidatorRegistry([])).run({}, [rule])[0];
  assert.equal(legacy.status, "FAILED");
  assert.equal(legacy.actual, null);
  assert.equal(new ReportBuilder().build([legacy]).score, 0);
});
check("actual production discovery/resolution preserves COMU 46/47 and metadata", () => {
  const selections = [
    { facultyId: "applied-sciences", departmentId: "food-technology", studyTypeId: "experimental" },
    { facultyId: "engineering", departmentId: "computer-engineering" },
  ];
  for (const selection of selections) {
    const food = selection.departmentId === "food-technology";
    const sets = new RuleSetSelector().select({ universityId: "comu", thesisTypeId: "bachelor", ...selection });
    const rules = new RuleResolver().resolve(sets);
    assert.equal(rules.length, food ? 46 : 47);
    assert.equal(new Set(rules.map((item) => item.id)).size, rules.length);
    const counts = (key) => rules.reduce((acc, item) => ({ ...acc, [item.validation[key]]: (acc[item.validation[key]] || 0) + 1 }), {});
    assert.deepEqual(counts("coverage"), food ? { COMPLETE: 45, PARTIAL: 1 } : { COMPLETE: 33, PARTIAL: 14 });
    assert.deepEqual(counts("trust"), food ? { HIGH: 45, MEDIUM: 1 } : { HIGH: 33, MEDIUM: 14 });
    const registry = new ValidatorRegistry();
    for (const item of rules) {
      const validator = registry.getValidator(item);
      assert.ok(validator, item.id);
      assert.equal(validator.assess, undefined, `Production validator not migrated: ${item.id}`);
    }
    if (food) {
      const prefix = "comu.applied-sciences.food-technology.bachelor.";
      assert.deepEqual(rules.find((item) => item.id === prefix + "page-number").validation, { coverage: "PARTIAL", trust: "MEDIUM" });
      assert.deepEqual(rules.find((item) => item.id === prefix + "page-number-sequence").validation, { coverage: "COMPLETE", trust: "HIGH" });
    }
  }
});

check("TypeScript rejects invalid combinations and RuleAssessment as a RuleResult", () => {
  // Compile in memory: no generated fixture, config or dependency.
  const filename = path.resolve("tests/audit/ruleAssessmentContract.typecheck.ts");
  const source = `
import type { RuleAssessment, ConfirmedAssessmentObservation, UndeterminedAssessmentObservation, AssessmentCoverage, AssessmentEvidence } from "../../src/features/analysis/types/RuleAssessment";
import type { RuleValidator } from "../../src/features/analysis/rules/validators/RuleValidator";
import type { RuleResult } from "../../src/features/analysis/types/RuleResult";
import { ReportBuilder } from "../../src/features/analysis/report/ReportBuilder";
import { decideRuleAssessment } from "../../src/features/analysis/rules/ruleAssessment";
declare const proof: AssessmentEvidence;
declare const assessment: RuleAssessment;
declare const confirmed: ConfirmedAssessmentObservation;
declare const undetermined: UndeterminedAssessmentObservation;
declare const result: RuleResult;
const legacy: RuleValidator = { validate: () => result };
const optIn: RuleValidator = { validate: () => result, assess: () => assessment };
const closed: AssessmentCoverage = { population: "closed", excludedSubjects: [] };
const applicable: RuleAssessment = { reference: { kind: "inventory", id: "type-test" }, applicability: { state: "applicable", evidence: proof }, coverage: closed, observations: [confirmed, undetermined] };
const na: RuleAssessment = { reference: { kind: "inventory", id: "type-test" }, applicability: { state: "not-applicable", reason: "Condition false", evidence: proof } };
const unknown: RuleAssessment = { reference: { kind: "inventory", id: "type-test" }, applicability: { state: "undetermined", reason: "Condition unknown" }, coverage: closed, observations: [undetermined] };
// @ts-expect-error missing proof cannot be sufficient evidence
const emptyProof: AssessmentEvidence = [];
// @ts-expect-error confirmed finding cannot have missing evidence
const missing: ConfirmedAssessmentObservation = { ...confirmed, evidence: { certainty: "missing", reason: "Missing" } };
// @ts-expect-error confirmed finding cannot have unresolved identity
const unresolved: ConfirmedAssessmentObservation = { ...confirmed, identity: { certainty: "unresolved", reason: "Unresolved" } };
// @ts-expect-error rendered unsupported cannot establish confirmed violation
const rendered: ConfirmedAssessmentObservation = { ...confirmed, finding: "violation", evidence: { certainty: "unsupported", boundary: "rendered-layout", reason: "Unsupported" } };
// @ts-expect-error uncertainty cannot claim a violation
const uncertainFinding: UndeterminedAssessmentObservation = { ...undetermined, finding: "violation" };
// @ts-expect-error certain identity + sufficient evidence requires an explicit finding
const unsupportedCombination: UndeterminedAssessmentObservation = { state: "undetermined", subject: { kind: "document" }, identity: { certainty: "not-required" }, evidence: { certainty: "sufficient", items: proof } };
// @ts-expect-error closed population cannot have unresolved carriers
const badCoverage: AssessmentCoverage = { population: "closed", excludedSubjects: [], unresolvedSubjects: [] };
// @ts-expect-error N/A cannot also contain evaluated observations
const badNa: RuleAssessment = { reference: na.reference, applicability: na.applicability, observations: [confirmed] };
// @ts-expect-error unresolved applicability cannot establish a finding
const badApplicability: RuleAssessment = { reference: unknown.reference, applicability: { state: "undetermined", reason: "Unknown" }, coverage: closed, observations: [confirmed] };
// @ts-expect-error assessment does not satisfy the scoring contract
const asResult: RuleResult = assessment;
// @ts-expect-error assessment cannot be sent to ReportBuilder
new ReportBuilder().build([assessment]);
// @ts-expect-error validate must still return RuleResult
const wrongValidator: RuleValidator = { validate: () => assessment };
// @ts-expect-error legacy RuleResult is not an assessment
const wrongAssessment: RuleValidator = { validate: () => result, assess: () => result };
void [legacy, optIn, applicable, na, unknown, decideRuleAssessment];
`;
  const options = {
    strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(file) === filename
      ? ts.createSourceFile(file, source, languageVersion, true)
      : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
  }));
  assert.equal(fs.existsSync(filename), false, "Type checks must remain in memory");
});

console.log(JSON.stringify({ audit: "ruleAssessmentContractRegression", result: "PASS", cases, productionRules: { food: 46, computer: 47 }, fixturesWritten: 0 }));
