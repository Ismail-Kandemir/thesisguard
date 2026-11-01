const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");

const projectRoot = path.resolve(__dirname, "../..");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const validSize = (value) => Number.isSafeInteger(value) && value > 0;
const isoDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const canonical = (value) => JSON.stringify(value, (_key, item) => item !== null && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, "en"))) : item);
const fingerprintDeclaration = (value) => sha256(Buffer.from(canonical(value), "utf8"));
function freeze(value) {
  if (value !== null && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

const requiredScenarios = freeze([
  { id: "margin-25cm", fileName: "word-margin-25cm.docx", ui: "Top/bottom 2.5 cm; applied section recorded", technical: "sectPr, pgMar top/bottom, raw unit/twips, parser result" },
  { id: "margin-3cm", fileName: "word-margin-3cm.docx", ui: "Top/bottom 3 cm; applied section recorded", technical: "Independent 3 cm control; raw representation not presumed" },
  { id: "multiple-sections", fileName: "word-multiple-sections.docx", ui: "Section breaks and each section's margin settings", technical: "All paragraph/body sectPr boundaries and measurements" },
  { id: "sec19-exact", fileName: "word-sec19-exact.docx", ui: "Exact title; Heading 1/outline settings", technical: "pPr/pStyle/outlineLvl, styles.xml, existing occurrence identity" },
  { id: "table-body-distractor", fileName: "word-table-body-distractor.docx", ui: "Exact heading plus ordinary A/Değer/Etki in body/table", technical: "Current body/table distinction and independent heading provenance" },
  { id: "partial-heading", fileName: "word-partial-heading.docx", ui: "Partial component with heading settings", technical: "Raw partial text and unresolved academic identity" },
  { id: "split-heading", fileName: "word-split-heading.docx", ui: "Components in separate heading paragraphs", technical: "Adjacency, styles/outline, paragraph blocks and numbering.xml if present" },
  { id: "multiple-runs", fileName: "word-multiple-runs.docx", ui: "Formatting change inside a heading word", technical: "w:r/w:t segmentation and current paragraph reconstruction" },
  { id: "unicode-nfc-nfd", fileName: "word-unicode-nfc-nfd.docx", ui: "NFC/NFD input method and save sequence", technical: "Before/after code points and raw saved text; no alias approval" },
]);

/** Planned requests only: never fill missing applicant declarations/hash/size. */
function createMissingEvidenceRequests() {
  return requiredScenarios.map((scenario, index) => ({ evidenceId: `SDU-NATIVE-40-${String(index + 1).padStart(2, "0")}`,
    fileName: scenario.fileName, filePath: `tests/fixtures/native-pending/${scenario.fileName}`, scenarioIds: [scenario.id] }));
}

class NativeIntakeContractError extends TypeError {
  constructor(code, message) { super(message); this.name = "NativeIntakeContractError"; this.code = code; }
}

function declaredMissing(input) {
  const p = input.declaredProvenance;
  const fields = [];
  for (const key of ["fileName", "filePath"]) if (!nonEmpty(input[key])) fields.push(key);
  if (!isHash(input.sha256)) fields.push("sha256");
  if (!validSize(input.byteSize)) fields.push("byteSize");
  for (const key of ["origin", "application", "applicationVersion", "operatingSystem", "creatorId", "saveMethod", "postCreationEdits", "verificationClaim"]) {
    if (!nonEmpty(p?.[key])) fields.push(`declaredProvenance.${key}`);
  }
  if (!isoDate(p?.createdAt)) fields.push("declaredProvenance.createdAt");
  if (!["performed", "not-needed", "pending"].includes(p?.privacyCleanup?.status) || !nonEmpty(p?.privacyCleanup?.description)) fields.push("declaredProvenance.privacyCleanup");
  if (!Array.isArray(p?.wordUiSettings) || !Array.isArray(input.scenarioIds) || !input.scenarioIds.every((id) => p.wordUiSettings.some((item) =>
    item?.scenarioId === id && nonEmpty(item.settings) && nonEmpty(item.evidenceReferenceId)))) fields.push("declaredProvenance.wordUiSettings");
  return fields;
}

function knownSyntheticArtifacts() {
  const directory = path.join(projectRoot, "tests/fixtures/comu/food-technology/experimental");
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const hashes = new Set(); const paths = new Set();
  for (const record of manifest.fixtures.filter((item) => item.origin === "synthetic-ooxml")) {
    if (path.basename(record.file) !== record.file) throw new NativeIntakeContractError("invalid-synthetic-inventory", "Fixture path escapes its manifest directory.");
    const file = path.join(directory, record.file);
    paths.add(fs.realpathSync(file)); hashes.add(sha256(fs.readFileSync(file)));
  }
  return { hashes, paths };
}

/**
 * Explicit operator trust boundary: reviews are independently curated inputs,
 * NOT fields read from applicant submissions. This validates review bindings and
 * supporting artifact bytes, not the truth of a human attestation automatically.
 */
function createNativeEvidenceGate({ rootDirectory = projectRoot, provenanceReviews = [], privacyReviews = [], purpose = "native-test" } = {}) {
  if (!["native-test", "synthetic-intake-rehearsal"].includes(purpose)) throw new NativeIntakeContractError("invalid-purpose", "Unknown intake purpose.");
  const root = fs.realpathSync(rootDirectory);
  if (!fs.statSync(root).isDirectory()) throw new NativeIntakeContractError("invalid-root", "An existing intake directory is required.");
  const provenance = reviewMap(structuredClone(provenanceReviews));
  const privacy = reviewMap(structuredClone(privacyReviews));
  const synthetic = knownSyntheticArtifacts();

  function resolveFile(relativePath) {
    if (!nonEmpty(relativePath) || path.isAbsolute(relativePath)) throw new NativeIntakeContractError("invalid-path", "An explicit relative artifact path is required.");
    const candidate = path.resolve(root, relativePath);
    const inside = (value) => value.startsWith(root + path.sep);
    if (!inside(candidate)) throw new NativeIntakeContractError("invalid-path", "Artifact path leaves the intake root.");
    if (!fs.existsSync(candidate)) return null;
    const real = fs.realpathSync(candidate);
    if (!inside(real) || !fs.statSync(real).isFile()) throw new NativeIntakeContractError("invalid-path", "Artifact must resolve to a regular file inside the intake root.");
    return { real, bytes: fs.readFileSync(real) };
  }

  function supportingArtifact(reference) {
    if (!nonEmpty(reference?.id) || !isHash(reference?.sha256) || !validSize(reference?.byteSize)) return false;
    const file = resolveFile(reference.filePath);
    return file !== null && file.bytes.length === reference.byteSize && sha256(file.bytes) === reference.sha256.toLowerCase();
  }

  async function evaluateOne(input) {
    const missingFields = declaredMissing(input);
    const base = { evidenceId: input.evidenceId, purpose, submission: input, missingFields,
      observedArtifact: null, state: "MISSING", readiness: "BLOCKED", acceptedForNativeTest: false,
      provenanceVerification: "not-verified", privacyVerification: "not-reviewed", mechanismChecks: "NOT-RUN", reasons: [] };
    const output = (state, reasons, extra = {}) => freeze(structuredClone({ ...base, state, reasons, ...extra }));
    if (!Array.isArray(input.scenarioIds) || input.scenarioIds.length === 0 || new Set(input.scenarioIds).size !== input.scenarioIds.length ||
      input.scenarioIds.some((id) => !requiredScenarios.some((scenario) => scenario.id === id))) return output("REJECTED", ["invalid-scenario"]);
    let file;
    try { file = nonEmpty(input.filePath) ? resolveFile(input.filePath) : null; }
    catch (error) { return output("REJECTED", [error.code ?? "artifact-read-error"]); }
    if (file === null) return output("MISSING", ["file-unavailable"]);
    const observed = { filePath: input.filePath, sha256: sha256(file.bytes), byteSize: file.bytes.length };
    base.observedArtifact = observed;
    if (nonEmpty(input.fileName) && (path.basename(input.filePath) !== input.fileName || path.extname(input.fileName).toLowerCase() !== ".docx")) return output("REJECTED", ["file-name-mismatch"]);
    if (input.sha256 !== undefined && (!isHash(input.sha256) || observed.sha256 !== input.sha256.toLowerCase())) return output("REJECTED", ["hash-mismatch"]);
    if (input.byteSize !== undefined && (!validSize(input.byteSize) || observed.byteSize !== input.byteSize)) return output("REJECTED", ["size-mismatch"]);
    const knownSynthetic = synthetic.hashes.has(observed.sha256) || synthetic.paths.has(file.real);
    if (purpose === "native-test" && (knownSynthetic || input.declaredProvenance?.origin === "programmatic")) return output("REJECTED", ["synthetic-is-not-word-native"]);
    if (missingFields.length > 0) return output("RECEIVED_UNVERIFIED", ["missing-declaration-fields"]);
    try {
      const zip = await JSZip.loadAsync(file.bytes, { checkCRC32: true });
      if (!["[Content_Types].xml", "_rels/.rels", "word/document.xml"].every((part) => zip.file(part))) return output("REJECTED", ["invalid-docx-package"]);
    } catch { return output("REJECTED", ["invalid-docx-package"]); }

    const claim = input.declaredProvenance;
    if (purpose === "native-test" && (claim.origin !== "word-created" || claim.application !== "Microsoft Word" || claim.saveMethod !== "manual-word-save-as-docx")) return output("REJECTED", ["unsupported-creation-chain"]);
    if (purpose === "synthetic-intake-rehearsal" && claim.origin !== "programmatic") return output("REJECTED", ["rehearsal-must-be-explicitly-synthetic"]);
    const review = provenance.get(input.evidenceId);
    if (review?.status === "rejected") return output("REJECTED", ["provenance-review-rejected"]);
    if (!review || review.status !== "verified") return output("RECEIVED_UNVERIFIED", ["independent-provenance-review-missing"]);
    const declarationSha256 = fingerprintDeclaration(input);
    const binds = (item) => item.evidenceId === input.evidenceId && isHash(item.sha256) && item.sha256.toLowerCase() === observed.sha256 &&
      item.byteSize === observed.byteSize && item.declarationSha256 === declarationSha256;
    const independent = (item) => nonEmpty(item.reviewerId) && item.reviewerId !== claim.creatorId && isoDate(item.reviewedAt) &&
      Date.parse(item.reviewedAt) >= Date.parse(claim.createdAt);
    const expectedKind = purpose === "native-test" ? "word-native" : "synthetic-intake-rehearsal";
    const supports = review.supportingEvidence;
    let evidenceValid = false;
    try {
      evidenceValid = Array.isArray(supports) && supports.length >= 3 && new Set(supports.map((item) => item.id)).size === supports.length &&
        ["creation-session", "word-ui", "save-chain"].every((kind) => supports.some((item) => item.kind === kind)) && supports.every(supportingArtifact) &&
        claim.wordUiSettings.every((setting) => supports.some((item) => item.id === setting.evidenceReferenceId && item.kind === "word-ui"));
    } catch { evidenceValid = false; }
    if (!binds(review) || !independent(review) || review.evidenceKind !== expectedKind ||
      review.basis !== "independent-creation-and-save-chain-review" || !nonEmpty(review.findings) || !evidenceValid) return output("RECEIVED_UNVERIFIED", ["provenance-review-insufficient-or-stale"]);

    const rehearsal = purpose === "synthetic-intake-rehearsal";
    const verified = { provenanceVerification: rehearsal ? "rehearsal-only-not-native" : "independently-verified" };
    const pendingState = rehearsal ? "RECEIVED_UNVERIFIED" : "PROVENANCE_VERIFIED";
    const privacyReview = privacy.get(input.evidenceId);
    if (privacyReview?.status === "rejected") return output("REJECTED", ["privacy-review-rejected"], verified);
    let privacyValid = false;
    try { privacyValid = privacyReview?.status === "approved" && binds(privacyReview) && independent(privacyReview) && supportingArtifact(privacyReview.reviewReference); }
    catch { privacyValid = false; }
    if (!privacyValid || !["performed", "not-needed"].includes(claim.privacyCleanup.status)) return output(pendingState, ["privacy-review-missing-or-stale"], verified);
    // ZIP loading yields control. Do not accept a cached proof if the artifact
    // disappeared or changed while the intake was being evaluated.
    let latest;
    try { latest = resolveFile(input.filePath); }
    catch (error) { return output("REJECTED", [error.code ?? "artifact-read-error"], verified); }
    if (latest === null) return output("MISSING", ["file-became-unavailable"]);
    if (latest.bytes.length !== observed.byteSize || sha256(latest.bytes) !== observed.sha256) return output("REJECTED", ["artifact-changed-during-intake"]);
    if (!rehearsal && synthetic.paths.has(latest.real)) return output("REJECTED", ["synthetic-is-not-word-native"]);
    if (rehearsal) return output("RECEIVED_UNVERIFIED", ["synthetic-intake-rehearsal-only"], {
      ...verified, privacyVerification: "reviewed-rehearsal-only", mechanismChecks: "PASS" });
    return output("ACCEPTED_FOR_NATIVE_TEST", ["all-native-intake-checks-passed"], {
      ...verified, readiness: "READY_FOR_NATIVE_TEST", acceptedForNativeTest: true, privacyVerification: "independently-reviewed", mechanismChecks: "PASS" });
  }

  return Object.freeze({ async evaluateBatch(submissions) {
    if (!Array.isArray(submissions)) throw new NativeIntakeContractError("invalid-batch", "Explicit submission array required.");
    const inputs = structuredClone(submissions);
    const seen = new Set();
    for (const input of inputs) {
      if (!nonEmpty(input?.evidenceId)) throw new NativeIntakeContractError("missing-evidence-id", "Every submission requires an evidence ID.");
      if (seen.has(input.evidenceId)) throw new NativeIntakeContractError("duplicate-evidence-id", input.evidenceId);
      seen.add(input.evidenceId);
    }
    const records = [];
    for (const input of inputs) records.push(await evaluateOne(input));
    const states = ["MISSING", "RECEIVED_UNVERIFIED", "PROVENANCE_VERIFIED", "REJECTED", "ACCEPTED_FOR_NATIVE_TEST"];
    return freeze({ schemaVersion: "native-evidence-intake/v1", purpose, productionAuthorization: "not-granted",
      academicApproval: "not-granted", sourceGate: { status: "BLOCKED", reason: "SDU-source-not-verified" },
      readiness: records.length > 0 && records.every((record) => record.acceptedForNativeTest) ? "READY_FOR_NATIVE_TEST" : "BLOCKED",
      nativeValidationPerformed: false, records, counts: Object.fromEntries(states.map((state) => [state, records.filter((record) => record.state === state).length])) });
  } });
}

function reviewMap(records) {
  if (!Array.isArray(records)) throw new NativeIntakeContractError("invalid-review-policy", "Trusted review records must be an array.");
  const result = new Map();
  for (const record of records) {
    if (!nonEmpty(record?.evidenceId) || result.has(record.evidenceId)) throw new NativeIntakeContractError("ambiguous-review", "Trusted review IDs must be unique.");
    result.set(record.evidenceId, freeze(record));
  }
  return result;
}

module.exports = { createNativeEvidenceGate, createMissingEvidenceRequests, requiredScenarios, fingerprintDeclaration, NativeIntakeContractError };
