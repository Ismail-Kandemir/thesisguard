const fs = require("fs");
const path = require("path");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");

const FIXTURE_DIRECTORY = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
);
const MANIFEST_PATH = path.join(FIXTURE_DIRECTORY, "manifest.json");
const VALID_ORIGINS = new Set([
  "synthetic-ooxml",
  "word-native",
  "realistic-synthetic",
  "anonymized-real-world",
]);
const VALID_MODES = new Set(["regression", "exploratory"]);

async function main() {
  const manifest = readManifest();
  let regressionCount = 0;
  let exploratoryCount = 0;

  for (const fixture of manifest.fixtures) {
    assertFixtureMetadata(fixture);
    const fixturePath = path.join(FIXTURE_DIRECTORY, fixture.file);
    assert(fs.existsSync(fixturePath), `Fixture bulunamadı: ${fixture.file}`);

    const { report } = await runAnalysisFixture(fixturePath);

    if (fixture.mode === "exploratory") {
      exploratoryCount += 1;
      printSummary(fixture.file, report, "EXPLORATORY");
      continue;
    }

    regressionCount += 1;
    assertExpectedOutcome(fixture, report);
    printSummary(fixture.file, report, "PASS");
  }

  console.log(
    `Corpus regression passed: ${regressionCount} regression, ${exploratoryCount} exploratory fixture.`,
  );
}

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  assert(manifest.schemaVersion === 1, "Desteklenmeyen manifest schemaVersion.");
  assert(Array.isArray(manifest.fixtures), "Manifest fixtures dizisi içermelidir.");
  return manifest;
}

function assertFixtureMetadata(fixture) {
  for (const field of [
    "file",
    "tier",
    "origin",
    "mode",
    "purpose",
    "targetedFeatures",
    "createdWith",
    "verifiedWith",
    "privacyStatus",
  ]) {
    assert(fixture[field] !== undefined, `${fixture.file ?? "Bilinmeyen fixture"}: ${field} eksik.`);
  }

  assert(Number.isInteger(fixture.tier) && fixture.tier >= 0 && fixture.tier <= 4, `${fixture.file}: tier geçersiz.`);
  assert(VALID_ORIGINS.has(fixture.origin), `${fixture.file}: origin geçersiz.`);
  assert(VALID_MODES.has(fixture.mode), `${fixture.file}: mode geçersiz.`);
  assert(Array.isArray(fixture.targetedFeatures) && fixture.targetedFeatures.length > 0, `${fixture.file}: targetedFeatures boş.`);
  assert(
    fixture.mode === "exploratory" || fixture.expected !== undefined,
    `${fixture.file}: regression fixture expected sonucu içermelidir.`,
  );
}

function assertExpectedOutcome(fixture, report) {
  const expected = fixture.expected;
  const actualFailedRuleIds = getRuleIds(report.results, "FAILED");
  const actualNotApplicableRuleIds = getRuleIds(report.results, "NOT_APPLICABLE");

  assertEqual(report.totalRules, expected.total, fixture.file, "total");
  assertEqual(report.passedRules, expected.passed, fixture.file, "passed");
  assertEqual(report.failedRules, expected.failed, fixture.file, "failed");
  assertEqual(report.notApplicableRules, expected.notApplicable, fixture.file, "notApplicable");
  assertArrayEqual(actualFailedRuleIds, expected.failedRuleIds, fixture.file, "failedRuleIds");

  if (expected.notApplicableRuleIds !== undefined) {
    assertArrayEqual(
      actualNotApplicableRuleIds,
      expected.notApplicableRuleIds,
      fixture.file,
      "notApplicableRuleIds",
    );
  }
}

function getRuleIds(results, status) {
  return results
    .filter((result) => result.status === status)
    .map((result) => result.ruleId)
    .sort();
}

function assertArrayEqual(actual, expected, fixture, field) {
  assert(Array.isArray(expected), `${fixture}: expected.${field} dizi olmalıdır.`);
  const sortedExpected = [...expected].sort();
  assertEqual(JSON.stringify(actual), JSON.stringify(sortedExpected), fixture, field);
}

function assertEqual(actual, expected, fixture, field) {
  assert(actual === expected, `${fixture}: ${field}; beklenen ${expected}, bulunan ${actual}.`);
}

function printSummary(file, report, label) {
  const failed = getRuleIds(report.results, "FAILED");
  const notApplicable = getRuleIds(report.results, "NOT_APPLICABLE");
  console.log(
    `${label} ${file}: ${report.passedRules}/${report.totalRules} passed, ` +
      `${report.failedRules} failed, ${report.notApplicableRules} N/A; ` +
      `failed=[${failed.join(", ")}], N/A=[${notApplicable.join(", ")}]`,
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
