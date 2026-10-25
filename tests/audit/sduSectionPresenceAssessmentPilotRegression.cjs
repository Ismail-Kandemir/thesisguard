const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
require("../golden/experimentalGoldenRegression.cjs");
const { sduSectionPresenceAssessmentPilot: pilot, sduSectionPresencePilotReadiness: readiness,
  readSduSectionPresencePilotDocx: readDocx, runSduSectionPresenceAssessmentPilot: runPilot } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduAssessmentReadiness: marginPolicy } = require("./sduMarginAssessmentPilot.ts");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
const { normalizeDocumentNumbering } = require("../../src/features/analysis/parsers/documentNumberingNormalizer.ts");
const { AssessmentExecutionService } = require("../../src/features/analysis/engine/AssessmentExecutionService.ts");
const { AssessmentReadinessGate } = require("../../src/features/analysis/engine/AssessmentReadinessGate.ts");
const { ValidatorRegistry } = require("../../src/features/analysis/rules/ValidatorRegistry.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { ReportBuilder } = require("../../src/features/analysis/report/ReportBuilder.ts");
const { loadAvailableRuleSets } = require("../../src/features/analysis/rules/RuleLoader.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const rule = pilot.candidates[0].rule;
const p = (text = "Giriş", style = null, outline) => `<w:p><w:pPr>${style === null ? "" : `<w:pStyle w:val="${style}"/>`}${outline === undefined ? "" : `<w:outlineLvl w:val="${outline}"/>`}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const style = (id, name = id, basedOn = null, outline) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${basedOn === null ? "" : `<w:basedOn w:val="${basedOn}"/>`}${outline === undefined ? "" : `<w:pPr><w:outlineLvl w:val="${outline}"/></w:pPr>`}</w:style>`;
const genuine = style("Heading1", "Heading 1") + style("Heading2", "Heading 2");
function document(body = p("Giriş", "Heading1"), definitions = genuine) {
  const parsed = parseDocumentXml(`<w:document xmlns:w="${w}"><w:body>${body}</w:body></w:document>`);
  const styles = parseStylesXml(`<w:styles xmlns:w="${w}">${definitions}</w:styles>`);
  return normalizeDocumentNumbering({ ...parsed, styles: styles.styles, documentDefaults: styles.documentDefaults });
}
function result(document, expected, executor, requested = rule) {
  const entries = runPilot(document, executor, [requested]);
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.kind, "assessment", JSON.stringify(entry));
  assert.equal(entry.ruleId, requested.id);
  assert.equal(entry.assessment.reference.id, requested.id);
  assert.equal(entry.decision, expected);
  for (const key of ["status", "passed", "score"]) assert.equal(Object.hasOwn(entry, key), false);
  return entry;
}
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fixtureDirectory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const fixtureHashes = new Map();
const corpusResults = [];
let cases = 0;
async function check(label, run) { await run(); cases++; console.log(`PASS ${label}`); }

async function main() {
  const policyBefore = JSON.stringify(marginPolicy);
  await check("original inventory ID retains its execution ID and presence-only contract", () => {
    assert.equal(pilot.candidates[0].inventoryId, "SDU-INV-SEC-13");
    assert.equal(rule.id, "pilot.sdu.2026.section.introduction.presence");
    assert.notEqual(rule.id, pilot.candidates[0].inventoryId);
    assert.equal(rule.type, "REQUIRED_SECTION");
    assert.deepEqual(rule.expected, { section: "Giriş", required: true });
    assert.equal(rule.score, 0);
    assert.equal(readiness.length, 9);
    assert.equal(pilot.mode, "assessment-only");
  });
  await check("source provenance preserves both exact printed-page references and frozen hash", () => {
    assert.deepEqual(pilot.candidates[0].references, [{ section: "1", printedPage: 3, item: 13 }, { section: "4.2", printedPage: 16 }]);
    assert.equal(pilot.source.frozenSourceSha256, "f3920ac00da8e53994a01b8ee0faa728cb1bcde7ca022fc6337a9feeadf63a44");
    assert.equal(pilot.source.url, "https://muhendislik.sdu.edu.tr/assets/uploads/sites/152/files/bitirme-odevitasarim-projesi-dersleri-hazirlama-kilavuzu-06042026.pdf");
    assert.match(pilot.source.claim, /presence only/);
  });
  await check("gate explicitly accepts only the admitted full rule contract", () => {
    const gate = new AssessmentReadinessGate(readiness);
    assert.equal(gate.check(rule), null);
    assert.equal(gate.check({ ...rule, expected: { section: "Abstract", required: true } }).code, "rule-contract-mismatch");
    assert.equal(new AssessmentExecutionService().run(document(), [rule])[0].kind, "rejected");
  });
  await check("unknown and inventory-as-execution IDs are rejected before validator lookup", () => {
    const registry = new ValidatorRegistry();
    registry.getValidator = () => { throw new Error("Rejected rules must not reach lookup"); };
    const service = new AssessmentExecutionService(registry, readiness);
    for (const id of ["unknown.section", "SDU-INV-SEC-13", ...marginPolicy.filter((candidate) => candidate.inventoryId.startsWith("SDU-INV-SEC-") && candidate.inventoryId !== "SDU-INV-SEC-13").map((candidate) => candidate.inventoryId)]) {
      const entry = service.run(document(), [{ ...rule, id }])[0];
      assert.equal(entry.kind, "rejected");
      assert.equal(entry.code, "unknown-rule");
    }
  });
  await check("explicit deferred binding is rejected without executing it", () => {
    const rejectedRule = { ...rule, id: "audit.deferred-section" };
    const service = new AssessmentExecutionService(undefined, [...readiness, { inventoryId: "SDU-INV-SEC-06", readiness: "deferred", rule: rejectedRule }]);
    const entries = service.run(document(), [rejectedRule, rule]);
    assert.equal(entries[0].kind, "rejected");
    assert.equal(entries[0].code, "not-assessment-ready");
    assert.equal(entries[1].decision, "compliant");
  });
  await check("confirmed body heading with closed coverage is compliant without numbering anchors", () => {
    const doc = document();
    assert.equal(doc.headings.length, 0);
    const entry = result(doc, "compliant");
    assert.equal(entry.assessment.coverage.population, "closed");
    assert.equal(entry.assessment.observations[0].identity.certainty, "confirmed");
    result(document(p("Giriş", null, "0")), "compliant");
    result(document(p("Giriş", "Child"), genuine + style("Child", "Child", "Heading1")), "compliant");
  });
  await check("name-only paragraph is undetermined and preserves legacy PASS", () => {
    const doc = document(p());
    result(doc, "undetermined");
    assert.equal(new RuleEngine().run(doc, [rule])[0].status, "PASSED");
  });
  await check("misleading Heading1 substring and outline 9 remain undetermined", () => {
    for (const outline of [undefined, "9"]) {
      const entry = result(document(p("Giriş", "Quote"), style("Quote", "Quotation Heading1 Example", null, outline)), "undetermined");
      assert.equal(entry.assessment.observations[0].state, "undetermined");
    }
    result(document(p("Giriş", null, "9")), "undetermined");
  });
  await check("missing required section is a violation only with genuinely closed coverage", () => {
    const entry = result(document(p("Body")), "violation");
    assert.equal(entry.assessment.coverage.population, "closed");
    assert.equal(entry.assessment.observations[0].finding, "violation");
  });
  await check("open or missing extraction coverage cannot produce compliance or absence violation", () => {
    for (const body of [p("Body"), p("Giriş", "Heading1")]) {
      const doc = document(body + '<w:altChunk/>');
      assert.equal(result(doc, "undetermined").assessment.coverage.population, "open");
      const missing = document(body);
      delete missing.sectionExtractionCoverage;
      result(missing, "undetermined");
    }
    const partial = document(p("Body"));
    partial.sections = [];
    result(partial, "undetermined");
  });
  await check("table-cell and textbox candidates stay unresolved with open coverage", () => {
    for (const carrier of ['<w:tbl><w:tr><w:tc>' + p("Giriş", "Heading1") + '</w:tc></w:tr></w:tbl>', '<w:p><w:r><w:pict><w:txbxContent>' + p("Giriş", "Heading1") + '</w:txbxContent></w:pict></w:r></w:p>']) {
      assert.equal(result(document(carrier), "undetermined").assessment.coverage.population, "open");
      result(document(p("Giriş", "Heading1") + carrier), "undetermined");
    }
  });
  await check("broken, cyclic or missing style definitions do not establish identity", () => {
    result(document(p("Giriş", "Child"), style("Child", "Child", "Missing")), "undetermined");
    result(document(p("Giriş", "Child"), style("Child", "Child", "Heading1") + style("Heading1", "Heading 1", "Child")), "undetermined");
    result(document(p("Giriş", "Missing"), ""), "undetermined");
  });
  await check("competing and nested section identity remains undetermined", () => {
    result(document(p("Giriş", "Heading1") + p("Giriş", "Heading1")), "undetermined");
    result(document(p("Other", "Heading1") + p("1.1 Giriş", "Heading2")), "undetermined");
  });
  await check("TOC/deleted entries cannot establish section presence", () => {
    result(document(p("Giriş", "TOC1") + p("Body"), style("TOC1")), "violation");
    result(document('<w:del>' + p("Giriş", "Heading1") + '</w:del>' + p("Body")), "violation");
  });
  await check("presence contract adds no order, first-section, content-quality or formatting requirements", () => {
    result(document(p("Other", "Heading1") + p("Giriş", "Heading1")), "compliant");
    result(document(p("Giriş", "Heading1")), "compliant");
  });
  await check("execution is opt-in, requests one rule, and never calls legacy validate", () => {
    const registry = new ValidatorRegistry();
    const target = registry.getValidator(rule);
    const assess = target.assess;
    const validate = target.validate;
    const calls = [];
    target.assess = function (doc, requested) { calls.push(requested.id); return assess.call(this, doc, requested); };
    target.validate = () => { throw new Error("Pilot must never call validate"); };
    try {
      const executor = new AssessmentExecutionService(registry, readiness);
      assert.deepEqual(calls, []);
      result(document(), "compliant", executor);
      assert.deepEqual(calls, [rule.id]);
    } finally { target.assess = assess; target.validate = validate; }
  });
  await check("missing assess is an execution error without validate fallback", () => {
    const registry = new ValidatorRegistry([["REQUIRED_SECTION", { validate() { throw new Error("Fallback called"); } }]]);
    const entries = runPilot(document(), new AssessmentExecutionService(registry, readiness));
    assert.equal(entries[0].kind, "error");
    assert.equal(entries[0].code, "missing-assess");
  });
  await check("four-decision transport is lossless; N/A uses only a clearly separate stub", () => {
    // Transport contract test only: this is not an SDU source applicability claim.
    const evidence = [{ kind: "document-format", property: "transport-test-only", actual: true }];
    for (const decision of ["compliant", "violation", "undetermined", "not-applicable"]) {
      const assessment = decision === "not-applicable"
        ? { reference: { kind: "rule", id: rule.id }, applicability: { state: "not-applicable", reason: "Explicit transport-only stub evidence, not an SDU applicability decision.", evidence } }
        : { reference: { kind: "rule", id: rule.id }, applicability: { state: "applicable", evidence }, coverage: { population: "closed", excludedSubjects: [] }, observations: [decision === "undetermined"
          ? { state: "undetermined", subject: { kind: "document" }, identity: { certainty: "unresolved", reason: "Transport stub" }, evidence: { certainty: "sufficient", items: evidence } }
          : { state: "confirmed", subject: { kind: "document" }, identity: { certainty: "not-required" }, evidence: { certainty: "sufficient", items: evidence }, finding: decision }] };
      const registry = new ValidatorRegistry([["REQUIRED_SECTION", { assess: () => assessment, validate() { throw new Error("Fallback called"); } }]]);
      const entry = result(document(), decision, new AssessmentExecutionService(registry, readiness));
      assert.strictEqual(entry.assessment, assessment);
    }
    for (const doc of [document(), document(p()), document(p("Body")), document(p("Body") + '<w:altChunk/>')]) {
      assert.notEqual(runPilot(doc)[0].decision, "not-applicable");
    }
  });
  await check("pilot normalization is pure and leaves legacy results and scores unchanged", () => {
    const doc = document(p());
    const engine = new RuleEngine();
    const builder = new ReportBuilder();
    const before = engine.run(doc, [rule]);
    const report = builder.build(before);
    const serialized = JSON.stringify(doc);
    result(doc, "undetermined");
    assert.equal(JSON.stringify(doc), serialized);
    assert.deepEqual(engine.run(doc, [rule]), before);
    assert.deepEqual(builder.build(before), report);
  });
  await check("existing margin policy stays unchanged and cannot admit this separate pilot", () => {
    assert.equal(JSON.stringify(marginPolicy), policyBefore);
    for (const candidate of pilot.candidates) {
      assert.equal(marginPolicy.find((record) => record.inventoryId === candidate.inventoryId).readiness, "deferred");
      assert.equal(new AssessmentExecutionService(undefined, marginPolicy).run(document(), [candidate.rule])[0].kind, "rejected");
    }
    for (const candidate of marginPolicy.filter((candidate) => candidate.readiness === "assessment-ready")) {
      assert.equal(new AssessmentExecutionService(undefined, readiness).run(document(), [candidate.rule])[0].kind, "rejected");
    }
  });
  await check("pilot is absent from production discovery and COMU 46/47 baselines remain intact", () => {
    const sets = loadAvailableRuleSets();
    assert.equal(sets.some((set) => set.metadata.university.id === "sdu"), false);
    const ids = new Set(sets.flatMap((set) => set.rules.map((item) => item.id)));
    for (const candidate of pilot.candidates) {
      assert.equal(ids.has(candidate.rule.id), false);
      assert.equal(ids.has(candidate.inventoryId), false);
    }
    assert.ok(!path.resolve(__dirname, "sduSectionPresenceAssessmentPilot.ts").startsWith(path.resolve("src/data/universities") + path.sep));
    for (const selection of [{ facultyId: "applied-sciences", departmentId: "food-technology", studyTypeId: "experimental" }, { facultyId: "engineering", departmentId: "computer-engineering" }]) {
      const resolved = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", thesisTypeId: "bachelor", ...selection }));
      const food = selection.departmentId === "food-technology";
      assert.equal(resolved.length, food ? 46 : 47);
      const counts = (key) => resolved.reduce((acc, item) => ({ ...acc, [item.validation[key]]: (acc[item.validation[key]] ?? 0) + 1 }), {});
      assert.deepEqual(counts("coverage"), food ? { COMPLETE: 45, PARTIAL: 1 } : { COMPLETE: 33, PARTIAL: 14 });
      assert.deepEqual(counts("trust"), food ? { HIGH: 45, MEDIUM: 1 } : { HIGH: 33, MEDIUM: 14 });
    }
  });
  await check("exact nine-section mapping and per-candidate source references", () => {
    assert.deepEqual(pilot.candidates.map((candidate) => [candidate.inventoryId, candidate.rule.id, candidate.rule.expected]), [
      ["SDU-INV-SEC-13", "pilot.sdu.2026.section.introduction.presence", { section: "Giriş", required: true }],
      ["SDU-INV-SEC-07", "pilot.sdu.2026.section.summary.presence", { section: "Özet", required: true }],
      ["SDU-INV-SEC-08", "pilot.sdu.2026.section.abstract.presence", { section: "Abstract", required: true }],
      ["SDU-INV-SEC-03", "pilot.sdu.2026.section.thesis-approval.presence", { section: "Tez Onayı", required: true }],
      ["SDU-INV-SEC-05", "pilot.sdu.2026.section.undertaking.presence", { section: "Taahhütname", required: true }],
      ["SDU-INV-SEC-09", "pilot.sdu.2026.section.acknowledgements.presence", { section: "Teşekkür", required: true }],
      ["SDU-INV-SEC-14", "pilot.sdu.2026.section.literature-summaries.presence", { section: "Kaynak Özetleri", required: true }],
      ["SDU-INV-SEC-19", "pilot.sdu.2026.section.impact-value-usability.presence", { section: "Yaygın Etki/Katma Değer/Kullanılabilirlik", required: true }],
      ["SDU-INV-SEC-22", "pilot.sdu.2026.section.curriculum-vitae.presence", { section: "Özgeçmiş", required: true }],
    ]);
    for (const [index, candidate] of pilot.candidates.entries()) {
      const item = [13, 7, 8, 3, 5, 9, 14, 19, 22][index];
      const guideSection = ["4.2", "4.1", "4.1", null, null, null, "4.3", "4.8", "4.11"][index];
      const pages = index === 7 ? [17, 18] : index === 8 ? [19] : [16];
      assert.deepEqual(candidate.references, [{ section: "1", printedPage: 3, item },
        ...(guideSection ? pages.map((printedPage) => ({ section: guideSection, printedPage })) : [])]);
      if (guideSection) assert.ok(candidate.rule.description.includes(`section ${guideSection}, printed page${pages.length > 1 ? "s" : ""} ${pages.join("–")}`));
      assert.equal(candidate.readiness, "assessment-ready");
      assert.equal(candidate.rule.type, "REQUIRED_SECTION");
      assert.equal(candidate.rule.score, 0);
      assert.match(candidate.rule.description, new RegExp(`item ${item}[;.]`));
    }
  });
  for (const candidate of pilot.candidates) {
    const target = candidate.rule;
    const section = target.expected.section;
    const assertDecision = (doc, expected) => result(doc, expected, undefined, target);
    const heading = () => p(section, "Heading1");
    const scenarios = [
      ["structural body heading", () => assertDecision(document(heading()), "compliant")],
      ["explicit outline / inherited / manual heading", () => {
        assertDecision(document(p(section, null, "0")), "compliant");
        assertDecision(document(p(section, "Child"), genuine + style("Child", "Child", "Heading1")), "compliant");
        assertDecision(document(p(`1. ${section}`, "Heading1")), "compliant");
      }],
      ["name-only preserves legacy PASS", () => {
        const doc = document(p(section));
        assertDecision(doc, "undetermined");
        assert.equal(new RuleEngine().run(doc, [target])[0].status, "PASSED");
      }],
      ["misleading substring / outline 9", () => {
        for (const outline of [undefined, "9"]) assertDecision(document(p(section, "Quote"), style("Quote", "Quotation Heading1 Example", null, outline)), "undetermined");
        assertDecision(document(p(section, null, "9")), "undetermined");
      }],
      ["closed absence", () => assertDecision(document(p("Body")), "violation")],
      ["open coverage with present or absent target", () => {
        for (const body of [heading(), p("Body")]) assertDecision(document(body + '<w:altChunk/>'), "undetermined");
      }],
      ["table-cell / textbox", () => {
        for (const carrier of ['<w:tbl><w:tr><w:tc>' + heading() + '</w:tc></w:tr></w:tbl>', '<w:p><w:r><w:pict><w:txbxContent>' + heading() + '</w:txbxContent></w:pict></w:r></w:p>']) {
          assertDecision(document(carrier), "undetermined");
          assertDecision(document(heading() + carrier), "undetermined");
        }
      }],
      ["broken / cyclic / missing style", () => {
        assertDecision(document(p(section, "Child"), style("Child", "Child", "Missing")), "undetermined");
        assertDecision(document(p(section, "Child"), style("Child", "Child", "Heading1") + style("Heading1", "Heading 1", "Child")), "undetermined");
        assertDecision(document(p(section, "Missing"), ""), "undetermined");
      }],
      ["competing / nested identity", () => {
        assertDecision(document(heading() + heading()), "undetermined");
        assertDecision(document(p("Other", "Heading1") + p(`1.1 ${section}`, "Heading2")), "undetermined");
      }],
      ["TOC / deleted exclusion", () => {
        assertDecision(document(p(section, "TOC1"), style("TOC1")), "violation");
        assertDecision(document('<w:del>' + heading() + '</w:del>'), "violation");
      }],
      ["allowlist exact contract and default denial", () => {
        const gate = new AssessmentReadinessGate(readiness);
        assert.equal(gate.check(target), null);
        assert.equal(gate.check({ ...target, expected: { ...target.expected, wordCount: 100 } }).code, "rule-contract-mismatch");
        assert.equal(gate.check({ ...target, expected: { ...target.expected, required: false } }).code, "rule-contract-mismatch");
        assert.equal(gate.check({ ...target, type: "SECTION_ORDER" }).code, "rule-contract-mismatch");
        assert.equal(new AssessmentExecutionService().run(document(), [target])[0].kind, "rejected");
        const deferred = new AssessmentReadinessGate([{ ...candidate, readiness: "deferred" }]);
        assert.equal(deferred.check(target).code, "not-assessment-ready");
        for (const id of [candidate.inventoryId, "unknown.section", "pilot.sdu.2026.section.conclusion.presence"]) {
          assert.equal(gate.check({ ...target, id }).code, "unknown-rule");
        }
      }],
    ];
    for (const [label, run] of scenarios) await check(`${candidate.inventoryId}: ${label}`, run);
  }
  await check("nine-section batch preserves independent decisions and explicit subset execution", () => {
    const doc = document(p("Giriş", "Heading1") + p("Özet"));
    const entries = runPilot(doc);
    assert.deepEqual(entries.map((entry) => entry.ruleId), pilot.candidates.map((candidate) => candidate.rule.id));
    assert.deepEqual(entries.map((entry) => entry.decision), ["compliant", "undetermined", "violation", "violation", "violation", "violation", "violation", "violation", "violation"]);
    const all = document(pilot.candidates.map((candidate) => p(candidate.rule.expected.section, "Heading1")).join(""));
    assert.deepEqual(runPilot(all).map((entry) => entry.decision), pilot.candidates.map(() => "compliant"));
    assert.deepEqual(runPilot(all, undefined, []).map((entry) => entry.ruleId), []);
    assert.deepEqual(runPilot(all, undefined, [pilot.candidates[2].rule]).map((entry) => entry.ruleId), [pilot.candidates[2].rule.id]);
    const mixed = runPilot(all, undefined, [{ ...rule, id: "unknown.section" }, ...pilot.candidates.map((candidate) => candidate.rule)]);
    assert.equal(mixed[0].kind, "rejected");
    assert.deepEqual(mixed.slice(1).map((entry) => entry.decision), pilot.candidates.map(() => "compliant"));
  });
  await check("nine-section batch never invokes legacy validate or changes scoring", () => {
    const registry = new ValidatorRegistry();
    const target = registry.getValidator(rule);
    const original = target.validate;
    const doc = document(pilot.candidates.map((candidate) => p(candidate.rule.expected.section)).join(""));
    const rules = pilot.candidates.map((candidate) => candidate.rule);
    const before = new RuleEngine().run(doc, rules);
    const report = new ReportBuilder().build(before);
    target.validate = () => { throw new Error("Legacy fallback forbidden"); };
    try { assert.deepEqual(runPilot(doc, new AssessmentExecutionService(registry, readiness)).map((entry) => entry.decision), pilot.candidates.map(() => "undetermined")); }
    finally { target.validate = original; }
    assert.deepEqual(new RuleEngine().run(doc, rules), before);
    assert.deepEqual(new ReportBuilder().build(before), report);
    assert.equal(JSON.stringify(marginPolicy), policyBefore);
  });
  await check("expanded sections add no aliases, content-quality or order requirements", () => {
    for (const candidate of pilot.candidates.slice(3)) {
      const target = candidate.rule;
      result(document(p(target.expected.section, "Heading1")), "compliant", undefined, target);
      result(document(p("Other", "Heading1") + p(target.expected.section, "Heading1")), "compliant", undefined, target);
      result(document(p("KABUL VE ONAY", "Heading1") + p("İNTİHAL (AŞIRMA) BEYAN SAYFASI", "Heading1")), "violation", undefined, target);
      assert.deepEqual(Object.keys(target.expected).sort(), ["required", "section"]);
    }
  });
  await check("new section names do not admit unsupported aliases or bibliography identity", () => {
    for (const candidate of pilot.candidates.slice(5)) {
      for (const name of ["Önsöz", "Acknowledgements", "Literatür Taraması", "Kaynaklar"]) {
        result(document(p(name, "Heading1")), "violation", undefined, candidate.rule);
      }
    }
  });
  await check("SEC-19 admits only the full combined name, never slash-separated alternatives", () => {
    const target = pilot.candidates[7].rule;
    for (const name of ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik", "Yaygın Etki/Katma Değer", "Katma Değer/Kullanılabilirlik", "Yaygın Etki/Kullanılabilirlik"]) {
      result(document(p(name, "Heading1")), "violation", undefined, target);
      assert.equal(new AssessmentReadinessGate(readiness).check({ ...target, expected: { section: name, required: true } }).code, "rule-contract-mismatch");
    }
    result(document(p("Yaygın Etki", "Heading1") + p("Katma Değer", "Heading1") + p("Kullanılabilirlik", "Heading1")), "violation", undefined, target);
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, "manifest.json"), "utf8"));
  for (const [filename, numberingSource] of [["full-correct.docx", "text"], ["automatic-heading-numbering-synthetic.docx", "word"]]) {
    await check(`unchanged on-disk DOCX package: ${filename}`, async () => {
      const filePath = path.join(fixtureDirectory, filename);
      const bytes = fs.readFileSync(filePath);
      fixtureHashes.set(filePath, digest(bytes));
      const doc = await readDocx(bytes);
      const before = JSON.stringify(doc);
      const entry = result(doc, "compliant");
      const batch = runPilot(doc);
      assert.deepEqual(batch.map((item) => item.decision), ["compliant", "undetermined", "undetermined", "violation", "violation", "undetermined", "violation", "violation", "undetermined"]);
      // Read actual package XML; filenames do not establish section identity.
      const zip = await require("jszip").loadAsync(bytes);
      const xml = await zip.file("word/document.xml").async("string");
      for (const [index, section] of [[3, "Tez Onayı"], [4, "Taahhütname"], [6, "Kaynak Özetleri"], [7, "Yaygın Etki/Katma Değer/Kullanılabilirlik"]]) {
        assert.equal(doc.paragraphs.some((paragraph) => paragraph.text.toLocaleLowerCase("tr-TR") === section.toLocaleLowerCase("tr-TR")), false);
        assert.equal(batch[index].assessment.coverage.population, "closed");
        assert.equal(batch[index].assessment.observations[0].finding, "violation");
      }
      for (const [index, text, paragraphId] of [[1, "ÖZET", "paragraph-7"], [2, "ABSTRACT", "paragraph-10"], [5, "TEŞEKKÜR", "paragraph-5"], [8, "ÖZGEÇMİŞ", "paragraph-46"]]) {
        assert.ok(xml.includes(`<w:t>${text}</w:t>`));
        const raw = doc.paragraphs.find((paragraph) => paragraph.id === paragraphId);
        assert.equal(raw.text, text);
        assert.equal(raw.styleId, null);
        assert.equal(raw.outlineLevel, undefined);
        assert.equal(batch[index].assessment.observations[0].identity.certainty, "unresolved");
        assert.equal(batch[index].assessment.observations[0].evidence.items[0].paragraphId, paragraphId);
      }
      assert.equal(entry.assessment.coverage.population, "closed");
      assert.equal(entry.assessment.observations.length, 1);
      const proof = entry.assessment.observations[0].evidence.items;
      assert.equal(proof[0].paragraphId, "paragraph-21");
      const paragraph = doc.paragraphs.find((item) => item.id === proof[0].paragraphId);
      assert.equal(paragraph.numbering.source, numberingSource);
      assert.equal(paragraph.numbering.visibleLabel, "1.");
      assert.equal(paragraph.styleId, "Heading1");
      assert.equal(JSON.stringify(doc), before);
      const origin = manifest.fixtures.find((item) => item.file === filename).origin;
      assert.equal(origin, "synthetic-ooxml");
      const observed = { filename, origin, sha256: digest(bytes), sections: batch.map((item) => ({ ruleId: item.ruleId, decision: item.decision, coverage: item.assessment.coverage.population })), paragraphId: paragraph.id, heading: paragraph.text,
        numberingSource, visibleLabel: paragraph.numbering.visibleLabel, decision: entry.decision, coverage: entry.assessment.coverage.population };
      corpusResults.push(observed);
      console.log(JSON.stringify({ onDiskDocx: observed }));
    });
  }
  await check("source DOCX packages are distinct and remain byte-identical", () => {
    assert.equal(fixtureHashes.size, 2);
    assert.equal(new Set(fixtureHashes.values()).size, 2);
    for (const [filename, before] of fixtureHashes) assert.equal(digest(fs.readFileSync(filename)), before);
  });
  await check("test-only TypeScript pilot passes strict typechecking without emission", () => {
    const filename = path.join(__dirname, "sduSectionPresenceAssessmentPilot.ts");
    const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, esModuleInterop: true };
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options));
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
    }));
  });
  console.log(JSON.stringify({ pilot: pilot.id, result: "PASS", cases, onDiskDocxFiles: corpusResults.length,
    corpusOrigin: "synthetic-ooxml; not Word-native or SDU student documents", fixtureWrites: 0 }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
