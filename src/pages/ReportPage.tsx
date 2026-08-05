import type { AnalysisReport, RuleResultValue } from '../features/analysis/types'
import { Card, Container } from '../shared'
import './ReportPage.css'

interface ReportPageProps {
  analysisReport?: AnalysisReport
}

export function ReportPage({ analysisReport }: ReportPageProps) {
  if (!analysisReport) {
    return (
      <Container className="report-page">
        <Card>Gösterilecek bir analiz raporu bulunamadı.</Card>
      </Container>
    )
  }

  return (
    <Container className="report-page">
      <h1>Analiz Raporu</h1>

      <section className="report-page__summary" aria-label="Rapor özeti">
        <SummaryItem label="Uyumluluk skoru" value={`%${analysisReport.score}`} />
        <SummaryItem label="Toplam kural" value={analysisReport.totalRules} />
        <SummaryItem label="Başarılı kural" value={analysisReport.passedRules} />
        <SummaryItem label="Başarısız kural" value={analysisReport.failedRules} />
      </section>

      <Card className="report-page__results">
        <table className="report-page__table">
          <thead>
            <tr>
              <th scope="col">Durum</th>
              <th scope="col">Kural adı</th>
              <th scope="col">Beklenen</th>
              <th scope="col">Gerçek değer</th>
              <th scope="col">Mesaj</th>
            </tr>
          </thead>
          <tbody>
            {analysisReport.results.map((result) => (
              <tr key={result.ruleId}>
                <td aria-label={result.passed ? 'Başarılı' : 'Başarısız'}>
                  {result.passed ? '✔' : '❌'}
                </td>
                <td>{result.ruleName}</td>
                <td>{formatRuleResultValue(result.expected)}</td>
                <td>{formatRuleResultValue(result.actual)}</td>
                <td>{result.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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

function formatRuleResultValue(value: RuleResultValue): string {
  return value === null ? '—' : String(value)
}
