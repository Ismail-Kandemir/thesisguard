const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
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

global.DOMParser = class DOMParser {
  parseFromString(xml) {
    const hasParserError = /<\s*parsererror/i.test(xml);

    return {
      getElementsByTagNameNS: () => [],
      querySelector: (selector) => (selector === "parsererror" && hasParserError ? {} : null),
    };
  }
};

const {
  DOCX_PACKAGE_LIMITS,
  DocxPackageError,
  readDocxAnalysisXmlParts,
} = require("../../src/features/analysis/readers/docxPackageReader.ts");

async function main() {
  await assertNormalDocxAccepted();
  await assertRejected(
    createPartCountFixture(),
    "DOCX_EXCESSIVE_PART_COUNT",
    "excessive part count should be rejected",
  );
  await assertRejected(
    createIndividualPartFixture(),
    "DOCX_EXCESSIVE_PART_SIZE",
    "excessive individual part should be rejected",
  );
  await assertRejected(
    createTotalSizeFixture(),
    "DOCX_EXCESSIVE_TOTAL_SIZE",
    "excessive total decompressed size should be rejected",
  );
  await assertRejected(
    Promise.resolve(createFileLikeBuffer(Buffer.from("not a zip"), "malformed.docx")),
    "DOCX_MALFORMED_PACKAGE",
    "malformed package should fail cleanly",
  );

  console.log("DOCX package safety regression passed.");
}

async function assertNormalDocxAccepted() {
  const fixturePath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "comu",
    "food-technology",
    "experimental",
    "full-correct.docx",
  );
  const buffer = fs.readFileSync(fixturePath);
  const file = createFileLikeBuffer(buffer, "full-correct.docx");
  const parts = await readDocxAnalysisXmlParts(file);

  if (!parts.documentXml.includes("w:document")) {
    throw new Error("normal DOCX should return document.xml content");
  }
}

async function assertRejected(filePromise, expectedCode, label) {
  try {
    await readDocxAnalysisXmlParts(await filePromise);
  } catch (error) {
    if (!(error instanceof DocxPackageError)) {
      throw new Error(`${label}: expected DocxPackageError`);
    }

    if (error.code !== expectedCode) {
      throw new Error(`${label}: expected ${expectedCode}, received ${error.code}`);
    }

    return;
  }

  throw new Error(`${label}: expected rejection`);
}

async function createPartCountFixture() {
  const zip = createMinimalDocxZip();

  for (let index = 0; index < DOCX_PACKAGE_LIMITS.maxPartCount; index += 1) {
    zip.file(`word/safety/part-${index}.xml`, "<root/>");
  }

  return fileFromZip(zip, "too-many-parts.docx");
}

async function createIndividualPartFixture() {
  const zip = createMinimalDocxZip();
  const oversizedPart = "x".repeat(DOCX_PACKAGE_LIMITS.maxPartSizeBytes + 1);

  zip.file("word/oversized.xml", oversizedPart);

  return fileFromZip(zip, "oversized-part.docx");
}

async function createTotalSizeFixture() {
  const zip = createMinimalDocxZip();
  const oneMegabyte = "x".repeat(1024 * 1024);
  const extraPartCount = Math.ceil(
    DOCX_PACKAGE_LIMITS.maxTotalUncompressedSizeBytes / oneMegabyte.length,
  );

  for (let index = 0; index < extraPartCount; index += 1) {
    zip.file(`word/large/part-${index}.xml`, oneMegabyte);
  }

  return fileFromZip(zip, "oversized-total.docx");
}

function createMinimalDocxZip() {
  const zip = new JSZip();

  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
  );

  return zip;
}

async function fileFromZip(zip, fileName) {
  const buffer = await zip.generateAsync({
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    type: "nodebuffer",
  });

  return createFileLikeBuffer(buffer, fileName);
}

function createFileLikeBuffer(buffer, fileName) {
  buffer.name = fileName;
  buffer.size = buffer.length;

  return buffer;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
