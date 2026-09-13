const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { runAnalysisFixture } = require("../golden/experimentalGoldenRegression.cjs");

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const FIXTURE_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "comu",
  "food-technology",
  "experimental",
);
const SOURCE_DOCX = path.join(FIXTURE_DIR, "full-correct.docx");
const INTERMEDIATE_WRONG_DOCX = path.join(FIXTURE_DIR, "multi-section-margin-synthetic.docx");
const FINAL_WRONG_DOCX = path.join(FIXTURE_DIR, "multi-section-final-margin-fail-synthetic.docx");
const ALL_CORRECT_DOCX = path.join(FIXTURE_DIR, "multi-section-margin-all-correct-synthetic.docx");
const TARGET_PARAGRAPH_TEXT =
  "This study evaluates the basic properties of the sample product.";
const WRONG_LEFT_TWIPS = "1000";
const WRONG_RIGHT_TWIPS = "1000";
const MARGIN_RULE_IDS = new Set([
  "comu.bachelor.margin.left",
  "comu.bachelor.margin.right",
  "comu.bachelor.margin.top",
  "comu.bachelor.margin.bottom",
  "comu.applied-sciences.food-technology.bachelor.margin.top",
]);

async function main() {
  await createFixtures();
  const fixturePaths = [INTERMEDIATE_WRONG_DOCX, FINAL_WRONG_DOCX, ALL_CORRECT_DOCX];
  const summaries = [];

  for (const fixturePath of fixturePaths) {
    summaries.push(await inspectRuntime(fixturePath));
  }

  console.log(JSON.stringify(summaries, null, 2));
}

async function createFixtures() {
  const source = fs.readFileSync(SOURCE_DOCX);
  await createFixture(source, INTERMEDIATE_WRONG_DOCX, {
    intermediateMargins: "wrong",
    finalMargins: "correct",
  });
  await createFixture(source, FINAL_WRONG_DOCX, {
    intermediateMargins: "correct",
    finalMargins: "wrong",
  });
  await createFixture(source, ALL_CORRECT_DOCX, {
    intermediateMargins: "correct",
    finalMargins: "correct",
  });
}

async function createFixture(source, targetPath, options) {
  const zip = await JSZip.loadAsync(source);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("word/document.xml bulunamadi.");
  const documentXml = await documentFile.async("string");
  const mutatedXml = createMultiSectionMarginDocumentXml(documentXml, options);

  zip.file("word/document.xml", mutatedXml);
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: "nodebuffer" }));
}

function createMultiSectionMarginDocumentXml(documentXml, options) {
  const bodyMatch = documentXml.match(/<w:body\b[\s\S]*<\/w:body>/);
  if (!bodyMatch) {
    throw new Error("w:body bulunamadi.");
  }

  const sectionProperties = Array.from(bodyMatch[0].matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g));
  if (sectionProperties.length < 2) {
    throw new Error("Audit icin beklenen section yapisi bulunamadi.");
  }

  const intermediateSectionProperties = options.intermediateMargins === "wrong"
    ? mutateSectionMargins(sectionProperties[0][0])
    : sectionProperties[0][0];
  const paragraphMatch = findParagraphByText(documentXml, TARGET_PARAGRAPH_TEXT);
  if (!paragraphMatch) {
    throw new Error("Hedef paragraf bulunamadi.");
  }

  const mutatedParagraph = addParagraphSectionProperties(
    paragraphMatch.paragraphXml,
    intermediateSectionProperties,
  );

  const withIntermediateSection = (
    documentXml.slice(0, paragraphMatch.start) +
    mutatedParagraph +
    documentXml.slice(paragraphMatch.end)
  );

  return options.finalMargins === "wrong"
    ? mutateFinalBodySectionMargins(withIntermediateSection)
    : withIntermediateSection;
}

function findParagraphByText(documentXml, expectedText) {
  const paragraphPattern = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphPattern.exec(documentXml)) !== null) {
    const paragraphXml = match[0];
    const text = Array.from(paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("");

    if (text === expectedText) {
      return {
        paragraphXml,
        start: match.index,
        end: match.index + paragraphXml.length,
      };
    }
  }

  return null;
}

function addParagraphSectionProperties(paragraphXml, sectionPropertiesXml) {
  const pPrMatch = paragraphXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/);

  if (pPrMatch) {
    const pPrXml = pPrMatch[0];
    if (/<w:sectPr\b/.test(pPrXml)) {
      throw new Error("Hedef paragrafta zaten w:sectPr var.");
    }

    const mutatedPPr = pPrXml.replace("</w:pPr>", `${sectionPropertiesXml}</w:pPr>`);
    return paragraphXml.replace(pPrXml, mutatedPPr);
  }

  return paragraphXml.replace(
    /(<w:p\b[^>]*>)/,
    `$1<w:pPr>${sectionPropertiesXml}</w:pPr>`,
  );
}

function mutateSectionMargins(sectionPropertiesXml) {
  return sectionPropertiesXml.replace(
    /<w:pgMar\b([^>]*)\/>/,
    (_match, attributes) => {
      const withoutLeft = attributes.replace(/\s+w:left="[^"]*"/, "");
      const withoutRight = withoutLeft.replace(/\s+w:right="[^"]*"/, "");
      return `<w:pgMar${withoutRight} w:left="${WRONG_LEFT_TWIPS}" w:right="${WRONG_RIGHT_TWIPS}"/>`;
    },
  );
}

function mutateFinalBodySectionMargins(documentXml) {
  const sectionMatches = Array.from(documentXml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g));
  const finalSectionMatch = sectionMatches.at(-1);
  if (!finalSectionMatch || finalSectionMatch.index === undefined) {
    throw new Error("Final body-level w:sectPr bulunamadi.");
  }

  const mutatedFinalSection = mutateSectionMargins(finalSectionMatch[0]);
  const start = finalSectionMatch.index;
  const end = start + finalSectionMatch[0].length;

  return documentXml.slice(0, start) + mutatedFinalSection + documentXml.slice(end);
}

async function inspectRuntime(fixturePath) {
  const ooxml = await inspectFixtureOoxml(fixturePath);
  const { document, report } = await runAnalysisFixture(fixturePath);
  const marginResults = report.results.filter((result) =>
    MARGIN_RULE_IDS.has(result.ruleId),
  );

  return {
    fixture: path.relative(process.cwd(), fixturePath),
    ooxml,
    normalizedPageMargins: document.pageMargins,
    pageSections: document.pageSections,
    pageNumberSections: document.pageNumbering.sections,
    report: {
      total: report.totalRules,
      passed: report.passedRules,
      failed: report.failedRules,
      notApplicable: report.notApplicableRules,
      score: report.score,
    },
    marginResults: marginResults.map((result) => ({
      ruleId: result.ruleId,
      status: result.status,
      expected: result.expected,
      actual: result.actual,
      message: result.message,
      evidence: result.evidence ?? [],
      evidenceTotal: result.evidenceTotal,
    })),
  };
}

async function inspectFixtureOoxml(fixturePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(fixturePath));
  const documentXml = await zip.file("word/document.xml").async("string");
  const sectionMatches = Array.from(documentXml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g));
  const bodyLevelSections = sectionMatches.filter((match) =>
    /<\/w:sectPr>\s*<\/w:body>/.test(documentXml.slice(match.index, match.index + match[0].length + 32)),
  );
  const paragraphLevelSections = sectionMatches.filter((match) =>
    !bodyLevelSections.includes(match),
  );

  return {
    namespace: WORD_NS,
    totalSectPr: sectionMatches.length,
    paragraphLevelSectPr: paragraphLevelSections.length,
    bodyLevelFinalSectPr: bodyLevelSections.length,
    sections: sectionMatches.map((match, index) => {
      const pgMar = match[0].match(/<w:pgMar\b([^>]*)\/>/);
      const margins = pgMar ? parseAttributes(pgMar[1]) : {};
      return {
        index,
        source: bodyLevelSections.includes(match) ? "body-level-final" : "paragraph-level",
        marginsTwips: pickMargins(margins),
        marginsCm: Object.fromEntries(
          Object.entries(pickMargins(margins)).map(([key, value]) => [
            key,
            twipsToCentimeters(Number(value)),
          ]),
        ),
      };
    }),
  };
}

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/\s+w:([^=]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function pickMargins(attributes) {
  return {
    top: attributes.top,
    right: attributes.right,
    bottom: attributes.bottom,
    left: attributes.left,
  };
}

function twipsToCentimeters(twips) {
  return Math.round((twips / 1440) * 2.54 * 100) / 100;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
