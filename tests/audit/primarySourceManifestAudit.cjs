const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const sourceRoot = path.join(
  root,
  "docs/sources/comu/applied-sciences/food-technology/bachelor",
);
const binaryRoot = process.env.THESISGUARD_SOURCE_BINARY_ROOT
  ? path.resolve(process.env.THESISGUARD_SOURCE_BINARY_ROOT)
  : sourceRoot;
const requireBinaries = process.env.THESISGUARD_REQUIRE_SOURCE_BINARIES === "1";
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));

assert.equal(manifest.schemaVersion, 1);
for (const field of [
  "collectionId", "institution", "faculty", "department", "programLevel",
  "officialPageTitle", "officialPageUrl", "officialPagePublishedAt", "retrievedAt",
]) {
  assert(manifest[field], `Missing manifest field: ${field}`);
}
assert.match(manifest.officialPageUrl, /^https:\/\/gida\.cubf\.comu\.edu\.tr\//);
assert(Array.isArray(manifest.artifacts) && manifest.artifacts.length === 4);

const ids = manifest.artifacts.map((artifact) => artifact.sourceId);
assert.equal(new Set(ids).size, ids.length, "Duplicate sourceId");
let verifiedBinaryCount = 0;
let skippedBinaryCount = 0;

for (const artifact of manifest.artifacts) {
  for (const field of [
    "sourceId", "documentType", "title", "downloadUrl", "filename", "sha256",
    "byteSize", "mimeType", "trustLevel",
  ]) {
    assert(artifact[field] !== undefined && artifact[field] !== "", `${artifact.sourceId}: missing ${field}`);
  }
  assert.match(artifact.downloadUrl, /^https:\/\/cdn\.comu\.edu\.tr\//);
  assert(["A1", "A2"].includes(artifact.trustLevel));
  assert.match(artifact.sha256, /^[0-9a-f]{64}$/);

  assert.match(artifact.filename, /^original\/[A-Za-z0-9._-]+$/, `${artifact.sourceId}: unsafe filename`);
  assert(Number.isInteger(artifact.byteSize) && artifact.byteSize > 0, `${artifact.sourceId}: invalid byteSize`);

  const absolutePath = path.join(binaryRoot, artifact.filename);
  if (!fs.existsSync(absolutePath)) {
    if (requireBinaries) {
      assert.fail(`${artifact.sourceId}: source file missing in strict mode`);
    }
    skippedBinaryCount += 1;
    console.log(`${artifact.sourceId}: binary integrity SKIPPED (local snapshot not present)`);
    continue;
  }

  const bytes = fs.readFileSync(absolutePath);
  assert.equal(bytes.length, artifact.byteSize, `${artifact.sourceId}: byteSize mismatch`);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    artifact.sha256,
    `${artifact.sourceId}: SHA-256 mismatch`,
  );

  if (artifact.mimeType === "application/pdf") {
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-", `${artifact.sourceId}: invalid PDF magic`);
  } else {
    assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK", `${artifact.sourceId}: invalid DOCX/ZIP magic`);
  }
  verifiedBinaryCount += 1;
}

console.log("Phase 4E-17 primary source manifest audit: PASS");
console.log(`Collection: ${manifest.collectionId}`);
console.log(`Metadata validation: PASS (${manifest.artifacts.length} artifacts)`);
console.log(`Binary integrity: PASS=${verifiedBinaryCount}, SKIPPED=${skippedBinaryCount}, strict=${requireBinaries}`);
for (const artifact of manifest.artifacts) {
  console.log(`${artifact.sourceId}: expected ${artifact.byteSize} bytes, sha256=${artifact.sha256}`);
}
