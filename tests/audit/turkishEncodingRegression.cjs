const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../golden/experimentalGoldenRegression.cjs');
const { loadAvailableRuleSets } = require('../../src/features/analysis/rules/RuleLoader.ts');
const { analyzeDocx } = require('../../src/features/analysis/analysisService.ts');
const { ReportBuilder } = require('../../src/features/analysis/report/ReportBuilder.ts');

const terms = ['Doğrudan Alıntı Sayfa Lokatörü', 'İçindekiler', 'Özet', 'Teşekkür', 'Şekiller', 'Çizelgeler', 'Kaynakça'];
// UTF-8 bytes decoded as Windows-1252/Latin-1, or a replacement character.
const mojibake = /[\u00c3\u00c4\u00c5][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2026\u2030\u2039\u203a\u20ac\u2122]|\ufffd/u;
const engineering = { universityId: 'comu', facultyId: 'engineering', departmentId: 'computer-engineering', thesisTypeId: 'bachelor' };

function runtimeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? runtimeFiles(file) : /\.(ts|tsx|json|css)$/u.test(entry.name) ? [file] : [];
  });
}

async function main() {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/data/universities/comu/faculties/engineering/departments/computer-engineering/bachelor.json'), 'utf8'));
  const quotation = source.rules.find(rule => rule.type === 'DIRECT_QUOTATION_PAGE_LOCATOR');
  assert.equal(quotation.title, terms[0], 'The source JSON must contain the exact Turkish title');
  const samples = ['DoÄŸrudan AlÄ±ntÄ± Sayfa LokatÃ¶rÃ¼', 'Ä°Ã§indekiler', 'Ã–zet', 'TeÅŸekkÃ¼r', 'Åžekiller', 'Ã‡izelgeler', 'KaynakÃ§a', '\ufffd'];
  for (const sample of samples) assert.ok(mojibake.test(sample), sample);
  for (const term of terms) assert.equal(mojibake.test(term), false, term);
  const files = runtimeFiles(path.join(__dirname, '../../src'));
  for (const file of files) {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
    assert.equal(mojibake.test(value), false, file);
  }
  const sets = loadAvailableRuleSets();
  const loaded = sets.flatMap(set => set.rules);
  assert.equal(loaded.find(rule => rule.id === quotation.id).title, terms[0]);
  for (const term of terms.filter(term => term !== 'Çizelgeler')) {
    assert.ok(loaded.some(rule => JSON.stringify(rule).includes(term)), term);
  }
  const bytes = new Uint8Array(fs.readFileSync(path.join(__dirname, '../fixtures/comu/food-technology/experimental/full-correct.docx')));
  Object.defineProperties(bytes, { name: { value: 'existing-fixture.docx' }, size: { value: bytes.byteLength }, type: { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
  const report = await analyzeDocx(bytes, engineering);
  assert.equal(report.results.find(result => result.ruleId === quotation.id).ruleName, terms[0]);
  assert.equal(mojibake.test(JSON.stringify(report)), false, 'Engine/report must preserve readable messages and evidence');
  // Çizelgeler is a presentation-only probe, not a new production section alias.
  const probe = new ReportBuilder().build(terms.map((term, index) => ({ ...report.results[0], ruleId: `presentation-only.${index}`, ruleName: term })));
  assert.deepEqual(probe.results.map(result => result.ruleName), terms);
  console.log(JSON.stringify({ audit: 'Sprint 50 encoding', result: 'PASS', sourceFiles: files.length,
    sourceAndLoadedRule: 'PASS', productionReport: 'PASS', terms: terms.length, mojibakeControls: samples.length,
    presentationOnlyProbe: 'Çizelgeler', fixtureWrites: 0 }));
}

module.exports = { terms, mojibake, engineering };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
