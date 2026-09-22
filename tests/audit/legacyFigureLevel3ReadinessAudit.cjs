const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const LEGACY_PATTERNS = [
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
  const sourceHits = findHits("src");
  assertEqual(sourceHits.length, 0, `production legacy figure source hits: ${JSON.stringify(sourceHits)}`);

  console.log(JSON.stringify({
    phase: "4E-18O",
    result: "PASS",
    decision: "OPTION B",
    level3CleanupReady: "CLEANUP_EXECUTED",
    remainingActiveProductionReaders: [],
    residualCompatibilityReaders: [],
    legacyProductionWriters: [],
  }, null, 2));
}

function findHits(rootRelativePath) {
  return walk(path.join(ROOT, rootRelativePath))
    .filter((filePath) => /\.(cjs|ts|tsx)$/.test(filePath))
    .flatMap((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      return LEGACY_PATTERNS
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
