const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function main() {
  const uploadPage = read("src/pages/UploadPage.tsx");
  const uploadCss = read("src/pages/UploadPage.css");
  const reportPage = read("src/pages/ReportPage.tsx");
  const reportView = read("src/features/analysis/report/components/AnalysisReportView.tsx");
  const uploadActions = read("src/features/upload/components/UploadActions.tsx");

  assertIncludes(uploadPage, "Analiz için gerekenler", "readiness checklist heading");
  assertIncludes(uploadPage, "handleChooseAnotherFile", "same-selection recovery handler");
  assertIncludes(uploadPage, "handleFullReset", "full reset handler");
  assertIncludes(uploadPage, "onChooseAnotherFile={handleChooseAnotherFile}", "report same-selection callback");
  assertIncludes(uploadPage, "onNewAnalysis={handleFullReset}", "report full reset callback");
  assertIncludes(uploadPage, "Belge inceleniyor.", "student-friendly loading copy");
  assertIncludes(uploadPage, "Dosyayı tekrar seçebilir", "student-friendly recovery copy");
  assertIncludes(uploadCss, "upload-page__readiness", "readiness styles");
  assertIncludes(uploadCss, "upload-page__error-recovery", "error recovery styles");
  assertIncludes(reportPage, "onChooseAnotherFile", "report page forwards same-selection recovery");
  assertIncludes(reportView, "Başka Dosya Seç", "report exposes same-selection recovery action");
  assertIncludes(uploadActions, "Eksikleri Tamamlayın", "disabled analyze action copy");
  assertIncludes(uploadActions, "disabledReason", "disabled analyze reason");

  console.log("Upload recovery UX static regression passed.");
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${expected}`);
  }
}

main();
