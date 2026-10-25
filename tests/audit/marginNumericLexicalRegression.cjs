const assert = require("node:assert/strict");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { MarginValidator } = require("../../src/features/analysis/rules/validators/MarginValidator.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { RuleEngine } = require("../../src/features/analysis/engine/RuleEngine.ts");
const { RuleResolver } = require("../../src/features/analysis/rules/RuleResolver.ts");
const { RuleSetSelector } = require("../../src/features/analysis/rules/RuleSetSelector.ts");
const { runSduMarginAssessmentPilot } = require("./sduMarginAssessmentPilot.ts");

const wrap = (body) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const section = (raw) => `<w:sectPr><w:pgMar${["top", "bottom", "left", "right"].map((side) => raw === null ? "" : ` w:${side}="${raw}"`).join("")}/></w:sectPr>`;
const document = (raw) => parseDocumentXml(wrap('<w:p/>' + section(raw)));
const rule = (side) => ({ id: `audit.margin.lexical.${side}`, type: `MARGIN_${side.toUpperCase()}`, category: "margin",
  expected: { value: 2.5, unit: "cm" }, title: "Synthetic lexical comparison control", description: "Test only; not an academic source",
  severity: "error", score: 0, message: "Test only", solution: "", enabled: true, version: "test" });
let cases = 0;
function check(label, run) { run(); cases++; console.log(`PASS ${label}`); }

// Fixed schema-derived lexical examples; expected cm values do not implement a
// second production parser. Null means invalid OR unsupported evidence, not N/A.
const positive = [
  ["1417", 2.5], ["0001417", 2.5], ["+001417", 2.5], [" 1417 ", 2.5], ["\t1417\r\n", 2.5],
  ["0", 0], ["+0000", 0], ["-0", -0], ["0.000cm", 0], ["002.500cm", 2.5],
  ["2.5cm", 2.5], ["25mm", 2.5], ["1in", 2.54], ["72pt", 2.54], ["6pc", 2.54], ["6pi", 2.54],
];
const invalidOrUnsupported = [null, "", " \t\r\n ", "1417.0", "1417.", ".1417", "1417.3228346456692", "1.417e3", "1417E0",
  "0x589", "0X589", "0b10110001001", "NaN", "Infinity", "-Infinity", "2,5", "bad", "1417 0",
  "2.5CM", "2.5 cm", " 2.5cm", "2.5cm ", "+2.5cm", ".5cm", "2.cm", "2.5m", "2.5px", "2.5e0cm",
  "\u00a01417\u00a0", "١٤١٧", "9007199254740992", "9007199254740993", "-9007199254740992",
  "9".repeat(400), "9".repeat(400) + "cm", "9007199254740991cm", "0." + "0".repeat(400) + "1cm"];

for (const side of ["top", "bottom", "left", "right"]) {
  check(`${side}: schema-defined integer and unit forms reach both margin views`, () => {
    const validator = new MarginValidator(side);
    for (const [raw, expected] of positive) {
      const parsed = document(raw);
      assert.equal(parsed.pageMargins[side], expected, raw);
      assert.equal(parsed.pageSections[0].pageMargins[side], expected, raw);
      const assessment = validator.assess(parsed, rule(side));
      assert.equal(decideRuleAssessment(assessment), expected === 2.5 ? "compliant" : "violation", raw);
      assert.equal(assessment.observations[0].evidence.certainty, "sufficient", raw);
    }
  });
  check(`${side}: negative integer/unit signs respect signed versus unsigned margin types`, () => {
    const validator = new MarginValidator(side);
    for (const raw of ["-1417", "-001417", "-2.5cm", "-25mm", "-1in", "-0cm"]) {
      const parsed = document(raw);
      const assessment = validator.assess(parsed, rule(side));
      if (side === "top" || side === "bottom") {
        assert.equal(typeof parsed.pageMargins[side], "number", raw);
        assert.equal(decideRuleAssessment(assessment), "violation", raw);
      } else {
        assert.equal(parsed.pageMargins[side], null, raw);
        assert.equal(decideRuleAssessment(assessment), "undetermined", raw);
      }
    }
  });
  check(`${side}: malformed lexemes and unsupported magnitudes never establish compliance`, () => {
    const validator = new MarginValidator(side);
    for (const raw of invalidOrUnsupported) {
      const parsed = document(raw);
      assert.equal(parsed.pageMargins[side], null, raw);
      assert.equal(parsed.pageSections[0].pageMargins[side], null, raw);
      const assessment = validator.assess(parsed, rule(side));
      assert.equal(decideRuleAssessment(assessment), "undetermined", raw);
      assert.equal(assessment.observations[0].evidence.certainty, "missing", raw);
      assert.equal(Object.hasOwn(assessment.observations[0], "finding"), false, raw);
    }
  });
  check(`${side}: safe integer bound is a runtime boundary, not an invented 32-bit schema limit`, () => {
    for (const raw of ["2147483648", "9007199254740991"]) {
      const parsed = document(raw);
      assert.equal(typeof parsed.pageMargins[side], "number");
      assert.ok(Number.isFinite(parsed.pageMargins[side]));
      assert.equal(decideRuleAssessment(new MarginValidator(side).assess(parsed, rule(side))), "violation");
    }
  });
}

check("multiple sections preserve unknown evidence and confirmed violations independently", () => {
  for (const [values, decision] of [
    [["1417", "0x589", "2.5cm"], "undetermined"],
    [["1417", "1.417e3", "1701"], "violation"],
    [["2.5cm", "+001417", "25mm"], "compliant"],
  ]) {
    const body = values.map((raw, index) => index === values.length - 1
      ? '<w:p/>' + section(raw) : `<w:p><w:pPr>${section(raw)}</w:pPr></w:p>`).join("");
    const parsed = parseDocumentXml(wrap(body));
    assert.equal(parsed.pageSections.length, 3);
    for (const entry of runSduMarginAssessmentPilot(parsed)) {
      assert.equal(entry.kind, "assessment");
      assert.equal(entry.decision, decision);
      assert.equal(entry.assessment.coverage.population, "closed");
      assert.deepEqual(entry.assessment.observations.map((item) => item.subject.sectionIndex), [0, 1, 2]);
    }
  }
});
check("open terminal coverage cannot prove compliance, but retains a confirmed violation", () => {
  for (const [values, decision] of [[["1417", "2.5cm"], "undetermined"], [["1417", "0x589"], "undetermined"], [["1701", "0x589"], "violation"]]) {
    const parsed = parseDocumentXml(wrap(values.map((raw) => `<w:p><w:pPr>${section(raw)}</w:pPr></w:p>`).join("")));
    runSduMarginAssessmentPilot(parsed).forEach((entry) => {
      assert.equal(entry.decision, decision);
      assert.equal(entry.assessment.coverage.population, "open");
    });
  }
  const noPgMar = parseDocumentXml(wrap('<w:p/><w:sectPr/>'));
  assert.deepEqual(runSduMarginAssessmentPilot(noPgMar).map((entry) => entry.decision), ["undetermined", "undetermined"]);
});
check("existing precision policy remains unchanged; alternative comparisons are diagnostic only", () => {
  const rows = [];
  for (const [raw, cm, decision] of [[1414, 2.49, "violation"], [1415, 2.5, "compliant"], [1416, 2.5, "compliant"],
    [1417, 2.5, "compliant"], [1418, 2.5, "compliant"], [1419, 2.5, "compliant"], [1420, 2.5, "compliant"], [1421, 2.51, "violation"]]) {
    const parsed = document(String(raw));
    assert.equal(parsed.pageMargins.top, cm);
    assert.equal(runSduMarginAssessmentPilot(parsed)[0].decision, decision);
    const exactRationalEquality = BigInt(raw) * 127n === 180000n;
    assert.equal(exactRationalEquality, false);
    rows.push({ rawTwips: raw, mathematicalCm: raw * 127 / 72000, policyAParsedCm: cm, policyADecision: decision,
      policyBExactRationalEquality: exactRationalEquality, nearestIntegerControlOnly: raw === 1417 });
  }
  assert.equal(document("2.5cm").pageMargins.top, 2.5);
  console.log(JSON.stringify({ precisionComparison: rows,
    policyC: "Schema explicit-unit representation 2.5cm is supported; no new source-approved integer tolerance.",
    activatedPolicy: "Existing two-decimal cm comparison only" }));
});
check("legacy COMU impact is explicit: invalid lexemes lose PASS and valid units recover evidence", () => {
  const resolved = new RuleResolver().resolve(new RuleSetSelector().select({ universityId: "comu", facultyId: "applied-sciences",
    departmentId: "food-technology", thesisTypeId: "bachelor", studyTypeId: "experimental" }));
  assert.equal(resolved.length, 46);
  const right = resolved.find((item) => item.id === "comu.bachelor.margin.right");
  assert.ok(right);
  const changes = [];
  for (const [raw, beforeCm, beforeStatus, afterStatus] of [["0x589", 2.5, "PASSED", "FAILED"],
    ["1.417e3", 2.5, "PASSED", "FAILED"], ["1417.0", 2.5, "PASSED", "FAILED"], ["2.5cm", null, "FAILED", "PASSED"]]) {
    const parsed = document(raw);
    const before = structuredClone(parsed);
    before.pageMargins.right = beforeCm; before.pageSections[0].pageMargins.right = beforeCm;
    const engine = new RuleEngine();
    assert.equal(engine.run(before, [right])[0].status, beforeStatus);
    assert.equal(engine.run(parsed, [right])[0].status, afterStatus);
    changes.push({ raw, beforeCm, afterCm: parsed.pageMargins.right, beforeStatus, afterStatus });
  }
  console.log(JSON.stringify({ legacyComuCounterexamples: changes, note: "Unchanged validate() consumes corrected numeric evidence; ordinary corpus is checked separately." }));
});
check("other numeric OOXML fields retain their prior behavior", () => {
  const parsed = parseDocumentXml(wrap('<w:p/><w:sectPr><w:pgSz w:w="0x589" w:h="1.417e3"/><w:pgMar w:top="0x589" w:bottom="1.417e3"/></w:sectPr>'));
  assert.equal(parsed.pageSize.widthMm, 24.99);
  assert.equal(parsed.pageSize.heightMm, 24.99);
  assert.equal(parsed.pageMargins.top, null);
  assert.equal(parsed.pageMargins.bottom, null);
});
console.log(JSON.stringify({ audit: "marginNumericLexical", result: "PASS", cases, positiveLexemesPerSide: positive.length,
  invalidOrUnsupportedLexemesPerSide: invalidOrUnsupported.length, fixtureWrites: 0,
  scope: "pgMar only; existing precision retained; no production onboarding" }));
