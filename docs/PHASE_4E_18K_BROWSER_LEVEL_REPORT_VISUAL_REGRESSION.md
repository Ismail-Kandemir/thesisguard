# PHASE 4E-18K — Browser-Level Report Visual Regression

## 1. Executive summary

4E-18K adds a real-browser visual regression path for the production analysis report UI. The check renders `AnalysisReportView` through Vite in a Chromium-family browser and validates layout, responsive behavior, coverage trust states, diagnostic hierarchy, filters, details panels, focusability, and visible text contracts.

Phase decision: **OPTION A — Browser-level report visual regression is production-ready.**

## 2. Starting Git/local state

Start state was verified on `main` with `HEAD=c16ecc2` and `origin/main=c16ecc2`. The working tree was already dirty from completed local phases 4E-18D through 4E-18J, as expected.

## 3. Existing test infrastructure

The repository had Vite, TypeScript, ESLint, Node audit scripts, golden fixture tests, and corpus tests. No Playwright, Cypress, Puppeteer, Jest, Vitest, React Testing Library, jsdom browser harness, screenshot baseline, or e2e script was present.

## 4. Browser tooling decision

No large browser-testing dependency was added. The smallest responsible path was a dependency-free Chrome DevTools Protocol runner using Node's built-in `WebSocket`, an ephemeral Vite server, and an installed Chromium-family browser.

## 5. Test environment

The browser test uses local-only Vite with an auto-selected free port. The successful run used `C:\Program Files\Google\Chrome\Application\chrome.exe`.

Tested viewports:

- `1440x1000`
- `1024x768`
- `900x900`
- `390x900`

## 6. Production data path

Key scenarios originate from `analyzeDocx()` outputs serialized as `AnalysisReport` JSON, then rendered through the production `AnalysisReportView` component. The `%100 + diagnostics` visual scenario preserves the golden score report and combines diagnostics produced by the production analysis path so score arithmetic and diagnostic policy are not changed.

## 7. Scenario matrix

- `golden`: 46/46, 100%, diagnostics 0, no partial coverage.
- `score-with-diagnostics`: 100% score with manual-review diagnostics.
- `multiple-diagnostics`: multiple manual-review cards and count wording.
- `partial-pass`: figure alignment `PASSED` with partial coverage.
- `partial-fail`: figure alignment `FAILED` with partial coverage.
- `anchor-only`: relevant object exists but zero objects are automatically evaluable.
- `ordinary-not-applicable`: no relevant object, ordinary N/A state.
- `long-content`: long title, message, expected, actual, and solution text.

## 8. Desktop findings

Desktop `1440x1000` passed. Summary, counts, trust note, filters, categories, rule cards, diagnostics, coverage notes, and details rendered without overlap or clipping.

## 9. Laptop findings

Laptop `1024x768` passed. Cards, summary layout, filter wrapping, details panels, and diagnostics remained readable.

## 10. Mobile findings

Mobile `390x900` passed. No unintended horizontal page overflow was detected. Badges, filters, long titles, coverage copy, diagnostic cards, and details remained usable.

## 11. Horizontal overflow

The harness checks `document.documentElement.scrollWidth` against `clientWidth` and also checks each scenario container and descendants. No unintended overflow was found in the tested viewports.

## 12. PASSED + complete

Complete passed rules keep the normal successful visual state and do not receive exceptional coverage UI.

## 13. FAILED + complete

Complete failed rules keep the normal failed visual state and details remain open by default.

## 14. PASSED + partial

`PASSED + partial` remains green/successful but includes visible `Kısmi değerlendirme` qualification and explanatory coverage text. It does not look like a failed rule.

## 15. FAILED + partial

`FAILED + partial` remains visually failed. Coverage copy is visible but secondary, preserving the proven violation as the primary state.

## 16. N/A no relevant

Ordinary N/A stays ordinary and does not render exceptional warning/coverage styling.

## 17. N/A relevant-but-unevaluable

Relevant-but-unevaluable N/A renders `Otomatik doğrulanamadı` and supporting copy that distinguishes it from "rule does not apply" without red failure styling.

## 18. Diagnostic section

Diagnostics render in a separate `İnceleme Gerektirenler` section with manual-review copy and diagnostic card styling distinct from failed rule cards.

## 19. Score/trust hierarchy

The trust note stays near the score summary and explains that the score covers automatically evaluable checks. The `%100 + diagnostics` scenario shows manual review without changing score arithmetic or inventing a confidence percentage.

## 20. Counts

Passed, failed, N/A, and manual-review counts remain visually distinct. Coverage does not create a fifth compliance count.

## 21. Filters

Rendered filters are exercised in the browser. Partial pass remains under `PASSED`, partial fail remains under `FAILED`, relevant-but-unevaluable N/A remains under `NOT_APPLICABLE`, and diagnostics do not enter rule-result filters.

## 22. Categories

Coverage presentation does not move categories, break group counts, duplicate cards, or create a fake category.

## 23. Expand/collapse

Details panels are rendered with native `details/summary`. Failed details are open by default, and the harness validates focus and activation on details content in the real browser.

## 24. Long-content behavior

Long realistic report strings wrap without horizontal overflow in the tested desktop, laptop, tablet, and mobile viewports.

## 25. Technical identifier exposure

Primary visible report text is checked for raw `wp:anchor`, `w:drawing`, and internal coverage reason text. None are exposed in the primary UX.

## 26. Accessibility semantics

The harness verifies meaningful headings, accessible filter labels, text status labels, text coverage labels, diagnostics text, and native details semantics. State is not communicated by color alone.

## 27. Keyboard behavior

The real browser check validates focusability and activation paths for report filter controls and details panels. No custom keyboard logic was introduced.

## 28. Responsive fixes

No production CSS changes were required in 18K. Existing responsive CSS passed the new browser assertions.

## 29. Screenshot/baseline strategy

Screenshots were not committed. Current recommendation is browser DOM/layout assertions rather than committed screenshot binaries because they are more stable across Windows/Linux fonts, device scale factors, and CI environments. A future hybrid approach can add temporary screenshots for debugging or committed baselines only after CI browser/font normalization exists.

## 30. Browser limitations

Only one Chromium-family browser is required and used for this phase. This is not an exhaustive browser matrix. The test requires a locally installed compatible browser or `THESISGUARD_BROWSER`.

## 31. Score differential

18K made no score arithmetic changes. Golden remains 46/46 and 100%.

## 32. Coverage differential

18K made no coverage domain changes. `complete`, `partial`, `none`, `relevant`, `evaluated`, and `unevaluated` semantics remain the 4E-18I baseline.

## 33. Diagnostic differential

18K made no diagnostic production policy changes. Diagnostics remain separate from failed rule counts.

## 34. Golden

`npm.cmd run test:golden` passed: `Golden fixture regression passed: 46/46.`

## 35. Corpus

`npm.cmd run test:corpus` passed: 31 regression fixtures passed and 11 exploratory fixtures completed.

## 36. Existing audit parity

Existing focused audits from 18C through 18J remained healthy, including diagnostic UX, partial coverage, anchored applicability, anchored semantic ordering, front matter scope, object semantic audits, and rule/source grounding audits.

## 37. Quality gates

`typecheck`, `lint`, `build`, `test:golden`, `test:corpus`, `test:browser-report`, and the requested audit scripts all passed. Vite build still reports the existing large chunk warning.

## 38. Fixture binary state

The six known modified DOCX fixtures were not rewritten, restored, staged, or otherwise intentionally changed by 18K.

## 39. Git diff

New 18K files:

- `tests/browser/reportVisualRegressionHarness.html`
- `tests/browser/reportVisualRegressionHarness.tsx`
- `tests/browser/reportVisualRegressionRunner.cjs`
- `tests/audit/browserReportVisualRegressionAudit.cjs`
- `docs/PHASE_4E_18K_BROWSER_LEVEL_REPORT_VISUAL_REGRESSION.md`

Modified 18K file:

- `package.json` adds `test:browser-report`

## 40. Remaining limitations

Very narrow `320px` stress was not added as a required supported viewport. The validated narrow viewport is `390px`. The browser matrix is Chromium-only. Screenshot baselines are intentionally deferred.

## 41. Phase decision

**OPTION A — Browser-level report visual regression is production-ready.**

## 42. Recommended next phase

Recommended next phase: **Phase 4E-18L — Legacy Figure Presence Retirement**.
