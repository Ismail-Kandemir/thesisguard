const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function main() {
  const uploadPage = read("src/pages/UploadPage.tsx");
  const uploadCss = read("src/pages/UploadPage.css");
  const uploadDropzone = read("src/features/upload/components/UploadDropzone.tsx");
  const reportPage = read("src/pages/ReportPage.tsx");
  const reportView = read("src/features/analysis/report/components/AnalysisReportView.tsx");
  const uploadActions = read("src/features/upload/components/UploadActions.tsx");

  assertIncludes(uploadPage, "Analiz için gerekenler", "readiness checklist heading");
  assertIncludes(uploadPage, "Şu anda yalnız listelenen programlar desteklenmektedir.", "supported scope copy");
  assertIncludes(uploadPage, "handleChooseAnotherFile", "same-selection recovery handler");
  assertIncludes(uploadPage, "handleFullReset", "full reset handler");
  assertIncludes(uploadPage, "onChooseAnotherFile={handleChooseAnotherFile}", "report same-selection callback");
  assertIncludes(uploadPage, "onNewAnalysis={handleFullReset}", "report full reset callback");
  assertIncludes(uploadPage, "Belge inceleniyor.", "student-friendly loading copy");
  assertIncludes(uploadPage, "yeniden .docx olarak kaydedin", "student-friendly DOCX recovery copy");
  assertNotIncludes(uploadPage, "role=\"alert\"", "recovery copy does not duplicate live error announcement");
  assertIncludes(uploadCss, "upload-page__readiness", "readiness styles");
  assertIncludes(uploadCss, "upload-page__analysis-spinner", "loading spinner styles");
  assertIncludes(uploadCss, "upload-page__error-recovery", "error recovery styles");
  assertIncludes(uploadDropzone, "role=\"alert\"", "upload error uses alert live region");
  assertIncludes(uploadDropzone, "aria-live=\"assertive\"", "upload error is announced");
  assertIncludes(reportPage, "onChooseAnotherFile", "report page forwards same-selection recovery");
  assertIncludes(reportView, "Düzeltilmiş DOCX Yükle", "report exposes same-selection recovery action");
  assertIncludes(reportView, "Seçimleri Sıfırla", "report exposes full reset action");
  assertIncludes(reportView, "Kritik hatalar önce gösterilir", "priority explanation copy");
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

function assertNotIncludes(source, unexpected, label) {
  if (source.includes(unexpected)) {
    throw new Error(`${label}: unexpected ${unexpected}`);
  }
}

main();
