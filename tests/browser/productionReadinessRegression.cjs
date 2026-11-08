const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const JSZip = require("jszip");
const { CdpSession, createPageSession, findBrowserExecutable, findOpenPort,
  startBrowser, stopProcess, waitForHttp, waitForBrowserWebSocket,
  waitForRuntimeValue } = require("./reportVisualRegressionRunner.cjs");

async function main() {
  const executable = findBrowserExecutable(); assert.ok(executable, "A real browser is required");
  const port = await findOpenPort(); const debugPort = await findOpenPort();
  const vite = spawn(process.execPath, [path.join(process.cwd(), "node_modules/vite/bin/vite.js"),
    "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore", windowsHide: true });
  let browser; let session; let page;
  const base = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/comu/food-technology/experimental/full-correct.docx"));
  const pgMar = '<w:pgMar w:top="1701" w:bottom="1417" w:left="1701" w:right="1417"/>';
  const section = `<w:sectPr>${pgMar}</w:sectPr>`;
  const math = '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>x=1</m:t></m:r></m:oMath>';
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`);
    browser = await startBrowser(executable, debugPort);
    session = await CdpSession.connect(await waitForBrowserWebSocket(debugPort));
    page = await createPageSession(session, debugPort, `http://127.0.0.1:${port}/upload`);
    await page.send("Page.enable"); await page.send("Page.navigate", { url: page.url });
    await waitForRuntimeValue(page, '!!document.querySelector("#university")');
    async function evaluate(expression) {
      const result = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    for (const [id, value] of [["university", "comu"], ["organization", "applied-sciences"], ["academic-unit", "food-technology"], ["thesis-type", "bachelor"], ["study-type", "experimental"]]) {
      await evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e) throw new Error(${JSON.stringify(id)}); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await waitForRuntimeValue(page, `document.getElementById(${JSON.stringify(id)}).value === ${JSON.stringify(value)}`);
    }
    const rows = [];
    await evaluate(`(async () => {
      const { RuleEngine } = await import('/src/features/analysis/engine/RuleEngine.ts');
      const run = RuleEngine.prototype.run;
      window.engineCalls = 0;
      RuleEngine.prototype.run = function (...args) { window.engineCalls++; return run.apply(this, args); };
      const read = FileReader.prototype.readAsArrayBuffer;
      let hold = true;
      FileReader.prototype.readAsArrayBuffer = function (...args) {
        if (hold) { hold = false; window.releaseRead = () => read.apply(this, args); }
        else read.apply(this, args);
      };
      const transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(atob(${JSON.stringify(base.toString("base64"))}), c => c.charCodeAt(0))], 'pending-correct.docx'));
      const input = document.querySelector('input[type=file]'); input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitForRuntimeValue(page, `!!document.querySelector('.upload-actions button:not(:disabled)')`);
    await evaluate(`document.querySelector('.upload-actions button').click()`);
    await waitForRuntimeValue(page, `typeof window.releaseRead === 'function'`);
    // Each check uses the actual UploadPage event handlers and browser DOMParser.
    const cases = [
      ["missing-terminal", `<w:p><w:pPr>${section}</w:pPr></w:p>`, false],
      ["duplicate-margin", `<w:p/><w:sectPr>${pgMar}${pgMar}</w:sectPr>`, false],
      ["equation-altChunk", `<w:p>${math}</w:p><w:altChunk/>${section}`, false],
      ["equation", `<w:p>${math}</w:p>${section}`, true],
    ];
    for (const [id, body, accept] of cases) {
      const zip = await JSZip.loadAsync(base);
      const xml = await zip.file("word/document.xml").async("string");
      zip.file("word/document.xml", xml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`));
      const encoded = await zip.generateAsync({ type: "base64" });
      await evaluate(`(() => {
        const data = Uint8Array.from(atob(${JSON.stringify(encoded)}), c => c.charCodeAt(0));
        const transfer = new DataTransfer(); transfer.items.add(new File([data], ${JSON.stringify(id + ".docx")}, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
        const input = document.querySelector('input[type=file]'); input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await waitForRuntimeValue(page, `!!document.querySelector('.upload-actions button:not(:disabled)')`);
      await evaluate(`document.querySelector('.upload-actions button').click()`);
      if (accept) {
        await waitForRuntimeValue(page, `!document.querySelector('.upload-page')`);
        assert.equal(await evaluate(`!!document.querySelector('.analysis-report')`), true);
      } else {
        const message = await waitForRuntimeValue(page, `document.querySelector('[role=alert]')?.textContent`);
        assert.equal(message, "Belgenin sayfa düzeni bilgileri güvenilir biçimde doğrulanamadığı için analiz tamamlanamadı. Lütfen DOCX dosyasını yeniden kaydedip tekrar deneyin.");
        assert.equal(await evaluate(`!!document.querySelector('.analysis-report')`), false);
        if (id === 'missing-terminal') {
          // An older successful request must not overwrite the new deferred UI.
          await evaluate(`window.releaseRead()`);
          await waitForRuntimeValue(page, `window.engineCalls === 1`);
          assert.equal(await evaluate(`!!document.querySelector('.analysis-report')`), false);
          assert.equal(await evaluate(`document.querySelector('[role=alert]')?.textContent`), message);
        }
      }
      rows.push({ id, decision: accept ? "ACCEPT" : "DEFER" });
    }
    console.log(JSON.stringify({ browser: path.basename(executable), result: "PASS", staleSuccessAfterDefer: "PASS", rows }));
  } finally {
    if (page) await page.close();
    if (session) { await session.send("Browser.close").catch(() => {}); await session.close(); }
    if (browser) stopProcess(browser);
    stopProcess(vite);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
