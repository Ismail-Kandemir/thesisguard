const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { runSduConservativeDecisionPilot: run } = require("./sduConservativeDecisionGuard.ts");
const { runSduGuardedAssessmentBatch: runBatch } = require("./sduGuardedAssessmentBatch.ts");
const { sduSectionPresenceAssessmentPilot: sections, readSduSectionPresencePilotDocx: readDocx } = require("./sduSectionPresenceAssessmentPilot.ts");
const { sduMarginAssessmentPilot: margins } = require("./sduMarginAssessmentPilot.ts");
const { normalizeSectionName } = require("../../src/features/analysis/parsers/documentSectionsParser.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");
const { resolveHeadingStyleProvenance } = require("../../src/features/analysis/parsers/headingStyleProvenance.ts");
const directory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const reportPath = path.resolve("docs/audit/SDU_SPRINT_37_GUARD_CALIBRATION_AUDIT.md");
const target = sections.candidates.find((item) => item.inventoryId === "SDU-INV-SEC-19").rule;
const exact = target.expected.section;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const paragraph = (text, style = "Heading1") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const section = (raw) => `<w:sectPr>${raw === null ? "" : `<w:pgMar w:top="${raw}" w:bottom="${raw}"/>`}</w:sectPr>`;
const classes = ["justified-uncertainty", "potential-overconservatism", "candidate-false-positive",
  "confirmed-violation-preserved", "confirmed-compliance-preserved", "insufficient-evidence"];
const protectedFiles = ["sduConservativeDecisionGuard.ts", "sduConservativeDecisionGuardRegression.cjs",
  "sduGuardedAssessmentBatch.ts", "sduGuardedAssessmentBatchRegression.cjs",
  "sduConservativePolicySimulationRegression.cjs", "sduNormalizationPolicyBoundaryRegression.cjs"]
  .map((name) => path.join(__dirname, name));
protectedFiles.push(path.resolve("src/features/analysis/parsers/documentXmlParser.ts"));

// Manually authored relevance labels describe the CONTROLLED test construction,
// not an academic alias list, a production detector or permission for compliance.
// Baseline decision pairs pin observed Sprint 35 behavior; they never override it.
function sectionCases() {
  const rows = [];
  const add = (name, text, relevant, selected, original, guarded, classification, style = "Heading1", open = false) =>
    rows.push({ name, inputs: [{ text, relevant, selected }], body: paragraph(text, style), original, guarded, classification, open });
  for (const [name, text] of [["exact", exact], ["NFC", exact.normalize("NFC")], ["NFD", exact.normalize("NFD")]])
    add(name, text, true, true, "compliant", "compliant", "confirmed-compliance-preserved");
  for (const [name, text] of [
    ["uppercase", exact.toLocaleUpperCase("tr-TR")], ["lowercase", exact.toLocaleLowerCase("tr-TR")],
    ["diacritics", "Yaygin Etki/Katma Deger/Kullanilabilirlik"], ["slash-hyphen", exact.replaceAll("/", "-")],
    ["slash-fullwidth", exact.replaceAll("/", "／")], ["slash-space", exact.replaceAll("/", " ")],
    ["whitespace", "  Yaygın  Etki / Katma Değer / Kullanılabilirlik  "], ["NBSP", exact.replaceAll(" ", "\u00a0")],
    ["word-boundary-deletion", "YaygınEtkiKatmaDeğerKullanılabilirlik"], ["malformed-punctuation", exact.replace("Yaygın", "Ya!ygın")],
  ]) add(name, text, true, true, "compliant", "undetermined", "justified-uncertainty");
  for (const [name, text] of [["partial-impact", "Yaygın Etki"], ["partial-value", "Katma Değer"], ["partial-usability", "Kullanılabilirlik"]])
    add(name, text, true, true, "violation", "undetermined", "justified-uncertainty");
  rows.push({ name: "split", inputs: ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik"].map((text) => ({ text, relevant: true, selected: true })),
    body: ["Yaygın Etki", "Katma Değer", "Kullanılabilirlik"].map((text) => paragraph(text)).join(""),
    original: "violation", guarded: "undetermined", classification: "justified-uncertainty" });
  for (const text of ["Değer", "Etki", "A", "Y", "K"])
    add(`generic-${text}`, text, false, true, "violation", "undetermined", "candidate-false-positive");
  for (const text of ["Z", "Q", "Sonuçlar"])
    add(`unrelated-${text}`, text, false, false, "violation", "violation", "confirmed-violation-preserved");
  add("unrelated-body", "Unrelated body", false, false, "violation", "violation", "confirmed-violation-preserved", null);
  for (const [name, style] of [["name-only", null], ["misleading-style", "QuoteHeading1Substring"], ["nested-heading", "Heading2"]])
    add(name, exact, true, true, "undetermined", "undetermined", "insufficient-evidence", style);
  add("open-exact", exact, true, true, "undetermined", "undetermined", "insufficient-evidence", "Heading1", true);
  add("open-generic-A", "A", false, true, "undetermined", "undetermined", "candidate-false-positive", "Heading1", true);
  add("open-unrelated", "Unrelated body", false, false, "undetermined", "undetermined", "insufficient-evidence", null, true);
  rows.push({ name: "exact-plus-generic", inputs: [{ text: exact, relevant: true, selected: true }, { text: "A", relevant: false, selected: true }],
    body: paragraph(exact) + paragraph("A", null), original: "compliant", guarded: "undetermined", classification: "candidate-false-positive" });
  rows.push({ name: "table-generic", inputs: [{ text: "Değer", relevant: false, selected: true }],
    body: `<w:tbl><w:tr><w:tc>${paragraph("Değer", null)}</w:tc></w:tr></w:tbl>`,
    original: "violation", guarded: "undetermined", classification: "candidate-false-positive" });
  add("body-generic", "Etki", false, true, "violation", "undetermined", "candidate-false-positive", null);
  for (const open of [false, true]) rows.push({ name: open ? "open-empty" : "empty-with-terminal-section", inputs: [], body: "", open,
    original: "undetermined", guarded: "undetermined", classification: "insufficient-evidence" });
  return rows;
}

function marginCases() {
  const rows = [];
  const add = (name, values, original, guarded, classification, terminal = true, extractionOpen = false) =>
    rows.push({ name, values, original, guarded, classification, terminal, extractionOpen });
  add("exact-cm", ["2.5cm"], "compliant", "compliant", "confirmed-compliance-preserved");
  for (const raw of ["2.499cm", "2.501cm"]) add(raw, [raw], "compliant", "undetermined", "justified-uncertainty");
  for (let value = 1414; value <= 1421; value++) add(String(value), [String(value)],
    value === 1414 || value === 1421 ? "violation" : "compliant", "undetermined", "justified-uncertainty");
  add("1701", ["1701"], "violation", "undetermined", "potential-overconservatism");
  add("3cm", ["3cm"], "violation", "violation", "confirmed-violation-preserved");
  for (const raw of [null, "0x589"]) add(raw === null ? "missing" : "malformed", [raw], "undetermined", "undetermined", "insufficient-evidence");
  add("multi-exact", ["2.5cm", "2.5cm"], "compliant", "compliant", "confirmed-compliance-preserved");
  add("multi-integer", ["2.5cm", "1417"], "compliant", "undetermined", "justified-uncertainty");
  add("multi-missing", ["2.5cm", null], "undetermined", "undetermined", "insufficient-evidence");
  add("multi-confirmed-missing", ["3cm", null], "violation", "violation", "confirmed-violation-preserved");
  add("multi-1701-missing", ["1701", null], "violation", "undetermined", "potential-overconservatism");
  add("multi-1701-exact", ["1701", "2.5cm"], "violation", "undetermined", "potential-overconservatism");
  add("open-exact", ["2.5cm", "2.5cm"], "undetermined", "undetermined", "insufficient-evidence", false);
  add("open-integer", ["1421", "1417"], "violation", "undetermined", "justified-uncertainty", false);
  add("open-confirmed", ["3cm", "2.5cm"], "violation", "violation", "confirmed-violation-preserved", false);
  add("open-1701", ["1701", "2.5cm"], "violation", "undetermined", "potential-overconservatism", false);
  add("open-extraction", ["2.5cm"], "compliant", "undetermined", "insufficient-evidence", true, true);
  add("multi-confirmed-integer", ["3cm", "1701"], "violation", "violation", "confirmed-violation-preserved");
  return rows;
}

function precision(raw) {
  if (raw === null) return { unit: "missing", rationalCm: null, decimalCm: null, parserRounding: "two-decimal-cm", academicTolerance: "not-approved" };
  if (/^\d+$/.test(raw)) {
    const numerator = BigInt(raw) * 127n;
    // Exact representation mathematics, NOT an academic comparison/acceptance policy.
    return { unit: "twips", rationalCm: `${numerator}/72000`, decimalCm: Number(raw) * 127 / 72000,
      exactTargetDifferenceCm: `${numerator - 180000n}/72000`, parserRounding: "two-decimal-cm",
      representationStepCm: "127/72000", quantizationPolicy: "not-approved", academicTolerance: "not-approved" };
  }
  const measure = /^(\d+(?:\.\d+)?)cm$/.exec(raw);
  return { unit: measure ? "cm" : "malformed", rationalCm: null, decimalCm: measure ? Number(measure[1]) : null,
    parserRounding: "two-decimal-cm", academicTolerance: "not-approved" };
}

async function audit() {
  const fixtureFiles = fs.readdirSync(directory).filter((file) => file.endsWith(".docx")).map((file) => path.join(directory, file));
  const hashes = new Map([...fixtureFiles, ...protectedFiles].map((file) => [file, hash(fs.readFileSync(file))]));
  const base = fs.readFileSync(path.join(directory, "full-correct.docx"));
  const originalXml = await (await JSZip.loadAsync(base)).file("word/document.xml").async("string");
  const sectionRows = []; const marginRows = []; const corpusRows = [];
  let evaluations = 0;
  let corpusEvaluations = 0;
  const confusion = { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };
  async function variant(body) {
    const zip = await JSZip.loadAsync(base);
    zip.file("word/document.xml", originalXml.replace(/<w:body>[\s\S]*<\/w:body>/u, `<w:body>${body}</w:body>`));
    return zip.generateAsync({ type: "nodebuffer" });
  }
  function observe(result, id, expected, label) {
    const record = result.originalReport.records.find((item) => item.executionId === id);
    const metadata = result.guardMetadata.find((item) => item.executionId === id);
    const actual = { original: record.execution.decision, guarded: metadata.guardedDecision };
    assert.deepEqual(actual, { original: expected.original, guarded: expected.guarded }, `UNEXPECTED DECISION ${label}: ${JSON.stringify(actual)}`);
    assert.ok(classes.includes(expected.classification));
    assert.notEqual(actual.guarded, "not-applicable");
    assert.equal(metadata.policyVersion, "sdu-conservative-decision/v1");
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    evaluations++;
    return { record, metadata };
  }
  try {
    for (const scenario of sectionCases()) {
      const bytes = await variant(scenario.body + (scenario.open ? "<w:altChunk/>" : "") + section("2.5cm"));
      const result = await run(bytes, { enabled: true });
      const { record, metadata } = observe(result, target.id, scenario, scenario.name);
      const document = normalizeAcademicSections(markRequiredSectionHeadings(await readDocx(bytes), [target]), [target]);
      assert.equal(document.paragraphs.length, scenario.inputs.length, scenario.name);
      const paragraphs = scenario.inputs.map((input, index) => {
        const item = document.paragraphs[index];
        assert.equal(item.text, input.text);
        // Observe the actual guard's evidence selection, never copy its substring detector.
        const selected = metadata.evidenceReference.rawValues.includes(item.text);
        assert.equal(selected, input.selected, `UNEXPECTED CANDIDATE ${scenario.name}: ${item.text}`);
        confusion[input.relevant ? selected ? "truePositive" : "falseNegative" : selected ? "falsePositive" : "trueNegative"]++;
        return { rawHeading: item.text, normalizedHeading: normalizeSectionName(item.text), authoredRelevant: input.relevant,
          candidateDetection: selected, structuralHeadingEvidence: resolveHeadingStyleProvenance(document, item),
          placement: item.sectionContext?.placement ?? null, inTable: item.isInTableCell,
          identity: document.academicSections.occurrences.filter((occurrence) => occurrence.headingParagraphId === item.id)
            .map((occurrence) => occurrence.structuralIdentity) };
      });
      const falsePositive = paragraphs.some((item) => !item.authoredRelevant && item.candidateDetection);
      assert.equal(falsePositive, scenario.classification === "candidate-false-positive");
      sectionRows.push({ scenario: scenario.name, paragraphs, candidateDetection: paragraphs.some((item) => item.candidateDetection),
        identityCertainty: record.execution.assessment.observations.map((item) => item.identity.certainty),
        coverage: record.execution.assessment.coverage.population, originalDecision: metadata.originalDecision,
        guardedDecision: metadata.guardedDecision, reasonCode: metadata.reasonCode, classification: scenario.classification,
        potentiallyUnnecessaryDowngrade: falsePositive && metadata.originalDecision !== "undetermined" && metadata.guardedDecision === "undetermined" });
    }
    for (const scenario of marginCases()) {
      const body = scenario.values.map((raw, index) => scenario.terminal && index === scenario.values.length - 1
        ? section(raw) : `<w:p><w:pPr>${section(raw)}</w:pPr></w:p>`).join("") + (scenario.extractionOpen ? "<w:altChunk/>" : "");
      const bytes = await variant(body);
      const document = await readDocx(bytes);
      const result = await run(bytes, { enabled: true });
      for (const { rule } of margins.candidates) {
        const { record, metadata } = observe(result, rule.id, scenario, `${scenario.name}/${rule.type}`);
        const side = rule.type === "MARGIN_TOP" ? "top" : "bottom";
        assert.deepEqual(metadata.evidenceReference.rawValues, scenario.values);
        marginRows.push({ scenario: scenario.name, executionId: rule.id, rawOoxml: scenario.values,
          measurements: scenario.values.map((raw, index) => ({ raw, ...precision(raw), parsedCm: document.pageSections[index].pageMargins[side] })),
          coverage: record.execution.assessment.coverage.population, extractionCoverage: document.sectionExtractionCoverage.population,
          originalDecision: metadata.originalDecision, guardedDecision: metadata.guardedDecision,
          uncertaintyReason: metadata.reasonCode, uncertainty: metadata.uncertainty, classification: scenario.classification,
          potentiallyUnnecessaryDowngrade: scenario.classification === "potential-overconservatism" });
      }
    }
    for (const file of ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"]) {
      const bytes = fs.readFileSync(path.join(directory, file));
      const a = await run(bytes, { enabled: true });
      const b = await runBatch(bytes, { admissionPolicy: "synthetic-pilot", guardEnabled: true });
      assert.equal(b.status, "completed");
      assert.equal(b.guardedAssessmentResults.length, 11);
      corpusEvaluations += b.guardedAssessmentResults.length;
      assert.deepEqual(b.guardMetadata.map((item) => [item.executionId, item.guardedDecision, item.reasonCode, item.evidenceReference]),
        a.guardMetadata.map((item) => [item.executionId, item.guardedDecision, item.reasonCode, item.evidenceReference]));
      const doc = await readDocx(bytes);
      for (const id of [target.id, ...margins.candidates.map((item) => item.rule.id)]) {
        const metadata = a.guardMetadata.find((item) => item.executionId === id);
        corpusRows.push({ file, executionId: id, originalDecision: metadata.originalDecision, guardedDecision: metadata.guardedDecision,
          reason: metadata.reasonCode, raw: metadata.evidenceReference.rawValues,
          selectedParagraphContext: id === target.id ? doc.paragraphs.filter((item) => metadata.evidenceReference.rawValues.includes(item.text))
            .map((item) => ({ text: item.text, inTable: item.isInTableCell, heading: resolveHeadingStyleProvenance(doc, item) })) : [] });
      }
    }
    // Exact arithmetic confirms distance, without choosing a tolerance or changing a decision.
    assert.equal(1701n * 127n, 216027n);
    assert.equal(1701n * 127n - 180000n, 36027n);
    assert.equal(1701n * 127n - 180000n > 127n, true);
    assert.ok(sectionRows.filter((row) => row.classification === "candidate-false-positive").every((row) => row.guardedDecision !== "compliant"));
  } finally {
    for (const [file, before] of hashes) assert.equal(hash(fs.readFileSync(file)), before, `PROTECTED FILE CHANGED: ${file}`);
  }
  const allRows = [...sectionRows, ...marginRows];
  const summary = { evaluations, sectionScenarios: sectionRows.length, marginEvaluations: marginRows.length,
    confusion, candidateFalsePositiveEvaluations: sectionRows.filter((row) => row.classification === "candidate-false-positive").length,
    falseCompliantFromCandidateFalsePositive: sectionRows.filter((row) => row.classification === "candidate-false-positive" && row.guardedDecision === "compliant").length,
    potentiallyUnnecessaryUndetermined: allRows.filter((row) => row.potentiallyUnnecessaryDowngrade).length,
    sectionPotentiallyUnnecessary: sectionRows.filter((row) => row.potentiallyUnnecessaryDowngrade).length,
    marginPotentiallyUnnecessary: marginRows.filter((row) => row.potentiallyUnnecessaryDowngrade).length,
    confirmedViolationPreserved: allRows.filter((row) => row.classification === "confirmed-violation-preserved").length,
    classificationCounts: Object.fromEntries(classes.map((name) => [name, allRows.filter((row) => row.classification === name).length])),
    corpusEvaluationsSeparate: corpusEvaluations, unexpectedDecisions: 0, productionAuthorization: "not-granted", fixtureWrites: 0 };
  return { summary, sectionRows, marginRows, corpusRows };
}

function cell(value) {
  return JSON.stringify(value).replaceAll("|", "&#124;").replaceAll("\n", " ");
}

function renderReport(data) {
  const { summary: s, sectionRows, marginRows, corpusRows } = data;
  return `# SDÜ Sprint 37 — Guard calibration audit

Tarih: 1 Kasım 2026. Yalnız audit; akademik onay veya production onboarding değildir.
Sprint 35–36 uygulamaları ve production parser değiştirilmedi. Sınıflar akademik kararların yerine geçmez.

## Yöntem ve sayım sınırı

Regresyon: [sduGuardCalibrationAuditRegression.cjs](../../tests/audit/sduGuardCalibrationAuditRegression.cjs).
Normal çalıştırma read-only'dir; yalnız açık \`--write-report\` seçeneği bu dokümanı üretir.
Sentetik paket varyantları bellekte hazırlanır. Mevcut DOCX'ler ve incelenen uygulamalar SHA-256 ile korunur.
Candidate seçimi guard'ın gerçek \`evidenceReference.rawValues\` çıktısından gözlemlenir; detector kopyalanmaz.
Raw/normalized metin, bağımsız heading provenance ve occurrence identity ayrıdır.
Manuel relevance etiketleri kontrollü senaryonun bilinen yapım amacıdır; akademik alias, otomatik detector veya gerçek belge ground truth değildir.
Generic sözcüklerin etiketi bu test bağlamında negatiftir; aynı sözcüğün gerçek belge bağlamında her zaman ilgisiz olduğu iddia edilmez.
İlk audit varsayımı olan “terminal section içeren boş belge kapalı yokluktur” doğrulanmadı:
mevcut semanticQualification paragraf envanteri boşsa coverage'ı open tutar. Bu iki boş kontrol U→U/insufficient-evidence olarak kaydedildi; uygulama değiştirilmedi.

${s.sectionScenarios} SEC-19 senaryosu + ${s.marginEvaluations} margin değerlendirmesi = **${s.evaluations} kontrollü değerlendirme**.
Margin üst/alt ayrı sayılır. Confusion matrix paragraf bazındadır; split senaryosu üç, exact-plus-generic iki paragraf içerir; boş senaryolar sıfırdır.
İki mevcut DOCX üzerindeki 22 pilot kontrolü ayrı baseline doğrulamasıdır; aşağıdaki hata/kalibrasyon toplamlarına eklenmez.

## SEC-19 candidate confusion matrix

Normatif kayıtlı ad: **Yaygın Etki/Katma Değer/Kullanılabilirlik**.

| Kontrollü relevance | Candidate seçildi | Seçilmedi |
| --- | ---: | ---: |
| İlgili (authored positive) | TP ${s.confusion.truePositive} | FN ${s.confusion.falseNegative} |
| İlgisiz (authored negative) | FP ${s.confusion.falsePositive} | TN ${s.confusion.trueNegative} |

FP içeren senaryo: **${s.candidateFalsePositiveEvaluations}**. Bunlardan üretilen guarded compliant: **${s.falseCompliantFromCandidateFalsePositive}**.
Candidate false positive, false compliant demek değildir. Buradaki zarar, kanıtlanmış yokluğu veya exact compliance'ı gereksiz U'ya yöneltme potansiyelidir.
Identity sütunu original assessment certainty'sidir; \`not-required\` kapalı yokluk gözlemi olabilir ve adayın kimliğini doğrulamaz.
Yapısal sütun her paragrafın bağımsız heading provenance'ını gösterir; tam evidence/reason/styleIds/occurrence identity regresyon JSON çıktısında korunur.

| Senaryo | Raw heading | Normalized heading | Heading certainty / placement | Candidate | Original identity | Coverage | Original → guarded | Reason | Sınıf |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${sectionRows.map((row) => `| ${row.scenario} | ${cell(row.paragraphs.map((p) => p.rawHeading))} | ${cell(row.paragraphs.map((p) => p.normalizedHeading))} | ${cell(row.paragraphs.map((p) => [p.structuralHeadingEvidence.certainty, p.inTable ? "table" : p.placement]))} | ${cell(row.paragraphs.map((p) => p.candidateDetection))} | ${cell(row.identityCertainty)} | ${row.coverage} | ${row.originalDecision} → ${row.guardedDecision} | ${row.reasonCode} | ${row.classification} |`).join("\n")}

## Margin evidence matrix

OOXML integer twips → cm dönüşümü mevcut parser sözleşmesinden: \`n × 127 / 72000\`.
Parser iki ondalığa yuvarlar; bu bir akademik tolerans değildir. \`2.499cm\` ve \`2.501cm\` raw olarak farklıdır, parser ikisini 2.50 yapar.
Aşağıdaki her satır üst ve alt pilotlarda ayrı doğrulanmıştır; sonuçları aynıdır. Parsed ve precision dizilerinin sırası raw section sırasıdır.
Coverage çiftinde ilk değer margin population, ikincisi extraction coverage'dır; bunlar aynı kavram değildir.
Integer için temsil adımı \`127/72000 cm\`; kabul edilebilir quantization/akademik tolerans onaylanmamıştır.

| Senaryo (iki side) | Raw OOXML | Unit | Raw mathematical cm | Parsed cm | Coverage: margin/extraction | Original → guarded | Uncertainty reason | Sınıf |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${marginRows.filter((row) => row.executionId.endsWith(".top")).map((row) => `| ${row.scenario} | ${cell(row.rawOoxml)} | ${cell(row.measurements.map((m) => m.unit))} | ${cell(row.measurements.map((m) => m.rationalCm ?? m.decimalCm))} | ${cell(row.measurements.map((m) => m.parsedCm))} | ${row.coverage}/${row.extractionCoverage} | ${row.originalDecision} → ${row.guardedDecision} | ${row.uncertaintyReason} (${row.uncertainty}) | ${row.classification} |`).join("\n")}

## 1701 twips ve aşırı muhafazakârlık bulguları

- \`1701 × 127 / 72000 = 216027/72000 = 3.000375 cm\`; parser sonucu **3 cm**.
- 2.5 cm farkı \`36027/72000 = 0.500375 cm\` = **283.677165… twips**. Bir twip adımı bu farkı açıklamaz.
- Raw değer geçerli ve safe integer'dır; ölçüm kayıp, malformed veya floating-point taşması değildir.
- Guard'ın \`exactCm\` dalı yalnız raw decimal \`cm\` kabul eder. Integer raw değer \`null\` sınıfına girer; \`confirmedViolation\` integer'dan kurulamaz.
- Ardından exact \`2.5cm\` dışındaki raw değerler \`precision-unapproved\` ile U olur. Bu nedenle 1701 için V→U teknik extraction belirsizliğinden değil, integer temsillerine topluca uygulanan **onaylanmamış precision/quantization politikası kısıtından** kaynaklanır.
- Yakın integer değerleri otomatik V yapmamak için getirilen kısıt, açıkça uzak integer karşıörneklere de yayılmıştır. Audit etiketi \`potential-overconservatism\`dir; bu rapor guarded sonucu V'ye değiştirmez veya yeni bir uzaklık eşiği tanımlamaz.
- SEC-19 \`expected.includes(normalized)\` gibi alt dize taraması, tek harfleri ve generic sözcükleri seçer. Structural identity yalnız compliance korumasında kullanılır; candidate taraması table/body/heading ayrımı yapmaz.
- Exact başlık + unrelated \`A\` kontrolünde original C de U'ya düşer. Bu yalnız yokluk kararlarını etkileyen bir sorun değildir.

Potansiyel gereksiz U downgrade: **${s.potentiallyUnnecessaryUndetermined}** (${s.sectionPotentiallyUnnecessary} SEC-19, ${s.marginPotentiallyUnnecessary} margin).
Bu sayı onaylanmış yeni akademik karar sayısı değildir. Önceden U olan open generic kontrolü yeni downgrade sayılmaz.
Korunan confirmed violation: **${s.confirmedViolationPreserved}** kontrollü değerlendirme; kapalı yokluk ve explicit 3cm karşıörnekleri içerir.

| Calibration sınıfı | Kontrollü değerlendirme sayısı |
| --- | ---: |
${Object.entries(s.classificationCounts).map(([name, count]) => `| ${name} | ${count} |`).join("\n")}

## Mevcut iki DOCX — Sprint 35/36 baseline korunması

Her DOCX'te 11 pilotun guard metadata/kararı Sprint 35 ile Sprint 36 arasında eşit bulundu. Aşağıda yalnız üç değişen pilot gösterilir; bu altı satır kontrollü hata toplamlarına katılmaz.

| DOCX | Execution ID | Original → guarded | Reason | Raw selection |
| --- | --- | --- | --- | --- |
${corpusRows.map((row) => `| ${row.file} | ${row.executionId} | ${row.originalDecision} → ${row.guardedDecision} | ${row.reason} | ${cell(row.raw)} |`).join("\n")}

Corpus SEC-19 raw selection bağlamı:

${corpusRows.filter((row) => row.executionId === target.id).map((row) => `- ${row.file}: ${cell(row.selectedParagraphContext.map((p) => ({ text: p.text, inTable: p.inTable, heading: p.heading.certainty })))}.`).join("\n")}

## Uygulanmamış politika iyileştirme önerileri

| Öneri | Beklenen fayda | False-positive riski | False-negative riski | Gerekli onay | Production etkisi |
| --- | --- | --- | --- | --- | --- |
| SEC-19 candidate için keyfi karakter sayısı yerine token sınırları ve tam bileşen/çoklu ayırt edici bileşen bağlamını incele; generic/tek harfleri tek başına yeterli sayma | A/Etki/Değer gürültüsünü azaltır | Sık geçen bileşenler yine aday olabilir | Fazla sert eşik genuine partial/split adayı kaçırıp yanlış yokluk V üretebilir | Teknik kalibrasyon ve ayrı pilot değişiklik incelemesi; compliant eşdeğerliği genişleyecekse ayrıca akademik onay | Bu sprintte yok; production uygulanmaz |
| Mevcut occurrence, revision, placement, block ve heading provenance kaynaklarını yeniden kullan; exact confirmed heading'i ilgisiz distractor'dan ayır | Paralel identity detector kurmadan aday bağlamını güçlendirir | Heading style tek başına akademik kimlik sanılırsa risk sürer | Yalnız confirmed heading zorunluluğu unresolved gerçek başlıkları elememeli; U yolu korunmalı | Teknik semantic inceleme; alias/case/slash kabulü için akademik onay | Yok; normalizer değiştirilmez |
| Raw integer, explicit unit, rounding kaybı ve ölçüm yokluğunu ayrı metadata sınıflarıyla incele | 1701 ile yakın 1417'nin aynı gerekçede kaybolmasını önler | Quantization bandı akademik tolerans sanılırsa false C/V riski | Aşırı geniş U alanı açık ihlalleri saklayabilir | Teknik birim/temsil kanıtı + native belge; kabul sınırı/precision kararı için yetkili normatif onay | Yok; parser/legacy precision değişmez |
| Kaynağa dayalı, temsil belirsizliğinden ayrı bir confirmed violation koruma politikası hazırla; açık integer karşıörnekleri ayrıca test et | 1701 gibi uzak değerlerde gereksiz downgrade'i azaltabilir; bir section'daki karşıörnek diğer eksik section'dan bağımsız kalır | Onaysız numeric threshold normal integer temsillerini false V yapabilir | Fazla geniş koruma eşiği gerçek ihlali U'da bırakabilir | Birim matematiği teknik; neyin akademik ihlal sayılacağı ve yakın temsil sınırı ayrıca onaylanmalı | Yok; yalnız sonraki pilot kararına öneri |
| Missing/malformed/reference uyuşmazlığını fail-closed tut; candidate FP'den ayır; admission reddini violation sayma | Eksik kanıttan kesinlik üretmez | Yanlış missing etiketi gereksiz U artırır | Yanlış eşlenmiş raw veri fark edilmezse kanıtsız C riski | Teknik veri bütünlüğü incelemesi; yeni akademik şart gerektirmez | Yok; v1/provenance/scoring sınırları korunur |

Hiçbir öneri alias, nearest-integer target, ± tolerans veya production requirement olarak kabul edilmedi.

## Remaining blockers ve Sprint 38

- **P0 SEC-19 identity policy** (DR-33-04) açık: geniş eşdeğerlik onayı yok; candidate specificity ve structural bağlam ayrı pilot kalibrasyonu istiyor.
- **P0 margin precision policy** (DR-33-03) açık: 1415–1420 implementation kabul bandı normatif tolerans değildir; uzak integer violation koruması ayrı değerlendirilmelidir.
- **P1 kaynak/scope** (DR-33-01/02) açık: iki kılavuzun byte/metin/kapsam reconciliation'ı bu audit ile yapılmadı; provenance registered-hash-only olarak kalır.
- **P1 native/gerçek belge** (DR-33-05) açık: sentetik ZIP başarıları Word/LibreOffice-native veya gerçek öğrenci kanıtı değildir.
- Bu audit önceki P0/P1'leri kapatmaz. Sprint 35–36 için bildirilen test başarısı, production blocker'larının kapandığı anlamına gelmez.

**Sprint 38: GO — yalnız sınırlı test/pilot candidate specificity ve evidence sınıflaması tasarımı için.**
Margin karar değişikliği ve akademik eşdeğerlikler ilgili onay/kanıt kapıları tamamlanmadan aktive edilmemeli.
**Production onboarding: NO-GO.** Gerçek scope admission default-deny, authorization \`not-granted\`.

## QA ve yeniden üretim

- Audit: ${s.evaluations} kontrollü karar, 22 ayrı corpus pilot baseline kontrolü, beklenmeyen karar ${s.unexpectedDecisions}; protected file/DOCX hash kontrolü.
- Bu sprintte ayrıca doğrulanan regresyonlar: Sprint 35 **48/48 PASS**, Sprint 36 **63/63 PASS**; uygulamalar değiştirilmedi.
- Typecheck, lint ve build **PASS**; build 500 kB chunk boyutu uyarısı verdi. Diff whitespace kontrolü **PASS**; status yalnız önceki untracked uygulamalar ile yeni audit dosyalarını gösterdi.
- \`npm.cmd run test\` çalıştırılmadı. Production/DOCX değişikliği ve add/commit/push yok.

\`\`\`powershell
node tests/audit/sduGuardCalibrationAuditRegression.cjs
node tests/audit/sduConservativeDecisionGuardRegression.cjs
node tests/audit/sduGuardedAssessmentBatchRegression.cjs
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short
\`\`\`

Raporu aynı gözlemlerle yenilemek için: \`node tests/audit/sduGuardCalibrationAuditRegression.cjs --write-report\`.
Normal audit koşusu, bu dokümanın gözlemlerle birebir eşleştiğini de doğrular.

Yerel dayanaklar: [numeric contract](../MARGIN_NUMERIC_AND_PRECISION_CONTRACT.md),
[Sprint 33 karar hazırlığı](SDU_SPRINT_33_POLICY_APPROVAL_PREPARATION.md),
[Sprint 34 kaynak kapısı](SDU_SPRINT_34_SOURCE_ACQUISITION_GATE.md).
Yeni PDF erişimi, kaynak doğrulaması veya akademik onay iddiası yoktur.
`;
}

async function main() {
  const data = await audit();
  const rendered = renderReport(data);
  if (process.argv.includes("--write-report")) fs.writeFileSync(reportPath, rendered, "utf8");
  else assert.equal(fs.readFileSync(reportPath, "utf8"), rendered, "Audit documentation is stale; inspect differences before explicitly regenerating.");
  console.log(JSON.stringify({ sectionEvidenceMatrix: data.sectionRows, marginEvidenceMatrix: data.marginRows, corpusBaseline: data.corpusRows }));
  console.log(JSON.stringify({ audit: "sduGuardCalibration", result: "PASS", ...data.summary }));
}
module.exports = { sectionCases, marginCases };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
