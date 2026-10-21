const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
require("../golden/experimentalGoldenRegression.cjs");
const { sduSectionPresenceAssessmentPilot: pilot, readSduSectionPresencePilotDocx: readDocx,
  runSduSectionPresenceAssessmentPilot: runPilot } = require("./sduSectionPresenceAssessmentPilot.ts");
const { normalizeAcademicSections } = require("../../src/features/analysis/parsers/academicSectionsNormalizer.ts");
const { resolveHeadingStyleProvenance } = require("../../src/features/analysis/parsers/headingStyleProvenance.ts");
const { markRequiredSectionHeadings } = require("../../src/features/analysis/rules/markRequiredSectionHeadings.ts");

const fixtureDirectory = path.join(__dirname, "../fixtures/comu/food-technology/experimental");
const filenames = ["full-correct.docx", "automatic-heading-numbering-synthetic.docx"];
const rules = pilot.candidates.map((candidate) => candidate.rule);
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const paragraph = (text, style = null, outline) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${outline === undefined ? "" : `<w:outlineLvl w:val="${outline}"/>`}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const style = (id, name, parent, outline) => `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/>${parent ? `<w:basedOn w:val="${parent}"/>` : ""}${outline === undefined ? "" : `<w:pPr><w:outlineLvl w:val="${outline}"/></w:pPr>`}</w:style>`;
const qualified = (doc) => normalizeAcademicSections(markRequiredSectionHeadings(doc, rules), rules);
const failures = [];
let passed = 0;
let diskCopies = 0;

async function check(label, run) {
  try { await run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failures.push({ label, error: error.stack }); console.error(`FAIL ${label}: ${error.message}`); }
}

function assertEntry(entry, rule, decision, coverage) {
  assert.equal(entry.kind, "assessment", JSON.stringify(entry));
  assert.equal(entry.ruleId, rule.id);
  assert.equal(entry.assessment.reference.id, rule.id);
  assert.equal(entry.assessment.applicability.state, "applicable");
  assert.equal(entry.decision, decision);
  assert.equal(entry.assessment.coverage.population, coverage);
  assert.notEqual(entry.decision, "not-applicable");
  for (const key of ["score", "status", "passed"]) assert.equal(Object.hasOwn(entry, key), false);
}

function evidenceRow(doc, occurrence, entry) {
  const p = doc.paragraphs[occurrence.headingParagraphIndex];
  const provenance = resolveHeadingStyleProvenance(doc, p);
  return {
    paragraphId: p.id, text: p.text, style: p.styleId, paragraphOutline: p.outlineLevel ?? "absent",
    styleChain: provenance.styleIds.map((id) => {
      const definition = doc.styles.find((item) => item.id === id);
      return { id, basedOn: definition.basedOn, outline: definition.outlineLevel ?? "absent" };
    }),
    numbering: p.numbering, provenance, structuralIdentity: occurrence.structuralIdentity,
    extractionCoverage: doc.sectionExtractionCoverage.population,
    assessmentCoverage: entry.assessment.coverage.population, decision: entry.decision,
  };
}

function scenarios(section) {
  const heading = paragraph(section, "Heading1");
  const custom = style("CalibrationHeading", "Calibration heading", "Heading1");
  return [
    { name: "valid-heading1", body: heading, styleId: "Heading1", identity: "confirmed", provenance: "confirmed", source: "style-outline", chain: ["Heading1", "Normal"], decision: "compliant" },
    { name: "explicit-outline", body: paragraph(section, null, "0"), styleId: null, outline: 0, identity: "confirmed", provenance: "confirmed", source: "paragraph-outline", chain: ["Normal"], decision: "compliant" },
    { name: "valid-inherited-style", body: paragraph(section, "CalibrationHeading"), styles: custom, styleId: "CalibrationHeading", identity: "confirmed", provenance: "confirmed", source: "style-outline", chain: ["CalibrationHeading", "Heading1", "Normal"], decision: "compliant" },
    // No visible numbering; a valid custom outline supplies manual heading semantics.
    { name: "manual-unnumbered-heading", body: paragraph(section, "CalibrationManual"), styles: style("CalibrationManual", "Manual section", "Normal", "0"), styleId: "CalibrationManual", identity: "confirmed", provenance: "confirmed", source: "style-outline", chain: ["CalibrationManual", "Normal"], decision: "compliant" },
    { name: "uppercase-name-only", body: paragraph(section.toLocaleUpperCase("tr-TR")), styleId: null, identity: "unresolved", provenance: "non-heading", source: "none", chain: ["Normal"], decision: "undetermined" },
    { name: "misleading-heading-substring", body: paragraph(section, "CalibrationQuote"), styles: style("CalibrationQuote", "Quotation Heading1 Example", "Normal"), styleId: "CalibrationQuote", identity: "unresolved", provenance: "non-heading", source: "none", chain: ["CalibrationQuote", "Normal"], decision: "undetermined" },
    { name: "outline-nine", body: paragraph(section, null, "9"), styleId: null, outline: 9, identity: "unresolved", provenance: "non-heading", source: "paragraph-outline", chain: ["Normal"], decision: "undetermined" },
    { name: "misleading-substring-outline-nine", body: paragraph(section, "CalibrationQuote", "9"), styles: style("CalibrationQuote", "Quotation Heading1 Example", "Normal"), styleId: "CalibrationQuote", outline: 9, identity: "unresolved", provenance: "non-heading", source: "paragraph-outline", chain: ["CalibrationQuote", "Normal"], decision: "undetermined" },
    { name: "missing-style", body: paragraph(section, "CalibrationMissing"), styleId: "CalibrationMissing", identity: "unresolved", provenance: "unresolved", source: "none", chain: [], decision: "undetermined" },
    { name: "broken-inheritance", body: paragraph(section, "CalibrationBroken"), styles: style("CalibrationBroken", "Broken heading", "CalibrationMissing"), styleId: "CalibrationBroken", identity: "unresolved", provenance: "unresolved", source: "none", chain: ["CalibrationBroken"], decision: "undetermined" },
    { name: "cyclic-inheritance", body: paragraph(section, "CalibrationCycleA"), styles: style("CalibrationCycleA", "Cycle A", "CalibrationCycleB") + style("CalibrationCycleB", "Cycle B", "CalibrationCycleA"), styleId: "CalibrationCycleA", identity: "unresolved", provenance: "unresolved", source: "none", chain: ["CalibrationCycleA", "CalibrationCycleB"], decision: "undetermined" },
    { name: "nested-heading", body: paragraph(`1.1 ${section}`, "Heading2"), styleId: "Heading2", numbering: "text", numberingLevel: 1, identity: "ambiguous", provenance: "confirmed", source: "style-outline", chain: ["Heading2", "Normal"], decision: "undetermined" },
    { name: "competing-occurrences", body: heading + heading, styleId: "Heading1", count: 2, identity: "ambiguous", provenance: "confirmed", source: "style-outline", chain: ["Heading1", "Normal"], decision: "undetermined" },
    { name: "table-cell-candidate", body: `<w:tbl><w:tr><w:tc>${heading}</w:tc></w:tr></w:tbl>`, carrier: "table", count: 0, decision: "undetermined", coverage: "open" },
    { name: "textbox-candidate", body: `<w:p><w:r><w:pict><w:txbxContent>${heading}</w:txbxContent></w:pict></w:r></w:p>`, carrier: "textbox", count: 0, decision: "undetermined", coverage: "open" },
    { name: "open-coverage-present", body: heading + '<w:altChunk/>', styleId: "Heading1", identity: "confirmed", provenance: "confirmed", source: "style-outline", chain: ["Heading1", "Normal"], decision: "undetermined", coverage: "open", extraction: "open" },
    { name: "open-coverage-absent", body: paragraph("Body") + '<w:altChunk/>', count: 0, decision: "undetermined", coverage: "open", extraction: "open" },
    { name: "closed-confirmed-absence", body: paragraph("Body"), count: 0, decision: "violation" },
  ];
}

async function main() {
  const originalHashes = new Map(filenames.map((filename) => [filename, hash(fs.readFileSync(path.join(fixtureDirectory, filename)))]));
  const temporaryRoot = path.resolve(os.tmpdir());
  const temporaryDirectory = fs.mkdtempSync(path.join(temporaryRoot, "thesisguard-section-calibration-"));
  try {
    for (const [fileIndex, filename] of filenames.entries()) {
      await check(`original DOCX evidence audit: ${filename}`, async () => {
        const bytes = fs.readFileSync(path.join(fixtureDirectory, filename));
        const zip = await JSZip.loadAsync(bytes);
        const xml = await zip.file("word/document.xml").async("string");
        const stylesXml = await zip.file("word/styles.xml").async("string");
        const doc = await readDocx(bytes);
        const normalized = qualified(doc);
        const entries = runPilot(doc);
        for (const [index, rule] of rules.entries()) {
          const occurrences = normalized.academicSections.occurrences.filter((item) => item.canonicalName === rule.expected.section);
          if (index >= 3) {
            assert.equal(occurrences.length, 0);
            assertEntry(entries[index], rule, "violation", "closed");
            assert.equal(doc.sectionExtractionCoverage.population, "closed");
            assert.equal(entries[index].assessment.observations[0].finding, "violation");
            assert.equal(entries[index].assessment.observations[0].identity.certainty, "not-required");
            assert.equal(doc.paragraphs.some((p) => p.text.toLocaleLowerCase("tr-TR") === rule.expected.section.toLocaleLowerCase("tr-TR")), false);
            assert.equal(xml.toLocaleLowerCase("tr-TR").includes(rule.expected.section.toLocaleLowerCase("tr-TR")), false);
            console.log(JSON.stringify({ originalDocx: filename, inventoryId: pilot.candidates[index].inventoryId,
              section: rule.expected.section, paragraphStyle: "no matching paragraph", outline: "absent", numbering: "absent",
              structuralIdentity: "no matching occurrence", extractionCoverage: doc.sectionExtractionCoverage,
              assessment: entries[index] }));
            continue;
          }
          assert.equal(occurrences.length, 1);
          const occurrence = occurrences[0];
          const p = doc.paragraphs[occurrence.headingParagraphIndex];
          const row = evidenceRow(doc, occurrence, entries[index]);
          assertEntry(entries[index], rule, index === 0 ? "compliant" : "undetermined", "closed");
          assert.equal(row.extractionCoverage, "closed");
          assert.equal(p.id, ["paragraph-21", "paragraph-7", "paragraph-10"][index]);
          assert.equal(p.outlineLevel, undefined);
          assert.equal(p.styleId, index === 0 ? "Heading1" : null);
          assert.equal(occurrence.structuralIdentity.certainty, index === 0 ? "confirmed" : "unresolved");
          assert.deepEqual(row.provenance.styleIds, index === 0 ? ["Heading1", "Normal"] : ["Normal"]);
          assert.equal(row.provenance.level, index === 0 ? 0 : null);
          assert.equal(p.numbering.source, index === 0 ? ["text", "word"][fileIndex] : "none");
          assert.equal(p.numbering.visibleLabel, index === 0 ? "1." : null);
          assert.equal(p.numbering.level, index === 0 ? 0 : null);
          const paragraphXml = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g).find((item) => item.includes(`<w:t>${p.text}</w:t>`));
          assert.ok(paragraphXml);
          assert.equal(/<w:outlineLvl\b/.test(paragraphXml), false);
          assert.equal(/<w:pStyle\b/.test(paragraphXml), index === 0);
          assert.ok(stylesXml.includes('w:styleId="Heading1"'));
          console.log(JSON.stringify({ originalDocx: filename, inventoryId: pilot.candidates[index].inventoryId, paragraphXml, ...row }));
        }
      });
    }

    // Controlled OOXML mutations of a package copy, never claims about actual students.
    const baseBytes = fs.readFileSync(path.join(fixtureDirectory, filenames[0]));
    const base = await JSZip.loadAsync(baseBytes);
    const originalXml = await base.file("word/document.xml").async("string");
    const originalStyles = await base.file("word/styles.xml").async("string");
    const sectionProperties = originalXml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g).at(-1);
    assert.ok(sectionProperties);
    for (const [index, rule] of rules.entries()) {
      for (const scenario of scenarios(rule.expected.section)) {
        await check(`${pilot.candidates[index].inventoryId}: disk DOCX ${scenario.name}`, async () => {
          const zip = await JSZip.loadAsync(baseBytes);
          const xml = originalXml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${scenario.body}${sectionProperties}</w:body>`);
          const stylesXml = originalStyles.replace('</w:styles>', `${scenario.styles ?? ""}</w:styles>`);
          assert.ok(xml.includes(scenario.body));
          if (scenario.styles) assert.ok(stylesXml.includes(scenario.styles));
          zip.file("word/document.xml", xml);
          zip.file("word/styles.xml", stylesXml);
          const filePath = path.join(temporaryDirectory, `${index}-${scenario.name}.docx`);
          fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
          diskCopies++;
          const bytes = fs.readFileSync(filePath);
          const digestBefore = hash(bytes);
          const diskZip = await JSZip.loadAsync(bytes);
          assert.equal(await diskZip.file("word/document.xml").async("string"), xml);
          assert.equal(await diskZip.file("word/styles.xml").async("string"), stylesXml);
          assert.equal(await diskZip.file("word/numbering.xml").async("string"), await base.file("word/numbering.xml").async("string"));
          const doc = await readDocx(bytes);
          const before = JSON.stringify(doc);
          const normalized = qualified(doc);
          const entry = runPilot(doc, undefined, [rule])[0];
          assertEntry(entry, rule, scenario.decision, scenario.coverage ?? "closed");
          assert.equal(doc.sectionExtractionCoverage.population, scenario.extraction ?? "closed");
          const occurrences = normalized.academicSections.occurrences.filter((item) => item.canonicalName === rule.expected.section);
          assert.equal(occurrences.length, scenario.count ?? 1);
          for (const occurrence of occurrences) {
            const p = doc.paragraphs[occurrence.headingParagraphIndex];
            const provenance = resolveHeadingStyleProvenance(doc, p);
            assert.equal(p.styleId, scenario.styleId);
            assert.equal(p.outlineLevel, scenario.outline);
            assert.equal(p.numbering.source, scenario.numbering ?? "none");
            assert.equal(p.numbering.level, scenario.numberingLevel ?? null);
            assert.equal(occurrence.structuralIdentity.certainty, scenario.identity);
            assert.equal(provenance.certainty, scenario.provenance);
            assert.equal(provenance.source, scenario.source);
            assert.deepEqual(provenance.styleIds, scenario.chain);
            assert.deepEqual(occurrence.structuralIdentity.headingProvenance, provenance);
            const observation = entry.assessment.observations.find((item) => item.evidence.items.some((proof) => proof.paragraphId === p.id));
            assert.ok(observation);
            assert.equal(observation.identity.certainty, scenario.identity);
            const qualificationProof = observation.evidence.items.find((item) => item.property === "academic-section.structural-identity");
            assert.deepEqual(JSON.parse(qualificationProof.actual), occurrence.structuralIdentity);
            console.log(JSON.stringify({ controlledDocx: path.basename(filePath), bodyXml: scenario.body, ...evidenceRow(doc, occurrence, entry) }));
          }
          if (scenario.carrier) {
            const p = doc.paragraphs.find((item) => item.text === rule.expected.section);
            assert.ok(p, "Excluded carrier text must remain inspectable as evidence");
            assert.equal(p.isInTableCell, scenario.carrier === "table");
            assert.equal(p.contentScope, scenario.carrier === "textbox" ? "textbox" : "document");
            assert.equal(p.styleId, "Heading1");
            assert.equal(p.outlineLevel, undefined);
            assert.equal(p.numbering.source, "none");
            assert.equal(resolveHeadingStyleProvenance(doc, p).certainty, "confirmed");
            assert.deepEqual(resolveHeadingStyleProvenance(doc, p).styleIds, ["Heading1", "Normal"]);
            assert.equal(entry.assessment.observations.length, 0);
            assert.ok(entry.assessment.coverage.unresolvedSubjects.some((item) => item.paragraphId === p.id));
          }
          if (occurrences.length === 0) {
            console.log(JSON.stringify({ controlledDocx: path.basename(filePath), bodyXml: scenario.body,
              structuralIdentity: scenario.carrier ? "unsupported-carrier; no academic occurrence" : "no matching occurrence",
              paragraphs: doc.paragraphs.map((p) => ({ text: p.text, style: p.styleId, outline: p.outlineLevel ?? "absent", numbering: p.numbering, context: p.sectionContext })),
              extractionCoverage: doc.sectionExtractionCoverage, assessment: entry }));
          }
          if (scenario.decision === "violation") {
            assert.equal(entry.assessment.observations[0].finding, "violation");
            assert.equal(entry.assessment.observations[0].identity.certainty, "not-required");
          }
          assert.equal(JSON.stringify(doc), before);
          assert.equal(hash(fs.readFileSync(filePath)), digestBefore);
        });
      }
    }
  } finally {
    // Verify the exact temporary parent and prefix before recursive cleanup.
    assert.equal(path.dirname(path.resolve(temporaryDirectory)), temporaryRoot);
    assert.ok(path.basename(temporaryDirectory).startsWith("thesisguard-section-calibration-"));
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    assert.equal(fs.existsSync(temporaryDirectory), false);
    for (const [filename, before] of originalHashes) assert.equal(hash(fs.readFileSync(path.join(fixtureDirectory, filename))), before);
  }
  console.log(JSON.stringify({ audit: "sduSectionEvidenceCalibration", passed, failed: failures.length, diskCopies,
    originalPackages: filenames.length, fixtureWrites: 0, temporaryCopiesRemoved: true,
    provenance: "Synthetic OOXML package copies; not Word-native or SDU student documents", failures }));
  if (failures.length > 0) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
