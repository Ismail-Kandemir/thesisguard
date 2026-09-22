const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const runnerPath = path.join(ROOT, "tests", "browser", "reportVisualRegressionRunner.cjs");
const harnessPath = path.join(ROOT, "tests", "browser", "reportVisualRegressionHarness.tsx");
const harnessHtmlPath = path.join(ROOT, "tests", "browser", "reportVisualRegressionHarness.html");
const packageJsonPath = path.join(ROOT, "package.json");

function main() {
  assertFile(runnerPath);
  assertFile(harnessPath);
  assertFile(harnessHtmlPath);

  const runner = fs.readFileSync(runnerPath, "utf8");
  const harness = fs.readFileSync(harnessPath, "utf8");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert(
    packageJson.scripts["test:browser-report"] ===
      "node tests/browser/reportVisualRegressionRunner.cjs",
    "package.json must expose the browser report regression command.",
  );
  assert(
    runner.includes("remote-debugging-port") && runner.includes("WebSocket"),
    "Runner must drive a real browser through the Chrome DevTools Protocol.",
  );
  assert(
    runner.includes("analyzeDocx") && runner.includes("full-correct.docx"),
    "Runner must use production analysis reports, including the golden DOCX fixture.",
  );
  assert(
    runner.includes("partial-pass") &&
      runner.includes("partial-fail") &&
      runner.includes("anchor-only") &&
      runner.includes("score-with-diagnostics") &&
      runner.includes("multiple-diagnostics") &&
      runner.includes("ordinary-not-applicable") &&
      runner.includes("long-content"),
    "Runner must cover the required report UX scenarios.",
  );
  assert(
    runner.includes("Emulation.setDeviceMetricsOverride") &&
      runner.includes("desktop") &&
      runner.includes("mobile"),
    "Runner must execute viewport-level layout checks.",
  );
  assert(
    harness.includes("AnalysisReportView") &&
      harness.includes("analysis-report__coverage-badge") &&
      harness.includes("analysis-report__diagnostics") &&
      harness.includes("analysis-report__filter") &&
      harness.includes("analysis-report__details-panel"),
    "Harness must render the production report component and assert its key UI states.",
  );
  assert(
    harness.includes("scrollWidth") &&
      harness.includes("clientWidth") &&
      harness.includes("__REPORT_VISUAL_KEYBOARD_CHECK__"),
    "Harness must check rendered overflow and keyboard/focus behavior in the browser.",
  );
  assert(
    !runner.includes("puppeteer") &&
      !runner.includes("playwright") &&
      !runner.includes("jsdom"),
    "Runner should remain dependency-free and must not fake browser rendering through jsdom.",
  );

  console.log("Browser report visual regression audit passed.");
}

function assertFile(filePath) {
  assert(fs.existsSync(filePath), `Missing expected file: ${path.relative(ROOT, filePath)}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main();
