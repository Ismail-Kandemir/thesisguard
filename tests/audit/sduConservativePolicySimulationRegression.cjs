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
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");

// Sprint 32 DESIGN SIMULATION ONLY. No exports, production wiring, new aliases,
// source-approved tolerance or modified execution entries. Scenario facts describe
// controlled input; they are not a detector for arbitrary student documents.
const pilots = [...sections.candidates, ...margins.candidates];
const rules = pilots.map(({ rule }) => rule);
const target = sections.candidates.find((item) => item.inventoryId === "SDU-INV-SEC-19").rule;
const exact = target.expected.section;
const frozenHash = "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44";
const departmentUrl = "https://muhendislik.sdu.edu.tr/assets/uploads/sites/147/files/bitirme_tasarim-2026-kilavuz-03032026.pdf";
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
const paragraph = (text, style = "Heading1") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const section = (raw) => `<w:sectPr>${raw === null ? "" : `<w:pgMar w:top="${raw}" w:bottom="${raw}"/>`}</w:sectPr>`;
const syntheticScope = { university: { id: "sdu" }, faculty: { id: "synthetic-faculty" }, department: { id: "synthetic-department" },
  programLevel: { id: "synthetic-level" }, workType: { id: "synthetic-work" } };
const bindings = pilots.map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    academicScope: syntheticScope, readiness: candidate.readiness,
    source: { kind: "frozen-source", title: source.title, url: source.url, frozenSourceSha256: source.frozenSourceSha256,
      claim: source.claim, references: candidate.references ?? [{ section: source.section, printedPage: source.printedPage }] } };
});
let cases = 0;
const transitions = {};
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }

// Byte identity is separate from URL identity, registered hash, normative review
// and academic scope. Synthetic bytes below only exercise these state boundaries.
function sourceIdentity(pilotBytes, linkedBytes) {
  const artifact = (bytes) => bytes === null ? { state: "unavailable", size: null, sha256: null }
    : { state: "supplied-bytes", size: bytes.length, sha256: digest(bytes) };
  return { pilot: artifact(pilotBytes), department: artifact(linkedBytes),
    byteIdentity: pilotBytes === null || linkedBytes === null ? "unverified"
      : Buffer.from(pilotBytes).equals(Buffer.from(linkedBytes)) ? "identical" : "different",
    normativeReview: "not-performed", productionAuthorization: "not-granted" };
}
function simulation(entry, proposedDecision, uncertainty) {
  assert.equal(entry.kind, "assessment");
  assert.notEqual(proposedDecision, "not-applicable");
  const transition = entry.decision === proposedDecision ? "unchanged" : `${entry.decision} -> ${proposedDecision}`;
  assert.ok(["unchanged", "compliant -> undetermined", "violation -> undetermined"].includes(transition));
  transitions[transition] = (transitions[transition] ?? 0) + 1;
  return { kind: "policy-simulation", productionApplied: false, baseExecution: structuredClone(entry), proposedDecision, uncertainty, transition };
}
function simulateSection(entry, { rawText, hasUnapprovedIdentityCandidate }) {
  // Canonical Unicode composition is proposed; case/diacritic/separator edits
  // require independent academic equivalence approval. No edits are accepted here.
  const exactCanonical = rawText !== null && rawText.normalize("NFC") === exact.normalize("NFC");
  const unresolved = hasUnapprovedIdentityCandidate && !exactCanonical;
  return simulation(entry, unresolved ? "undetermined" : entry.decision,
    unresolved ? { kind: "unapproved-identity-equivalence", rawText, normalizedLegacy: normalizeSectionName(rawText) } : null);
}
function simulateMargins(entry, controlledFacts) {
  // Facts are explicit fixture evidence: exact-unit 2.5cm or clear 3cm control,
  // unavailable evidence, or a representation whose comparison is not approved.
  // Integer quantization (even nearest-integer 1417) cannot authorize compliance.
  const proposed = controlledFacts.some((fact) => fact === "exact-violation") ? "violation"
    : entry.assessment.coverage.population === "closed" && controlledFacts.length > 0 && controlledFacts.every((fact) => fact === "exact-compliant")
      ? "compliant" : "undetermined";
  return simulation(entry, proposed, { kind: "precision-evidence-review", controlledFacts,
    integerQuantizationPolicy: "unapproved", academicTolerance: "not-invented" });
}

async function main() {
  const hashes = new Map(manifest.fixtures.map(({ file }) => [file, digest(fs.readFileSync(path.join(directory, file)))]));
  const baseBytes = fs.readFileSync(path.join(directory, "full-correct.docx"));
  const originalXml = await (await JSZip.loadAsync(baseBytes)).file("word/document.xml").async("string");
  async function variant(body) {
    const zip = await JSZip.loadAsync(baseBytes);
    zip.file("word/document.xml", originalXml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`));
    return readDocx(await zip.generateAsync({ type: "nodebuffer" }));
  }
  try {
    await check("two real sources remain unreconciled: no invented byte size, hash or normative equivalence", () => {
      const state = sourceIdentity(null, null);
      assert.deepEqual(state.pilot, { state: "unavailable", size: null, sha256: null });
      assert.deepEqual(state.department, state.pilot);
      assert.equal(state.byteIdentity, "unverified");
      assert.notEqual(departmentUrl, sections.source.url);
      for (const binding of bindings) {
        assert.equal(binding.source.url, sections.source.url);
        assert.equal(binding.source.frozenSourceSha256, frozenHash);
      }
      console.log(JSON.stringify({ sourceReconciliation: state, accessObservation: "Sprint 32 browser and HTTP retrieval failed; no PDF bytes obtained",
        pilotUrl: sections.source.url, registeredFrozenHash: frozenHash, departmentUrl,
        coursePage: "https://muhendislik.sdu.edu.tr/endustri/tr/lisans/bitirme-odevi-tasarim-projesi-dersi-476s.html",
        elevenPilotsDerivedFrom: "registered frozen pilot source; not the department-linked PDF" }));
    });
    await check("synthetic source identity states distinguish unavailable, identical and different bytes", () => {
      const first = Buffer.from("%PDF-1.7\nsynthetic source state A");
      const second = Buffer.from("%PDF-1.7\nsynthetic source state B");
      assert.equal(sourceIdentity(first, null).byteIdentity, "unverified");
      assert.equal(sourceIdentity(first, Buffer.from(first)).byteIdentity, "identical");
      const different = sourceIdentity(first, second);
      assert.equal(different.byteIdentity, "different");
      assert.notEqual(different.pilot.sha256, different.department.sha256);
      assert.equal(different.pilot.size, different.department.size); // size equality is not identity
      assert.equal(different.normativeReview, "not-performed"); // byte difference does not prove a rule difference
      assert.equal(different.productionAuthorization, "not-granted");
    });
    const sectionCases = [
      ["exact", exact, "Heading1", "compliant", "compliant"],
      ["case", exact.toLocaleUpperCase("tr-TR"), "Heading1", "compliant", "undetermined"],
      ["NFD", exact.normalize("NFD"), "Heading1", "compliant", "compliant"],
      ["NFC", exact.normalize("NFC"), "Heading1", "compliant", "compliant"],
      ["Turkish-diacritics", "Yaygin Etki/Katma Deger/Kullanilabilirlik", "Heading1", "compliant", "undetermined"],
      ["whitespace", "  Yaygın  Etki / Katma Değer / Kullanılabilirlik  ", "Heading1", "compliant", "undetermined"],
      ["slash-hyphen", exact.replaceAll("/", "-"), "Heading1", "compliant", "undetermined"],
      ["slash-fullwidth", exact.replaceAll("/", "／"), "Heading1", "compliant", "undetermined"],
      ["word-boundary-deletion", "YaygınEtkiKatmaDeğerKullanılabilirlik", "Heading1", "compliant", "undetermined"],
      ["in-word-punctuation", exact.replace("Yaygın", "Ya!ygın"), "Heading1", "compliant", "undetermined"],
      ["partial", "Yaygın Etki", "Heading1", "violation", "undetermined"],
      ["name-only", exact, null, "undetermined", "undetermined"],
      ["misleading-style", exact, "QuoteHeading1Substring", "undetermined", "undetermined"],
    ];
    for (const [name, rawText, style, current, proposed] of sectionCases) {
      await check(`SEC-19 conservative simulation: ${name}`, async () => {
        const document = await variant(paragraph(rawText, style) + section("2.5cm"));
        const entry = runSections(document, undefined, [target])[0];
        const before = structuredClone(entry);
        assert.equal(entry.decision, current);
        const result = simulateSection(entry, { rawText, hasUnapprovedIdentityCandidate: true });
        assert.equal(result.proposedDecision, proposed);
        assert.deepEqual(entry, before);
        const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, [target]), [target]);
        console.log(JSON.stringify({ scenario: name, rawOoxml: paragraph(rawText, style), normalizedIdentity: normalizeSectionName(rawText),
          structuralIdentity: qualified.academicSections.occurrences.map((item) => item.structuralIdentity.certainty), simulation: result }));
      });
    }
    for (const [name, body, candidate, current, proposed] of [
      ["split-headings", ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik"].map((text) => paragraph(text)).join(""), true, "violation", "undetermined"],
      ["closed-no-candidate", paragraph("Unrelated body", null), false, "violation", "violation"],
      ["open-exact-heading", paragraph(exact) + "<w:altChunk/>", false, "undetermined", "undetermined"],
    ]) {
      await check(`section absence/coverage simulation: ${name}`, async () => {
        const document = await variant(body + section("2.5cm"));
        const entry = runSections(document, undefined, [target])[0];
        assert.equal(entry.decision, current);
        const result = simulateSection(entry, { rawText: candidate ? document.paragraphs.map((item) => item.text).join("\n") : null,
          hasUnapprovedIdentityCandidate: candidate });
        assert.equal(result.proposedDecision, proposed);
        console.log(JSON.stringify({ scenario: name, simulation: result }));
      });
    }
    const marginCases = [
      ...Array.from({ length: 8 }, (_, index) => { const raw = index + 1414;
        return [String(raw), raw === 1414 || raw === 1421 ? "violation" : "compliant", "undetermined", "unapproved-integer-quantization"]; }),
      ["2.5cm", "compliant", "compliant", "exact-compliant"],
      ["2.499cm", "compliant", "undetermined", "rounded-measure"],
      ["2.501cm", "compliant", "undetermined", "rounded-measure"],
      [null, "undetermined", "undetermined", "missing"], ["0x589", "undetermined", "undetermined", "missing"],
      ["3cm", "violation", "violation", "exact-violation"],
    ];
    for (const [raw, current, proposed, fact] of marginCases) {
      await check(`margin conservative simulation: ${raw}`, async () => {
        const document = await variant(paragraph("Body", null) + section(raw));
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), margins.candidates.map(({ rule }) => rule));
        for (const entry of entries) {
          assert.equal(entry.decision, current);
          assert.equal(simulateMargins(entry, [fact]).proposedDecision, proposed);
        }
        console.log(JSON.stringify({ marginRaw: raw, parsedCm: document.pageMargins.top, current, proposed,
          rawMathematicalCm: raw !== null && /^\d+$/.test(raw) ? Number(raw) * 127 / 72000 : null,
          precisionUncertainty: fact, integerTargetTwips: "180000/127; nearest-integer policy not approved", productionApplied: false }));
      });
    }
    for (const [name, values, facts, terminal, current, proposed] of [
      ["closed-exact", ["2.5cm", "2.5cm"], ["exact-compliant", "exact-compliant"], true, "compliant", "compliant"],
      ["mixed-integer", ["2.5cm", "1417"], ["exact-compliant", "unapproved-integer-quantization"], true, "compliant", "undetermined"],
      ["missing", ["2.5cm", null], ["exact-compliant", "missing"], true, "undetermined", "undetermined"],
      ["confirmed-violation-with-unknown", ["3cm", null], ["exact-violation", "missing"], true, "violation", "violation"],
      ["open-exact", ["2.5cm", "2.5cm"], ["exact-compliant", "exact-compliant"], false, "undetermined", "undetermined"],
      ["open-quantization", ["1421", "1417"], ["unapproved-integer-quantization", "unapproved-integer-quantization"], false, "violation", "undetermined"],
      ["open-confirmed-violation", ["3cm", "2.5cm"], ["exact-violation", "exact-compliant"], false, "violation", "violation"],
    ]) {
      await check(`multi-section conservative simulation: ${name}`, async () => {
        const body = values.map((raw, index) => terminal && index === values.length - 1 ? section(raw)
          : `<w:p><w:pPr>${section(raw)}</w:pPr></w:p>`).join("");
        const document = await variant(body);
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), margins.candidates.map(({ rule }) => rule));
        entries.forEach((entry) => {
          assert.equal(entry.decision, current);
          assert.equal(entry.assessment.coverage.population, terminal ? "closed" : "open");
          assert.equal(simulateMargins(entry, facts).proposedDecision, proposed);
        });
      });
    }
    await check("admission remains default-deny; PDF verification does not authorize production or change scope", async () => {
      const request = { purpose: "assessment-only", academicScope: syntheticScope, candidates: bindings };
      await assert.rejects(() => admitAssessmentBatch(request), (error) => error.code === "unknown-execution-id");
      const realScopeRequest = structuredClone(request);
      realScopeRequest.academicScope.department.id = "industrial-engineering-unapproved";
      await assert.rejects(() => admitAssessmentBatch(realScopeRequest, bindings), (error) => error.code === "scope-mismatch");
      const admission = await admitAssessmentBatch(request, bindings);
      admission.bindings.forEach((binding) => assert.deepEqual(binding.admission.sourceVerification, { state: "registered-hash-only" }));
      assert.equal(admission.productionAuthorization, "not-granted");
      const syntheticBytes = Buffer.from("%PDF-1.7\nSynthetic transport only; no official SDU claim");
      const synthetic = structuredClone(bindings.slice(0, 1));
      synthetic[0].source = { ...synthetic[0].source, title: "Synthetic transport", url: "https://example.invalid/synthetic.pdf",
        frozenSourceSha256: digest(syntheticBytes), claim: "Not an SDU normative source" };
      const verified = await admitAssessmentBatch({ purpose: "assessment-only", academicScope: syntheticScope, candidates: synthetic,
        sourceArtifacts: [{ url: synthetic[0].source.url, pdfBytes: syntheticBytes }] }, synthetic);
      assert.equal(verified.bindings[0].admission.sourceVerification.state, "supplied-pdf-hash-match");
      assert.equal(verified.productionAuthorization, "not-granted");
    });
    for (const filename of ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"]) {
      await check(`${filename}: original eleven assessments/report and COMU scoring survive simulation`, async () => {
        const document = await readDocx(fs.readFileSync(path.join(directory, filename)));
        const legacyRules = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", facultyId: "applied-sciences",
          departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" }));
        assert.equal(legacyRules.length, 46);
        const engine = new RuleEngine(); const builder = new ReportBuilder();
        const legacyBefore = structuredClone(builder.build(engine.run(document, legacyRules)));
        const entries = runSections(document, new AssessmentExecutionService(undefined, pilots), rules);
        const admission = await admitAssessmentBatch({ purpose: "assessment-only", academicScope: syntheticScope, candidates: bindings }, bindings);
        const before = createAssessmentReport(entries, admission.bindings);
        const sectionEntry = entries.find((entry) => entry.ruleId === target.id);
        const result = simulateSection(sectionEntry, { rawText: null, hasUnapprovedIdentityCandidate: false });
        assert.throws(() => createAssessmentReport([result], admission.bindings), (error) => error.code === "invalid-execution");
        assert.deepEqual(createAssessmentReport(entries, admission.bindings), before);
        assert.deepEqual(JSON.parse(JSON.stringify(before)), before);
        assert.deepEqual(before.scoring, { mode: "unscored", legacyContribution: "none" });
        assert.deepEqual(builder.build(engine.run(document, legacyRules)), legacyBefore);
        assert.equal(before.records.length, 11);
      });
    }
    await check("corpus provenance remains synthetic; filenames/application metadata do not establish native authorship", () => {
      const origins = {};
      for (const fixture of manifest.fixtures) {
        origins[fixture.origin] = (origins[fixture.origin] ?? 0) + 1;
        assert.ok(fixture.createdWith);
      }
      assert.deepEqual(origins, { "synthetic-ooxml": 42 });
    });
    assert.ok(transitions["compliant -> undetermined"] > 0);
    assert.ok(transitions["violation -> undetermined"] > 0);
    assert.ok(transitions.unchanged > 0);
  } finally {
    for (const [filename, before] of hashes) assert.equal(digest(fs.readFileSync(path.join(directory, filename))), before, filename);
  }
  console.log(JSON.stringify({ audit: "sduConservativePolicySimulation", result: "PASS", cases, transitions,
    label: "test-only design simulation; original assessments unchanged", fixtureWrites: 0, temporaryFiles: 0,
    sourceReconciliation: "unverified", productionAuthorization: "not-granted" }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
