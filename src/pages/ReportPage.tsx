import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { routePaths } from '../app/constants/routePaths'
import type {
  AnalysisReport,
  RuleResult,
  RuleResultValue,
} from '../features/analysis/types'
import { Button, Card, Container } from '../shared'
import './ReportPage.css'

type ResultFilter = 'all' | 'failed' | 'passed'

interface ReportPageProps {
  analysisReport?: AnalysisReport
  onNewAnalysis?: () => void
}

const FILTERS: readonly { id: ResultFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'failed', label: 'Hatalar' },
  { id: 'passed', label: 'Başarılı' },
]

export function ReportPage({ analysisReport, onNewAnalysis }: ReportPageProps) {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<ResultFilter>('all')

  function handleNewAnalysis() {
    if (onNewAnalysis) {
      onNewAnalysis()
      return
    }

    navigate(routePaths.upload)
  }

  if (!analysisReport) {
    return (
      <Container className="report-page">
        <Card className="report-page__empty-report">
          <p>Gösterilecek bir analiz raporu bulunamadı.</p>
          <Button onClick={handleNewAnalysis}>Yeni Analiz</Button>
        </Card>
      </Container>
    )
  }

  const visibleResults = getVisibleResults(analysisReport.results, activeFilter)

  return (
    <Container className="report-page">
      <header className="report-page__header">
        <div>
          <h1>Analiz Raporu</h1>
          <p>Tezinizin kural uyumluluğunu ve düzeltilmesi gereken alanları inceleyin.</p>
        </div>
        <Button onClick={handleNewAnalysis}>Yeni Analiz</Button>
      </header>

      <section className="report-page__summary" aria-label="Rapor özeti">
        <SummaryItem label="Uyumluluk skoru" value={`%${analysisReport.score}`} />
        <SummaryItem label="Toplam kural" value={analysisReport.totalRules} />
        <SummaryItem label="Başarılı kural" value={analysisReport.passedRules} />
        <SummaryItem label="Başarısız kural" value={analysisReport.failedRules} />
      </section>

      <section className="report-page__details" aria-labelledby="result-heading">
        <div className="report-page__results-header">
          <div>
            <h2 id="result-heading">Kural sonuçları</h2>
            <p>{visibleResults.length} sonuç gösteriliyor</p>
          </div>
          <div className="report-page__filters" aria-label="Sonuç filtreleri">
            {FILTERS.map((filter) => (
              <button
                aria-pressed={activeFilter === filter.id}
                className="report-page__filter"
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {visibleResults.length > 0 ? (
          <div className="report-page__result-list">
            {visibleResults.map((result) => (
              <RuleResultCard key={result.ruleId} result={result} />
            ))}
          </div>
        ) : (
          <Card className="report-page__empty-filter" role="status">
            {getEmptyFilterMessage(activeFilter)}
          </Card>
        )}
      </section>
    </Container>
  )
}

interface SummaryItemProps {
  label: string
  value: string | number
}

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <Card className="report-page__summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  )
}

function RuleResultCard({ result }: { result: RuleResult }) {
  return (
    <Card
      className={[
        'report-page__result-card',
        result.passed
          ? 'report-page__result-card--passed'
          : 'report-page__result-card--failed',
      ].join(' ')}
    >
      <div className="report-page__result-title">
        <h3>{result.ruleName}</h3>
        <span className="report-page__status">
          <span aria-hidden="true">{result.passed ? '✓' : '✕'}</span>
          {result.passed ? 'Başarılı' : 'Başarısız'}
        </span>
      </div>

      {result.passed ? (
        <p className="report-page__success-message">{result.message}</p>
      ) : (
        <>
          <p className="report-page__message">{result.message}</p>
          <dl className="report-page__values">
            <div>
              <dt>Beklenen</dt>
              <dd>{formatRuleResultValue(result.expected)}</dd>
            </div>
            <div>
              <dt>Belgede bulunan</dt>
              <dd>{formatRuleResultValue(result.actual)}</dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  )
}

function getVisibleResults(
  results: readonly RuleResult[],
  filter: ResultFilter,
): RuleResult[] {
  const filteredResults = results.filter((result) => {
    if (filter === 'failed') {
      return !result.passed
    }

    if (filter === 'passed') {
      return result.passed
    }

    return true
  })

  return filter === 'all'
    ? [...filteredResults].sort(
        (first, second) => Number(first.passed) - Number(second.passed),
      )
    : filteredResults
}

function getEmptyFilterMessage(filter: ResultFilter): string {
  if (filter === 'failed') {
    return 'Hatalı kural bulunamadı.'
  }

  if (filter === 'passed') {
    return 'Başarılı kural bulunamadı.'
  }

  return 'Gösterilecek kural sonucu bulunamadı.'
}

function formatRuleResultValue(value: RuleResultValue): string {
  return value === null ? 'Tespit edilemedi' : String(value)
}
