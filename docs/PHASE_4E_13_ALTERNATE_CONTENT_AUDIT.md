# Phase 4E-13 AlternateContent Audit

## Scope

This phase audits `mc:AlternateContent` handling only. It does not change
production source, parser logic, validator logic, or rule semantics.

The tested namespace is:

`http://schemas.openxmlformats.org/markup-compatibility/2006`

All new fixtures are `origin = synthetic-ooxml`. They do not claim Word-native
serialization.

## Representation

The audit fixtures use this Markup Compatibility and Extensibility shape:

```xml
<mc:AlternateContent>
  <mc:Choice Requires="wps">...</mc:Choice>
  <mc:Fallback>...</mc:Fallback>
</mc:AlternateContent>
```

Expected logical semantics: one `mc:AlternateContent` block exposes one visible
content path. Both `mc:Choice` and `mc:Fallback` should not contribute semantic
facts at the same time.

This audit does not decide which branch ThesisGuard should select in the future.
Acceptable future policies could include supported Choice selection, Fallback
selection when Choice is unsupported, or another conservative single-branch
resolution policy.

## Parser Behavior

Production code currently has no AlternateContent/MCE branch-selection logic in
the inspected parser and validator path:

- `src/features/analysis/parsers/documentXmlParser.ts`
- `src/features/analysis/parsers/documentCaptionsNormalizer.ts`
- `src/features/analysis/parsers/documentHeadingsNormalizer.ts`
- `src/features/analysis/parsers/documentSectionsParser.ts`
- `src/features/analysis/rules/validators/bodyParagraphs.ts`

The audit script confirms these files do not mention `AlternateContent`,
`markup-compatibility`, `Choice`, `Fallback`, or `Requires`, while they do use
descendant traversal such as `getElementsByTagNameNS`.

Observed consequence: ThesisGuard descends into both Choice and Fallback content
when the descendants are WordprocessingML elements already consumed by the
existing parsers.

## Fixtures

`alternate-content-text-synthetic.docx`

Inline AlternateContent in a body paragraph:

- Choice marker: `TG_ALT_CHOICE`
- Fallback marker: `TG_ALT_FALLBACK`
- Identical marker in both branches: `TG_ALT_TEXT_MARKER`

Runtime result:

- `mc:AlternateContent`: 2
- `mc:Choice`: 2
- `mc:Fallback`: 2
- normalized paragraph text contains both distinct markers
- `TG_ALT_TEXT_MARKER` run occurrence: 2
- report: 46 total, 46 passed, 0 failed, 0 N/A, score 100

Classification: duplicate text/run reconstruction, without a failing current
rule in this fixture.

`alternate-content-semantic-collision-synthetic.docx`

Block-level AlternateContent immediately before the real `KAYNAKLAR` section:

- Choice text: `KAYNAKLAR`
- Fallback text: `KAYNAKLAR`
- Real document body also contains `KAYNAKLAR`

Runtime result:

- normalized `KAYNAKLAR` paragraph/run occurrences: 3
- normalized `KAYNAKLAR` section facts: 3
- report: 46 total, 45 passed, 1 failed, 0 N/A, score 98
- failed rule:
  `comu.applied-sciences.food-technology.bachelor.experimental.section-order`

Classification: duplicate reconstruction, false positive, markup compatibility
gap.

`alternate-content-figure-synthetic.docx`

The existing inline DrawingML figure run is represented in both Choice and
Fallback. A deterministic VML fallback was not introduced in this phase; the
fixture uses a simpler DrawingML fallback representation to isolate branch
selection behavior.

Runtime result:

- `mc:AlternateContent`: 1
- OOXML `w:drawing`: 2
- Choice drawing count: 1
- Fallback drawing count: 1
- normalized figure facts: 2
- figure IDs: `figure-1`, `figure-2`
- both figures point to the same paragraph
- caption association becomes ambiguous
- report: 46 total, 42 passed, 1 failed, 3 N/A, score 98
- failed rule:
  `comu.applied-sciences.food-technology.bachelor.figure-caption-placement`
- N/A rules:
  `comu.applied-sciences.food-technology.bachelor.figure-object-alignment`
  plus downstream figure caption/reference checks that require reliable
  association.

Classification: duplicate object reconstruction, false positive, markup
compatibility gap.

## Root Cause

The exact chain is:

`mc:AlternateContent`
-> both `mc:Choice` and `mc:Fallback` contain WordprocessingML descendants
-> parser/normalizer descendant traversal collects those descendants
-> normalized paragraphs, sections, or figures include both branches
-> validators consume duplicated facts
-> selected exploratory fixtures produce wrong RuleResults.

The relevant traversal sites are:

- paragraph parsing through body descendant `w:p` traversal
- run parsing through paragraph descendant `w:r` traversal
- figure parsing through body descendant `w:drawing` traversal
- section parsing over normalized paragraphs
- body typography validators over normalized body paragraphs

## Phase 4E-13A Recommendation

Prefer a central AlternateContent branch resolver before downstream parsing.
That is safer than adding representation-specific filters to each parser or
validator.

A minimum-safe design can:

- recognize `mc:AlternateContent`, `mc:Choice`, `mc:Fallback`, and `Requires`
- maintain a small supported-feature/prefix set
- select at most one branch per AlternateContent block
- expose a resolved DOM or a traversal helper that downstream parsers use
- preserve trust boundaries by keeping inactive branch content out of body,
  section, heading, caption, reference, and object facts

Full MCE support is not required for the first production fix if the supported
feature set is explicit and conservative.

## Trust Boundary

Evidence comes from repository code inspection, synthetic OOXML fixtures, ZIP XML
inspection, normalized document output, and production-equivalent 46-rule runtime
via `tests/audit/alternateContentAudit.cjs`.

The audit does not prove behavior for every Word-native AlternateContent
serialization, every possible `Requires` value, or VML fallback serialization.
