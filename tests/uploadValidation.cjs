const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  module._compile(output, filename);
};

const {
  MAX_DOCX_FILE_SIZE_BYTES,
  validateUploadFile,
} = require("../src/features/upload/utils.ts");

function main() {
  assertValid(file("thesis.docx", MAX_DOCX_FILE_SIZE_BYTES, ""), ".docx should be accepted");
  assertValid(file("thesis.DOCX", MAX_DOCX_FILE_SIZE_BYTES, ""), ".DOCX should be accepted");
  assertInvalid(file("thesis.pdf", 1024, "application/pdf"), "INVALID_FILE_TYPE", ".pdf should be rejected");
  assertValid(file("limit.docx", MAX_DOCX_FILE_SIZE_BYTES, ""), "20 MB should be accepted");
  assertInvalid(
    file("too-large.docx", MAX_DOCX_FILE_SIZE_BYTES + 1, ""),
    "FILE_TOO_LARGE",
    "20 MB + 1 byte should be rejected",
  );
  assertValid(file("empty-mime.docx", 1024, ""), "empty MIME with .docx should be accepted");
  assertInvalid(null, "NO_FILE", "missing file should be rejected");

  console.log("Upload validation regression passed.");
}

function file(name, size, type) {
  return { name, size, type };
}

function assertValid(candidate, label) {
  const result = validateUploadFile(candidate);

  if (!result.valid) {
    throw new Error(`${label}: expected valid, received ${result.code}`);
  }
}

function assertInvalid(candidate, code, label) {
  const result = validateUploadFile(candidate);

  if (result.valid) {
    throw new Error(`${label}: expected ${code}, received valid`);
  }

  if (result.code !== code) {
    throw new Error(`${label}: expected ${code}, received ${result.code}`);
  }
}

main();
