const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const files = {
  university: "src/data/universities/comu/bachelor.json",
  department: "src/data/universities/comu/faculties/applied-sciences/departments/food-technology/bachelor.json",
  experimental: "src/data/universities/comu/faculties/applied-sciences/departments/food-technology/bachelor/experimental.json",
  manifest: "docs/sources/comu/applied-sciences/food-technology/bachelor/manifest.json",
  phase16: "tests/audit/data/comuFoodTechnologyRuleGrounding.json",
  phase17: "tests/audit/data/comuFoodTechnologyPrimaryRuleGrounding.json",
};

function resolve(layers) {
  const result = new Map();
  for (const [provenance, ruleSet] of layers) {
    for (const rule of ruleSet.rules) {
      for (const override of rule.overrides ?? []) {
        assert(result.has(override.ruleId), `Unknown override: ${override.ruleId}`);
        result.delete(override.ruleId);
      }
      assert(!result.has(rule.id), `Duplicate resolved rule: ${rule.id}`);
      result.set(rule.id, { rule, provenance });
    }
  }
  return result;
}

const university = readJson(files.university);
const department = readJson(files.department);
const experimental = readJson(files.experimental);
const manifest = readJson(files.manifest);
const phase16 = readJson(files.phase16);
const audit = readJson(files.phase17);
const resolved = resolve([
  ["university", university],
  ["department", department],
  ["experimental", experimental],
]);
const allowedClassifications = new Set([
  "PRIMARY_DIRECT", "PRIMARY_DERIVED", "TEMPLATE_SUPPORTED", "SECONDARY_ONLY",
  "AMBIGUOUS", "UNSUPPORTED", "CONFLICTING",
]);
const allowedConfidence = new Set(["high", "medium", "low"]);
const allowedValueComparisons = new Set([
  "MATCH", "NORMALIZED_MATCH", "MISMATCH", "NOT_COMPARABLE", "SOURCE_AMBIGUOUS",
]);
const sourceIds = new Set(manifest.artifacts.map((artifact) => artifact.sourceId));
const recordsById = new Map();

for (const record of audit.records) {
  assert(!recordsById.has(record.ruleId), `Duplicate audit rule ID: ${record.ruleId}`);
  recordsById.set(record.ruleId, record);
  assert(allowedClassifications.has(record.classification), `${record.ruleId}: invalid classification`);
  assert(allowedConfidence.has(record.confidence), `${record.ruleId}: invalid confidence`);
  assert(allowedValueComparisons.has(record.valueComparison), `${record.ruleId}: invalid value comparison`);
  assert(sourceIds.has(record.sourceId), `${record.ruleId}: unknown sourceId`);
  assert(Number.isInteger(record.pdfPhysicalPageIndex) && record.pdfPhysicalPageIndex >= 0);
  assert.equal(record.pdfPageNumber, record.pdfPhysicalPageIndex + 1, `${record.ruleId}: page mismatch`);
  for (const field of [
    "currentExpected", "section", "evidence", "interpretation", "secondaryComparison",
    "implementationNotes",
  ]) assert(record[field], `${record.ruleId}: missing ${field}`);
}

assert.equal(recordsById.size, resolved.size, "Resolved/audit record count mismatch");
assert.deepEqual([...recordsById.keys()].sort(), [...resolved.keys()].sort(), "Missing or unknown rule IDs");
for (const [ruleId, item] of resolved) {
  assert.equal(recordsById.get(ruleId).provenance, item.provenance, `${ruleId}: provenance mismatch`);
  assert(typeof item.rule.solution === "string" && item.rule.solution.trim(), `${ruleId}: solution missing`);
}

const taxonomyDecisions = new Set(["FIGURE", "NOT_FIGURE", "CONTEXT_DEPENDENT", "UNRESOLVED"]);
for (const item of audit.objectTaxonomy) {
  assert(taxonomyDecisions.has(item.semanticDecision), `${item.object}: invalid semanticDecision`);
  assert(allowedConfidence.has(item.confidence), `${item.object}: invalid confidence`);
}

const counts = {};
for (const record of audit.records) counts[record.classification] = (counts[record.classification] ?? 0) + 1;
const valueCounts = {};
for (const record of audit.records) valueCounts[record.valueComparison] = (valueCounts[record.valueComparison] ?? 0) + 1;
const phase16ById = new Map(phase16.records.map((record) => [record.ruleId, record.classification]));
const transitions = {};
for (const record of audit.records) {
  const transition = `${phase16ById.get(record.ruleId)} -> ${record.classification}`;
  transitions[transition] = (transitions[transition] ?? 0) + 1;
}

console.log("Phase 4E-17 primary rule grounding audit: PASS");
console.log(`Resolved rules: ${resolved.size}; audit records: ${recordsById.size}`);
console.log(`Classifications: ${JSON.stringify(counts)}`);
console.log(`Value comparisons: ${JSON.stringify(valueCounts)}`);
console.log(`Transitions: ${JSON.stringify(transitions)}`);
