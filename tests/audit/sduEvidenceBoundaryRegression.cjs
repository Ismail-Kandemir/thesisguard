const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { normalizeSectionName } = require("../../src/features/analysis/parsers/documentSectionsParser.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { resolveHeadingStyleProvenance } = require("../../src/features/analysis/parsers/headingStyleProvenance.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { admitAssessmentBatch } = require("../../src/features/analysis/engine/AssessmentAdmission.ts");
const { createAssessmentReport } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");

const pilots = [...sections.candidates, ...margins.candidates];
const rules = pilots.map((candidate) => candidate.rule);
const target = sections.candidates.find((candidate) => candidate.inventoryId === "SDU-INV-SEC-19").rule;
const exact = target.expected.section;
const normalizedExact = "yayginetkikatmadegerkullanilabilirlik";
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const paragraph = (text, style = "Heading1") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const style = (id, name, parent) => `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${parent}"/></w:style>`;
const pgMar = (raw) => raw === undefined ? "" : `<w:pgMar w:top="${raw}" w:bottom="${raw}"/>`;
const sectPr = (raw) => `<w:sectPr>${pgMar(raw)}</w:sectPr>`;
let cases = 0;
let memoryPackages = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }

function assertEntry(entry, expected, coverage = "closed") {
  assert.equal(entry.kind, "assessment", JSON.stringify(entry));
  assert.equal(entry.decision, expected);
  assert.equal(entry.assessment.applicability.state, "applicable");
  assert.equal(entry.assessment.coverage.population, coverage);
  assert.notEqual(entry.decision, "not-applicable");
  for (const key of ["status", "passed", "score"]) assert.equal(Object.hasOwn(entry, key), false);
}

async function main() {
  const fixtureHashes = new Map(manifest.fixtures.map(({ file }) => [file, hash(fs.readFileSync(path.join(directory, file)))]));
  const originalPolicy = JSON.stringify([sections, margins]);
  const baseBytes = fs.readFileSync(path.join(directory, "full-correct.docx"));
  const baseZip = await JSZip.loadAsync(baseBytes);
  const originalXml = await baseZip.file("word/document.xml").async("string");
  const originalStyles = await baseZip.file("word/styles.xml").async("string");
  async function controlledPackage(body, extraStyles = "") {
    const zip = await JSZip.loadAsync(baseBytes);
    const xml = originalXml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`);
    const stylesXml = originalStyles.replace("</w:styles>", `${extraStyles}</w:styles>`);
    zip.file("word/document.xml", xml);
    zip.file("word/styles.xml", stylesXml);
    const bytes = await zip.generateAsync({ type: "nodebuffer" });
    memoryPackages++;
    const document = await readDocx(bytes);
    return { document, xml, stylesXml };
  }
  try {
    const equivalentNames = [
      ["exact-full-name", exact],
      ["turkish-uppercase", exact.toLocaleUpperCase("tr-TR")],
      ["lowercase", exact.toLocaleLowerCase("tr-TR")],
      ["ascii-turkish-variation", "Yaygin Etki/Katma Deger/Kullanilabilirlik"],
      ["decomposed-unicode", exact.normalize("NFD")],
      ["whitespace", "  Yaygın\tEtki / Katma  Değer / Kullanılabilirlik  "],
      ["nonbreaking-space", exact.replaceAll(" ", "\u00a0")],
      ["slash-as-spaces", exact.replaceAll("/", " ")],
      ["slash-as-hyphens", exact.replaceAll("/", "-")],
      ["fullwidth-slashes", exact.replaceAll("/", "／")],
      ["no-word-separators", "YaygınEtkiKatmaDeğerKullanılabilirlik"],
      ["punctuation-inside-word", exact.replace("Yaygın", "Ya!ygın")],
    ];
    const sectionScenarios = [
      ...equivalentNames.map(([name, text]) => ({ name, text, body: paragraph(text), identity: "confirmed", decision: "compliant", equivalent: true })),
      ...["Yaygın Etki", "Katma Değer", "Kullanılabilirlik", "Yaygın Etki/Katma Değer", "Katma Değer/Kullanılabilirlik", "Yaygın Etki/Kullanılabilirlik"].map((text, index) => ({
        name: `partial-name-${index}`, text, body: paragraph(text), count: 0, decision: "violation", equivalent: false,
      })),
      { name: "split-headings", body: ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik"].map((text) => paragraph(text)).join(""), count: 0, decision: "violation" },
      { name: "split-runs-same-paragraph", body: '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' + ["Yaygın Etki/", "Katma Değer/", "Kullanılabilirlik"].map((text) => `<w:r><w:t>${text}</w:t></w:r>`).join("") + '</w:p>', identity: "confirmed", decision: "compliant" },
      { name: "name-only", text: exact, body: paragraph(exact, null), identity: "unresolved", decision: "undetermined" },
      { name: "misleading-heading-style", text: exact, body: paragraph(exact, "BoundaryQuote"), styles: style("BoundaryQuote", "Quotation Heading1 Example", "Normal"), identity: "unresolved", decision: "undetermined" },
      { name: "missing-style", text: exact, body: paragraph(exact, "BoundaryMissing"), identity: "unresolved", decision: "undetermined" },
      { name: "broken-inheritance", text: exact, body: paragraph(exact, "BoundaryBroken"), styles: style("BoundaryBroken", "Broken", "BoundaryMissing"), identity: "unresolved", decision: "undetermined" },
      { name: "cyclic-inheritance", text: exact, body: paragraph(exact, "BoundaryCycleA"), styles: style("BoundaryCycleA", "Cycle A", "BoundaryCycleB") + style("BoundaryCycleB", "Cycle B", "BoundaryCycleA"), identity: "unresolved", decision: "undetermined" },
      { name: "inherited-heading", text: exact, body: paragraph(exact, "BoundaryInherited"), styles: style("BoundaryInherited", "Inherited", "Heading1"), identity: "confirmed", decision: "compliant" },
      { name: "nested-heading", text: exact, body: paragraph(exact, "Heading2"), identity: "ambiguous", decision: "undetermined" },
      { name: "competing-headings", text: exact, body: paragraph(exact) + paragraph(exact), count: 2, identity: "ambiguous", decision: "undetermined" },
      { name: "table-cell", text: exact, body: `<w:tbl><w:tr><w:tc>${paragraph(exact)}</w:tc></w:tr></w:tbl>`, count: 0, decision: "undetermined", coverage: "open" },
      { name: "textbox", text: exact, body: `<w:p><w:r><w:pict><w:txbxContent>${paragraph(exact)}</w:txbxContent></w:pict></w:r></w:p>`, count: 0, decision: "undetermined", coverage: "open" },
      { name: "open-extraction", text: exact, body: paragraph(exact) + '<w:altChunk/>', identity: "confirmed", decision: "undetermined", coverage: "open", extraction: "open" },
    ];
    for (const scenario of sectionScenarios) {
      await check(`SEC-19 normalization boundary: ${scenario.name}`, async () => {
        const { document, xml } = await controlledPackage(scenario.body + sectPr("1417"), scenario.styles);
        const before = JSON.stringify(document);
        const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, rules), rules);
        const entry = runSections(document, undefined, [target])[0];
        assertEntry(entry, scenario.decision, scenario.coverage ?? "closed");
        const occurrences = qualified.academicSections.occurrences.filter((item) => item.canonicalName === exact);
        assert.equal(occurrences.length, scenario.count ?? 1);
        for (const occurrence of occurrences) assert.equal(occurrence.structuralIdentity.certainty, scenario.identity);
        if (scenario.equivalent !== undefined) assert.equal(normalizeSectionName(scenario.text) === normalizedExact, scenario.equivalent);
        assert.equal(document.sectionExtractionCoverage.population, scenario.extraction ?? "closed");
        const rawText = document.paragraphs.map((item) => ({ text: item.text, normalizedIdentity: normalizeSectionName(item.text), styleId: item.styleId,
          headingProvenance: resolveHeadingStyleProvenance(document, item), tableCell: item.isInTableCell, contentScope: item.contentScope }));
        console.log(JSON.stringify({ boundary: "section-identity", scenario: scenario.name, inventoryId: "SDU-INV-SEC-19", executionId: target.id,
          normativeIdentity: exact, normalizedNormativeIdentity: normalizedExact, rawBodyXml: scenario.body, rawText,
          structuralIdentity: occurrences.map((item) => item.structuralIdentity), extractionCoverage: document.sectionExtractionCoverage,
          assessment: entry }));
        assert.ok(xml.includes(scenario.body));
        assert.equal(JSON.stringify(document), before);
        const engine = new RuleEngine(); const builder = new ReportBuilder();
        const legacy = engine.run(document, [target]); const legacyBefore = structuredClone(builder.build(legacy));
        runSections(document, undefined, [target]);
        assert.deepEqual(builder.build(engine.run(document, [target])), legacyBefore);
        if (scenario.name === "name-only") assert.equal(legacy[0].status, "PASSED");
      });
    }
    // Characterization of current conversion, NOT a source-approved tolerance
    // or a new validator. Raw mathematical cm is diagnostic evidence only.
    const marginCases = [
      ["1414", 2.49, "violation"], ["1415", 2.5, "compliant"], ["1416", 2.5, "compliant"],
      ["1417", 2.5, "compliant"], ["1418", 2.5, "compliant"], ["1419", 2.5, "compliant"], ["1420", 2.5, "compliant"], ["1421", 2.51, "violation"],
      // Sprint 30: bare fractional twips are invalid lexical evidence. Sprint 29
      // accepted them through Number(); keep these counterexamples explicit.
      ["1414.4881", null, "undetermined"], ["1414.4882", null, "undetermined"], ["1420.1574", null, "undetermined"], ["1420.1575", null, "undetermined"],
      ["1417.3228346456692", null, "undetermined"],
      ["2.5cm", 2.5, "compliant"], // Schema-defined explicit-unit measure, supported in Sprint 30.
      [undefined, null, "undetermined"], ["", null, "undetermined"], [" ", null, "undetermined"],
      ["bad", null, "undetermined"], ["NaN", null, "undetermined"], ["Infinity", null, "undetermined"],
      ["2,5", null, "undetermined"], ["0", 0, "violation"], ["-1417", -2.5, "violation"],
      ["0x589", null, "undetermined"], ["1.417e3", null, "undetermined"], // Sprint 30: Number() no longer authorizes these lexemes.
    ];
    for (const [raw, parsedCm, decision] of marginCases) {
      await check(`both SDU margins: raw ${JSON.stringify(raw)} -> ${parsedCm} -> ${decision}`, async () => {
        const { document } = await controlledPackage(paragraph("Body", null) + sectPr(raw));
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), margins.candidates.map((item) => item.rule));
        assert.equal(document.pageMargins.top, parsedCm);
        assert.equal(document.pageMargins.bottom, parsedCm);
        entries.forEach((entry) => assertEntry(entry, decision));
        const rawNumber = raw !== undefined && raw.trim().length > 0 && Number.isFinite(Number(raw)) ? Number(raw) : null;
        console.log(JSON.stringify({ boundary: "margin-measurement", rawTwips: raw ?? "missing pgMar", rawPgMarXml: pgMar(raw),
          mathematicalCmBeforeRounding: rawNumber === null ? null : rawNumber * 127 / 72000,
          parsedCm, numericLexemeIsInteger: raw !== undefined && /^[+-]?\d+$/u.test(raw), assessments: entries }));
        const legacy = new RuleEngine().run(document, margins.candidates.map((item) => item.rule));
        const before = new ReportBuilder().build(legacy);
        createAssessmentReport(entries, margins.candidates.map((candidate) => ({ inventoryId: candidate.inventoryId,
          executionId: candidate.rule.id, contract: candidate.rule, source: { kind: "frozen-source", title: margins.source.title,
            url: margins.source.url, frozenSourceSha256: margins.source.frozenSourceSha256, claim: margins.source.claim,
            references: [{ section: margins.source.section, printedPage: margins.source.printedPage }] } })));
        assert.deepEqual(new ReportBuilder().build(legacy), before);
      });
    }
    const multiCases = [
      { name: "three-compliant-sections", values: ["1417", "1417", "1417"], decision: "compliant" },
      { name: "intermediate-violation", values: ["1417", "1421", "1417"], decision: "violation" },
      { name: "intermediate-unknown", values: ["1417", "", "1417"], decision: "undetermined" },
      { name: "violation-and-unknown", values: ["1421", "", "1417"], decision: "violation" },
      { name: "incomplete-terminal-compliant-observations", values: ["1417", "1417"], terminal: false, coverage: "open", decision: "undetermined" },
      { name: "incomplete-terminal-confirmed-violation", values: ["1421", "1417"], terminal: false, coverage: "open", decision: "violation" },
    ];
    for (const scenario of multiCases) {
      await check(`multi-section margin boundary: ${scenario.name}`, async () => {
        const body = scenario.values.map((value, index) => index === scenario.values.length - 1 && scenario.terminal !== false
          ? paragraph("Body", null) + sectPr(value)
          : `<w:p><w:pPr>${sectPr(value)}</w:pPr><w:r><w:t>Body</w:t></w:r></w:p>`).join("");
        const { document } = await controlledPackage(body);
        assert.equal(document.pageSections.length, scenario.values.length);
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), margins.candidates.map((item) => item.rule));
        entries.forEach((entry) => {
          assertEntry(entry, scenario.decision, scenario.coverage ?? "closed");
          assert.equal(entry.assessment.observations.length, scenario.values.length);
          assert.deepEqual(entry.assessment.observations.map((item) => item.subject.sectionIndex), scenario.values.map((_, index) => index));
        });
        console.log(JSON.stringify({ boundary: "multi-section-margins", scenario: scenario.name, rawBodyXml: body,
          rawTwipsBySection: scenario.values, parsedSections: document.pageSections, assessments: entries }));
      });
    }
    await check("existing disk corpus diversity audit, including real-document availability", async () => {
      const origins = {};
      const features = new Set();
      for (const fixture of manifest.fixtures) {
        const bytes = fs.readFileSync(path.join(directory, fixture.file));
        const document = await readDocx(bytes);
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), rules);
        assert.equal(entries.length, 11);
        entries.forEach((entry) => {
          assert.equal(entry.kind, "assessment");
          assert.notEqual(entry.decision, "not-applicable");
        });
        origins[fixture.origin] = (origins[fixture.origin] ?? 0) + 1;
        fixture.targetedFeatures.forEach((feature) => features.add(feature));
        console.log(JSON.stringify({ boundary: "existing-corpus-diversity", file: fixture.file, origin: fixture.origin,
          styles: document.styles.length, numberingDefinitions: document.numberingDefinitions.length,
          pageSectionCount: document.pageSections.length, tableCellParagraphs: document.paragraphs.filter((item) => item.isInTableCell).length,
          textboxParagraphs: document.paragraphs.filter((item) => item.contentScope === "textbox").length,
          extractionCoverage: document.sectionExtractionCoverage, decisions: entries.map((entry, index) => ({
            inventoryId: pilots[index].inventoryId, executionId: entry.ruleId, coverage: entry.assessment.coverage.population, decision: entry.decision,
          })) }));
      }
      assert.deepEqual(origins, { "synthetic-ooxml": 42 });
      assert.ok(features.has("multi-section-margin-section-ownership"));
      console.log(JSON.stringify({ documentEvidenceOrigins: origins, realStudentOrWordNativeEvidence: "not present in this corpus", source: "manifest provenance, not filename inference" }));
    });
    await check("actual SDU scope stays default-denied and frozen provenance is not a fresh PDF hash", async () => {
      await assert.rejects(() => admitAssessmentBatch({ purpose: "assessment-only", academicScope: {
        university: { id: "sdu" }, faculty: { id: "engineering" },
      }, candidates: [] }), (error) => error.code === "missing-academic-scope");
      for (const source of [sections.source, margins.source]) {
        assert.equal(source.frozenSourceSha256, "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44");
        assert.equal(source.url, "https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf");
      }
    });
    assert.equal(JSON.stringify([sections, margins]), originalPolicy);
  } finally {
    for (const [filename, before] of fixtureHashes) assert.equal(hash(fs.readFileSync(path.join(directory, filename))), before);
  }
  console.log(JSON.stringify({ audit: "sduEvidenceBoundary", result: "PASS", cases, memoryPackages, diskCorpusPackages: fixtureHashes.size,
    fixtureWrites: 0, temporaryFiles: 0, findings: ["broad section-name normalization", "two-decimal margin acceptance band"],
    numericLexicalFix: "Sprint 30: invalid bare numbers rejected; schema-defined explicit units supported",
    readiness: "assessment-only; production NO-GO; real scope and real-document evidence unconfirmed" }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
