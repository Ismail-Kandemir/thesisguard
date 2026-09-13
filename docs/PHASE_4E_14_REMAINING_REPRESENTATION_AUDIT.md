# Phase 4E-14 Remaining Representation Audit

## Current Coverage Map

Already covered areas:

- style inheritance, docDefaults, theme font resolution
- automatic heading numbering
- split runs and complex field cached results
- marked and unmarked TOC ownership
- multi-section margins
- tracked `w:del` / `w:ins` visibility policy
- VML textbox ownership
- DrawingML/WPS textbox ownership and textbox-vs-figure classification
- footnote/endnote cross-part audit
- `mc:AlternateContent` single-branch resolution

Footnotes/endnotes remain a representation coverage gap and cross-part
limitation, but Phase 4E-12 did not prove wrong results in the current 46-rule
runtime.

## Candidate Risk Ranking

High: `w:moveFrom` / `w:moveTo` tracked move revisions

Evidence: `documentXmlParser` excludes runs under `w:del`, but there is no
equivalent current-document visibility policy for `w:moveFrom`. `w:moveTo` is
also parsed as ordinary visible content. Possible affected rules include section
detection, required sections, body typography, abbreviations, object references,
and captions.

Medium: `w:sdt` / `w:sdtContent`

Evidence: wrappers are transparent to descendant traversal and TOC already uses
SDT marker logic. Mini diagnostics showed simple text is reconstructed once, but
nested ownership combinations could still deserve future targeted testing.

Medium: comments

Evidence: `comments.xml` is not read by the package reader, so comment body text
is a cross-part limitation similar to footnotes/endnotes. Body `w:commentReference`
does not add visible text in the tested diagnostic.

Medium: charts / SmartArt / OLE / generic drawing classification

Evidence: figure detection treats non-textbox `w:drawing` as figure-like. This
may be correct for many thesis illustrations, but richer DrawingML object
classification remains shallow and could need future Word-native fixtures.

Low: hyperlinks

Evidence: `w:hyperlink` is transparent to run/text traversal. Split hyperlink
runs reconstruct as one paragraph text without duplicate paragraph ownership.

Low: `customXml` and `smartTag`

Evidence: wrappers are transparent around WordprocessingML descendants. Simple
diagnostics showed one paragraph and one run occurrence.

Low: `w:fldSimple`

Evidence: field instruction is an attribute and cached result descendants are
visible. Mini diagnostic showed result text `Sekil 1` becomes an object
reference; instruction text did not leak as paragraph text.

Low: header/footer semantic leakage

Evidence: header/footer XML parts are read for page numbering, not merged into
body paragraphs or sections.

## Selected Target

Selected target: `w:moveFrom` / `w:moveTo` tracked move revisions.

Selection rationale:

- direct conflict with existing revision visibility policy
- realistic Word revision representation
- high impact on current 46 rules
- deterministic synthetic fixture support
- current parser has clear `w:del` handling but no `moveFrom` handling

Expected logical semantics: under accepted/current-document analysis semantics,
the old moved source and the current moved destination should not both be treated
as simultaneously visible academic body content. A full revision engine is not
required to prove the current gap.

## OOXML Representation

The audit uses deterministic synthetic OOXML:

```xml
<w:moveFrom w:id="714" w:author="ThesisGuard Audit" w:date="2026-09-13T00:00:00Z">
  <w:r><w:t>...</w:t></w:r>
</w:moveFrom>
<w:moveTo w:id="715" w:author="ThesisGuard Audit" w:date="2026-09-13T00:00:00Z">
  <w:r><w:t>...</w:t></w:r>
</w:moveTo>
```

The fixtures are `origin = synthetic-ooxml`; no Word-native serialization claim
is made.

## Fixture Evidence

`tracked-move-synthetic.docx`

- raw `w:moveFrom`: 1
- raw `w:moveTo`: 1
- both contain `TG_MOVED_TEXT`
- normalized paragraph text:
  `... TG_MOVED_TEXT TG_MOVED_TEXT`
- marker run occurrences: 2
- production runtime: 46 total, 46 passed, 0 failed, 0 N/A, score 100

This proves duplicate reconstruction, but not a wrong current RuleResult for the
plain text marker fixture.

`tracked-move-semantic-collision-synthetic.docx`

- raw `w:moveFrom`: 1
- raw `w:moveTo`: 1
- both contain `KAYNAKLAR`
- normalized paragraph text: `KAYNAKLARKAYNAKLAR`
- marker run occurrences: 2
- exact `KAYNAKLAR` section fact count: 0
- production runtime: 46 total, 42 passed, 4 failed, 0 N/A, score 91

Failed rules:

- `comu.bachelor.spacing.line-height`
- `comu.bachelor.format.alignment`
- `comu.applied-sciences.food-technology.bachelor.paragraph-indentation`
- `comu.applied-sciences.food-technology.bachelor.references`

This proves duplicate reconstruction and false positive/false negative style
runtime impact: the duplicated tracked move heading is no longer recognized as
the references section and is also treated as academic body content.

## Wrapper Diagnostics

Hyperlink:

- split `w:hyperlink` runs reconstruct to `DNA analizi`
- one paragraph occurrence
- no duplicate paragraph
- no URL analysis is expected

SDT/content control:

- simple `w:sdt/w:sdtContent` text reconstructs once
- no outer/inner duplicate observed in the mini diagnostic

`customXml` and `smartTag`:

- simple wrapped text reconstructs once
- no duplicate outer/inner paragraph observed

Simple field:

- cached result text is parsed
- instruction attribute does not leak as visible paragraph text
- `Sekil 1` result can become a figure reference

Comments:

- body `w:commentReference` contributes an empty run only
- `comments.xml` is not read by `readDocxAnalysisXmlParts`
- comment text remains a cross-part/product-semantics question, not a proven
  current 46-rule bug

Header/footer:

- header/footer content is not merged into body paragraphs/sections
- page numbering ownership remains the relevant parser path

Object representation:

- DrawingML textbox and AlternateContent duplicate object cases are already
  covered
- charts/SmartArt/OLE remain a medium-risk future object classification area,
  but this phase did not create a stronger deterministic fixture than tracked
  moves

## Classification

- REVISION VISIBILITY GAP
- DUPLICATE RECONSTRUCTION
- FALSE POSITIVE
- FALSE NEGATIVE
- ARCHITECTURAL LIMITATION

## Root Cause

Chain:

`w:moveFrom` + `w:moveTo`
-> `documentXmlParser` semantic run traversal
-> `parseRuns` excludes only `w:del`
-> both moved source and moved destination runs enter paragraph text
-> section/body scope is built from duplicated text
-> validators consume malformed or duplicated academic facts
-> wrong RuleResults occur in the semantic collision fixture.

## Phase 4E-14A Recommendation

Implement a centralized revision visibility resolver or shared semantic
visibility helper, consistent with Phase 4E-9A:

- `w:del`: invisible
- `w:ins`: visible
- candidate minimum policy: `w:moveFrom` invisible, `w:moveTo` visible

Avoid rule-specific or validator-specific filtering. The fix should live near
semantic traversal/parsing so paragraphs, runs, sections, headings, captions,
references, abbreviations, and typography share one revision visibility policy.

## Trust Boundary

Evidence comes from repository code inspection, synthetic OOXML fixture
generation, raw XML inspection, normalized model output, and
production-equivalent 46-rule runtime.

This audit does not claim full Word revision semantics, full tracked-change
accept/reject behavior, rendered layout fidelity, or Word-native serialization
coverage.
