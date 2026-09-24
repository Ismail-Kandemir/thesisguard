import { createRoot } from 'react-dom/client'
import type { AnalysisReport } from '../../src/features/analysis/types'
import { AnalysisReportView } from '../../src/features/analysis/report/components'

import '../../src/features/analysis/report/components/AnalysisReportView.css'

interface BrowserScenario {
  id: string
  label: string
  report: AnalysisReport
}

interface BrowserHarnessData {
  generatedAt: string
  scenarios: BrowserScenario[]
}

interface BrowserHarnessResult {
  failures: string[]
  scenarioCount: number
  viewport: {
    height: number
    width: number
  }
}

declare global {
  interface Window {
    __REPORT_VISUAL_RESULT__?: BrowserHarnessResult
    __REPORT_VISUAL_KEYBOARD_CHECK__?: () => Promise<string[]>
  }
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Harness root element was not found.')
}

document.documentElement.style.background = '#f3f4f6'
document.body.style.margin = '0'
document.body.style.fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const shell = document.createElement('main')
shell.style.boxSizing = 'border-box'
shell.style.display = 'grid'
shell.style.gap = '28px'
shell.style.maxWidth = '1180px'
shell.style.margin = '0 auto'
shell.style.padding = '24px'
root.append(shell)

void runHarness()

async function runHarness(): Promise<void> {
  const data = await fetch('/tests/browser/reportVisualRegressionData.generated.json', {
    cache: 'no-store',
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Harness data could not be loaded: ${response.status}`)
    }

    return response.json() as Promise<BrowserHarnessData>
  })

  createRoot(shell).render(
    <>
      {data.scenarios.map((scenario) => (
        <section
          data-browser-scenario={scenario.id}
          key={scenario.id}
          style={{
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxSizing: 'border-box',
            padding: '20px',
          }}
        >
          <AnalysisReportView
            analysisReport={scenario.report}
            onNewAnalysis={() => undefined}
          />
        </section>
      ))}
    </>,
  )

  await nextFrame()
  await nextFrame()

  window.__REPORT_VISUAL_KEYBOARD_CHECK__ = runKeyboardInteractionChecks
  window.__REPORT_VISUAL_RESULT__ = runVisualChecks(data.scenarios)
}

function runVisualChecks(scenarios: readonly BrowserScenario[]): BrowserHarnessResult {
  const failures: string[] = []

  assertNoPageOverflow(failures)
  assertScenarioLayout(failures, scenarios)
  assertFixFirstSection(failures)
  assertCoverageStates(failures)
  assertDiagnostics(failures)
  assertFilters(failures)
  assertDetails(failures)
  assertAccessibilityLabels(failures)
  assertNoRawTechnicalTerms(failures)

  return {
    failures,
    scenarioCount: scenarios.length,
    viewport: {
      height: window.innerHeight,
      width: window.innerWidth,
    },
  }
}

function assertFixFirstSection(failures: string[]): void {
  const partialFail = getScenarioElement('partial-fail')
  const partialPass = getScenarioElement('partial-pass')
  const fixFirst = partialFail?.querySelector('.analysis-report__fix-first')

  assert(Boolean(fixFirst), failures, 'Fix-first section renders for failed reports.')
  assert(
    textOf(fixFirst).includes('Oncelikli Duzeltmeler'),
    failures,
    'Fix-first section has student-facing heading.',
  )
  assert(
    (fixFirst?.querySelectorAll('.analysis-report__fix-first-item').length ?? 0) > 0,
    failures,
    'Fix-first section lists failed rules.',
  )
  assert(
    textOf(fixFirst).includes('Detaya git'),
    failures,
    'Fix-first items expose detail navigation.',
  )
  assert(
    textOf(partialPass).includes('Basarisiz kural bulunamadi'),
    failures,
    'Passing reports get a compact no-failures fix-first state.',
  )
}

async function runKeyboardInteractionChecks(): Promise<string[]> {
  const failures: string[] = []
  const firstFilter = document.querySelector<HTMLButtonElement>(
    '[data-browser-scenario="partial-pass"] .analysis-report__filter',
  )

  if (!firstFilter) {
    failures.push('Keyboard check could not find the first filter button.')
    return failures
  }

  firstFilter.focus()
  if (document.activeElement !== firstFilter) {
    failures.push('Filter button did not receive focus.')
  }

  const activeFilterBeforeEnter = firstFilter.getAttribute('aria-pressed')
  firstFilter.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
  }))
  firstFilter.click()
  await nextFrame()

  if (firstFilter.getAttribute('aria-pressed') !== activeFilterBeforeEnter) {
    failures.push('Already-active filter changed unexpectedly after keyboard activation.')
  }

  const detailsSummary = document.querySelector<HTMLElement>(
    '[data-browser-scenario="partial-pass"] .analysis-report__result-card--passed .analysis-report__details-panel summary',
  )
  if (!detailsSummary) {
    failures.push('Keyboard check could not find a details summary.')
    return failures
  }

  detailsSummary.focus()
  if (document.activeElement !== detailsSummary) {
    failures.push('Details summary did not receive focus.')
  }

  detailsSummary.click()
  await nextFrame()

  const details = detailsSummary.closest('details')
  if (!details?.open) {
    failures.push('Details panel did not open after keyboard-path activation.')
  }

  return failures
}

function assertNoPageOverflow(failures: string[]): void {
  const allowedRoundingError = 1
  const rootOverflow =
    document.documentElement.scrollWidth - document.documentElement.clientWidth

  if (rootOverflow > allowedRoundingError) {
    failures.push(`Document has horizontal overflow: ${rootOverflow}px.`)
  }

  for (const element of document.querySelectorAll<HTMLElement>('[data-browser-scenario]')) {
    const overflow = element.scrollWidth - element.clientWidth

    if (overflow > allowedRoundingError) {
      failures.push(`${getScenarioId(element)} has horizontal overflow: ${overflow}px.`)
    }
  }
}

function assertScenarioLayout(
  failures: string[],
  scenarios: readonly BrowserScenario[],
): void {
  for (const scenario of scenarios) {
    const element = getScenarioElement(scenario.id)
    assert(Boolean(element), failures, `${scenario.id} scenario rendered.`)

    if (!element) {
      continue
    }

    assert(Boolean(element.querySelector('.analysis-report')), failures, `${scenario.id} report root exists.`)
    assert(Boolean(element.querySelector('.analysis-report__summary')), failures, `${scenario.id} summary exists.`)
    assert(Boolean(element.querySelector('.analysis-report__trust-note')), failures, `${scenario.id} trust note exists.`)
    assert(Boolean(element.querySelector('.analysis-report__details')), failures, `${scenario.id} results section exists.`)
    assertNoElementOverflow(element, failures, scenario.id)
  }
}

function assertCoverageStates(failures: string[]): void {
  const partialPass = getScenarioElement('partial-pass')
  const partialFail = getScenarioElement('partial-fail')
  const anchorOnly = getScenarioElement('anchor-only')
  const ordinaryNotApplicable = getScenarioElement('ordinary-not-applicable')

  assert(
    hasCardWithText(partialPass, 'analysis-report__result-card--passed', 'Kismi degerlendirme'),
    failures,
    'Partial pass keeps passed visual state with partial coverage label.',
  )
  assert(
    hasCardWithText(partialFail, 'analysis-report__result-card--failed', 'Kural basarisiz'),
    failures,
    'Partial fail keeps failed visual state while explaining coverage.',
  )
  assert(
    hasCardWithText(anchorOnly, 'analysis-report__result-card--not-applicable', 'Otomatik dogrulanamadi'),
    failures,
    'Relevant unevaluable object renders as special N/A coverage state.',
  )
  assert(
    ordinaryNotApplicable?.querySelector('.analysis-report__coverage-badge') === null,
    failures,
    'Ordinary N/A does not render exceptional coverage badge.',
  )
}

function assertDiagnostics(failures: string[]): void {
  const diagnosticScore = getScenarioElement('score-with-diagnostics')
  const multiDiagnostic = getScenarioElement('multiple-diagnostics')

  assert(
    Boolean(diagnosticScore?.querySelector('.analysis-report__diagnostics')),
    failures,
    'Score-with-diagnostics scenario renders separate diagnostic section.',
  )
  assert(
    textOf(diagnosticScore).includes('%100') && textOf(diagnosticScore).includes('Manuel inceleme'),
    failures,
    '100 score and manual review summary coexist without score demotion.',
  )
  assert(
    (multiDiagnostic?.querySelectorAll('.analysis-report__diagnostic-card').length ?? 0) >= 2,
    failures,
    'Multiple diagnostics render as separate review cards.',
  )
  assert(
    !textOf(diagnosticScore).includes('Kural basarisiz'),
    failures,
    'Diagnostic-only score scenario does not create failed rule text.',
  )
}

function assertFilters(failures: string[]): void {
  const partialPass = getScenarioElement('partial-pass')
  const filterLabels = Array.from(
    partialPass?.querySelectorAll<HTMLButtonElement>('.analysis-report__filter') ?? [],
  ).map((button) => normalizeText(button.textContent ?? ''))

  for (const label of ['Tumu', 'Basarisiz', 'Basarili', 'Uygulanamaz']) {
    assert(filterLabels.some((item) => item.includes(label)), failures, `${label} filter is visible.`)
  }
}

function assertDetails(failures: string[]): void {
  const partialFail = getScenarioElement('partial-fail')
  assert(
    Boolean(partialFail?.querySelector('.analysis-report__details-panel[open]')),
    failures,
    'Failed partial rule opens details by default.',
  )
  assert(
    textOf(partialFail).includes('Nasil duzeltilir?'),
    failures,
    'Failed rule correction guidance remains visible.',
  )
  assert(
    textOf(partialFail).includes('Kural kodu:'),
    failures,
    'Rule identifier remains in details.',
  )
}

function assertAccessibilityLabels(failures: string[]): void {
  assert(Boolean(document.querySelector('h1')), failures, 'Main report heading exists.')
  assert(
    Array.from(document.querySelectorAll('[aria-label]')).some((element) =>
      normalizeText(element.getAttribute('aria-label') ?? '').includes('Sonuc filtreleri'),
    ),
    failures,
    'Filter group has an accessible label.',
  )
  assert(
    Boolean(document.querySelector('[aria-labelledby="score-trust-heading"]')),
    failures,
    'Score trust note is labelled.',
  )
  assert(
    Boolean(document.querySelector('summary')),
    failures,
    'Details summary is keyboard-focusable content.',
  )
}

function assertNoRawTechnicalTerms(failures: string[]): void {
  const visibleText = textOf(document.body)
  for (const rawTerm of ['wp:anchor', 'w:drawing', 'unsupported-anchored-placement']) {
    assert(!visibleText.includes(rawTerm), failures, `Visible report text hides raw term ${rawTerm}.`)
  }
}

function assertNoElementOverflow(
  rootElement: HTMLElement,
  failures: string[],
  scenarioId: string,
): void {
  for (const element of rootElement.querySelectorAll<HTMLElement>('*')) {
    if (element.scrollWidth - element.clientWidth > 1) {
      const className = typeof element.className === 'string' ? element.className : element.tagName
      failures.push(`${scenarioId} element overflow: ${className}`)
      return
    }
  }
}

function hasCardWithText(
  rootElement: Element | null,
  className: string,
  expectedText: string,
): boolean {
  const normalizedExpected = normalizeText(expectedText)

  return Array.from(rootElement?.querySelectorAll(`.${className}`) ?? []).some((card) =>
    normalizeText(card.textContent ?? '').includes(normalizedExpected),
  )
}

function getScenarioElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-browser-scenario="${id}"]`)
}

function getScenarioId(element: Element): string {
  return element.getAttribute('data-browser-scenario') ?? 'unknown scenario'
}

function textOf(element: Element | null): string {
  return normalizeText(element?.textContent ?? '')
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
}

function assert(condition: boolean, failures: string[], message: string): void {
  if (!condition) {
    failures.push(message)
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve()
    })
  })
}
