const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const JSZip = require("jszip");
const { createNativeEvidenceGate, createMissingEvidenceRequests, requiredScenarios, fingerprintDeclaration } = require("./sduNativeEvidenceIntake.cjs");
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
let cases = 0;
async function check(label, action) { await action(); cases++; console.log(`PASS ${label}`); }
const clone = (value) => structuredClone(value);

async function main() {
  const fixtures = "tests/fixtures/comu/food-technology/experimental";
  const protectedPaths = fs.readdirSync(fixtures).filter((file) => file.endsWith(".docx")).map((file) => path.join(fixtures, file));
  protectedPaths.push(path.join(fixtures, "manifest.json"), "tests/audit/sduConservativeDecisionGuard.ts",
    "tests/audit/sduConservativeDecisionGuardV2.ts", "tests/audit/sduNativeEvidenceInventoryRegression.cjs", "docs/audit/SDU_NATIVE_EVIDENCE_REQUEST.md");
  const before = new Map(protectedPaths.map((file) => [file, digest(fs.readFileSync(file))]));
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "thesisguard-intake-rehearsal-"));
  let current;
  try {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>PROGRAMMATIC INTAKE REHEARSAL ONLY; NOT WORD-NATIVE</w:t></w:r></w:p></w:body></w:document>');
    const bytes = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(path.join(temporaryRoot, "rehearsal.docx"), bytes);
    const fileHash = digest(bytes);
    const references = ["creation-session", "word-ui", "save-chain", "privacy-review"].map((kind) => {
      const content = Buffer.from(`SYNTHETIC INTAKE MECHANISM ONLY: ${kind}. No Word session or native verification occurred.`);
      const filePath = `${kind}.txt`; fs.writeFileSync(path.join(temporaryRoot, filePath), content);
      return { id: kind, kind, filePath, sha256: digest(content), byteSize: content.length };
    });
    const submission = { evidenceId: "REHEARSAL-ONLY-001", fileName: "rehearsal.docx", filePath: "rehearsal.docx",
      sha256: fileHash, byteSize: bytes.length, scenarioIds: ["margin-25cm"], declaredProvenance: {
        origin: "programmatic", application: "Programmatic test generator", applicationVersion: "rehearsal-only",
        operatingSystem: "test-harness", creatorId: "synthetic-author", createdAt: "2026-11-01T10:00:00.000Z",
        wordUiSettings: [{ scenarioId: "margin-25cm", settings: "Synthetic placeholder, not an observed Word UI setting", evidenceReferenceId: "word-ui" }],
        saveMethod: "programmatic-intake-rehearsal", postCreationEdits: "none; generated for mechanism checks only",
        privacyCleanup: { status: "not-needed", description: "No real document, person or editor session." }, verificationClaim: "declared-only",
      } };
    const reviews = (input, kind = "synthetic-intake-rehearsal") => {
      const common = { evidenceId: input.evidenceId, sha256: input.sha256, byteSize: input.byteSize,
        declarationSha256: fingerprintDeclaration(input), reviewerId: "synthetic-independent-reviewer", reviewedAt: "2026-11-01T10:01:00.000Z" };
      return { provenanceReviews: [{ ...common, status: "verified", evidenceKind: kind,
        basis: "independent-creation-and-save-chain-review", findings: "Synthetic rehearsal binding checks only; NOT native provenance verification.", supportingEvidence: references.slice(0, 3) }],
      privacyReviews: [{ ...common, status: "approved", reviewReference: references[3] }] };
    };
    const gate = (input, overrides = {}) => createNativeEvidenceGate({ rootDirectory: temporaryRoot,
      purpose: "synthetic-intake-rehearsal", ...reviews(input), ...overrides });
    const nativeClaim = clone(submission);
    nativeClaim.declaredProvenance.origin = "word-created";
    nativeClaim.declaredProvenance.application = "Microsoft Word";
    nativeClaim.declaredProvenance.saveMethod = "manual-word-save-as-docx";
    const nativeGate = () => createNativeEvidenceGate({ rootDirectory: temporaryRoot });
    const first = async (service, value) => (await service.evaluateBatch([value])).records[0];

    await check("current nine planned native submissions remain MISSING and BLOCKED", async () => {
      current = await createNativeEvidenceGate().evaluateBatch(createMissingEvidenceRequests());
      assert.equal(requiredScenarios.length, 9); assert.equal(current.counts.MISSING, 9);
      assert.equal(current.readiness, "BLOCKED"); assert.equal(current.counts.ACCEPTED_FOR_NATIVE_TEST, 0);
      current.records.forEach((record) => { assert.ok(record.missingFields.includes("sha256")); assert.equal(record.observedArtifact, null); });
    });
    await check("valid metadata and claimed verified provenance cannot accept unavailable file", async () => {
      const input = { ...nativeClaim, filePath: "missing.docx", fileName: "missing.docx" };
      const service = createNativeEvidenceGate({ rootDirectory: temporaryRoot, ...reviews(input, "word-native") });
      assert.equal((await first(service, input)).state, "MISSING");
    });
    await check("invalid hash and wrong size reject before review", async () => {
      for (const [key, value, reason] of [["sha256", "0".repeat(64), "hash-mismatch"], ["byteSize", bytes.length + 1, "size-mismatch"]]) {
        const row = await first(nativeGate(), { ...nativeClaim, [key]: value });
        assert.equal(row.state, "REJECTED"); assert.ok(row.reasons.includes(reason));
      }
    });
    await check("missing provenance remains received-unverified without filling declarations", async () => {
      const input = clone(nativeClaim); delete input.declaredProvenance;
      const row = await first(nativeGate(), input);
      assert.equal(row.state, "RECEIVED_UNVERIFIED"); assert.ok(row.missingFields.includes("declaredProvenance.application"));
      assert.equal(row.submission.declaredProvenance, undefined);
    });
    await check("metadata-only verification claims and embedded reviews never become operator trust", async () => {
      const input = clone(nativeClaim); input.declaredProvenance.verificationClaim = "claims-verified";
      input.provenanceReview = reviews(input, "word-native").provenanceReviews[0];
      const row = await first(nativeGate(), input);
      assert.equal(row.state, "RECEIVED_UNVERIFIED"); assert.equal(row.provenanceVerification, "not-verified");
    });
    await check("invalid, duplicate and malformed scenarios reject", async () => {
      for (const scenarioIds of [["unknown"], ["margin-25cm", "margin-25cm"], [], "margin-25cm"]) {
        const row = await first(nativeGate(), { ...nativeClaim, scenarioIds });
        assert.equal(row.state, "REJECTED"); assert.ok(row.reasons.includes("invalid-scenario"));
      }
    });
    await check("duplicate evidence ID rejects the batch atomically", async () => {
      await assert.rejects(() => nativeGate().evaluateBatch([nativeClaim, nativeClaim]), (error) => error.code === "duplicate-evidence-id");
      await assert.rejects(() => nativeGate().evaluateBatch([{ ...nativeClaim, evidenceId: "" }]), (error) => error.code === "missing-evidence-id");
    });
    await check("ambiguous independent review records are rejected", () => {
      const records = reviews(submission);
      assert.throws(() => gate(submission, { provenanceReviews: [...records.provenanceReviews, ...records.provenanceReviews] }), (error) => error.code === "ambiguous-review");
    });
    await check("missing privacy review blocks an otherwise complete rehearsal", async () => {
      const row = await first(gate(submission, { privacyReviews: [] }), submission);
      assert.equal(row.readiness, "BLOCKED"); assert.ok(row.reasons.includes("privacy-review-missing-or-stale"));
      assert.equal(row.acceptedForNativeTest, false);
    });
    await check("known synthetic renamed copy cannot be labeled Word-native even with fabricated review assertions", async () => {
      const original = fs.readFileSync(path.join(fixtures, "full-correct.docx"));
      fs.writeFileSync(path.join(temporaryRoot, "renamed-native.docx"), original);
      const input = { ...nativeClaim, filePath: "renamed-native.docx", fileName: "renamed-native.docx", sha256: digest(original), byteSize: original.length };
      const service = createNativeEvidenceGate({ rootDirectory: temporaryRoot, ...reviews(input, "word-native") });
      const row = await first(service, input);
      assert.equal(row.state, "REJECTED"); assert.ok(row.reasons.includes("synthetic-is-not-word-native"));
    });
    await check("all 42 existing synthetic fixtures remain ineligible for native acceptance", async () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(fixtures, "manifest.json"), "utf8"));
      const inputs = manifest.fixtures.map((record, index) => {
        const filePath = `${fixtures}/${record.file}`;
        const content = fs.readFileSync(filePath);
        return { ...clone(nativeClaim), evidenceId: `NEGATIVE-SYNTHETIC-${index}`, fileName: record.file, filePath,
          sha256: digest(content), byteSize: content.length };
      });
      const result = await createNativeEvidenceGate().evaluateBatch(inputs);
      assert.equal(result.counts.REJECTED, 42); assert.equal(result.counts.ACCEPTED_FOR_NATIVE_TEST, 0);
    });
    await check("valid controlled intake verifies mechanism only, never native provenance or native validation", async () => {
      const result = await gate(submission).evaluateBatch([submission]);
      const row = result.records[0];
      assert.equal(row.mechanismChecks, "PASS"); assert.equal(row.state, "RECEIVED_UNVERIFIED");
      assert.equal(row.provenanceVerification, "rehearsal-only-not-native");
      assert.equal(row.acceptedForNativeTest, false); assert.equal(result.counts.ACCEPTED_FOR_NATIVE_TEST, 0);
      assert.equal(result.nativeValidationPerformed, false); assert.equal(result.readiness, "BLOCKED");
      assert.equal(result.productionAuthorization, "not-granted"); assert.equal(result.academicApproval, "not-granted");
      assert.equal(result.sourceGate.status, "BLOCKED"); assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
      assert.ok(Object.isFrozen(row.submission.declaredProvenance));
    });
    await check("rehearsal attestations cannot cross into native-test acceptance", async () => {
      const service = createNativeEvidenceGate({ rootDirectory: temporaryRoot, ...reviews(nativeClaim) });
      const row = await first(service, nativeClaim);
      assert.equal(row.state, "RECEIVED_UNVERIFIED"); assert.ok(row.reasons.includes("provenance-review-insufficient-or-stale"));
      assert.equal(row.acceptedForNativeTest, false);
    });
    await check("missing/tampered supporting evidence and reviewer self-attestation do not verify provenance", async () => {
      for (const mutate of [
        (review) => { review.reviewerId = submission.declaredProvenance.creatorId; },
        (review) => { review.supportingEvidence[0].filePath = "unavailable.txt"; },
        (review) => { review.supportingEvidence[0].sha256 = "f".repeat(64); },
        (review) => { review.supportingEvidence = []; },
        (review) => { review.declarationSha256 = "a".repeat(64); },
        (review) => { review.sha256 = 123; },
        (review) => { review.reviewedAt = "2026-10-01T10:00:00.000Z"; },
      ]) {
        const metadata = clone(reviews(submission)); mutate(metadata.provenanceReviews[0]);
        const row = await first(gate(submission, metadata), submission);
        assert.equal(row.state, "RECEIVED_UNVERIFIED"); assert.equal(row.mechanismChecks, "NOT-RUN");
      }
    });
    await check("post-save metadata/bytes changes invalidate bound reviews", async () => {
      const input = clone(submission); input.declaredProvenance.postCreationEdits = "changed after review";
      const row = await first(gate(submission), input); assert.equal(row.mechanismChecks, "NOT-RUN");
      const service = gate(submission);
      fs.appendFileSync(path.join(temporaryRoot, "rehearsal.docx"), Buffer.from("changed"));
      const changed = await first(service, submission); assert.equal(changed.state, "REJECTED");
      assert.ok(changed.reasons.includes("hash-mismatch"));
      fs.writeFileSync(path.join(temporaryRoot, "rehearsal.docx"), bytes);
    });
    await check("artifact removed during async package inspection cannot receive acceptance or rehearsal PASS", async () => {
      const originalLoad = JSZip.loadAsync;
      try {
        JSZip.loadAsync = async (...args) => {
          const result = await originalLoad(...args);
          fs.unlinkSync(path.join(temporaryRoot, "rehearsal.docx"));
          return result;
        };
        const row = await first(gate(submission), submission);
        assert.equal(row.state, "MISSING"); assert.ok(row.reasons.includes("file-became-unavailable"));
        assert.equal(row.acceptedForNativeTest, false); assert.equal(row.mechanismChecks, "NOT-RUN");
      } finally {
        JSZip.loadAsync = originalLoad;
        fs.writeFileSync(path.join(temporaryRoot, "rehearsal.docx"), bytes);
      }
    });
    await check("invalid package, invalid creation chain and path traversal remain blocked", async () => {
      fs.writeFileSync(path.join(temporaryRoot, "invalid.docx"), Buffer.from("not a DOCX"));
      const invalid = { ...nativeClaim, fileName: "invalid.docx", filePath: "invalid.docx", sha256: digest(Buffer.from("not a DOCX")), byteSize: 10 };
      assert.equal((await first(nativeGate(), invalid)).state, "REJECTED");
      const wrongChain = clone(nativeClaim); wrongChain.declaredProvenance.saveMethod = "automated-conversion";
      assert.ok((await first(nativeGate(), wrongChain)).reasons.includes("unsupported-creation-chain"));
      assert.ok((await first(nativeGate(), { ...nativeClaim, filePath: "../outside.docx" })).reasons.includes("invalid-path"));
    });
    await check("rejected provenance/privacy decisions are not academic violations", async () => {
      for (const key of ["provenanceReviews", "privacyReviews"]) {
        const metadata = clone(reviews(submission)); metadata[key][0].status = "rejected";
        const row = await first(gate(submission, metadata), submission);
        assert.equal(row.state, "REJECTED"); assert.equal(Object.hasOwn(row, "decision"), false);
      }
    });
    await check("gate snapshots reviews and caller mutations cannot grant acceptance", async () => {
      const metadata = clone(reviews(submission));
      const service = gate(submission, metadata);
      metadata.provenanceReviews[0].reviewerId = submission.declaredProvenance.creatorId;
      assert.equal((await first(service, submission)).mechanismChecks, "PASS");
      assert.equal((await service.evaluateBatch([])).readiness, "BLOCKED");
    });
  } finally {
    // Verify the absolute recursive-delete target before removing this test's temp directory.
    const target = fs.realpathSync(temporaryRoot);
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(target).startsWith("thesisguard-intake-rehearsal-"));
    fs.rmSync(target, { recursive: true, force: true });
    for (const [file, original] of before) assert.equal(digest(fs.readFileSync(file)), original, file);
  }
  console.log(JSON.stringify({ audit: "sduNativeEvidenceIntake", result: "PASS", cases, currentCounts: current.counts,
    requiredScenarios: requiredScenarios.length, nativeAccepted: 0, nativeValidationPerformed: false,
    rehearsal: "mechanism-only", sourceGate: "BLOCKED", productionAuthorization: "not-granted", fixtureWrites: 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
