import { useState } from 'react'
import type {
  AnalysisReport,
  RuleEvidence,
  RuleResult,
  RuleResultStatus,
  RuleResultValue,
} from '../../types'
import { Button, Card } from '../../../../shared'
import './AnalysisReportView.css'

type ResultFilter = 'all' | RuleResultStatus

interface AnalysisReportViewProps {
  analysisReport: AnalysisReport
  onNewAnalysis: () => void
}

interface FilterOption {
  id: ResultFilter
  label: string
  count: number
}

export function AnalysisReportView({
  analysisReport,
  onNewAnalysis,
}: AnalysisReportViewProps) {
  const [activeFilter, setActiveFilter] = useState<ResultFilter>('all')
  const filterOptions = createFilterOptions(analysisReport)
  const visibleResults = getVisibleResults(analysisReport.results, activeFilter)

  return (
    <div className="analysis-report">
      <header className="analysis-report__header">
        <div>
          <h1>Analiz Raporu</h1>
          <p>Tezinizin kural uyumluluğunu ve düzeltilmesi gereken alanları inceleyin.</p>
        </div>
        <Button onClick={onNewAnalysis}>Yeni Analiz</Button>
      </header>

      <ReportSummary analysisReport={analysisReport} />

      <section className="analysis-report__details" aria-labelledby="result-heading">
        <div className="analysis-report__results-header">
          <div>
            <h2 id="result-heading">Kural sonuçları</h2>
            <p>{visibleResults.length} sonuç gösteriliyor</p>
          </div>
          <ReportFilters
            activeFilter={activeFilter}
            filters={filterOptions}
            onFilterChange={setActiveFilter}
          />
        </div>

        <RuleResultList activeFilter={activeFilter} results={visibleResults} />
      </section>
    </div>
  )
}

function ReportSummary({ analysisReport }: { analysisReport: AnalysisReport }) {
  return (
    <section className="analysis-report__summary" aria-label="Rapor özeti">
      <SummaryItem label="Uyumluluk" value={`%${analysisReport.score}`} tone="score" />
      <SummaryItem label="Toplam kontrol" value={analysisReport.totalRules} />
      <SummaryItem label="Başarılı" value={analysisReport.passedRules} tone="passed" />
      <SummaryItem label="Başarısız" value={analysisReport.failedRules} tone="failed" />
      <SummaryItem label="Uygulanamaz" value={analysisReport.notApplicableRules} tone="neutral" />
    </section>
  )
}

interface SummaryItemProps {
  label: string
  tone?: 'score' | 'passed' | 'failed' | 'neutral'
  value: string | number
}

function SummaryItem({ label, tone = 'neutral', value }: SummaryItemProps) {
  return (
    <Card className={`analysis-report__summary-item analysis-report__summary-item--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  )
}

interface ReportFiltersProps {
  activeFilter: ResultFilter
  filters: readonly FilterOption[]
  onFilterChange: (filter: ResultFilter) => void
}

function ReportFilters({
  activeFilter,
  filters,
  onFilterChange,
}: ReportFiltersProps) {
  return (
    <div className="analysis-report__filters" aria-label="Sonuç filtreleri">
      {filters.map((filter) => (
        <button
          aria-pressed={activeFilter === filter.id}
          className="analysis-report__filter"
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          type="button"
        >
          {filter.label} ({filter.count})
        </button>
      ))}
    </div>
  )
}

interface RuleResultListProps {
  activeFilter: ResultFilter
  results: readonly RuleResult[]
}

function RuleResultList({ activeFilter, results }: RuleResultListProps) {
  if (results.length === 0) {
    return (
      <Card className="analysis-report__empty-filter" role="status">
        {getEmptyFilterMessage(activeFilter)}
      </Card>
    )
  }

  return (
    <div className="analysis-report__result-list">
      {results.map((result) => (
        <RuleResultItem key={result.ruleId} result={result} />
      ))}
    </div>
  )
}

function RuleResultItem({ result }: { result: RuleResult }) {
  const presentation = getResultPresentation(result.status)
  const correctionGuidance = getCorrectionGuidance(result)
  const evidence = result.evidence ?? []
  const hasMessage = result.message.trim().length > 0
  const hasExpected = hasResultValue(result.expected)
  const hasActual = hasResultValue(result.actual)
  const hasEvidence = evidence.length > 0
  const hasDetails = shouldRenderDetails({
    correctionGuidance,
    hasActual,
    hasEvidence,
    hasExpected,
    hasMessage,
    status: result.status,
  })

  return (
    <Card
      className={[
        'analysis-report__result-card',
        `analysis-report__result-card--${presentation.className}`,
      ].join(' ')}
    >
      <div className="analysis-report__result-title">
        <h3>{result.ruleName || 'Kural sonucu'}</h3>
        <span className="analysis-report__status">
          <span aria-hidden="true">{presentation.symbol}</span>
          {presentation.label}
        </span>
      </div>

      {hasDetails ? (
        <details
          className="analysis-report__details-panel"
          open={result.status === 'FAILED'}
        >
          <summary>Detaylar</summary>

          <div className="analysis-report__details-content">
            {hasMessage ? (
              <p className="analysis-report__message">{result.message}</p>
            ) : null}

            {hasExpected || hasActual ? (
              <dl className="analysis-report__values">
                {hasExpected ? (
                  <div>
                    <dt>Beklenen</dt>
                    <dd>{formatRuleResultValue(result.expected, 'expected')}</dd>
                  </div>
                ) : null}
                {hasActual ? (
                  <div>
                    <dt>Belgede bulunan</dt>
                    <dd>{formatRuleResultValue(result.actual, 'actual')}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {hasEvidence ? (
              <EvidenceList
                evidence={evidence}
                evidenceTotal={result.evidenceTotal ?? evidence.length}
              />
            ) : null}

            {correctionGuidance ? (
              <div className="analysis-report__guidance">
                <h4>Nasıl düzeltilir?</h4>
                <p>{correctionGuidance}</p>
              </div>
            ) : null}

            <p className="analysis-report__rule-code">
              <span>Kural kodu:</span> {result.ruleId}
            </p>
          </div>
        </details>
      ) : null}
    </Card>
  )
}

function shouldRenderDetails(options: {
  correctionGuidance: string | null
  hasActual: boolean
  hasEvidence: boolean
  hasExpected: boolean
  hasMessage: boolean
  status: RuleResultStatus
}): boolean {
  if (options.status === 'PASSED') {
    return options.hasEvidence
  }

  if (options.status === 'NOT_APPLICABLE') {
    return options.hasMessage || options.hasEvidence
  }

  return (
    options.hasMessage ||
    options.hasExpected ||
    options.hasActual ||
    options.correctionGuidance !== null ||
    options.hasEvidence
  )
}

interface EvidenceListProps {
  evidence: readonly RuleEvidence[]
  evidenceTotal: number
}

function EvidenceList({ evidence, evidenceTotal }: EvidenceListProps) {
  return (
    <section className="analysis-report__evidence" aria-label="Tespit edilen sorunlar">
      <div className="analysis-report__evidence-header">
        <h4>{evidenceTotal} sorun bulundu</h4>
        {evidence.length < evidenceTotal ? (
          <p>İlk {evidence.length} sorun gösteriliyor.</p>
        ) : null}
      </div>

      <ol className="analysis-report__evidence-list">
        {evidence.map((item, index) => (
          <li key={createEvidenceKey(item, index)}>
            <EvidenceItem evidence={item} index={index} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function EvidenceItem({
  evidence,
  index,
}: {
  evidence: RuleEvidence
  index: number
}) {
  return (
    <article className="analysis-report__evidence-item">
      <h5>{getEvidenceTitle(evidence, index)}</h5>
      <dl>
        {getEvidenceText(evidence) ? (
          <div>
            <dt>Metin</dt>
            <dd>“{getEvidenceText(evidence)}”</dd>
          </div>
        ) : null}
        {getEvidenceSectionName(evidence) ? (
          <div>
            <dt>Bölüm</dt>
            <dd>{getEvidenceSectionName(evidence)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Konum</dt>
          <dd>{formatEvidenceLocation(evidence)}</dd>
        </div>
        {hasResultValue(evidence.expected) ? (
          <div>
            <dt>Beklenen</dt>
            <dd>{formatEvidenceValue(evidence.expected, getEvidenceUnit(evidence), 'expected')}</dd>
          </div>
        ) : null}
        {hasResultValue(evidence.actual) ? (
          <div>
            <dt>Bulunan</dt>
            <dd>{formatEvidenceValue(evidence.actual, getEvidenceUnit(evidence), 'actual')}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  )
}

function createEvidenceKey(evidence: RuleEvidence, index: number): string {
  if (evidence.kind === 'paragraph') {
    return `${evidence.kind}-${evidence.paragraphId}-${index}`
  }

  if (evidence.kind === 'heading') {
    return `${evidence.kind}-${evidence.paragraphId}-${index}`
  }

  if (evidence.kind === 'run') {
    return `${evidence.kind}-${evidence.paragraphId}-${evidence.runIndex}-${index}`
  }

  if (evidence.kind === 'section') {
    return `${evidence.kind}-${evidence.sectionName}-${evidence.paragraphId ?? 'missing'}-${index}`
  }

  if (evidence.kind === 'document-format') {
    return `${evidence.kind}-${evidence.property}-${index}`
  }

  if (evidence.kind === 'caption') {
    return `${evidence.kind}-${evidence.captionId}-${index}`
  }

  if (evidence.kind === 'table' || evidence.kind === 'figure') {
    return `${evidence.kind}-${evidence.objectId}-${index}`
  }

  return `evidence-${index}`
}

function getEvidenceTitle(evidence: RuleEvidence, index: number): string {
  const prefix = `Sorun ${index + 1}`

  if (evidence.kind === 'heading') {
    return `${prefix}: Başlık`
  }

  if (evidence.kind === 'run') {
    return `${prefix}: Metin`
  }

  if (evidence.kind === 'section') {
    return `${prefix}: Bölüm`
  }

  if (evidence.kind === 'document-format') {
    return `${prefix}: ${evidence.property}`
  }

  if (evidence.kind === 'caption') {
    return `${prefix}: ${evidence.captionKind === 'table' ? 'Tablo başlığı' : 'Şekil başlığı'}`
  }

  if (evidence.kind === 'table') {
    return `${prefix}: ${evidence.objectLabel ?? 'Tablo nesnesi'}`
  }

  if (evidence.kind === 'figure') {
    return `${prefix}: ${evidence.objectLabel ?? 'Şekil nesnesi'}`
  }

  return prefix
}

function getEvidenceText(evidence: RuleEvidence): string | undefined {
  if (evidence.kind === 'run') {
    return evidence.textExcerpt ?? evidence.paragraphExcerpt
  }

  if (evidence.kind === 'paragraph' || evidence.kind === 'heading' || evidence.kind === 'caption') {
    return evidence.textExcerpt
  }

  if (evidence.kind === 'table' || evidence.kind === 'figure') {
    return evidence.captionText
  }

  return undefined
}

function getEvidenceSectionName(evidence: RuleEvidence): string | undefined {
  if (evidence.kind === 'paragraph' || evidence.kind === 'run' || evidence.kind === 'heading') {
    return evidence.sectionName
  }

  if (evidence.kind === 'section') {
    return evidence.sectionName
  }

  return undefined
}

function getEvidenceUnit(evidence: RuleEvidence): string | undefined {
  if (
    evidence.kind === 'paragraph' ||
    evidence.kind === 'run' ||
    evidence.kind === 'section' ||
    evidence.kind === 'document-format'
  ) {
    return evidence.unit
  }

  return undefined
}

function formatEvidenceLocation(evidence: RuleEvidence): string {
  if (evidence.kind === 'document-format') {
    return evidence.sectionIndex === undefined
      ? 'Belge biçimi'
      : `Belge bölümü: ${evidence.sectionIndex + 1}`
  }

  if (evidence.kind === 'table') {
    return evidence.objectLabel ?? 'Tablo nesnesi'
  }

  if (
    evidence.kind === 'paragraph' ||
    evidence.kind === 'run' ||
    evidence.kind === 'heading' ||
    evidence.kind === 'caption' ||
    evidence.kind === 'figure' ||
    evidence.kind === 'section'
  ) {
    if (evidence.paragraphIndex !== undefined) {
      return `Belgedeki paragraf: ${evidence.paragraphIndex + 1}`
    }
  }

  return 'Konum tespit edildi'
}

function createFilterOptions(analysisReport: AnalysisReport): FilterOption[] {
  return [
    { id: 'all', label: 'Tümü', count: analysisReport.totalRules },
    { id: 'FAILED', label: 'Başarısız', count: analysisReport.failedRules },
    { id: 'PASSED', label: 'Başarılı', count: analysisReport.passedRules },
    {
      id: 'NOT_APPLICABLE',
      label: 'Uygulanamaz',
      count: analysisReport.notApplicableRules,
    },
  ]
}

function getVisibleResults(
  results: readonly RuleResult[],
  filter: ResultFilter,
): RuleResult[] {
  const filteredResults = filter === 'all'
    ? results
    : results.filter((result) => result.status === filter)

  return filter === 'all'
    ? [...filteredResults].sort(
        (first, second) => getStatusOrder(first.status) - getStatusOrder(second.status),
      )
    : [...filteredResults]
}

function getEmptyFilterMessage(filter: ResultFilter): string {
  if (filter === 'FAILED') {
    return 'Başarısız kural bulunamadı.'
  }

  if (filter === 'PASSED') {
    return 'Başarılı kural bulunamadı.'
  }

  if (filter === 'NOT_APPLICABLE') {
    return 'Uygulanamaz kural bulunamadı.'
  }

  return 'Gösterilecek kural sonucu bulunamadı.'
}

function getStatusOrder(status: RuleResultStatus): number {
  return { FAILED: 0, PASSED: 1, NOT_APPLICABLE: 2 }[status]
}

function getResultPresentation(status: RuleResultStatus): {
  className: 'passed' | 'failed' | 'not-applicable'
  symbol: string
  label: string
} {
  if (status === 'PASSED') {
    return { className: 'passed', symbol: '✓', label: 'Başarılı' }
  }

  if (status === 'FAILED') {
    return { className: 'failed', symbol: '×', label: 'Başarısız' }
  }

  return { className: 'not-applicable', symbol: '-', label: 'Uygulanamaz' }
}

function getCorrectionGuidance(result: RuleResult): string | null {
  if (result.status !== 'FAILED') {
    return null
  }

  const searchableText = [
    result.ruleName,
    result.message,
    formatRuleResultValue(result.expected, 'expected'),
  ].join(' ').toLocaleLowerCase('tr-TR')

  if (searchableText.includes('yazı tipi')) {
    return 'İlgili metni beklenen yazı tipine dönüştürün.'
  }

  if (searchableText.includes('punto') || searchableText.includes('yazı boyutu')) {
    return 'İlgili metnin punto değerini beklenen boyuta getirin.'
  }

  if (searchableText.includes('satır aralığı')) {
    return 'Satır aralığını beklenen değere ayarlayın.'
  }

  if (searchableText.includes('hizalama') || searchableText.includes('hizalı')) {
    return 'İlgili metin veya nesnenin hizalamasını beklenen hizaya ayarlayın.'
  }

  if (searchableText.includes('girinti')) {
    return 'İlgili paragrafın ilk satır girintisini beklenen değere ayarlayın.'
  }

  if (searchableText.includes('bölüm')) {
    return 'Gerekli bölümü tezinizde uygun konuma ekleyin veya bölüm başlığını beklenen adla düzenleyin.'
  }

  if (searchableText.includes('başlık')) {
    return 'İlgili başlığı beklenen biçim, düzey veya numaralandırma düzenine getirin.'
  }

  if (searchableText.includes('tablo')) {
    return 'Tablo başlığı, hizalaması veya metin içi atıfını beklenen kurala göre düzenleyin.'
  }

  if (searchableText.includes('şekil')) {
    return 'Şekil başlığı, hizalaması veya metin içi atıfını beklenen kurala göre düzenleyin.'
  }

  if (searchableText.includes('kısaltma')) {
    return 'Metinde kullandığınız kısaltmaları kısaltmalar listesiyle tutarlı hale getirin.'
  }

  if (searchableText.includes('sayfa')) {
    return 'Sayfa numarası biçimini ve konumunu beklenen düzene göre ayarlayın.'
  }

  if (searchableText.includes('anahtar kelime')) {
    return 'Anahtar kelime bilgisini beklenen sayı ve yerleşime göre düzenleyin.'
  }

  return null
}

function hasResultValue(value: RuleResultValue): boolean {
  return value !== null && value !== ''
}

function formatRuleResultValue(
  value: RuleResultValue,
  context: 'actual' | 'expected',
): string {
  if (hasResultValue(value)) {
    return String(value)
  }

  return context === 'actual' ? 'Belgede tespit edilmedi' : 'Belirtilmedi'
}

function formatEvidenceValue(
  value: RuleResultValue,
  unit: string | undefined,
  context: 'actual' | 'expected',
): string {
  const formattedValue = formatRuleResultValue(value, context)

  return unit && hasResultValue(value) ? `${formattedValue} ${unit}` : formattedValue
}
