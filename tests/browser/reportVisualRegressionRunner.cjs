const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const JSZip = require("jszip");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      resolveJsonModule: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  module._compile(output, filename);
};

require("../golden/experimentalGoldenRegression.cjs");

const { analyzeDocx } = require("../../src/features/analysis/analysisService.ts");

const FIXTURE_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
);
const HARNESS_DATA_PATH = path.join(
  process.cwd(),
  "tests",
  "browser",
  "reportVisualRegressionData.generated.json",
);
const SELECTION = {
  universityId: "comu",
  facultyId: "applied-sciences",
  departmentId: "food-technology",
  thesisTypeId: "bachelor",
  studyTypeId: "experimental",
};
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "tablet", width: 900, height: 900 },
  { name: "mobile", width: 390, height: 900 },
];

async function main() {
  const browserPath = findBrowserExecutable();

  if (!browserPath) {
    throw new Error(
      "No real browser executable was found for browser-level report visual regression.",
    );
  }

  const data = await createHarnessData();
  fs.writeFileSync(HARNESS_DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);

  const vitePort = await findOpenPort();
  const debugPort = await findOpenPort();
  const vite = startVite(vitePort);

  try {
    await waitForHttp(`http://127.0.0.1:${vitePort}/tests/browser/reportVisualRegressionHarness.html`);

    const browser = await startBrowser(browserPath, debugPort);
    try {
      const browserWebSocketUrl = await waitForBrowserWebSocket(debugPort);
      const browserSession = await CdpSession.connect(browserWebSocketUrl);

      try {
        const results = [];

        for (const viewport of VIEWPORTS) {
          const pageSession = await createPageSession(
            browserSession,
            debugPort,
            `http://127.0.0.1:${vitePort}/tests/browser/reportVisualRegressionHarness.html?viewport=${viewport.name}`,
          );
          try {
            results.push(await runViewportChecks(pageSession, viewport));
          } finally {
            await pageSession.close();
          }
        }

        const failures = results.flatMap((result) => result.failures);
        if (failures.length > 0) {
          throw new Error(`Browser visual regression failed:\n${failures.join("\n")}`);
        }

        console.log(JSON.stringify({
          phase: "4E-18K",
          result: "PASS",
          browserPath,
          scenarios: data.scenarios.map((scenario) => scenario.id),
          viewports: results.map((result) => ({
            name: result.viewportName,
            height: result.viewport.height,
            width: result.viewport.width,
            scenarioCount: result.scenarioCount,
            keyboardChecks: result.keyboardChecks,
          })),
        }, null, 2));
      } finally {
        await browserSession.close();
      }
    } finally {
      stopProcess(browser);
    }
  } finally {
    stopProcess(vite);
    fs.rmSync(HARNESS_DATA_PATH, { force: true });
  }
}

async function createHarnessData() {
  const golden = await analyzeFixture("full-correct.docx");
  const diagnosticSource = await analyzeDocx(
    await createFullCorrectWithAnchors("single"),
    SELECTION,
  );
  const multipleDiagnosticSource = await analyzeDocx(
    await createFullCorrectWithAnchors("multiple"),
    SELECTION,
  );
  const reports = {
    golden,
    diagnosticOnly: createDiagnosticPresentationReport(golden, diagnosticSource.diagnostics),
    multipleDiagnostics: createDiagnosticPresentationReport(
      golden,
      multipleDiagnosticSource.diagnostics,
    ),
    partialPass: await analyzeSyntheticDocx(
      mainBoundary() +
        inlinePicture("center", 11) +
        caption("\u015Eekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture(12) +
        caption("\u015Eekil 2. Anchor"),
    ),
    partialFail: await analyzeSyntheticDocx(
      mainBoundary() +
        inlinePicture("left", 21) +
        caption("\u015Eekil 1. Inline") +
        paragraph("Ara metin") +
        anchorPicture(22) +
        caption("\u015Eekil 2. Anchor"),
    ),
    anchorOnly: await analyzeSyntheticDocx(
      mainBoundary() +
        anchorPicture(31) +
        caption("\u015Eekil 1. Anchor"),
    ),
    ordinaryNotApplicable: await analyzeSyntheticDocx(mainBoundary() + paragraph("Sadece metin")),
  };

  assertReportShape(reports.golden, "golden");
  assertScoreDiagnosticScenario(reports.diagnosticOnly, "score-with-diagnostics");
  assert(reports.multipleDiagnostics.diagnostics.length >= 2, "multiple diagnostics scenario was not produced");
  assertRuleCoverage(reports.partialPass, "PASSED", "partial", "partial pass");
  assertRuleCoverage(reports.partialFail, "FAILED", "partial", "partial fail");
  assertRuleCoverage(reports.anchorOnly, "NOT_APPLICABLE", "none", "anchor only");

  return {
    generatedAt: new Date().toISOString(),
    scenarios: [
      { id: "golden", label: "Golden 46/46 report", report: reports.golden },
      { id: "score-with-diagnostics", label: "100 score with manual review diagnostics", report: reports.diagnosticOnly },
      { id: "multiple-diagnostics", label: "Multiple manual review diagnostics", report: reports.multipleDiagnostics },
      { id: "partial-pass", label: "Partial coverage with passed rule", report: reports.partialPass },
      { id: "partial-fail", label: "Partial coverage with failed rule", report: reports.partialFail },
      { id: "anchor-only", label: "Relevant object not automatically verifiable", report: reports.anchorOnly },
      { id: "ordinary-not-applicable", label: "Ordinary not applicable rule", report: reports.ordinaryNotApplicable },
      { id: "long-content", label: "Long wrapping stress report", report: createLongContentReport(reports.partialFail) },
    ],
  };
}

function createDiagnosticPresentationReport(sourceReport, diagnostics) {
  return {
    ...JSON.parse(JSON.stringify(sourceReport)),
    diagnostics,
  };
}

async function runViewportChecks(pageSession, viewport) {
  await pageSession.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: viewport.width < 600,
    width: viewport.width,
  });
  await pageSession.send("Page.enable");
  await pageSession.send("Runtime.enable");
  await pageSession.send("Page.navigate", {
    url: pageSession.url,
  });
  await pageSession.waitForEvent("Page.loadEventFired", 15000);

  const harnessResult = await waitForRuntimeValue(
    pageSession,
    "window.__REPORT_VISUAL_RESULT__",
  );
  const keyboardChecks = await runKeyboardCheck(pageSession);
  const failures = [
    ...harnessResult.failures.map((failure) => `${viewport.name}: ${failure}`),
    ...keyboardChecks.failures.map((failure) => `${viewport.name}: ${failure}`),
  ];

  return {
    ...harnessResult,
    failures,
    keyboardChecks: keyboardChecks.failures.length === 0 ? "PASS" : "FAIL",
    viewportName: viewport.name,
  };
}

async function runKeyboardCheck(pageSession) {
  const result = await pageSession.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: "window.__REPORT_VISUAL_KEYBOARD_CHECK__()",
    returnByValue: true,
  });

  return {
    failures: result.result.value,
  };
}

async function createPageSession(browserSession, debugPort, url) {
  const target = await browserSession.send("Target.createTarget", {
    url: "about:blank",
  });
  const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
  const pageTarget = targets.find((item) => item.id === target.targetId);

  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("Created browser target did not expose a page WebSocket URL.");
  }

  const session = await CdpSession.connect(pageTarget.webSocketDebuggerUrl);
  session.url = url;
  return session;
}

async function waitForRuntimeValue(pageSession, expression) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    const response = await pageSession.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (response.result.value) {
      return response.result.value;
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for runtime value: ${expression}`);
}

class CdpSession {
  constructor(socket) {
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
    this.socket = socket;
    this.socket.addEventListener("message", (event) => {
      this.handleMessage(String(event.data));
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timeout = setTimeout(() => {
        reject(new Error("Timed out connecting to browser WebSocket."));
      }, 10000);

      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve(new CdpSession(socket));
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Browser WebSocket connection failed."));
      }, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for CDP event: ${method}`));
      }, timeoutMs);
      const waiters = this.eventWaiters.get(method) ?? [];
      waiters.push((params) => {
        clearTimeout(timeout);
        resolve(params);
      });
      this.eventWaiters.set(method, waiters);
    });
  }

  handleMessage(rawMessage) {
    const message = JSON.parse(rawMessage);

    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    if (message.method) {
      const waiters = this.eventWaiters.get(message.method) ?? [];
      this.eventWaiters.delete(message.method);
      for (const waiter of waiters) {
        waiter(message.params);
      }
    }
  }

  close() {
    this.socket.close();
    return Promise.resolve();
  }
}

async function analyzeFixture(fileName) {
  return analyzeDocx(createNodeDocxReaderInput(path.join(FIXTURE_DIR, fileName)), SELECTION);
}

async function analyzeSyntheticDocx(content) {
  const zip = new JSZip();
  zip.file("word/document.xml", documentXml(content));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return analyzeDocx(createFileLikeBytes(buffer, "browser-visual-regression.docx"), SELECTION);
}

async function createFullCorrectWithAnchors(mode) {
  const fixturePath = path.join(FIXTURE_DIR, "full-correct.docx");
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("full-correct.docx does not contain word/document.xml.");
  }

  const documentXmlText = await documentFile.async("string");
  const anchoredContent = mode === "multiple"
    ? paragraph("Ek inceleme nesneleri") + anchorPicture(501) + paragraph("Ara metin") + anchorPicture(502)
    : paragraph("Ek inceleme nesnesi") + anchorPicture(401);
  const updatedXml = documentXmlText.includes("<w:sectPr")
    ? documentXmlText.replace("<w:sectPr", `${anchoredContent}<w:sectPr`)
    : documentXmlText.replace("</w:body>", `${anchoredContent}</w:body>`);

  zip.file("word/document.xml", updatedXml);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return createFileLikeBytes(buffer, `full-correct-${mode}-diagnostic.docx`);
}

function createLongContentReport(sourceReport) {
  const clone = JSON.parse(JSON.stringify(sourceReport));
  const longText = [
    "Cok uzun ama kullaniciya donuk aciklama",
    "otomatik dogrulanabilen kisimlarda ihlal tespit edilirken",
    "manuel inceleme gerektiren kapsam ayri tutulmustur",
    "ve bu metin dar ekranlarda kart disina tasmamalidir",
  ].join(" ");
  clone.results = clone.results.map((result, index) => {
    if (index > 2) {
      return result;
    }

    return {
      ...result,
      actual: `${longText} ${index + 1}`,
      expected: `${longText} beklenen ${index + 1}`,
      message: `${longText}. ${result.message}`,
      ruleName: `${result.ruleName} - ${longText}`,
      solution: `${longText}.`,
    };
  });

  return clone;
}

function pickFigureAlignment(report) {
  const result = report.results.find((item) => item.ruleId.endsWith("figure-object-alignment"));
  if (!result) {
    throw new Error("Missing figure-object-alignment result.");
  }

  return result;
}

function assertRuleCoverage(report, expectedStatus, expectedCoverage, label) {
  const result = pickFigureAlignment(report);
  assert(result.status === expectedStatus, `${label} status changed: ${result.status}`);
  assert(
    result.coverage?.status === expectedCoverage,
    `${label} coverage changed: ${result.coverage?.status}`,
  );
}

function assertScoreDiagnosticScenario(report, label) {
  assert(
    report.score === 100,
    `${label} score is not 100: score=${report.score}, passed=${report.passedRules}, failed=${report.failedRules}, notApplicable=${report.notApplicableRules}, failedRuleIds=${report.results.filter((result) => result.status === "FAILED").map((result) => result.ruleId).join(", ")}`,
  );
  assert(report.failedRules === 0, `${label} has failed rules.`);
  assert(report.diagnostics.length > 0, `${label} has no diagnostics.`);
}

function assertReportShape(report, label) {
  assert(report.totalRules === 46, `${label} total rule count changed.`);
  assert(report.score === 100, `${label} score changed.`);
  assert(report.failedRules === 0, `${label} failed count changed.`);
}

function documentXml(content) {
  return [
    '<w:document',
    ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
    ">",
    "<w:body>",
    content,
    "</w:body>",
    "</w:document>",
  ].join("");
}

function mainBoundary() {
  return paragraph("Giris");
}

function paragraph(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function caption(text) {
  return [
    '<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr>',
    `<w:r><w:t>${text}</w:t></w:r></w:p>`,
  ].join("");
}

function inlinePicture(alignment, id) {
  return [
    `<w:p><w:pPr><w:jc w:val="${alignment}"/></w:pPr><w:r><w:drawing><wp:inline>`,
    `<wp:docPr id="${id}" name="Inline Picture ${id}"/>`,
    pictureGraphic(),
    "</wp:inline></w:drawing></w:r></w:p>",
  ].join("");
}

function anchorPicture(id) {
  return [
    '<w:p><w:r><w:drawing><wp:anchor simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">',
    '<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>',
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>',
    '<wp:extent cx="1828800" cy="914400"/>',
    '<wp:wrapSquare wrapText="bothSides"/>',
    `<wp:docPr id="${id}" name="Anchor Object ${id}"/>`,
    pictureGraphic(),
    "</wp:anchor></w:drawing></w:r></w:p>",
  ].join("");
}

function pictureGraphic() {
  return '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic/></a:graphicData></a:graphic>';
}

function createNodeDocxReaderInput(filePath) {
  return createFileLikeBytes(fs.readFileSync(filePath), path.basename(filePath));
}

function createFileLikeBytes(buffer, name) {
  const exactBytes = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const bytes = new Uint8Array(exactBytes);

  Object.defineProperties(bytes, {
    name: { value: name, enumerable: true },
    size: { value: bytes.byteLength, enumerable: true },
    type: {
      value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      enumerable: true,
    },
  });

  return bytes;
}

function startVite(port) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const npmArgs = [
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ];
  const child = process.platform === "win32"
    ? spawn("cmd.exe", ["/c", npmCommand, ...npmArgs], {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: true,
    })
    : spawn(npmCommand, npmArgs, {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
    });

  return child;
}

async function startBrowser(browserPath, debugPort) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "thesisguard-browser-"));
  const child = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  child.once("exit", (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`Browser process exited with code ${code}.\n`);
    }
  });

  return child;
}

function stopProcess(child) {
  if (!child.killed) {
    child.kill();
  }
}

function findBrowserExecutable() {
  const candidates = [
    process.env.THESISGUARD_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) {
          resolve(address.port);
          return;
        }

        reject(new Error("Could not allocate an open port."));
      });
    });
  });
}

async function waitForHttp(url) {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    try {
      await fetchText(url);
      return;
    } catch {
      await delay(250);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForBrowserWebSocket(debugPort) {
  const deadline = Date.now() + 20000;
  const url = `http://127.0.0.1:${debugPort}/json/version`;

  while (Date.now() < deadline) {
    try {
      const version = await fetchJson(url);
      if (version.webSocketDebuggerUrl) {
        return version.webSocketDebuggerUrl;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error("Timed out waiting for browser debugging endpoint.");
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve(body);
      });
    }).on("error", reject);
  });
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
