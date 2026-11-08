const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inventory, observe, admit, validate, sha256, fingerprintDeclaration, sourceIdentity } = require('./realWorldDocxValidation.cjs');

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'thesisguard-s49-intake-'));
  const original = fs.readFileSync(path.join(__dirname, '../fixtures/comu/food-technology/experimental/full-correct.docx'));
  let checks = 0;
  const check = (label, action) => { action(); checks++; console.log('PASS ' + label); };
  try {
    fs.writeFileSync(path.join(temporary, 'sample.docx'), original);
    fs.writeFileSync(path.join(temporary, 'support.txt'), 'MECHANISM REHEARSAL ONLY. Not a Word/LibreOffice session.');
    const submission = { id: 'rehearsal', file: 'sample.docx', sha256: sha256(original), byteSize: original.length,
      source: { origin: 'programmatic', application: 'Microsoft Word Desktop', version: 'REHEARSAL-NOT-REAL', creatorId: 'test-generator', creationMethod: 'mechanism rehearsal; no editor execution' },
      expected: { fields: { pageSections: [{ top: 3, bottom: 2.5, left: 3, right: 2.5 }, { top: 3, bottom: 2.5, left: 3, right: 2.5 }] },
        rules: [{ ruleId: 'comu.bachelor.margin.left', status: 'PASSED' }] } };
    const review = item => ({ id: item.id, sha256: item.sha256, declarationSha256: fingerprintDeclaration(item),
      status: 'approved', privacyApproved: true, reviewerId: 'test-reviewer', reviewedAt: '2026-11-08T10:00:00.000Z', purpose: 'mechanism-rehearsal',
      supportingEvidence: ['provenance', 'ground-truth', 'privacy'].map(purpose => ({ purpose, file: 'support.txt', sha256: sha256(fs.readFileSync(path.join(temporary, 'support.txt'))) })) });
    check('no review / embedded self-approval cannot authorize', () => {
      assert.equal(admit(temporary, { ...submission, review: review(submission) }, []).accepted, false);
    });
    check('Desktop, Online, LibreOffice, programmatic and unknown remain distinct', () => {
      const desktop = sourceIdentity({ origin: 'word-native', application: 'Microsoft Word Desktop' });
      const online = sourceIdentity({ origin: 'word-online', application: 'Microsoft Word Online' });
      assert.equal(desktop.scope, 'word-desktop-native'); assert.equal(desktop.nativeEligible, true);
      assert.equal(online.scope, 'word-online'); assert.equal(online.nativeEligible, false);
      assert.equal(sourceIdentity({ origin: 'libreoffice-generated', application: 'LibreOffice' }).category, 'LibreOffice');
      assert.equal(sourceIdentity(submission.source).category, 'Programmatic DOCX');
      assert.equal(sourceIdentity({ origin: 'programmatic', application: 'python-docx' }).category, 'Programmatic DOCX');
      assert.equal(sourceIdentity({ origin: 'programmatic', application: 'python-docx' }).scope, 'unverified');
      assert.equal(sourceIdentity({ origin: 'programmatic', application: 'Microsoft Word Online' }).nativeEligible, false);
      assert.equal(sourceIdentity({ origin: 'unknown', application: 'Microsoft Word Desktop' }).scope, 'unverified');
      assert.equal(sourceIdentity({ origin: 'word-native', application: 'Microsoft Word Online' }).scope, 'unverified');
      assert.equal(sourceIdentity({ origin: 'word-online', application: 'Microsoft Word Desktop' }).scope, 'unverified');
      assert.equal(sourceIdentity({ origin: 'word-native', application: 'Microsoft Word' }).scope, 'unverified');
    });
    const variants = [
      ['unknown source', item => { item.source.origin = 'unknown'; }],
      ['ambiguous Word application cannot imply Desktop', item => { item.source.application = 'Microsoft Word'; }],
      ['Online cannot claim Desktop-native', item => { item.source.origin = 'word-native'; item.source.application = 'Microsoft Word Online'; }],
      ['Desktop cannot claim Online', item => { item.source.origin = 'word-online'; }],
      ['missing version', item => { item.source.version = ''; }],
      ['hash mismatch', item => { item.sha256 = '0'.repeat(64); }],
      ['path traversal', item => { item.file = '../outside.docx'; }],
      ['absolute path', item => { item.file = path.join(temporary, 'sample.docx'); }],
      ['synthetic native laundering', item => { item.source.origin = 'word-native'; }],
      ['synthetic LibreOffice laundering', item => { item.source.origin = 'libreoffice-generated'; item.source.application = 'LibreOffice'; }],
      ['missing ground truth', item => { item.expected.fields = {}; }],
      ['unsupported observed field', item => { item.expected.fields.renderedFooterPosition = 2.5; }],
      ['missing section value', item => { delete item.expected.fields.pageSections[0].top; }],
      ['duplicate academic rule', item => { item.expected.rules.push(item.expected.rules[0]); }],
      ['invalid table count', item => { item.expected.fields.tableCount = 'one'; }],
      ['invalid TOC value', item => { item.expected.fields.tocPresent = 'yes'; }],
    ];
    for (const [label, mutate] of variants) {
      const item = structuredClone(submission); mutate(item);
      check(label, () => assert.equal(admit(temporary, item, [review(item)]).accepted, false));
    }
    for (const [label, mutate] of [
      ['stale declaration', item => { item.declarationSha256 = '0'.repeat(64); }],
      ['self review', item => { item.reviewerId = submission.source.creatorId; }],
      ['missing privacy', item => { item.privacyApproved = false; }],
      ['missing support', item => { item.supportingEvidence = []; }],
      ['tampered support hash', item => { item.supportingEvidence[0].sha256 = '0'.repeat(64); }],
      ['missing review purpose', item => { delete item.purpose; }],
      ['ambiguous support purpose', item => { item.supportingEvidence[1].purpose = 'provenance'; }],
    ]) {
      const item = review(submission); mutate(item);
      check(label, () => assert.equal(admit(temporary, submission, [item]).accepted, false));
    }
    check('ambiguous independent review', () => assert.equal(admit(temporary, submission, [review(submission), review(submission)]).accepted, false));
    const result = await validate(temporary, [submission], [review(submission)]);
    check('controlled mechanism positive never establishes real compatibility', () => {
      assert.equal(result.records[0].comparison, 'MATCH');
      assert.equal(result.records[0].verifiedCompatibility, false);
      assert.equal(result.realWorldValidation, 'NOT_ESTABLISHED_BY_BATCH');
      assert.equal(result.batchComparison, 'BLOCKED');
      assert.equal(result.productionAuthorization, 'not-granted');
    });
    const incorrect = structuredClone(submission); incorrect.expected.fields.pageSections[0].top = 2.5;
    incorrect.expected.rules[0].status = 'FAILED';
    const mismatch = await validate(temporary, [incorrect], [review(incorrect)]);
    check('mismatched field and academic oracle remain visible', () => {
      assert.equal(mismatch.records[0].comparison, 'MISMATCH');
      assert.equal(mismatch.records[0].differences.length, 2);
      assert.equal(mismatch.records[0].verifiedCompatibility, false);
    });
    await assert.rejects(validate(temporary, [submission, submission], []), /duplicate/); checks++;
    assert.equal((await validate(temporary, [], [])).batchComparison, 'BLOCKED'); checks++;
    const invalidBytes = Buffer.from('not a DOCX package');
    fs.writeFileSync(path.join(temporary, 'invalid.docx'), invalidBytes);
    const invalid = { ...structuredClone(submission), file: 'invalid.docx', sha256: sha256(invalidBytes), byteSize: invalidBytes.length };
    const invalidResult = await validate(temporary, [invalid], [review(invalid)]);
    check('invalid DOCX produces no compatibility success', () => {
      assert.equal(invalidResult.records[0].analysis, 'ERROR');
      assert.equal(invalidResult.records[0].verifiedCompatibility, false);
      assert.equal(invalidResult.batchComparison, 'BLOCKED');
    });
    const observed = await observe(original);
    check('parser observations alone are not application ground truth', () => assert.equal(Object.hasOwn(observed, 'verifiedCompatibility'), false));
    const census = await inventory();
    check('existing census cannot silently promote native compatibility', () => {
      assert.deepEqual(census.summary, { total: 44, wordNativeVerified: 0, libreOfficeGeneratedVerified: 0, programmatic: 42, unknown: 2 });
      assert.ok(census.records.every(record => record.comparison === 'NOT_RUN' && record.applicationVerifiedValues === null && record.expectedAcademicDecision === null));
      assert.deepEqual(census, JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/audit/SPRINT_49_DOCX_INVENTORY.json'), 'utf8')));
    });
    console.log(JSON.stringify({ audit: 'Sprint 49', mechanismRegression: 'PASS', checks, existingFixtures: 44, nativeValidation: 'BLOCKED', fixtureWrites: 0 }));
  } finally {
    const resolved = fs.realpathSync(temporary);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('thesisguard-s49-intake-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
