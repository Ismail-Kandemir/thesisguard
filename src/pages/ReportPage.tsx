import { useNavigate } from 'react-router-dom'
import { routePaths } from '../app/constants/routePaths'
import { AnalysisReportView } from '../features/analysis/report/components'
import type { AnalysisReport } from '../features/analysis/types'
import { Button, Card, Container } from '../shared'
import './ReportPage.css'

interface ReportPageProps {
  analysisReport?: AnalysisReport
  onNewAnalysis?: () => void
}

export function ReportPage({ analysisReport, onNewAnalysis }: ReportPageProps) {
  const navigate = useNavigate()

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

  return (
    <Container className="report-page">
      <AnalysisReportView
        analysisReport={analysisReport}
        onNewAnalysis={handleNewAnalysis}
      />
    </Container>
  )
}
