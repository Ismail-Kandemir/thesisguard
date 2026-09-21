const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const paths = {
  university: "src/data/universities/comu/bachelor.json",
  common: "src/data/universities/comu/faculties/applied-sciences/departments/food-technology/bachelor.json",
  experimental:
    "src/data/universities/comu/faculties/applied-sciences/departments/food-technology/bachelor/experimental.json",
  sourceResearch:
    "src/data/universities/comu/faculties/applied-sciences/departments/food-technology/bachelor/source-research.json",
  audit: "tests/audit/data/comuFoodTechnologyRuleGrounding.json",
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function resolveWithProvenance(layers) {
  const resolved = new Map();

  for (const layer of layers) {
    for (const rule of layer.rules) {
      for (const override of rule.overrides ?? []) {
        assert(resolved.has(override.ruleId), `Unknown override: ${override.ruleId}`);
        resolved.delete(override.ruleId);
      }
      assert(!resolved.has(rule.id), `Duplicate resolved rule ID: ${rule.id}`);
      resolved.set(rule.id, { rule, provenance: layer.name });
    }
  }

  return [...resolved.values()];
}

const university = readJson(paths.university);
const common = readJson(paths.common);
const experimental = readJson(paths.experimental);
const sourceResearch = readJson(paths.sourceResearch);
const audit = readJson(paths.audit);
const commonResolved = resolveWithProvenance([
  { name: "university", rules: university.rules },
  { name: "department", rules: common.rules },
]);
const resolved = resolveWithProvenance([
  { name: "university", rules: university.rules },
  { name: "department", rules: common.rules },
  { name: "experimental", rules: experimental.rules },
]);
const sourceResearchResolved = resolveWithProvenance([
  { name: "university", rules: university.rules },
  { name: "department", rules: common.rules },
  { name: "source-research", rules: sourceResearch.rules },
]);

const allowedClassifications = new Set([
  "DIRECT",
  "DERIVED",
  "ASSUMED",
  "UNSUPPORTED",
  "AMBIGUOUS",
]);
const allowedConfidence = new Set(["high", "medium", "low"]);
const auditIds = audit.records.map((record) => record.ruleId);
const resolvedIds = resolved.map(({ rule }) => rule.id);

assert.equal(new Set(auditIds).size, auditIds.length, "Duplicate audit rule ID");
assert.deepEqual(
  [...auditIds].sort(),
  [...resolvedIds].sort(),
  "Audit records must exactly match resolved Experimental rule IDs",
);

for (const record of audit.records) {
  assert(allowedClassifications.has(record.classification), `Invalid classification: ${record.ruleId}`);
  assert(allowedConfidence.has(record.confidence), `Invalid confidence: ${record.ruleId}`);
  assert(record.sourceFile, `Missing sourceFile: ${record.ruleId}`);
  assert(record.sourceSection, `Missing sourceSection: ${record.ruleId}`);
  assert(record.evidence, `Missing evidence: ${record.ruleId}`);
}

const objectIds = audit.objectSemantics.map((record) => record.id);
const requiredObjectIds = [
  "normal-picture", "photograph", "screenshot", "chart", "graph", "smartart", "diagram",
  "schema", "map", "grouped-drawing", "vml-image", "ole-object", "equation", "table", "cizelge",
];
assert.equal(new Set(objectIds).size, objectIds.length, "Duplicate object semantic ID");
assert.deepEqual([...objectIds].sort(), [...requiredObjectIds].sort(), "Object semantics audit is incomplete");

const byClassification = Object.fromEntries([...allowedClassifications].map((key) => [key, 0]));
const bySeverity = {};
const byCategory = {};
const recordsById = new Map(audit.records.map((record) => [record.ruleId, record]));

for (const { rule } of resolved) {
  const classification = recordsById.get(rule.id).classification;
  byClassification[classification] += 1;
  bySeverity[rule.severity] ??= Object.fromEntries([...allowedClassifications].map((key) => [key, 0]));
  bySeverity[rule.severity][classification] += 1;
  byCategory[rule.category] ??= Object.fromEntries([...allowedClassifications].map((key) => [key, 0]));
  byCategory[rule.category][classification] += 1;
}

const provenance = resolved.reduce((summary, item) => {
  summary[item.provenance] = (summary[item.provenance] ?? 0) + 1;
  return summary;
}, {});
const sourceMetadataCount = resolved.filter(({ rule }) =>
  ["source", "sourceQuote", "sourceSection", "sourceConfidence", "guideId"].some((key) => key in rule),
).length;
const solutionCount = resolved.filter(({ rule }) =>
  typeof rule.solution === "string" && rule.solution.trim().length > 0,
).length;
assert.equal(solutionCount, resolved.length, "Every resolved rule must have a solution");

console.log("Phase 4E-16 rule source grounding audit: PASS");
console.log(`Resolved Experimental rules: ${resolved.length}`);
console.log(`Resolved common rules: ${commonResolved.length}`);
console.log(`Resolved Source Research rules: ${sourceResearchResolved.length}`);
console.log(`Audit records: ${audit.records.length}; object records: ${audit.objectSemantics.length}`);
console.log(`Classification: ${JSON.stringify(byClassification)}`);
console.log(`Severity: ${JSON.stringify(bySeverity)}`);
console.log(`Category: ${JSON.stringify(byCategory)}`);
console.log(`Provenance: ${JSON.stringify(provenance)}`);
console.log(`Rules with solution: ${solutionCount}/${resolved.length}`);
console.log(`Rules with production source metadata: ${sourceMetadataCount}/${resolved.length}`);
console.log(`Guide title present: ${Boolean(common.metadata?.guide?.title)}`);
console.log("Guide version/date/URL are not represented by the current GuideMetadata type.");
