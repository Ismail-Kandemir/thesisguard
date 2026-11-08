const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { CdpSession, createPageSession, findBrowserExecutable, findOpenPort, startBrowser,
  stopProcess, waitForHttp, waitForBrowserWebSocket, waitForRuntimeValue } = require('./reportVisualRegressionRunner.cjs');
const { terms, mojibake } = require('../audit/turkishEncodingRegression.cjs');

async function main() {
  const executable = findBrowserExecutable(); assert.ok(executable, 'A real browser is required');
  const port = await findOpenPort(); const debugPort = await findOpenPort();
  const vite = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', windowsHide: true });
  let browser; let session; let page;
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`);
    browser = await startBrowser(executable, debugPort);
    session = await CdpSession.connect(await waitForBrowserWebSocket(debugPort));
    page = await createPageSession(session, debugPort, `http://127.0.0.1:${port}/upload`);
    await page.send('Page.enable'); await page.send('Page.navigate', { url: page.url });
    await waitForRuntimeValue(page, '!!document.querySelector("#university")');
    const evaluate = async expression => {
      const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    for (const [id, value] of [['university', 'comu'], ['organization', 'engineering'], ['academic-unit', 'computer-engineering'], ['thesis-type', 'bachelor']]) {
      await evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await waitForRuntimeValue(page, `document.getElementById(${JSON.stringify(id)}).value === ${JSON.stringify(value)}`);
    }
    const base = fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/comu/food-technology/experimental/full-correct.docx'));
    await evaluate(`(() => {
      const data = Uint8Array.from(atob(${JSON.stringify(base.toString('base64'))}), c => c.charCodeAt(0));
      window.encodingFile = new File([data], 'existing-fixture.docx', {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
      const transfer = new DataTransfer(); transfer.items.add(window.encodingFile);
      const e = document.querySelector('input[type=file]'); e.files = transfer.files; e.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    await waitForRuntimeValue(page, '!!document.querySelector(".upload-actions button:not(:disabled)")');
    await evaluate('document.querySelector(".upload-actions button").click()');
    await waitForRuntimeValue(page, '!!document.querySelector(".analysis-report__result-card h3")');
    const headings = await evaluate('Array.from(document.querySelectorAll(".analysis-report__result-card h3"), node => node.textContent)');
    assert.ok(headings.includes(terms[0]), 'Actual engineering report must render the exact corrected title');
    const actualText = await evaluate('document.querySelector(".analysis-report").textContent');
    for (const term of terms.filter(term => term !== 'Çizelgeler')) assert.ok(actualText.includes(term), term);
    assert.equal(mojibake.test(actualText), false, 'No corrupted title/message/solution in the rendered report');

    // All seven UTF-8 inputs through the real report component. This separate
    // presentation probe does not invent a Çizelgeler production rule/alias.
    await evaluate(`(async () => {
      const main = await (await fetch('/src/main.tsx')).text();
      const imports = Array.from(main.matchAll(/from\\s+["']([^"']+)["']/g), match => match[1]);
      const reactModule = await import(imports.find(value => /\\/react\\.js(?:\\?|$)/.test(value)));
      const domModule = await import(imports.find(value => /react-dom_client\\.js/.test(value)));
      const react = reactModule.default ?? reactModule; const dom = domModule.default ?? domModule;
      const { AnalysisReportView } = await import('/src/features/analysis/report/components/AnalysisReportView.tsx');
      const { analyzeDocx } = await import('/src/features/analysis/analysisService.ts');
      const { ReportBuilder } = await import('/src/features/analysis/report/ReportBuilder.ts');
      const actual = await analyzeDocx(window.encodingFile, {universityId:'comu',facultyId:'engineering',departmentId:'computer-engineering',thesisTypeId:'bachelor'});
      const report = new ReportBuilder().build(${JSON.stringify(terms)}.map((term, index) => ({...actual.results[0], ruleId:'presentation-only.'+index, ruleName:term})));
      const mount = document.createElement('section'); mount.id = 'encoding-presentation-probe'; document.body.append(mount);
      dom.createRoot(mount).render(react.createElement(AnalysisReportView, {analysisReport:report,onNewAnalysis:()=>{}}));
    })()`);
    await waitForRuntimeValue(page, 'document.querySelectorAll("#encoding-presentation-probe .analysis-report__result-card h3").length === 7');
    const rendered = await evaluate('Array.from(document.querySelectorAll("#encoding-presentation-probe .analysis-report__result-card h3"), node => node.textContent)');
    assert.deepEqual(rendered, terms);
    assert.equal(await evaluate('document.characterSet'), 'UTF-8');
    console.log(JSON.stringify({ result: 'PASS', browser: path.basename(executable), actualEngineeringTitle: headings.find(value => value === terms[0]),
      displayedTerms: rendered, documentEncoding: 'UTF-8', presentationOnly: 'Çizelgeler', fixtureWrites: 0 }));
  } finally {
    if (page) await page.close();
    if (session) { await session.send('Browser.close').catch(() => {}); await session.close(); }
    if (browser) stopProcess(browser);
    stopProcess(vite);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
