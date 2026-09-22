# PHASE 4E-18L - Legacy Figure Presence Retirement

## 1. Executive Summary

Phase 4E-18L retires the legacy assumption that every generic `w:drawing` occurrence is an academic figure for production rule decisions. Production figure applicability now flows through object semantic resolutions. Legacy `DocumentFigureOccurrence` remains as a structural/evidence bridge only.

## 2. Starting State

The branch started on `main` with local phase 4E-18D through 4E-18K work already present. `HEAD` and `origin/main` both resolved to `c16ecc2`. Existing local changes were preserved.

## 3. Legacy Model Definition

The legacy model treated parser-level figure occurrences as figure presence whenever a `w:drawing` was captured into `document.figures.items`. That structure was useful for physical placement and evidence, but it was too broad for academic identity because charts, diagrams, grouped drawings, unknown drawings, anchors, and invisible revisions could be counted before semantic confirmation.

## 4. New Semantic Model

Academic figure identity is now derived from `document.objectSemantics.resolutions` where `status` is `declared` and `academicType` is `figure`. A drawing may still exist structurally without becoming an academic figure.

## 5. Consumer Inventory

Reviewed consumers included object applicability, document fact evaluation, figure alignment, caption placement, caption format, in-text references, body paragraph filtering, report evidence, and regression audits. Production identity consumers were moved to semantic helpers.

## 6. Legacy Dependency Matrix

| Consumer | Previous dependency | Phase 4E-18L state |
| --- | --- | --- |
| Conditional figure requirements | Non-anchor legacy figure occurrence | Declared semantic figure |
| Figure alignment | Legacy figure occurrences | Declared semantic structural occurrences plus anchor coverage guard |
| Caption placement | Inline legacy figures | Inline declared semantic structural occurrences |
| In-text reference | Captioned legacy figures | Declared semantic identities |
| Body paragraph exclusion | All legacy figure carrier paragraphs | Declared semantic figure carrier paragraphs |
| Caption format pilot | Semantic path already present | Preserved |
| Evidence/report bridge | Structural occurrence | Preserved as bridge |

## 7. Retirement Target

The target was not to delete all structural figure data. The target was to remove legacy generic figure presence from academic identity, applicability, and validation decisions.

## 8. Retirement Level

Retirement level is **LEVEL 2**: legacy figure structures remain for structural matching, evidence, and compatibility, but production academic figure presence is semantic.

## 9. Semantic Figure Selector

`getDeclaredAcademicFigures(document)` is the central selector. It maps declared figure semantic resolutions to their semantic representation, optional caption, and optional structural occurrence. It does not parse raw OOXML and does not infer identity from drawing kind alone.

## 10. Compatibility Bridge

Documents without `objectSemantics` keep a narrow compatibility path so older tests or mock normalized documents can still run. This fallback is not the production identity path when semantic facts exist.

## 11. Figure Alignment

Figure alignment now evaluates declared semantic figures that have inline structural occurrences. Anchored candidates remain unevaluated coverage when they are visible, main-scope, adjacent to a figure caption, and not already declared.

## 12. Caption Placement

Figure caption placement now evaluates inline declared semantic figure occurrences instead of all inline legacy drawing occurrences.

## 13. Caption Format

The figure caption format pilot already used semantic declared/matched/inline behavior. Phase 4E-18L preserved that path and updated expectations for exploratory generic object fixtures.

## 14. In-Text Reference

Figure in-text reference validation now builds identities from declared semantic figure captions and structural occurrences. Uncaptioned generic drawings no longer trigger reference requirements.

## 15. List Of Figures

The list-of-figures requirement now follows semantic figure presence through the central applicability helper. Unresolved generic drawings leave the rule not applicable.

## 16. Figure Count

Production figure count for academic applicability is the count of declared semantic academic figures. Legacy structural count may still be higher in diagnostics or evidence scenarios.

## 17. Front-Matter

Generic front-matter pictures and charts are not academic figures. Scope semantics continue to prevent front-matter objects from driving main-body academic figure requirements.

## 18. Anchored Drawings

Anchored drawings are not automatically academic figures. Visible anchored picture candidates can still produce partial/none coverage semantics for alignment, but identity requires semantic declaration.

## 19. Revision Visibility

Deleted and move-from drawings remain structurally observable where appropriate, but they do not become declared academic figures. Inserted and move-to visible drawings can be declared when captions support semantic resolution.

## 20. AlternateContent

AlternateContent remains single-branch semantic input. The active semantic branch can be declared as a figure; fallback branches do not duplicate academic figure presence.

## 21. Textboxes

DrawingML and VML textboxes remain excluded from academic figure identity. They do not trigger figure validators.

## 22. Chart Diagram Group

Uncaptioned chart, diagram, grouped, and unknown drawings no longer act as academic figures. Captioned diagram cases can still become declared semantic figures when the semantic resolver links them to a figure caption.

## 23. OLE VML Equation

OLE objects, VML textbox content, and equations do not produce academic figure identity.

## 24. Runtime Matrix

The new audit covers inline declared figures, uncaptioned pictures, charts, diagrams, grouped drawings, unknown drawings, captioned diagrams, anchored candidates, unresolved anchors, front-matter objects, deleted/move-from objects, inserted/move-to objects, AlternateContent, DrawingML textboxes, VML textboxes, OLE, and equations.

## 25. Rule Differential

Intentional exploratory corrections: uncaptioned chart, SmartArt/diagram, grouped drawing, and unknown drawing fixtures no longer fail figure caption placement. Declared semantic figures still trigger figure list/reference requirements when appropriate.

## 26. Diagnostic Differential

Diagnostics remain available for unresolved or unsupported technical objects. Invisible revision objects do not emit diagnostics in the retirement audit.

## 27. Coverage Differential

Inline declared figures report complete physical alignment coverage. Anchored candidates report unsupported anchored placement coverage without becoming academic figure identities.

## 28. Score Differential

Golden score remains 100. Exploratory generic-object scores improve where previous failures were caused only by legacy figure presence.

## 29. Golden

Golden regression remains `46/46` with no diagnostics and score `100`.

## 30. Regression Corpus

Regression corpus remains passing after the semantic migration.

## 31. Exploratory Corpus

Exploratory corpus remains passing with expected intentional deltas for generic unresolved drawings.

## 32. Browser Regression

The browser-level report regression remains part of the audit chain to ensure visual trust UX did not regress while figure applicability semantics changed.

## 33. Existing Audit Parity

Existing anchored-object, partial-coverage, rule-coverage UX, diagnostic UX, front-matter, source-grounding, and object-semantic audits are retained in the verification chain.

## 34. Fixture Binary Churn State

Eight DOCX fixtures were already locally modified before this phase. ZIP entry set parity and ZIP entry content parity showed no semantic fixture payload change. Phase 4E-18L did not repair, rewrite, or restore those binary files.

## 35. Quality Gates

Required gates for this phase are typecheck, lint, build, golden regression, corpus regression, browser report regression, the new legacy figure retirement audit, and the existing audit chain.

## 36. Git Diff

The intended Phase 4E-18L production diff is scoped to object applicability and consumers that previously depended on legacy figure presence. Test changes add the retirement audit and update expected exploratory generic-object results.

## 37. Remaining Legacy Fields

`document.figures.items` and `DocumentFigureOccurrence` remain. They are structural bridge fields used for physical placement, paragraph mapping, evidence, compatibility, and report context.

## 38. Remaining Limitations

This phase does not delete parser-level figure extraction, does not reparse DOCX binaries, does not add Word rendering or anchor coordinate support, and does not change scoring weights, rule metadata, table semantics, or parser object extraction semantics.

## 39. Phase Decision

Decision: **OPTION A**. Legacy academic figure presence has been retired from production decision-making, with a documented LEVEL 2 structural compatibility bridge.

## 40. Recommended Next Phase

Recommended next phase: decide whether to keep LEVEL 2 permanently for evidence compatibility or plan a smaller LEVEL 3 cleanup that removes only proven-unused legacy bridge surfaces.
