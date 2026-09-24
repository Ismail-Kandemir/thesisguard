# ThesisGuard Project Rules

- Project name: ThesisGuard.
- Architecture: React + TypeScript + Vite.
- Preserve Clean Code, type safety, and the existing architecture.
- Keep changes narrowly scoped to the user request; avoid unrelated refactors.
- Do not add unnecessary files, folders, features, or abstractions.
- Prefer existing semantic sources of truth instead of creating parallel detectors.
- Do not weaken validation merely to make tests pass.
- Do not use `any` in TypeScript.
- Use small, reusable components when frontend changes are requested.
- Do not add or change dependencies unless explicitly required.
- Do not commit or push unless explicitly requested.

## Validation Rules

- Validation must remain source-bounded: never invent academic requirements.
- Do not treat unsupported academic expectations as production requirements.
- Current validation baseline is 46 rules:
  - Coverage: COMPLETE 45 / PARTIAL 1 / SHALLOW 0 / MISSING 0
  - Trust: HIGH 45 / MEDIUM 1 / LOW 0
- `comu.applied-sciences.food-technology.bachelor.page-number` must remain PARTIAL/MEDIUM because rendered physical footer placement cannot be fully proven from static OOXML.
- `comu.applied-sciences.food-technology.bachelor.page-number-sequence` is COMPLETE/HIGH.
- Do not change rule IDs, score arithmetic, or source grounding unless explicitly requested.

## Semantic Architecture

- Preserve `AcademicSectionOccurrence` and existing semantic section boundaries.
- Preserve Figure Level 3 architecture.
- Generic `w:drawing` must never establish academic figure identity.
- Never reintroduce the legacy `document.figures` bridge.
- Preserve current table, bibliography, abbreviation, and conditional-list semantics.

## DOCX And Audit Safety

- Do not modify DOCX fixtures unless the task explicitly requires it.
- Be alert that some old audit scripts can rewrite DOCX ZIP containers.
- If DOCX churn occurs unintentionally, report it and restore only the affected fixtures from HEAD.

## Verification

- For normal implementation tasks, run only focused tests relevant to the change.
- Do not automatically run golden, corpus, typecheck, lint, and build; the user will run the full verification suite manually unless the task explicitly asks Codex to.
- If a test or command fails, do not hide it; report the failure and the fix or remaining blocker.

## Reporting

- Keep final reports concise.
- Include: files changed, what changed, focused tests run, blockers, and manual verification commands.
