const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const LEGACY_SOURCE_PATTERNS = [
  "DocumentFigureOccurrence",
  "DocumentFigures",
  "NormalizedDocument.figures",
  "document.figures",
  "figures.items",
  "figures.count",
  "figures.hasFigures",
  "parseFigures",
];

const CURRENT_DOCS = [
  "docs/ARCHITECTURE.md",
  "docs/TEST_PLAN.md",
  "docs/UNIVERSITY_RULES.md",
  "docs/ROADMAP.md",
  "docs/PROJECT_PLAN.md",
];

const HISTORICAL_DOC_MARKERS = [
  {
    file: "docs/PHASE_4E_18M_LEGACY_FIGURE_BRIDGE_DEPENDENCY_AND_LEVEL3_READINESS.md",
    markers: ["Post-18P current-state note", "Phase 4E-18P completed LEVEL 3 cleanup"],
  },
  {
    file: "docs/PHASE_4E_18N_SEMANTIC_FIGURE_STRUCTURAL_EVIDENCE_MIGRATION.md",
    markers: ["Post-18P current-state note", "Current production source has no legacy figure bridge"],
  },
  {
    file: "docs/PHASE_4E_18O_LEGACY_FIGURE_LEVEL3_CLEANUP_PLANNING_AND_REMOVAL_AUDIT.md",
    markers: ["Post-18P current-state note", "Current authority for figure bridge retirement"],
  },
  {
    file: "docs/PHASE_4E_18P_LEGACY_FIGURE_BRIDGE_LEVEL3_CLEANUP_EXECUTION.md",
    markers: ["current authority", "LEVEL 3 is complete"],
  },
];

const CURRENT_STALE_PATTERNS = [
  /DocumentFigureOccurrence[^.\n]*(still exists|still active|remains active|is active)/i,
  /document\.figures[^.\n]*(still exists|still active|remains active|is active)/i,
  /parseFigures\(\)[^.\n]*(still exists|still active|remains active|is active)/i,
  /LEVEL 3[^.\n]*(future|planned|pending|ready)/i,
  /legacy figure bridge[^.\n]*(still exists|remains|active|current)/i,
  /figures\.items/i,
  /figures\.count/i,
  /figures\.hasFigures/i,
  /real `w:drawing` varl/i,
];

function main() {
  const sourceHits = findForbiddenSourceHits(path.join(ROOT, "src"));
  assertEqual(sourceHits.length, 0, `production legacy figure source hits: ${JSON.stringify(sourceHits)}`);

  const currentDocHits = CURRENT_DOCS.flatMap(findStaleCurrentDocHits);
  assertEqual(currentDocHits.length, 0, `stale current documentation hits: ${JSON.stringify(currentDocHits)}`);

  const missingMarkers = HISTORICAL_DOC_MARKERS.flatMap(({ file, markers }) => {
    const content = readRepoFile(file);
    return markers
      .filter((marker) => !content.includes(marker))
      .map((marker) => ({ file, marker }));
  });
  assertEqual(missingMarkers.length, 0, `missing historical superseded/current-state markers: ${JSON.stringify(missingMarkers)}`);

  const architecture = readRepoFile("docs/ARCHITECTURE.md");
  [
    "ObjectRepresentationOccurrence",
    "CaptionOccurrence",
    "ObjectCaptionAssociation",
    "AcademicObjectResolution",
    "legacy figure bridge was retired at LEVEL 3",
    "Phase 4E-18P",
  ].forEach((marker) => {
    assertIncludes(architecture, marker, `architecture doc marker missing: ${marker}`);
  });

  console.log(JSON.stringify({
    phase: "4E-18Q",
    result: "PASS",
    productionLegacyFigureBridge: "ABSENT",
    currentDocsChecked: CURRENT_DOCS,
    historicalDocsChecked: HISTORICAL_DOC_MARKERS.map((entry) => entry.file),
  }, null, 2));
}

function findForbiddenSourceHits(directory) {
  return walk(directory)
    .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
    .flatMap((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      return LEGACY_SOURCE_PATTERNS
        .filter((pattern) => content.includes(pattern))
        .map((pattern) => ({ file: toRepoRelativePath(filePath), pattern }));
    });
}

function findStaleCurrentDocHits(file) {
  const content = readRepoFile(file);
  return CURRENT_STALE_PATTERNS.flatMap((pattern) => {
    const matches = content.match(pattern);
    return matches ? [{ file, pattern: pattern.toString(), match: matches[0] }] : [];
  });
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
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

function assertIncludes(content, expected, message) {
  if (!content.includes(expected)) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
