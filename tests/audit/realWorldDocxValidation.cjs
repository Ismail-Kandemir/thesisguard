const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fingerprintDeclaration } = require('./sduNativeEvidenceIntake.cjs');
require('../golden/experimentalGoldenRegression.cjs');
const { analyzeDocx, createNormalizedDocumentFromDocx } = require('../../src/features/analysis/analysisService.ts');
const { AnalysisReadinessDeferredError } = require('../../src/features/analysis/engine/AnalysisReadinessGate.ts');

const root = path.resolve(__dirname, '../..');
const fixtureDirectory = 'tests/fixtures/comu/food-technology/experimental';
const manifest = JSON.parse(fs.readFileSync(path.join(root, fixtureDirectory, 'manifest.json'), 'utf8'));
const selection = { universityId: 'comu', facultyId: 'applied-sciences', departmentId: 'food-technology', thesisTypeId: 'bachelor', studyTypeId: 'experimental' };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const equal = (a, b) => fingerprintDeclaration(a) === fingerprintDeclaration(b);
const knownSyntheticHashes = new Set(manifest.fixtures.map(record => sha256(fs.readFileSync(path.join(root, fixtureDirectory, record.file)))));

function scan(directory) {
  const excluded = new Set(['.git', 'node_modules', 'dist', '.codex', '.agents', '.aws']);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : scan(file);
    return entry.isFile() && /\.docx$/i.test(entry.name) ? [file] : [];
  });
}

function containedFile(directory, relative) {
  if (!text(relative) || path.isAbsolute(relative)) throw new Error('relative-path-required');
  const base = fs.realpathSync(directory);
  const candidate = fs.realpathSync(path.resolve(base, relative));
  const remainder = path.relative(base, candidate);
  if (!remainder || remainder.startsWith('..') || path.isAbsolute(remainder) || !fs.statSync(candidate).isFile()) throw new Error('path-outside-intake');
  return candidate;
}

async function observe(bytes) {
  const input = new Uint8Array(bytes);
  Object.defineProperties(input, { name: { value: 'private-validation.docx' }, size: { value: input.byteLength }, type: { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
  const document = await createNormalizedDocumentFromDocx(input);
  const fields = { pageSections: document.pageSections.map(section => section.pageMargins),
    tableCount: document.tables.count, tocPresent: document.tableOfContents.hasField };
  try {
    const report = await analyzeDocx(input, selection);
    return { fields, analysis: 'COMPLETED', counts: { total: report.totalRules, passed: report.passedRules, failed: report.failedRules, notApplicable: report.notApplicableRules },
      rules: report.results.map(result => ({ ruleId: result.ruleId, status: result.status })) };
  } catch (error) {
    if (!(error instanceof AnalysisReadinessDeferredError)) throw error;
    return { fields, analysis: 'DEFERRED', rules: [] }; // No report/score invented.
  }
}

async function inventory() {
  const files = scan(root).sort();
  const rows = [];
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const declared = relative.startsWith(fixtureDirectory + '/') ? manifest.fixtures.find(record => record.file === path.basename(file)) : null;
    const bytes = fs.readFileSync(file);
    const actual = await observe(bytes);
    rows.push({ file: relative, sha256: sha256(bytes), byteSize: bytes.length,
      classification: declared?.origin === 'synthetic-ooxml' ? 'Programmatic/synthetic' : 'Unknown/unverified',
      application: null, applicationVersion: null, creationMethod: declared?.createdWith ?? null,
      provenanceReference: declared ? fixtureDirectory + '/manifest.json' : 'docs/audit/SPRINT_41_DOCX_MARGIN_COMPARISON.md',
      applicationVerifiedValues: null, expectedAcademicDecision: null,
      syntheticRegressionOracle: declared?.expected ?? null,
      thesisGuardValues: actual.fields, actualAcademicDecision: actual.rules.filter(rule => rule.ruleId.includes('.margin.')),
      analysis: actual.analysis, counts: actual.counts,
      comparison: 'NOT_RUN', reason: 'No reviewed Word/LibreOffice ground truth; parser observations are not ground truth' });
    if (sha256(fs.readFileSync(file)) !== sha256(bytes)) throw new Error('fixture-mutated-during-observation');
  }
  return { schemaVersion: 1, scope: 'existing-workspace-fixtures', nativeCompatibilityVerified: false,
    summary: { total: rows.length, wordNativeVerified: 0, libreOfficeGeneratedVerified: 0,
      programmatic: rows.filter(row => row.classification === 'Programmatic/synthetic').length,
      unknown: rows.filter(row => row.classification === 'Unknown/unverified').length }, records: rows };
}

/** Reviews are separately curated operator input, never read from submissions.
 * Hashes bind artifacts, not the truth of a reviewer claim or human identity.
 * An operator must inspect the actual creation/save and application evidence.
 */
function admit(directory, submission, reviews) {
  const blocked = reason => ({ accepted: false, reason, verifiedCompatibility: false });
  if (!submission || !text(submission.id)) return blocked('missing-id');
  let file;
  try { file = containedFile(directory, submission.file); } catch { return blocked('missing-or-unsafe-file'); }
  if (!/\.docx$/i.test(file)) return blocked('docx-required');
  const bytes = fs.readFileSync(file);
  const hash = sha256(bytes);
  if (submission.sha256 !== hash || submission.byteSize !== bytes.length) return blocked('artifact-mismatch');
  const source = submission.source;
  if (!source || !['word-native', 'libreoffice-generated', 'programmatic'].includes(source.origin) ||
      !['Microsoft Word', 'LibreOffice'].includes(source.application) || !text(source.version) || !text(source.creationMethod) || !text(source.creatorId)) return blocked('unverified-source');
  if ((source.origin === 'word-native' && source.application !== 'Microsoft Word') ||
      (source.origin === 'libreoffice-generated' && source.application !== 'LibreOffice')) return blocked('application-origin-conflict');
  if (source.origin !== 'programmatic' && knownSyntheticHashes.has(hash)) return blocked('known-synthetic-cannot-be-native');
  const matches = reviews.filter(review => review.id === submission.id);
  if (matches.length !== 1) return blocked('missing-or-ambiguous-independent-review');
  const review = matches[0];
  if (review.sha256 !== hash || review.declarationSha256 !== fingerprintDeclaration(submission) ||
      review.status !== 'approved' || review.privacyApproved !== true || !text(review.reviewerId) || review.reviewerId === source.creatorId ||
      !['real-application-validation', 'mechanism-rehearsal'].includes(review.purpose) ||
      !text(review.reviewedAt) || !Number.isFinite(Date.parse(review.reviewedAt))) return blocked('stale-or-incomplete-review');
  if (!Array.isArray(review.supportingEvidence) || review.supportingEvidence.length !== 3 ||
      new Set(review.supportingEvidence.map(item => item.purpose)).size !== 3) return blocked('missing-or-ambiguous-support');
  for (const purpose of ['provenance', 'ground-truth', 'privacy']) {
    const support = review.supportingEvidence.find(item => item.purpose === purpose);
    try {
      if (!support || sha256(fs.readFileSync(containedFile(directory, support.file))) !== support.sha256) return blocked('missing-or-tampered-' + purpose);
    } catch { return blocked('missing-or-tampered-' + purpose); }
  }
  const expected = submission.expected;
  if (!expected || !expected.fields || !Array.isArray(expected.rules) || expected.rules.length === 0 || Object.keys(expected.fields).length === 0 ||
      Object.keys(expected.fields).some(key => !['pageSections', 'tableCount', 'tocPresent'].includes(key)) ||
      expected.rules.some(rule => !text(rule.ruleId) || !['PASSED', 'FAILED', 'NOT_APPLICABLE'].includes(rule.status)) ||
      new Set(expected.rules.map(rule => rule.ruleId)).size !== expected.rules.length) return blocked('invalid-ground-truth-contract');
  if (expected.fields.pageSections && (!Array.isArray(expected.fields.pageSections) || expected.fields.pageSections.length === 0 ||
      expected.fields.pageSections.some(section => ['top', 'bottom', 'left', 'right'].some(side => !Number.isFinite(section[side]))))) return blocked('invalid-section-ground-truth');
  if (Object.hasOwn(expected.fields, 'tableCount') && (!Number.isSafeInteger(expected.fields.tableCount) || expected.fields.tableCount < 0)) return blocked('invalid-table-ground-truth');
  if (Object.hasOwn(expected.fields, 'tocPresent') && typeof expected.fields.tocPresent !== 'boolean') return blocked('invalid-toc-ground-truth');
  return { accepted: true, file, bytes, hash, review, compatibilityScope: source.origin === 'programmatic' ? 'controlled-application-automation-only' : source.origin };
}

async function validate(directory, submissions, reviews) {
  if (!Array.isArray(submissions) || !Array.isArray(reviews) || submissions.some(s => !s || !text(s.id)) ||
      new Set(submissions.map(s => s.id)).size !== submissions.length) throw new Error('invalid-or-duplicate-submission-id');
  ({ submissions, reviews } = structuredClone({ submissions, reviews }));
  const records = [];
  for (const submission of submissions) {
    const admission = admit(directory, submission, reviews);
    if (!admission.accepted) { records.push({ id: submission.id, ...admission }); continue; }
    let actual;
    try { actual = await observe(admission.bytes); }
    catch {
      records.push({ id: submission.id, accepted: true, analysis: 'ERROR', comparison: 'NOT_RUN',
        verifiedCompatibility: false, nativeCompatibilityVerified: false, reason: 'Document analysis failed; no compatibility conclusion' });
      continue;
    }
    const differences = [];
    for (const [field, expected] of Object.entries(submission.expected.fields)) {
      if (!equal(actual.fields[field], expected)) differences.push({ kind: 'field', field, expected, actual: actual.fields[field] });
    }
    for (const expected of submission.expected.rules) {
      const status = actual.rules.find(rule => rule.ruleId === expected.ruleId)?.status ?? null;
      if (status !== expected.status) differences.push({ kind: 'academic-decision', ...expected, actual: status });
    }
    const after = admit(directory, submission, reviews);
    if (!after.accepted || after.hash !== admission.hash) throw new Error('evidence-changed-after-admission');
    const rehearsal = admission.review.purpose === 'mechanism-rehearsal';
    const verified = !rehearsal && differences.length === 0 && actual.analysis === 'COMPLETED';
    records.push({ id: submission.id, accepted: true, sha256: admission.hash, source: submission.source,
      applicationVerifiedValues: submission.expected.fields, expectedAcademicDecision: submission.expected.rules,
      thesisGuardValues: actual.fields, actualAcademicDecision: actual.rules.filter(rule => submission.expected.rules.some(expected => expected.ruleId === rule.ruleId)),
      analysis: actual.analysis, differences, compatibilityScope: admission.compatibilityScope,
      comparison: differences.length ? 'MISMATCH' : 'MATCH', verifiedCompatibility: verified,
      nativeCompatibilityVerified: verified && admission.compatibilityScope !== 'controlled-application-automation-only' });
  }
  return { schemaVersion: 1, productionAuthorization: 'not-granted',
    realWorldValidation: 'NOT_ESTABLISHED_BY_BATCH',
    batchComparison: records.length > 0 && records.every(record => record.verifiedCompatibility && record.comparison === 'MATCH') ? 'MATCH' : 'BLOCKED', records };
}

async function main() {
  const args = process.argv.slice(2);
  const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const intake = option('--intake');
  const data = intake
    ? await validate(option('--root'), JSON.parse(fs.readFileSync(intake, 'utf8')), JSON.parse(fs.readFileSync(option('--reviews'), 'utf8')))
    : await inventory();
  if (option('--output')) fs.writeFileSync(option('--output'), JSON.stringify(data, null, 2) + '\n');
  else console.log(JSON.stringify(data));
  if (intake && (data.batchComparison !== 'MATCH' ||
      (args.includes('--require-native') && (!data.records.length || data.records.some(record => !record.nativeCompatibilityVerified))))) process.exitCode = 1;
}

module.exports = { inventory, observe, admit, validate, sha256, fingerprintDeclaration };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
