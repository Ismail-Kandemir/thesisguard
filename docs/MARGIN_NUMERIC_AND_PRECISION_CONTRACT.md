# Margin numeric evidence and precision contract

Sprint 30 changes only the `w:pgMar` margin reader in `documentXmlParser.ts`.
It does not change validators, academic requirements, scoring, section identity,
admission or production university configuration.

## Lexical authority

ECMA-376 Part 1, Annex A schema definitions:

- `CT_PageMar`: `top` and `bottom` use `ST_SignedTwipsMeasure`;
  `left` and `right` use `ST_TwipsMeasure`.
- `ST_SignedTwipsMeasure`: union of `xsd:integer` and `ST_UniversalMeasure`.
- `ST_TwipsMeasure`: union of `ST_UnsignedDecimalNumber` (`xsd:unsignedLong`)
  and `ST_PositiveUniversalMeasure`.
- `ST_UniversalMeasure`: `-?[0-9]+(\.[0-9]+)?(mm|cm|in|pt|pc|pi)`.
- The positive universal measure branch excludes the minus sign.

Sources consulted:

- [ECMA-376 publication and Part 1](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- [WordprocessingML reference schema](https://github.com/python-openxml/python-docx/blob/master/ref/xsd/wml.xsd)
- [Shared simple-type reference schema](https://github.com/python-openxml/python-docx/blob/master/ref/xsd/shared-commonSimpleTypes.xsd)
- [W3C integer lexical representation](https://www.w3.org/TR/xmlschema-2/#integer)

The schema copies above are maintained by python-docx. The ECMA archive could
not be fetched in this session; this is not a newly verified standards archive.
The matching union/measure patterns were also checked with the .NET XML Schema
validator in memory. Regression tests do not require network access.

## Supported evidence

- Integer branch: decimal digits, optional leading `+`/`-`, leading zeros and
  surrounding XML whitespace (space, tab, CR, LF). Negative values are supported
  for top/bottom only. Unsigned integer `-0` denotes zero.
- Explicit-unit branch: exact, case-sensitive schema pattern above. No leading
  plus, outer whitespace, internal whitespace, bare decimal point or exponent.
  `mm` = 0.1 cm, `cm` = 1 cm, `in` = 2.54 cm, `pt` = 1/72 inch,
  `pc` and `pi` = 1/6 inch.
- Bare fractions, scientific/hexadecimal notation, NaN, Infinity, empty/missing
  attributes and malformed units do not establish a numeric margin fact.
- Integers beyond `Number.MAX_SAFE_INTEGER`, non-finite conversions, unit
  measures whose equivalent twips exceed that magnitude, and numeric underflow
  are unsupported evidence. This is a runtime representation boundary, not an
  OOXML schema range restriction or an academic violation.
- Unsupported/invalid evidence remains `null`; `assess()` retains uncertainty.
  A confirmed violation in another section can still determine the overall
  assessment, according to the existing decision contract.

## Precision: comparison of policies

**A — Existing policy, retained:** convert twips to cm, round to two decimal
places and compare with the expected cm value. Integer twips 1415 through 1420
currently become 2.50 cm. This is an implementation acceptance band, not a
source-approved academic tolerance. Explicit units use the same final rounding.

**B — Raw integer twips:** exact 2.5 cm equals `180000/127` twips, approximately
1417.3228346456692; no integer twips equals that rational value. Requiring exact
rational equality would reject normal integer representations. Choosing 1417
as a nearest-integer target would accept 1417 alone, but would introduce a
different comparison policy. Neither approach is activated here.

**C — Explicit units:** the schema permits `2.5cm` and equivalent unit measures;
the parser now supports them. This establishes a representation, not a new
academic tolerance for integer twips. No separately source-approved SDU precision
policy was available in this sprint.

False-compliance risk remains if policy A is interpreted as exact physical
equality; false-violation risk arises if ordinary integer representations are
compared with the exact non-integer target under policy B. Resolution requires a
separate, source-grounded precision decision, plus Word-native evidence.

## Compatibility and readiness

Existing ordinary integer corpus values keep their values and rounding. Legacy
`validate()` is unchanged: invalid values previously parsed as numeric can now
change legacy PASS to FAIL, while recognized unit measures can change unknown
evidence to numeric evidence. Assessment distinguishes these unknown cases from
academic violation. Existing COMU golden/corpus behavior must remain unchanged.

SEC-19 normalization, real SDU scope authorization, frozen PDF verification and
Word-native/student evidence remain separate blockers. This contract does not
authorize production onboarding.
