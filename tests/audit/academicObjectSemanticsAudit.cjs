const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "tests", "audit", "data", "academicObjectSemanticsAudit.json");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "comu", "food-technology", "experimental");
const MANIFEST_PATH = path.join(FIXTURE_DIR, "manifest.json");

const allowed = {
  representation: new Set(["picture", "chart", "diagram", "group", "textbox", "vml", "ole", "equation", "table", "unknown-drawing"]),
  captionSemantic: new Set(["declared-figure", "declared-table", "none", "malformed", "ambiguous", "conflicting", "orphan", "unknown"]),
  association: new Set(["matched", "missing", "ambiguous", "conflicting", "not-attempted"]),
  currentAcademicType: new Set(["figure", "table", "none"]),
  proposedResolution: new Set(["resolved-figure", "resolved-table", "unresolved-candidate", "ambiguous", "excluded-from-object-candidacy"]),
  sourceSupport: new Set(["A1", "A2", "B", "C", "D"]),
  classification: new Set(["PROVEN_FALSE_POSITIVE", "PROVEN_FALSE_NEGATIVE", "SEMANTIC_OVERCLAIM", "REPRESENTATION_GAP", "ASSOCIATION_AMBIGUITY", "SCOPE_GAP", "SOURCE_AMBIGUITY", "ARCHITECTURAL_LIMITATION", "EXPECTED_BEHAVIOR"]),
};

function main() {
  const data = readJson(DATA_PATH);
  const fixtureManifest = readJson(MANIFEST_PATH);
  const fixtureByName = new Map(fixtureManifest.fixtures.map((entry) => [entry.file, entry]));

  assert(data.schemaVersion === 1, "Unsupported audit schemaVersion.");
  assert(data.phase === "4E-18", "Audit phase must be 4E-18.");
  assert(data.decision === "OPTION_C", "Phase decision must remain explicit.");
  assert(Array.isArray(data.records) && data.records.length > 0, "Audit records are required.");

  const seen = new Set();
  for (const record of data.records) {
    assert(!seen.has(record.fixture), `Duplicate fixture record: ${record.fixture}`);
    seen.add(record.fixture);
    const fixture = fixtureByName.get(record.fixture);
    assert(fixture, `Fixture is absent from corpus manifest: ${record.fixture}`);
    assert(fs.existsSync(path.join(FIXTURE_DIR, record.fixture)), `Fixture file is missing: ${record.fixture}`);
    assert(record.origin === fixture.origin, `Origin mismatch for ${record.fixture}`);
    assert(record.mode === fixture.mode, `Mode mismatch for ${record.fixture}`);
    assert(record.origin === "synthetic-ooxml", `${record.fixture} must not be labelled Word-native.`);
    for (const key of ["representation", "captionSemantic", "association", "currentAcademicType", "proposedResolution", "classification"]) {
      assert(allowed[key].has(record[key]), `Invalid ${key} for ${record.fixture}: ${record[key]}`);
    }
    assert(Array.isArray(record.sourceSupport) && record.sourceSupport.length > 0, `sourceSupport required for ${record.fixture}`);
    record.sourceSupport.forEach((value) => assert(allowed.sourceSupport.has(value), `Invalid source support ${value}`));
    assert(typeof record.note === "string" && record.note.trim().length > 0, `note required for ${record.fixture}`);
  }

  for (const required of ["picture", "chart", "diagram", "group", "textbox", "ole"]) {
    assert(data.records.some((record) => record.representation === required), `Missing representation coverage: ${required}`);
  }
  assert(data.records.some((record) => record.proposedResolution === "unresolved-candidate"), "Unresolved semantics must be represented.");
  assert(!data.records.some((record) => record.mode === "exploratory" && fixtureByName.get(record.fixture).expected), "Exploratory records must not carry regression expectations.");

  console.log(`Phase ${data.phase} academic-object semantics audit: ${data.records.length}/${data.records.length} records valid; decision=${data.decision}.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
