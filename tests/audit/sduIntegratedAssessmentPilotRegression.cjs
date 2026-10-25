const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runSections } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins, sduAssessmentReadiness: marginPolicy,
  runSduMarginAssessmentPilot: runMargins } = require("./sduMarginAssessmentPilot.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { AssessmentReadinessGate } = require("../../src/features/analysis/engine/AssessmentReadinessGate.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { normalizeDocumentNumbering } = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { resolveHeadingStyleProvenance } = require("../../src/features/analysis/parsers/headingStyleProvenance.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");

// Compose existing admitted candidates only. Do not merge the margin policy's
// historical deferred section records into this independent integration scope.
const candidates = [...sections.candidates, ...margins.candidates];
const rules = candidates.map((candidate) => candidate.rule);
const fixtureDirectory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const filenames = ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"];
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const policyBefore = JSON.stringify([sections, margins, marginPolicy]);
let cases = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }

// Test-only runner: reuse section qualification and execute all eleven rules in
// one service call. Preserve entries verbatim; never turn them into RuleResults.
function runIntegrated(document, executor = new AssessmentExecutionService(undefined, candidates), requested = rules) {
  const seen = new Set();
  for (const rule of requested) {
    assert.equal(seen.has(rule.id), false, `Duplicate execution ID: ${rule.id}`);
    seen.add(rule.id);
  }
  return runSections(document, executor, requested).map((entry) => {
    const candidate = candidates.find((item) => item.rule.id === entry.ruleId);
    const source = candidate?.rule.type === "REQUIRED_SECTION" ? sections.source : margins.source;
    return {
      inventoryId: candidate?.inventoryId ?? null,
      executionId: entry.ruleId,
      contract: candidate?.rule ?? null,
      source: candidate ? { ...source, references: candidate.references ?? [{ section: source.section, printedPage: source.printedPage }] } : null,
      extractionCoverage: document.sectionExtractionCoverage,
      pageSectionInventory: document.pageSections.map(({ index, source }) => ({ index, source })),
      entry,
    };
  });
}

function entries(rows) { return rows.map((row) => row.entry); }
function decisions(rows) { return entries(rows).map((entry) => entry.decision); }
function byId(rows) { return Object.fromEntries(rows.map((row) => [row.executionId, row])); }
function assertAssessment(entry) {
  assert.equal(entry.kind, "assessment", JSON.stringify(entry));
  assert.equal(entry.assessment.reference.id, entry.ruleId);
  assert.equal(entry.assessment.applicability.state, "applicable");
  assert.ok(["compliant", "violation", "undetermined"].includes(entry.decision));
  for (const key of ["status", "passed", "score"]) assert.equal(Object.hasOwn(entry, key), false);
}

function reparse(xml, original) {
  return normalizeDocumentNumbering({ ...parseDocumentXml(xml), styles: original.styles,
    documentDefaults: original.documentDefaults, numberingDefinitions: original.numberingDefinitions });
}

async function main() {
  const fixtureHashes = new Map(filenames.map((name) => [name, digest(fs.readFileSync(path.join(fixtureDirectory, name)))]));
  try {
    await check("exact eleven inventory/execution bindings, nine sections and two margins", () => {
      assert.equal(candidates.length, 11);
      assert.equal(new Set(rules.map((rule) => rule.id)).size, 11);
      assert.equal(new Set(candidates.map((candidate) => candidate.inventoryId)).size, 11);
      assert.deepEqual(candidates.map(({ inventoryId, rule }) => [inventoryId, rule.id]), [
        ["SDU-INV-SEC-13", "pilot.sdu.2026.section.introduction.presence"],
        ["SDU-INV-SEC-07", "pilot.sdu.2026.section.summary.presence"],
        ["SDU-INV-SEC-08", "pilot.sdu.2026.section.abstract.presence"],
        ["SDU-INV-SEC-03", "pilot.sdu.2026.section.thesis-approval.presence"],
        ["SDU-INV-SEC-05", "pilot.sdu.2026.section.undertaking.presence"],
        ["SDU-INV-SEC-09", "pilot.sdu.2026.section.acknowledgements.presence"],
        ["SDU-INV-SEC-14", "pilot.sdu.2026.section.literature-summaries.presence"],
        ["SDU-INV-SEC-19", "pilot.sdu.2026.section.impact-value-usability.presence"],
        ["SDU-INV-SEC-22", "pilot.sdu.2026.section.curriculum-vitae.presence"],
        ["SDU-INV-LAY-05", "pilot.sdu.2026.margin.top"],
        ["SDU-INV-LAY-06", "pilot.sdu.2026.margin.bottom"],
      ]);
      assert.deepEqual(rules.map((rule) => rule.type), [...Array(9).fill("REQUIRED_SECTION"), "MARGIN_TOP", "MARGIN_BOTTOM"]);
      for (const candidate of candidates) assert.equal(candidate.readiness, "assessment-ready");
    });
    await check("frozen source provenance, exact names, printed references and unscored contracts", () => {
      for (const source of [sections.source, margins.source]) {
        assert.equal(source.url, "https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf");
        assert.equal(source.frozenSourceSha256, "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44");
      }
      const names = ["Giriş", "Özet", "Abstract", "Tez Onayı", "Taahhütname", "Teşekkür", "Kaynak Özetleri", "Yaygın Etki/Katma Değer/Kullanılabilirlik", "Özgeçmiş"];
      const items = [13, 7, 8, 3, 5, 9, 14, 19, 22];
      const references = [["4.2", 16], ["4.1", 16], ["4.1", 16], null, null, null, ["4.3", 16], ["4.8", 17, 18], ["4.11", 19]];
      sections.candidates.forEach((candidate, index) => {
        assert.deepEqual(candidate.rule.expected, { section: names[index], required: true });
        const reference = references[index];
        assert.deepEqual(candidate.references, [{ section: "1", printedPage: 3, item: items[index] },
          ...(reference ? reference.slice(1).map((printedPage) => ({ section: reference[0], printedPage })) : [])]);
      });
      assert.equal(margins.source.section, "2.2");
      assert.equal(margins.source.printedPage, 4);
      for (const candidate of margins.candidates) assert.deepEqual(candidate.rule.expected, { value: 2.5, unit: "cm" });
      for (const rule of rules) assert.equal(rule.score, 0);
    });

    for (const filename of filenames) {
      // The filename selects bytes only. Evidence assertions below are identical
      // for both packages and inspect OOXML, semantic identity and observations.
      const bytes = fs.readFileSync(path.join(fixtureDirectory, filename));
      const zip = await JSZip.loadAsync(bytes);
      const xml = await zip.file("word/document.xml").async("string");
      const stylesXml = await zip.file("word/styles.xml").async("string");
      const document = await readDocx(bytes);
      const before = JSON.stringify(document);
      const baseline = runIntegrated(document);

      await check(`${filename}: disk OOXML to eleven independent assessments`, () => {
        assert.equal(baseline.length, 11);
        assert.deepEqual(decisions(baseline), ["compliant", "undetermined", "undetermined", "violation", "violation", "undetermined", "violation", "violation", "undetermined", "violation", "compliant"]);
        const qualified = normalizeAcademicSections(markRequiredSectionHeadings(document, rules), rules);
        const paragraphXml = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/gu);
        const rawMargins = xml.match(/<w:pgMar\b[^>]*>/gu);
        assert.equal(rawMargins.length, document.pageSections.length);
        for (const [index, row] of baseline.entries()) {
          const { assessment } = row.entry;
          assertAssessment(row.entry);
          assert.strictEqual(row.contract, rules[index]);
          assert.equal(row.inventoryId, candidates[index].inventoryId);
          assert.equal(assessment.coverage.population, "closed");
          assert.ok(assessment.observations.length > 0);
          let ooxml;
          if (index < 9) {
            const occurrences = qualified.academicSections.occurrences.filter((item) => item.canonicalName === row.contract.expected.section);
            if ([3, 4, 6, 7].includes(index)) {
              assert.equal(occurrences.length, 0);
              assert.equal(xml.toLocaleLowerCase("tr-TR").includes(row.contract.expected.section.toLocaleLowerCase("tr-TR")), false);
              assert.equal(assessment.observations[0].finding, "violation");
              ooxml = { matchingParagraph: null, structuralIdentity: "no matching occurrence" };
            } else {
              assert.equal(occurrences.length, 1);
              const occurrence = occurrences[0];
              const paragraph = document.paragraphs[occurrence.headingParagraphIndex];
              const raw = paragraphXml.find((item) => item.includes(`<w:t>${paragraph.text}</w:t>`));
              assert.ok(raw);
              assert.equal(paragraph.id, ["paragraph-21", "paragraph-7", "paragraph-10", null, null, "paragraph-5", null, null, "paragraph-46"][index]);
              assert.equal(paragraph.styleId, index === 0 ? "Heading1" : null);
              assert.equal(paragraph.outlineLevel, undefined);
              assert.equal(/<w:pStyle\b/u.test(raw), index === 0);
              assert.equal(/<w:outlineLvl\b/u.test(raw), false);
              assert.equal(occurrence.structuralIdentity.certainty, index === 0 ? "confirmed" : "unresolved");
              assert.equal(assessment.observations[0].identity.certainty, occurrence.structuralIdentity.certainty);
              assert.equal(assessment.observations[0].evidence.certainty, "sufficient");
              assert.ok(assessment.observations[0].evidence.items.some((proof) => proof.paragraphId === paragraph.id));
              const provenance = resolveHeadingStyleProvenance(document, paragraph);
              assert.deepEqual(provenance.styleIds, index === 0 ? ["Heading1", "Normal"] : ["Normal"]);
              const styleDefinitions = (stylesXml.match(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/gu) ?? [])
                .filter((definition) => provenance.styleIds.some((id) => definition.includes(`w:styleId="${id}"`)));
              assert.equal(styleDefinitions.length, provenance.styleIds.length);
              ooxml = { paragraphXml: raw, styleDefinitions, provenance, structuralIdentity: occurrence.structuralIdentity };
            }
          } else {
            const side = index === 9 ? "top" : "bottom";
            assert.equal(assessment.observations.length, document.pageSections.length);
            assessment.observations.forEach((observation, sectionIndex) => {
              assert.equal(observation.subject.sectionIndex, document.pageSections[sectionIndex].index);
              assert.equal(observation.identity.certainty, "not-required");
              assert.equal(observation.evidence.certainty, "sufficient");
              assert.equal(observation.evidence.items[0].actual, document.pageSections[sectionIndex].pageMargins[side]);
              assert.ok(rawMargins[sectionIndex].includes(`w:${side}="${side === "top" ? "1701" : "1417"}"`));
              assert.equal(observation.finding, side === "top" ? "violation" : "compliant");
            });
            ooxml = { rawMargins, pageSections: document.pageSections };
          }
          console.log(JSON.stringify({ docx: filename, sha256: digest(bytes), ...row, ooxml }));
        }
      });
      await check(`${filename}: mixed decisions and standalone pilot parity`, () => {
        assert.deepEqual(entries(baseline).slice(0, 9), runSections(document));
        assert.deepEqual(entries(baseline).slice(9), runMargins(document));
        assert.equal(baseline[0].entry.decision, "compliant");
        assert.equal(baseline[1].entry.decision, "undetermined");
        assert.equal(baseline[3].entry.decision, "violation");
        for (const rule of rules) {
          assert.deepEqual(runIntegrated(document, undefined, [rule])[0].entry.decision, baseline.find((row) => row.executionId === rule.id).entry.decision);
        }
      });
      await check(`${filename}: section coverage opens without changing either margin`, () => {
        const changed = reparse(xml.replace("</w:body>", "<w:altChunk/></w:body>"), document);
        const rows = runIntegrated(changed);
        assert.equal(changed.sectionExtractionCoverage.population, "open");
        rows.slice(0, 9).forEach((row) => {
          assert.equal(row.entry.assessment.coverage.population, "open");
          assert.equal(row.entry.decision, "undetermined");
        });
        assert.deepEqual(entries(rows).slice(9), entries(baseline).slice(9));
      });
      await check(`${filename}: missing margin evidence preserves all section assessments`, () => {
        const changed = reparse(xml.replace(/<w:pgMar\b[^>]*\/>/gu, ""), document);
        assert.ok(changed.pageSections.every((section) => section.pageMargins.top === null && section.pageMargins.bottom === null));
        const rows = runIntegrated(changed);
        assert.deepEqual(entries(rows).slice(0, 9), entries(baseline).slice(0, 9));
        rows.slice(9).forEach((row) => {
          assert.equal(row.entry.decision, "undetermined");
          assert.ok(row.entry.assessment.observations.every((item) => item.evidence.certainty === "missing"));
        });
      });
      await check(`${filename}: order-independent results and duplicate request rejection`, () => {
        for (const requested of [[...rules].reverse(), [...rules.slice(9), ...rules.slice(0, 9)]]) {
          assert.deepEqual(byId(runIntegrated(document, undefined, requested)), byId(baseline));
        }
        const executor = new AssessmentExecutionService(undefined, candidates);
        executor.run = () => { throw new Error("Duplicate requests must not reach execution"); };
        assert.throws(() => runIntegrated(document, executor, [...rules, rules[0]]), /Duplicate execution ID/u);
      });
      await check(`${filename}: unknown, deferred and mismatched contracts rejected before lookup`, () => {
        const deferred = { ...rules[0], id: "audit.sdu.deferred-section" };
        const unknown = { ...rules[0], id: "unknown.sdu.section" };
        const mismatch = { ...rules[0], expected: { section: "Unsupported alias", required: true } };
        const registry = new ValidatorRegistry();
        const lookup = registry.getValidator.bind(registry);
        const calls = [];
        registry.getValidator = (rule) => { calls.push(rule); return lookup(rule); };
        const service = new AssessmentExecutionService(registry, [...candidates, { inventoryId: "SDU-INV-SEC-06", readiness: "deferred", rule: deferred }]);
        const rows = runIntegrated(document, service, [unknown, deferred, mismatch, ...rules.slice(1)]);
        assert.deepEqual(entries(rows).slice(0, 3).map((entry) => [entry.kind, entry.code]), [["rejected", "unknown-rule"], ["rejected", "not-assessment-ready"], ["rejected", "rule-contract-mismatch"]]);
        assert.deepEqual(calls, rules.slice(1));
        assert.deepEqual(entries(rows).slice(3), entries(baseline).slice(1));
        const gate = new AssessmentReadinessGate(candidates);
        for (const candidate of candidates) {
          assert.equal(gate.check(candidate.rule), null);
          assert.equal(gate.check({ ...candidate.rule, id: candidate.inventoryId }).code, "unknown-rule");
        }
      });
      await check(`${filename}: duplicate readiness is ambiguous and leaves ten other pilots intact`, () => {
        const service = new AssessmentExecutionService(undefined, [...candidates, candidates[0]]);
        const rows = runIntegrated(document, service);
        assert.equal(rows[0].entry.kind, "rejected");
        assert.equal(rows[0].entry.code, "ambiguous-readiness");
        assert.deepEqual(entries(rows).slice(1), entries(baseline).slice(1));
      });
      await check(`${filename}: all service error variants preserve the other ten entries`, () => {
        for (const target of [rules[0], rules[9]]) {
          for (const code of ["runtime-error", "missing-assess", "missing-validator", "invalid-assessment"]) {
            const registry = new ValidatorRegistry();
            const lookup = registry.getValidator.bind(registry);
            registry.getValidator = (rule) => rule.id !== target.id ? lookup(rule)
              : code === "missing-validator" ? undefined
                : { validate() { throw new Error("No legacy fallback"); }, ...(code === "missing-assess" ? {} : {
                  assess() { if (code === "runtime-error") throw new Error("Isolated test fault"); return {}; },
                }) };
            const rows = runIntegrated(document, new AssessmentExecutionService(registry, candidates));
            const failed = rows.find((row) => row.executionId === target.id).entry;
            assert.equal(failed.kind, "error");
            assert.equal(failed.code, code);
            assert.equal(Object.hasOwn(failed, "decision"), false);
            assert.deepEqual(rows.filter((row) => row.executionId !== target.id), baseline.filter((row) => row.executionId !== target.id));
          }
        }
      });
      await check(`${filename}: four-way transport remains lossless; N/A is a transport-only stub`, () => {
        // Explicitly synthetic transport evidence, never an SDU applicability claim.
        const target = rules[10];
        const evidence = [{ kind: "document-format", property: "transport-test-only", actual: true }];
        for (const decision of ["compliant", "violation", "undetermined", "not-applicable"]) {
          const assessment = decision === "not-applicable"
            ? { reference: { kind: "rule", id: target.id }, applicability: { state: "not-applicable", reason: "Synthetic transport stub only; no SDU applicability assertion.", evidence } }
            : { reference: { kind: "rule", id: target.id }, applicability: { state: "applicable", evidence }, coverage: { population: "closed", excludedSubjects: [] }, observations: [decision === "undetermined"
              ? { state: "undetermined", subject: { kind: "document" }, identity: { certainty: "unresolved", reason: "Transport stub" }, evidence: { certainty: "sufficient", items: evidence } }
              : { state: "confirmed", subject: { kind: "document" }, identity: { certainty: "not-required" }, evidence: { certainty: "sufficient", items: evidence }, finding: decision }] };
          const registry = new ValidatorRegistry();
          const lookup = registry.getValidator.bind(registry);
          registry.getValidator = (rule) => rule.id === target.id ? { assess: () => assessment, validate() { throw new Error("No fallback"); } } : lookup(rule);
          const rows = runIntegrated(document, new AssessmentExecutionService(registry, candidates));
          assert.equal(rows[10].entry.decision, decision);
          assert.strictEqual(rows[10].entry.assessment, assessment);
          for (const key of ["status", "passed", "score"]) assert.equal(Object.hasOwn(rows[10].entry, key), false);
          assert.deepEqual(rows.slice(0, 10), baseline.slice(0, 10));
        }
      });
      await check(`${filename}: one service batch, no legacy validate, no input or policy mutation`, () => {
        const registry = new ValidatorRegistry();
        const lookup = registry.getValidator.bind(registry);
        const calls = [];
        registry.getValidator = (rule) => {
          const validator = lookup(rule);
          return { assess(doc, requested) { calls.push(requested.id); return validator.assess(doc, requested); },
            validate() { throw new Error("Integrated pilot must never invoke validate"); } };
        };
        const executor = new AssessmentExecutionService(registry, candidates);
        const run = executor.run.bind(executor);
        let batches = 0;
        executor.run = (doc, requested) => { batches++; return run(doc, requested); };
        assert.deepEqual(runIntegrated(document, executor), baseline);
        assert.equal(batches, 1);
        assert.deepEqual(calls, rules.map((rule) => rule.id));
        assert.equal(JSON.stringify(document), before);
        assert.equal(JSON.stringify([sections, margins, marginPolicy]), policyBefore);
      });
      await check(`${filename}: production discovery, COMU 46/47 metadata and legacy reports unchanged`, () => {
        const sets = loadAvailableRuleSets();
        assert.equal(sets.some((set) => set.metadata.university.id === "sdu"), false);
        const productionIds = new Set(sets.flatMap((set) => set.rules.map((rule) => rule.id)));
        for (const candidate of candidates) {
          assert.equal(productionIds.has(candidate.inventoryId), false);
          assert.equal(productionIds.has(candidate.rule.id), false);
        }
        for (const selection of [{ facultyId: "applied-sciences", departmentId: "food-technology", studyTypeId: "experimental" }, { facultyId: "engineering", departmentId: "computer-engineering" }]) {
          const resolved = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", thesisTypeId: "bachelor", ...selection }));
          const food = selection.departmentId === "food-technology";
          assert.equal(resolved.length, food ? 46 : 47);
          const counts = (key) => resolved.reduce((acc, rule) => ({ ...acc, [rule.validation[key]]: (acc[rule.validation[key]] ?? 0) + 1 }), {});
          assert.deepEqual(counts("coverage"), food ? { COMPLETE: 45, PARTIAL: 1 } : { COMPLETE: 33, PARTIAL: 14 });
          assert.deepEqual(counts("trust"), food ? { HIGH: 45, MEDIUM: 1 } : { HIGH: 33, MEDIUM: 14 });
          const engine = new RuleEngine();
          const builder = new ReportBuilder();
          const legacy = engine.run(document, resolved);
          const report = builder.build(legacy);
          assert.deepEqual(runIntegrated(document), baseline);
          assert.deepEqual(engine.run(document, resolved), legacy);
          assert.deepEqual(builder.build(legacy), report);
        }
        assert.equal(JSON.stringify(document), before);
      });
    }
  } finally {
    for (const [filename, before] of fixtureHashes) assert.equal(digest(fs.readFileSync(path.join(fixtureDirectory, filename))), before);
  }
  console.log(JSON.stringify({ audit: "sduIntegratedAssessmentPilot", result: "PASS", cases, pilots: 11,
    sectionPilots: 9, marginPilots: 2, diskPackages: 2, fixtureWrites: 0, temporaryFiles: 0,
    source: "Previously frozen provenance; no fresh source hash verification", corpus: "Synthetic OOXML; not Word-native or SDU student documents" }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
