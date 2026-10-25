const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { normalizeSectionName } = require("../../src/features/analysis/parsers/documentSectionsParser.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { admitAssessmentBatch } = require("../../src/features/analysis/engine/AssessmentAdmission.ts");
const { createAssessmentReport } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");

// Characterization only. None of the equivalences or diagnostic comparison
// alternatives below authorizes an academic alias, tolerance or real admission.
const pilots = [...sections.candidates, ...margins.candidates];
const rules = pilots.map((candidate) => candidate.rule);
const target = sections.candidates.find((candidate) => candidate.inventoryId === "SDU-INV-SEC-19").rule;
const exact = "Yaygın Etki/Katma Değer/Kullanılabilirlik";
const normalized = "yayginetkikatmadegerkullanilabilirlik";
const frozenHash = "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44";
// Browser observations from Sprint 31, not live assertions or frozen PDF bytes.
const scopeEvidence = {
  department: "https://muhendislik.sdu.edu.tr/endustri",
  undergraduateNavigation: "https://muhendislik.sdu.edu.tr/endustri/tr/lisans.html",
  announcement: "https://muhendislik.sdu.edu.tr/endustri/tr/haber/bitirme-odevi-ve-tasarim-projesi-dersleri-hakkinda-onemli-guncelleme-57745h.html",
  course: "https://muhendislik.sdu.edu.tr/endustri/tr/lisans/bitirme-odevi-tasarim-projesi-dersi-476s.html",
  linkedGuide: "https://muhendislik.sdu.edu.tr/assets/uploads/sites/147/files/bitirme_tasarim-2026-kilavuz-03032026.pdf",
  status: "Department/course applicability link observed; linked PDF differs from pilot URL; PDF bytes unavailable; no hash/equivalence verification or admission authorization",
};
const syntheticScope = { university: { id: "sdu" }, faculty: { id: "synthetic-faculty" },
  department: { id: "synthetic-department" }, programLevel: { id: "synthetic-level" }, workType: { id: "synthetic-work-type" } };
const policy = pilots.map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    readiness: candidate.readiness, academicScope: syntheticScope,
    source: { kind: "frozen-source", title: source.title, url: source.url, frozenSourceSha256: source.frozenSourceSha256,
      claim: source.claim, references: candidate.references ?? [{ section: source.section, printedPage: source.printedPage }] } };
});
const request = () => structuredClone({ purpose: "assessment-only", academicScope: syntheticScope, candidates: policy });
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const paragraph = (text, style = "Heading1") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const section = (raw) => `<w:sectPr>${raw === null ? "" : `<w:pgMar w:top="${raw}" w:bottom="${raw}"/>`}</w:sectPr>`;
let cases = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }
async function denied(input, code, trusted) {
  await assert.rejects(() => admitAssessmentBatch(input, trusted), (error) => error.code === code);
}
function filesBelow(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directoryPath, entry.name);
    return entry.isDirectory() ? filesBelow(filename) : [filename];
  });
}

async function main() {
  const corpusFiles = ["tests", "sample-documents", "public", "docs"].flatMap((root) => filesBelow(path.resolve(root)))
    .filter((filename) => path.extname(filename).toLowerCase() === ".docx");
  const hashes = new Map(corpusFiles.map((filename) => [filename, digest(fs.readFileSync(filename))]));
  const originalPolicy = JSON.stringify([sections, margins, policy]);
  const baseBytes = fs.readFileSync(path.join(directory, "full-correct.docx"));
  const originalXml = await (await JSZip.loadAsync(baseBytes)).file("word/document.xml").async("string");
  async function variant(body) {
    const zip = await JSZip.loadAsync(baseBytes);
    zip.file("word/document.xml", originalXml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`));
    return readDocx(await zip.generateAsync({ type: "nodebuffer" }));
  }
  try {
    await check("eleven exact source-bounded contracts, no new aliases or precision tolerance", () => {
      assert.equal(pilots.length, 11);
      assert.equal(exact, target.expected.section);
      assert.equal(normalizeSectionName(exact), normalized);
      assert.equal(new Set(rules.map((rule) => rule.id)).size, 11);
      for (const rule of rules) assert.equal(Object.hasOwn(rule.expected, "aliases"), false);
      margins.candidates.forEach(({ rule }) => assert.deepEqual(rule.expected, { value: 2.5, unit: "cm" }));
    });
    const identities = [
      ["exact", exact, true], ["case-folding", exact.toLocaleUpperCase("tr-TR"), true],
      ["Turkish-diacritics", "Yaygin Etki/Katma Deger/Kullanilabilirlik", true],
      ["NFD", exact.normalize("NFD"), true], ["NFC", exact.normalize("NFC"), true],
      ["whitespace", "  Yaygın\tEtki / Katma  Değer / Kullanılabilirlik  ", true],
      ["NBSP", exact.replaceAll(" ", "\u00a0"), true],
      ["slash-to-space", exact.replaceAll("/", " "), true],
      ["slash-to-hyphen", exact.replaceAll("/", "-"), true],
      ["fullwidth-slash", exact.replaceAll("/", "／"), true],
      ["word-boundary-removal", "YaygınEtkiKatmaDeğerKullanılabilirlik", true],
      ["punctuation-inside-word", exact.replace("Yaygın", "Ya!ygın"), true],
      ["fullwidth-letter-not-NFKC", exact.replace("Y", "Ｙ"), false],
      ["partial-impact", "Yaygın Etki", false], ["partial-value", "Katma Değer", false],
      ["partial-usability", "Kullanılabilirlik", false],
    ];
    for (const [name, text, equal] of identities) {
      await check(`SEC-19 technical equality, not approved academic equivalence: ${name}`, async () => {
        const document = await variant(paragraph(text) + section("1417"));
        const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, [target]), [target]);
        const occurrences = qualified.academicSections.occurrences.filter((item) => item.canonicalName === exact);
        assert.equal(normalizeSectionName(text) === normalized, equal);
        assert.equal(occurrences.length, equal ? 1 : 0);
        if (equal) assert.equal(occurrences[0].structuralIdentity.certainty, "confirmed");
        const entry = runSections(document, undefined, [target])[0];
        assert.equal(entry.decision, equal ? "compliant" : "violation");
        assert.equal(entry.assessment.coverage.population, "closed");
        console.log(JSON.stringify({ identityBoundary: name, rawOoxml: paragraph(text), normalizedIdentity: normalizeSectionName(text),
          structuralIdentity: occurrences.map((item) => item.structuralIdentity.certainty), coverage: entry.assessment.coverage,
          decision: entry.decision, academicEquivalenceAuthorization: "not-established-by-normalization" }));
      });
    }
    for (const [name, body, decision, coverage, certainty] of [
      ["split-headings", ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik"].map((text) => paragraph(text)).join(""), "violation", "closed", null],
      ["name-only", paragraph(exact, null), "undetermined", "closed", "unresolved"],
      ["misleading-style", paragraph(exact, "QuoteHeading1Substring"), "undetermined", "closed", "unresolved"],
      ["nested-heading", paragraph(exact, "Heading2"), "undetermined", "closed", "ambiguous"],
      ["open-coverage", paragraph(exact) + "<w:altChunk/>", "undetermined", "open", "confirmed"],
    ]) {
      await check(`structural identity remains independent of name equality: ${name}`, async () => {
        const document = await variant(body + section("1417"));
        const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, [target]), [target]);
        const occurrences = qualified.academicSections.occurrences.filter((item) => item.canonicalName === exact);
        assert.deepEqual(occurrences.map((item) => item.structuralIdentity.certainty), certainty ? [certainty] : []);
        const entry = runSections(document, undefined, [target])[0];
        assert.equal(entry.decision, decision);
        assert.equal(entry.assessment.coverage.population, coverage);
      });
    }
    await check("precision A/B/C are separate from the normative requirement; no policy replacement", async () => {
      const rows = [];
      for (const raw of [1414, 1415, 1416, 1417, 1418, 1419, 1420, 1421]) {
        const document = await variant(paragraph("Body", null) + section(String(raw)));
        const expectedCm = raw === 1414 ? 2.49 : raw === 1421 ? 2.51 : 2.5;
        assert.equal(document.pageMargins.top, expectedCm);
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), margins.candidates.map(({ rule }) => rule));
        entries.forEach((entry) => assert.equal(entry.decision, expectedCm === 2.5 ? "compliant" : "violation"));
        assert.equal(BigInt(raw) * 127n === 180000n, false);
        rows.push({ rawTwips: raw, mathematicalCm: raw * 127 / 72000, parsedCm: expectedCm,
          assessment: entries[0].decision, exactRationalEquality: false });
      }
      for (const [raw, decision] of [["2.5cm", "compliant"], ["2.499cm", "compliant"], ["2.501cm", "compliant"], ["0x589", "undetermined"], [null, "undetermined"]]) {
        const document = await variant(paragraph("Body", null) + section(raw));
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), margins.candidates.map(({ rule }) => rule));
        entries.forEach((entry) => assert.equal(entry.decision, decision));
      }
      console.log(JSON.stringify({ precision: rows, requirement: "2.5 cm; frozen reference section 2.2 printed page 4",
        academicTolerance: "not-authorized", representationPolicy: "proposal only: retain raw lexeme/unit and conversion precision, then obtain explicit source/scope approval before a comparator change" }));
    });
    await check("web scope evidence does not bind a different PDF to the frozen eleven pilots", async () => {
      assert.notEqual(scopeEvidence.linkedGuide, sections.source.url);
      for (const source of [sections.source, margins.source]) assert.equal(source.frozenSourceSha256, frozenHash);
      // These identifiers are an unapproved request, not real production metadata.
      const input = request();
      input.academicScope = { university: { id: "sdu" }, faculty: { id: "engineering-and-natural-sciences-unapproved" },
        department: { id: "industrial-engineering-unapproved" }, programLevel: { id: "bachelor-unapproved" }, workType: { id: "graduation-project-unapproved" } };
      input.candidates.forEach((candidate) => { candidate.academicScope = input.academicScope; });
      await denied(input, "unknown-execution-id"); // default empty trusted policy
      await denied(input, "scope-mismatch", policy); // synthetic policy cannot authorize real scope
      const incomplete = request(); delete incomplete.academicScope.programLevel;
      await denied(incomplete, "missing-academic-scope", policy);
      const changedPdf = request(); changedPdf.candidates[0].source.url = scopeEvidence.linkedGuide;
      await denied(changedPdf, "provenance-mismatch", policy);
      console.log(JSON.stringify({ academicScopeEvidence: scopeEvidence, frozenSourceUrl: sections.source.url,
        frozenHash, pdfVerification: "registered-hash-only", realScopeAdmission: "denied", productionAuthorization: "not-granted" }));
    });
    await check("source verification states require bytes; synthetic PDF success is transport-only", async () => {
      const admission = await admitAssessmentBatch(request(), policy);
      admission.bindings.forEach((binding) => assert.deepEqual(binding.admission.sourceVerification, { state: "registered-hash-only" }));
      const bytes = new TextEncoder().encode("%PDF-1.7\nSynthetic hash transport control; not an official SDU document.");
      const bad = request(); bad.sourceArtifacts = [{ url: sections.source.url, pdfBytes: bytes }];
      await denied(bad, "source-hash-mismatch", policy);
      const trusted = structuredClone(policy.slice(0, 1));
      trusted[0].source = { ...trusted[0].source, title: "Synthetic PDF transport only", url: "https://example.invalid/synthetic.pdf",
        frozenSourceSha256: digest(bytes), claim: "Synthetic transport; no SDU source or scope claim" };
      const synthetic = await admitAssessmentBatch({ purpose: "assessment-only", academicScope: syntheticScope, candidates: trusted,
        sourceArtifacts: [{ url: trusted[0].source.url, pdfBytes: bytes }] }, trusted);
      assert.deepEqual(synthetic.bindings[0].admission.sourceVerification, { state: "supplied-pdf-hash-match", sha256: digest(bytes) });
      assert.equal(synthetic.productionAuthorization, "not-granted");
    });
    await check("disk corpus provenance is metadata-based; app.xml is not proof of native authorship", async () => {
      const origins = { "synthetic-ooxml": 0, "word-native": 0, "libreoffice-native": 0, "real-student-document": 0, unknown: 0 };
      for (const filename of corpusFiles) {
        const fixture = path.dirname(filename) === directory ? manifest.fixtures.find((item) => item.file === path.basename(filename)) : undefined;
        const origin = fixture?.origin;
        const classification = Object.hasOwn(origins, origin) ? origin : "unknown";
        origins[classification]++;
        const zip = await JSZip.loadAsync(fs.readFileSync(filename));
        assert.ok(zip.file("word/document.xml"));
        if (classification === "synthetic-ooxml") assert.ok(fixture.createdWith);
        console.log(JSON.stringify({ corpusFile: path.relative(process.cwd(), filename), classification,
          provenance: fixture ? { origin, createdWith: fixture.createdWith, privacyStatus: fixture.privacyStatus } : "no provenance record",
          applicationMetadata: zip.file("docProps/app.xml") ? await zip.file("docProps/app.xml").async("string") : null }));
      }
      assert.deepEqual(origins, { "synthetic-ooxml": 42, "word-native": 0, "libreoffice-native": 0, "real-student-document": 0, unknown: 0 });
      console.log(JSON.stringify({ evidenceInventory: origins, roots: ["tests", "sample-documents", "public", "docs"],
        nativeAndRealStudentEvidence: "absent; production evidence blocker" }));
    });
    for (const filename of ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"]) {
      await check(`${filename}: eleven decisions, provenance, unscored report and legacy isolation`, async () => {
        const document = await readDocx(fs.readFileSync(path.join(directory, filename)));
        const before = JSON.stringify(document);
        const engine = new RuleEngine(); const builder = new ReportBuilder();
        const legacyRules = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", facultyId: "applied-sciences",
          departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" }));
        assert.equal(legacyRules.length, 46);
        const legacy = engine.run(document, legacyRules); const legacyReport = structuredClone(builder.build(legacy));
        const admission = await admitAssessmentBatch(request(), policy);
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), rules);
        assert.deepEqual(entries.map((entry) => entry.decision), ["compliant", "undetermined", "undetermined", "violation", "violation", "undetermined", "violation", "violation", "undetermined", "violation", "compliant"]);
        const report = createAssessmentReport(entries, admission.bindings);
        assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
        assert.deepEqual(report.records.map((record) => record.execution), entries);
        assert.deepEqual(report.scoring, { mode: "unscored", legacyContribution: "none" });
        report.records.forEach((record, index) => {
          assert.deepEqual(record.source, policy[index].source);
          assert.deepEqual(record.academicScope, syntheticScope);
          assert.equal(record.admission.productionAuthorization, "not-granted");
        });
        assert.deepEqual(builder.build(engine.run(document, legacyRules)), legacyReport);
        assert.deepEqual(builder.build(legacy), legacyReport);
        assert.equal(JSON.stringify(document), before);
      });
    }
    await check("existing discovery and policy metadata remain unchanged", () => {
      assert.equal(loadAvailableRuleSets().some((set) => set.metadata.university.id === "sdu"), false);
      assert.equal(JSON.stringify([sections, margins, policy]), originalPolicy);
    });
  } finally {
    for (const [filename, before] of hashes) assert.equal(digest(fs.readFileSync(filename)), before, filename);
  }
  console.log(JSON.stringify({ audit: "sduNormalizationPolicyBoundary", result: "PASS", cases, pilots: 11,
    diskCorpusPackages: corpusFiles.length, fixtureWrites: 0, temporaryFiles: 0,
    productionChanges: 0, realScopeAdmission: "denied", productionAuthorization: "not-granted" }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
