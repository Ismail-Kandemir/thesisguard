const assert = require("node:assert/strict");
require("../golden/experimentalGoldenRegression.cjs");
const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { MarginValidator } = require("../../src/features/analysis/rules/validators/MarginValidator.ts");
const { decideRuleAssessment } = require("../../src/features/analysis/rules/ruleAssessment.ts");
const { runSduMarginAssessmentPilot } = require("./sduMarginAssessmentPilot.ts");

const wrap = (body) => '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>';
const attribute = (side, value) => value === null ? "" : ` w:${side}="${value}"`;
function section(top, bottom) {
  return '<w:sectPr><w:pgMar' + attribute("top", top) + attribute("bottom", bottom) + '/></w:sectPr>';
}
function document(side, values) {
  return parseDocumentXml(wrap(values.map((value, index) => {
    const properties = section(side === "top" ? value : "1417", side === "bottom" ? value : "1417");
    return index === values.length - 1 ? '<w:p/>' + properties : '<w:p><w:pPr>' + properties + '</w:pPr></w:p>';
  }).join("")));
}
const rule = (side, expected = 2.5) => ({
  id: `numeric-evidence-test.${side}`, type: `MARGIN_${side.toUpperCase()}`, category: "margin",
  expected, title: "Numeric margin evidence", description: "Test only", severity: "error", score: 0,
  message: "Test", solution: "", enabled: true, version: "test",
});
const cases = [
  { label: "missing", raw: null, value: null, before: null },
  { label: "empty", raw: "", value: null, before: 0 },
  { label: "whitespace", raw: " \t\r\n ", value: null, before: 0 },
  { label: "nonnumeric", raw: "invalid", value: null, before: null },
  { label: "NaN", raw: "NaN", value: null, before: null },
  { label: "infinite", raw: "Infinity", value: null, before: null },
  { label: "numeric zero", raw: "0", value: 0, before: 0 },
  { label: "padded zero", raw: " 0 ", value: 0, before: 0 },
  { label: "matching positive", raw: "1417", value: 2.5, before: 2.5 },
  { label: "padded positive", raw: " 1417 ", value: 2.5, before: 2.5 },
  { label: "mismatching positive", raw: "1701", value: 3, before: 3 },
];
let checks = 0;
function check(label, run) { run(); checks += 1; console.log(`PASS ${label}`); }

for (const side of ["top", "bottom"]) {
  check(`${side}: raw attribute states reach both normalized margin views and assessment`, () => {
    const validator = new MarginValidator(side);
    for (const sample of cases) {
      const parsed = document(side, [sample.raw]);
      assert.equal(parsed.pageMargins[side], sample.value, sample.label);
      assert.equal(parsed.pageSections[0].pageMargins[side], sample.value, sample.label);
      const assessment = validator.assess(parsed, rule(side));
      const expectedDecision = sample.value === null ? "undetermined" : sample.value === 2.5 ? "compliant" : "violation";
      assert.equal(decideRuleAssessment(assessment), expectedDecision, sample.label);
      assert.equal(assessment.observations[0].evidence.certainty, sample.value === null ? "missing" : "sufficient");
    }
  });
  check(`${side}: explicit zero stays numeric and is not converted to undetermined`, () => {
    const validator = new MarginValidator(side);
    // Zero expected is a comparator control, not a new academic requirement.
    assert.equal(decideRuleAssessment(validator.assess(document(side, ["0"]), rule(side, 0))), "compliant");
    assert.equal(decideRuleAssessment(validator.assess(document(side, [""]), rule(side, 0))), "undetermined");
    assert.equal(validator.validate(document(side, ["0"]), rule(side, 0)).status, "PASSED");
    assert.equal(validator.validate(document(side, [""]), rule(side, 0)).status, "FAILED");
  });
  check(`${side}: mixed known/unknown sections never establish full compliance`, () => {
    for (const raw of [null, "", " \t ", "invalid"]) {
      for (const values of [["1417", raw], [raw, "1417"], ["1417", raw, "1417"]]) {
        const parsed = document(side, values);
        const entry = runSduMarginAssessmentPilot(parsed).find((item) => item.ruleId.endsWith(`.${side}`));
        assert.equal(entry.kind, "assessment");
        assert.equal(entry.decision, "undetermined");
        assert.equal(entry.assessment.observations.length, values.length);
        assert.equal(entry.assessment.observations.filter((item) => item.state === "undetermined").length, 1);
      }
    }
  });
  check(`${side}: genuine violations survive unrelated unknown evidence`, () => {
    const parsed = document(side, ["1417", "1701", ""]);
    const assessment = new MarginValidator(side).assess(parsed, rule(side));
    assert.equal(decideRuleAssessment(assessment), "violation");
    assert.deepEqual(assessment.observations.map((item) => item.state), ["confirmed", "confirmed", "undetermined"]);
    assert.deepEqual(parsed.pageSections.map((item) => item.pageMargins[side]), [2.5, 3, null]);
  });
  check(`${side}: legacy comparison changes only recovered blank evidence`, () => {
    const validator = new MarginValidator(side);
    for (const sample of cases) {
      const parsed = document(side, [sample.raw]);
      // Captured pre-fix normalized values from Sprint 11. The same unchanged
      // validate() consumes the old snapshot and the newly parsed document.
      const beforeDocument = structuredClone(parsed);
      beforeDocument.pageMargins[side] = sample.before;
      beforeDocument.pageSections[0].pageMargins[side] = sample.before;
      const before = validator.validate(beforeDocument, rule(side));
      const after = validator.validate(parsed, rule(side));
      if (sample.before === sample.value) {
        assert.deepEqual(after, before, sample.label);
      } else {
        assert.equal(before.status, "FAILED");
        assert.equal(after.status, "FAILED");
        assert.equal(before.actual, 0);
        assert.equal(after.actual, null);
        assert.equal(before.evidence[0].actual, 0);
        assert.equal(after.evidence[0].actual, null);
        assert.notEqual(after.message, before.message);
        assert.equal(validator.validate(beforeDocument, rule(side, 0)).status, "PASSED");
        assert.equal(validator.validate(parsed, rule(side, 0)).status, "FAILED");
      }
    }
  });
}
check("shared margin reader applies the blank guard to left/right without losing zero", () => {
  const parsed = parseDocumentXml(wrap('<w:p/><w:sectPr><w:pgMar w:left="" w:right=" " w:top="0" w:bottom="1417"/></w:sectPr>'));
  assert.deepEqual(parsed.pageMargins, { left: null, right: null, top: 0, bottom: 2.5 });
  assert.deepEqual(parsed.pageSections[0].pageMargins, parsed.pageMargins);
});
check("missing pgMar and missing section evidence retain existing unknown semantics", () => {
  for (const body of ['<w:p/><w:sectPr/>', '<w:p/>']) {
    const parsed = parseDocumentXml(wrap(body));
    assert.equal(parsed.pageMargins.top, null);
    assert.equal(parsed.pageMargins.bottom, null);
    assert.deepEqual(runSduMarginAssessmentPilot(parsed).map((entry) => entry.decision), ["undetermined", "undetermined"]);
  }
});
console.log(JSON.stringify({ audit: "marginNumericEvidenceRegression", result: "PASS", cases: checks, rawCasesPerSide: cases.length, fixturesWritten: 0 }));
