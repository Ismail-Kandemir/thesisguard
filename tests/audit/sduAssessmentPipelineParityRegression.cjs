const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { analyzeDocx, createNormalizedDocumentFromDocx } = require("../../src/features/analysis/analysisService.ts");
const { readDocxAnalysisXmlParts } = require("../../src/features/analysis/readers/docxPackageReader.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { resolveHeadingStyleProvenance } = require("../../src/features/analysis/parsers/headingStyleProvenance.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { admitAssessmentBatch, AssessmentAdmissionError } = require("../../src/features/analysis/engine/AssessmentAdmission.ts");
const { createAssessmentReport, AssessmentReportContractError } = require("../../src/features/analysis/report/AssessmentReport.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readPilot,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");

const pilots = [...sections.candidates, ...margins.candidates];
const rules = pilots.map((candidate) => candidate.rule);
// Test scope only. This is not a verified SDU department, degree or work type.
const syntheticScope = { university: { id: "sdu" }, faculty: { id: "engineering" },
  department: { id: "synthetic-department-not-a-source-claim" }, programLevel: { id: "synthetic-level" },
  workType: { id: "synthetic-work-type" } };
const policy = pilots.map((candidate) => {
  const source = candidate.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
  return { inventoryId: candidate.inventoryId, executionId: candidate.rule.id, contract: candidate.rule,
    readiness: candidate.readiness, academicScope: syntheticScope,
    source: { kind: "frozen-source", title: source.title, url: source.url, frozenSourceSha256: source.frozenSourceSha256,
      claim: source.claim, references: candidate.references ?? [{ section: source.section, printedPage: source.printedPage }] } };
});
const selection = { universityId: "comu", facultyId: "applied-sciences", departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" };
const fixtureDirectory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const filenames = ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const roundTrip = (value) => JSON.parse(JSON.stringify(value));
const changedKeys = (first, second) => [...new Set([...Object.keys(first), ...Object.keys(second)])]
  .filter((key) => JSON.stringify(first[key]) !== JSON.stringify(second[key]));
let cases = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }

// Same byte representation as existing Node DOCX audits; production upload
// validation and the real package reader both remain active.
function fileInput(bytes) {
  const file = new Uint8Array(bytes);
  Object.defineProperties(file, { name: { value: "parity-input.docx" }, size: { value: file.length },
    type: { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } });
  return file;
}

/** Capture the ACTUAL analyzeDocx normalization chain, not a copied pipeline.
 * Only test contracts are injected at rule resolution; the existing production
 * selection is not an SDU selection. Scoped instrumentation is always restored.
 */
async function productionPath(file) {
  const originalResolve = RuleResolver.prototype.resolve;
  const originalRun = RuleEngine.prototype.run;
  let document;
  let batches = 0;
  try {
    RuleResolver.prototype.resolve = () => rules;
    RuleEngine.prototype.run = function (normalized, requested) {
      assert.deepEqual(requested, rules);
      document = normalized;
      batches++;
      return originalRun.call(this, normalized, requested);
    };
    const legacyReport = await analyzeDocx(file, selection);
    assert.equal(batches, 1);
    return { document, legacyReport };
  } finally {
    RuleResolver.prototype.resolve = originalResolve;
    RuleEngine.prototype.run = originalRun;
  }
}

async function controlledReport(document, admissionRequest, trustedPolicy, makeExecutor) {
  const admission = await admitAssessmentBatch(admissionRequest, trustedPolicy);
  const readiness = admission.bindings.map((binding) => ({ inventoryId: binding.inventoryId,
    readiness: binding.admission.readiness, rule: binding.contract }));
  const executor = makeExecutor ? makeExecutor(readiness) : new AssessmentExecutionService(undefined, readiness);
  const executions = executor.run(document, admission.bindings.map((binding) => binding.contract));
  return createAssessmentReport(executions, admission.bindings);
}
const admissionRequest = () => ({ purpose: "assessment-only", academicScope: syntheticScope, candidates: policy });

function evidenceProjection(document) {
  return { paragraphs: document.paragraphs, styles: document.styles, documentDefaults: document.documentDefaults,
    numberingDefinitions: document.numberingDefinitions, blocks: document.blocks, sections: document.sections,
    pageMargins: document.pageMargins, pageSections: document.pageSections, extractionCoverage: document.sectionExtractionCoverage };
}

function subjectEvidence(document, rule) {
  if (rule.type !== "REQUIRED_SECTION") {
    const side = rule.type === "MARGIN_TOP" ? "top" : "bottom";
    return { margins: document.pageSections.map((section) => ({ index: section.index, source: section.source, value: section.pageMargins[side] })) };
  }
  return document.academicSections.occurrences.filter((item) => item.canonicalName === rule.expected.section)
    .map((occurrence) => ({ identity: occurrence.identity, paragraphId: occurrence.headingParagraphId,
      boundary: occurrence.boundary, structuralIdentity: occurrence.structuralIdentity,
      headingProvenance: resolveHeadingStyleProvenance(document, document.paragraphs[occurrence.headingParagraphIndex]) }));
}

async function comparePaths(bytes) {
  const file = fileInput(bytes);
  const parts = await readDocxAnalysisXmlParts(file);
  const productionBase = await createNormalizedDocumentFromDocx(file);
  const pilotBase = await readPilot(file);
  assert.deepEqual(evidenceProjection(productionBase), evidenceProjection(pilotBase));
  const production = await productionPath(file);
  const pilotDocument = normalizeAcademicSections(markRequiredSectionHeadings(pilotBase, rules), rules);
  const baselineDocument = JSON.stringify(production.document);
  const a = await controlledReport(production.document, admissionRequest(), policy);
  const b = await controlledReport(pilotDocument, admissionRequest(), policy);
  assert.deepEqual(a, b);
  // One normalized document is also shared by both legacy and assessment paths.
  assert.deepEqual(new RuleEngine().run(production.document, rules), production.legacyReport.results);
  assert.deepEqual(runSections(production.document, new AssessmentExecutionService(undefined, pilots), rules), a.records.map((record) => record.execution));
  assert.equal(JSON.stringify(production.document), baselineDocument);
  const scopeDifferences = [];
  for (const rule of rules) {
    assert.deepEqual(subjectEvidence(production.document, rule), subjectEvidence(pilotDocument, rule));
    const occurrences = production.document.academicSections.occurrences.filter((item) => item.canonicalName === rule.expected.section);
    for (const occurrence of occurrences) {
      const peer = pilotDocument.academicSections.occurrences.find((item) => item.headingParagraphId === occurrence.headingParagraphId);
      assert.ok(peer);
      const differences = changedKeys(occurrence, peer);
      assert.ok(differences.every((key) => key === "scope"), JSON.stringify(differences));
      if (differences.length > 0) scopeDifferences.push(occurrence.headingParagraphId);
    }
  }
  const classifications = {
    "parser/normalizer divergence": { baseFields: changedKeys(productionBase, pilotBase),
      normalizedFields: changedKeys(production.document, pilotDocument), relevantEvidenceEqual: true },
    "semantic qualification divergence": { scopeAnnotationDifferences: scopeDifferences, structuralIdentityAndHeadingProvenanceEqual: true },
    "legacy validate versus assess divergence": a.records.map((record, index) => ({ inventoryId: record.inventoryId,
      executionId: record.executionId, legacyStatus: production.legacyReport.results[index].status, assessmentDecision: record.execution.decision })),
    "admission/report metadata divergence": { equal: true, productionAuthorization: "not-granted", scope: "synthetic test scope only" },
  };
  return { ...production, parts, report: a, classifications };
}

async function memoryVariant(bytes, transform) {
  const zip = await JSZip.loadAsync(bytes);
  const original = await zip.file("word/document.xml").async("string");
  const changed = transform(original);
  assert.notEqual(changed, original);
  zip.file("word/document.xml", changed);
  return zip.generateAsync({ type: "uint8array" });
}

async function main() {
  const fixtureHashes = new Map(filenames.map((name) => [name, hash(fs.readFileSync(path.join(fixtureDirectory, name)))]));
  const policyBefore = JSON.stringify([sections, margins, policy]);
  try {
    for (const filename of filenames) {
      const bytes = fs.readFileSync(path.join(fixtureDirectory, filename));
      const genuineLegacyBefore = await analyzeDocx(fileInput(bytes), selection);
      let baseline;
      await check(`${filename}: production and controlled pipeline parity for eleven mapped pilots`, async () => {
        baseline = await comparePaths(bytes);
        assert.equal(baseline.report.records.length, 11);
        assert.equal(new Set(baseline.report.records.map((record) => record.executionId)).size, 11);
        assert.deepEqual(baseline.report.records.map((record) => record.execution.decision),
          ["compliant", "undetermined", "undetermined", "violation", "violation", "undetermined", "violation", "violation", "undetermined", "violation", "compliant"]);
        assert.deepEqual(baseline.classifications["parser/normalizer divergence"].baseFields.sort(),
          ["pageNumbering", "objectReferences", "abbreviations", "coverSemantics", "themeFonts"].sort());
        assert.equal(baseline.classifications["semantic qualification divergence"].scopeAnnotationDifferences.length, 5);
        console.log(JSON.stringify({ docx: filename, classifications: baseline.classifications }));
        const rawParagraphs = baseline.parts.documentXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/gu);
        for (const [index, record] of baseline.report.records.entries()) {
          assert.equal(record.inventoryId, pilots[index].inventoryId);
          assert.equal(record.executionId, rules[index].id);
          assert.deepEqual(record.contract, rules[index]);
          assert.deepEqual(record.source, policy[index].source);
          assert.equal(record.admission.sourceVerification.state, "registered-hash-only");
          assert.equal(record.execution.assessment.applicability.state, "applicable");
          assert.equal(record.execution.assessment.coverage.population, "closed");
          const evidence = subjectEvidence(baseline.document, record.contract);
          let ooxml;
          if (index < 9) {
            const matchingParagraphs = evidence.map((item) => {
              const paragraph = baseline.document.paragraphs.find((paragraph) => paragraph.id === item.paragraphId);
              const paragraphXml = rawParagraphs.find((raw) => raw.includes(`<w:t>${paragraph.text}</w:t>`));
              assert.ok(paragraphXml);
              const styleDefinitions = (baseline.parts.stylesXml.match(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/gu) ?? [])
                .filter((raw) => item.headingProvenance.styleIds.some((id) => raw.includes(`w:styleId="${id}"`)));
              return { paragraphXml, styleDefinitions, paragraphId: paragraph.id, ...item };
            });
            if (matchingParagraphs.length === 0) {
              assert.equal(record.execution.assessment.observations[0].finding, "violation");
              assert.equal(baseline.parts.documentXml.toLocaleLowerCase("tr-TR").includes(record.contract.expected.section.toLocaleLowerCase("tr-TR")), false);
            }
            ooxml = { matchingParagraphs, sectionIdentity: matchingParagraphs.length > 0 ? "see structural evidence" : "no matching occurrence in closed coverage" };
          } else {
            ooxml = { pageMarginsXml: baseline.parts.documentXml.match(/<w:pgMar\b[^>]*>/gu), ...evidence };
          }
          console.log(JSON.stringify({ docx: filename, ...record,
            extractionCoverage: baseline.document.sectionExtractionCoverage, ooxml }));
        }
      });
      await check(`${filename}: known semantic differences are retained on the same normalized document`, () => {
        const [intro, summary, , missing] = baseline.report.records;
        assert.equal(intro.execution.decision, "compliant");
        assert.equal(intro.execution.assessment.observations[0].identity.certainty, "confirmed");
        assert.equal(summary.execution.decision, "undetermined");
        assert.equal(baseline.legacyReport.results[1].status, "PASSED");
        assert.equal(summary.execution.assessment.observations[0].identity.certainty, "unresolved");
        assert.equal(missing.execution.decision, "violation");
        assert.equal(missing.execution.assessment.coverage.population, "closed");
        assert.equal(missing.execution.assessment.observations[0].finding, "violation");
      });
      await check(`${filename}: missing margin OOXML yields legacy FAILED and assessment undetermined`, async () => {
        const variant = await memoryVariant(bytes, (xml) => xml.replace(/<w:pgMar\b[^>]*\/>/gu, (raw) => raw.replace(/\s+w:top="[^"]*"/u, "")));
        const compared = await comparePaths(variant);
        assert.equal(compared.legacyReport.results[9].status, "FAILED");
        assert.equal(compared.report.records[9].execution.decision, "undetermined");
        assert.ok(compared.report.records[9].execution.assessment.observations.every((item) => item.evidence.certainty === "missing"));
        assert.deepEqual(compared.report.records.filter((_, index) => index !== 9), baseline.report.records.filter((_, index) => index !== 9));
      });
      await check(`${filename}: open extraction coverage stays undetermined and margins stay independent`, async () => {
        const variant = await memoryVariant(bytes, (xml) => xml.replace("</w:body>", "<w:altChunk/></w:body>"));
        const compared = await comparePaths(variant);
        assert.equal(compared.document.sectionExtractionCoverage.population, "open");
        compared.report.records.slice(0, 9).forEach((record) => {
          assert.equal(record.execution.decision, "undetermined");
          assert.equal(record.execution.assessment.coverage.population, "open");
        });
        assert.deepEqual(compared.report.records.slice(9), baseline.report.records.slice(9));
      });
      await check(`${filename}: runtime/missing-assess/invalid-assessment errors and gate rejection preserve other ten records`, async () => {
        for (const target of [rules[0], rules[9]]) {
          for (const code of ["runtime-error", "missing-assess", "invalid-assessment", "unknown-rule"]) {
            const report = await controlledReport(baseline.document, admissionRequest(), policy, (readiness) => {
              const registry = new ValidatorRegistry(); const lookup = registry.getValidator.bind(registry);
              if (code !== "unknown-rule") registry.getValidator = (rule) => rule.id !== target.id ? lookup(rule)
                : { validate() { throw new Error("No legacy fallback"); }, ...(code === "missing-assess" ? {} : {
                  assess() { if (code === "runtime-error") throw new Error("Synthetic isolated validator fault"); return {}; },
                }) };
              return new AssessmentExecutionService(registry, code === "unknown-rule" ? readiness.filter((item) => item.rule.id !== target.id) : readiness);
            });
            const failed = report.records.find((record) => record.executionId === target.id).execution;
            assert.equal(failed.kind, code === "unknown-rule" ? "rejected" : "error");
            assert.equal(failed.code, code);
            assert.equal(Object.hasOwn(failed, "decision"), false);
            assert.deepEqual(report.records.filter((record) => record.executionId !== target.id), baseline.report.records.filter((record) => record.executionId !== target.id));
            assert.deepEqual(roundTrip(report), report);
          }
        }
      });
      await check(`${filename}: admission/default-deny and duplicate failures never become academic findings`, async () => {
        let executorConstructions = 0;
        const mustNotExecute = () => { executorConstructions++; throw new Error("Admission rejection must precede execution"); };
        const before = roundTrip(baseline.report);
        for (const [request, trusted, expectedCode] of [
          [admissionRequest(), [], "unknown-execution-id"],
          [{ ...admissionRequest(), academicScope: { university: { id: "sdu" }, faculty: { id: "engineering" } } }, [], "missing-academic-scope"],
          [{ ...admissionRequest(), candidates: [...policy, policy[0]] }, policy, "duplicate-readiness-metadata"],
        ]) {
          await assert.rejects(() => controlledReport(baseline.document, request, trusted, mustNotExecute),
            (error) => error instanceof AssessmentAdmissionError && error.code === expectedCode && !Object.hasOwn(error, "decision"));
        }
        assert.equal(executorConstructions, 0);
        // Admission and report batch rejection are atomic. Existing successful
        // records remain intact; invalid duplicates are not silently filtered.
        const admission = await admitAssessmentBatch(admissionRequest(), policy);
        const entries = baseline.report.records.map((record) => record.execution);
        assert.throws(() => createAssessmentReport([...entries, entries[0]], admission.bindings),
          (error) => error instanceof AssessmentReportContractError && error.code === "duplicate-execution-id");
        const independentTen = await controlledReport(baseline.document, { ...admissionRequest(), candidates: policy.slice(1) }, policy);
        assert.deepEqual(independentTen.records, baseline.report.records.slice(1));
        assert.deepEqual(baseline.report, before);
        assert.deepEqual(createAssessmentReport(entries, admission.bindings), baseline.report);
      });
      await check(`${filename}: report metadata/round-trip, unscored status and genuine COMU score invariance`, async () => {
        assert.deepEqual(roundTrip(baseline.report), baseline.report);
        assert.deepEqual(baseline.report.scoring, { mode: "unscored", legacyContribution: "none" });
        assert.ok(baseline.report.records.every((record) => record.admission.productionAuthorization === "not-granted"));
        for (const key of ["score", "passedRules", "failedRules", "results"]) assert.equal(Object.hasOwn(baseline.report, key), false);
        assert.deepEqual(await analyzeDocx(fileInput(bytes), selection), genuineLegacyBefore);
        const builder = new ReportBuilder();
        assert.deepEqual(builder.build(baseline.legacyReport.results).score, baseline.legacyReport.score);
        for (const selected of [selection, { universityId: "comu", facultyId: "engineering", departmentId: "computer-engineering", thesisTypeId: "bachelor" }]) {
          const resolved = new RuleResolver().resolve(new RuleSetSelector().select(selected));
          assert.equal(resolved.length, selected.departmentId === "food-technology" ? 46 : 47);
        }
      });
    }
    await check("synthetic transport only: all four decisions survive pipeline document, executor and report", async () => {
      const bytes = fs.readFileSync(path.join(fixtureDirectory, filenames[0]));
      const { document } = await productionPath(fileInput(bytes));
      const rule = { ...rules[0], id: "audit.synthetic.pipeline-transport" };
      const binding = { inventoryId: "SYNTHETIC-TRANSPORT-ONLY", executionId: rule.id, contract: rule,
        source: { kind: "synthetic-transport", label: "Synthetic four-way transport only; not an SDU source applicability claim." } };
      const proof = [{ kind: "document-format", property: "synthetic-transport-only", actual: true }];
      for (const decision of ["compliant", "violation", "undetermined", "not-applicable"]) {
        const assessment = decision === "not-applicable"
          ? { reference: { kind: "rule", id: rule.id }, applicability: { state: "not-applicable", reason: "Synthetic transport only; not source-based N/A.", evidence: proof } }
          : { reference: { kind: "rule", id: rule.id }, applicability: { state: "applicable", evidence: proof }, coverage: { population: "closed", excludedSubjects: [] }, observations: [decision === "undetermined"
            ? { state: "undetermined", subject: { kind: "document" }, identity: { certainty: "unresolved", reason: "Synthetic identity uncertainty" }, evidence: { certainty: "sufficient", items: proof } }
            : { state: "confirmed", subject: { kind: "document" }, identity: { certainty: "not-required" }, evidence: { certainty: "sufficient", items: proof }, finding: decision }] };
        const registry = new ValidatorRegistry([["REQUIRED_SECTION", { assess: () => assessment, validate() { throw new Error("No fallback"); } }]]);
        const executor = new AssessmentExecutionService(registry, [{ inventoryId: binding.inventoryId, readiness: "assessment-ready", rule }]);
        const entries = executor.run(document, [rule]);
        const report = createAssessmentReport(entries, [binding]);
        assert.equal(report.records[0].execution.decision, decision);
        assert.deepEqual(roundTrip(report).records[0].execution.assessment, assessment);
      }
    });
    assert.equal(JSON.stringify([sections, margins, policy]), policyBefore);
  } finally {
    for (const [filename, before] of fixtureHashes) assert.equal(hash(fs.readFileSync(path.join(fixtureDirectory, filename))), before);
  }
  console.log(JSON.stringify({ audit: "sduAssessmentPipelineParity", result: "PASS", cases, diskPackages: 2, pilots: 11,
    memoryVariants: 4, fixtureWrites: 0, temporaryFiles: 0, realScopeAdmission: "denied; unconfirmed", productionAuthorization: "not-granted",
    sourceVerification: "registered frozen hash only", corpus: "Synthetic OOXML, not real student validation" }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
