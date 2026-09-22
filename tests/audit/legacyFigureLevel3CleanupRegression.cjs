const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_ROOT = path.join(ROOT, "src");
const FORBIDDEN_SOURCE_PATTERNS = [
  "DocumentFigureOccurrence",
  "DocumentFigures",
  "NormalizedDocument.figures",
  "document.figures",
  "figures.items",
  "figures.count",
  "figures.hasFigures",
  "parseFigures",
];

function main() {
  const hits = findForbiddenHits(SOURCE_ROOT);
  assertEqual(hits.length, 0, `legacy figure bridge production hits: ${JSON.stringify(hits)}`);

  console.log(JSON.stringify({
    phase: "4E-18P",
    result: "PASS",
    productionLegacyFigureBridge: "REMOVED",
    checkedPatterns: FORBIDDEN_SOURCE_PATTERNS,
  }, null, 2));
}

function findForbiddenHits(directory) {
  return walk(directory)
    .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
    .flatMap((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      return FORBIDDEN_SOURCE_PATTERNS
        .filter((pattern) => content.includes(pattern))
        .map((pattern) => ({ file: toRepoRelativePath(filePath), pattern }));
    });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function toRepoRelativePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
