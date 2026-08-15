import { useState, type ChangeEvent, type ReactNode } from 'react'
import { analyzeDocx } from '../features/analysis/analysisService'
import {
  ACADEMIC_CATALOG,
  type AcademicCatalogEntry,
} from '../features/analysis/catalog/AcademicCatalog'
import type {
  AcademicSelection,
  AnalysisReport,
} from '../features/analysis/types'
import {
  FileInfo,
  UploadActions,
  UploadDropzone,
  createSelectedUploadFile,
  isSupportedUploadFile,
} from '../features/upload'
import type { SelectedUploadFile } from '../features/upload'
import { Card, Container } from '../shared'
import { ReportPage } from './ReportPage'
import './UploadPage.css'

export function UploadPage() {
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<SelectedUploadFile | null>(null)
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null)
  const [universityId, setUniversityId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [thesisTypeId, setThesisTypeId] = useState('')
  const [studyTypeId, setStudyTypeId] = useState('')

  const universityEntries = universityId
    ? ACADEMIC_CATALOG.filter((entry) => entry.university.id === universityId)
    : []
  const organizationEntries = organizationId
    ? universityEntries.filter((entry) => getOrganization(entry).id === organizationId)
    : []
  const unitEntries = unitId
    ? organizationEntries.filter((entry) => getUnit(entry).id === unitId)
    : []
  const academicSelection = createAcademicSelection(
    unitEntries,
    thesisTypeId,
    studyTypeId,
  )
  const thesisTypeEntry = unitEntries.find(
    (entry) => entry.thesisType.id === thesisTypeId,
  )
  const studyTypes = thesisTypeEntry?.studyTypes ?? []
  const disabledReason = getDisabledReason(selectedFile, academicSelection)

  function handleFileSelect(file: File) {
    if (!isSupportedUploadFile(file)) {
      setSelectedFile(null)
      setAnalysisReport(null)
      setErrorMessage('Yalnızca .docx uzantılı dosyalar yüklenebilir.')
      return
    }

    setErrorMessage('')
    setAnalysisReport(null)
    setSelectedFile(createSelectedUploadFile(file))
  }

  async function handleAnalyzeClick() {
    if (!selectedFile || !academicSelection) {
      setErrorMessage(getDisabledReason(selectedFile, academicSelection))
      return
    }

    try {
      setErrorMessage('')
      const report = await analyzeDocx(selectedFile.file, academicSelection)
      setAnalysisReport(report)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Analiz sırasında bilinmeyen bir hata oluştu.',
      )
    }
  }

  if (analysisReport) {
    return (
      <ReportPage
        analysisReport={analysisReport}
        onNewAnalysis={() => {
          setAnalysisReport(null)
          setSelectedFile(null)
          setErrorMessage('')
        }}
      />
    )
  }

  return (
    <Container className="upload-page">
      <Card className="upload-page__card">
        <header className="upload-page__header">
          <h1>Tez Analizi</h1>
          <p>Tez bilgilerini seçin ve analiz edilecek DOCX dosyasını yükleyin.</p>
        </header>

        <section className="upload-page__selections" aria-label="Tez bilgileri">
          <SelectionField
            id="university"
            label="Üniversite"
            onChange={(event) => {
              setUniversityId(event.target.value)
              setOrganizationId('')
              setUnitId('')
              setThesisTypeId('')
              setStudyTypeId('')
            }}
            value={universityId}
          >
            <option value="">Üniversite seçin</option>
            {uniqueEntries(ACADEMIC_CATALOG, (entry) => entry.university.id).map(
              (entry) => (
                <option key={entry.university.id} value={entry.university.id}>
                  {entry.university.name}
                </option>
              ),
            )}
          </SelectionField>

          <SelectionField
            disabled={!universityId}
            id="organization"
            label="Fakülte / Enstitü"
            onChange={(event) => {
              setOrganizationId(event.target.value)
              setUnitId('')
              setThesisTypeId('')
              setStudyTypeId('')
            }}
            value={organizationId}
          >
            <option value="">Fakülte veya enstitü seçin</option>
            {uniqueEntries(universityEntries, (entry) => getOrganization(entry).id).map(
              (entry) => {
                const organization = getOrganization(entry)
                return (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                )
              },
            )}
          </SelectionField>

          <SelectionField
            disabled={!organizationId}
            id="academic-unit"
            label="Bölüm / Program"
            onChange={(event) => {
              setUnitId(event.target.value)
              setThesisTypeId('')
              setStudyTypeId('')
            }}
            value={unitId}
          >
            <option value="">Bölüm veya program seçin</option>
            {uniqueEntries(organizationEntries, (entry) => getUnit(entry).id).map(
              (entry) => {
                const unit = getUnit(entry)
                return (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                )
              },
            )}
          </SelectionField>

          <SelectionField
            disabled={!unitId}
            id="thesis-type"
            label="Tez Türü"
            onChange={(event) => {
              setThesisTypeId(event.target.value)
              setStudyTypeId('')
            }}
            value={thesisTypeId}
          >
            <option value="">Tez türü seçin</option>
            {uniqueEntries(unitEntries, (entry) => entry.thesisType.id).map(
              (entry) => (
                <option key={entry.thesisType.id} value={entry.thesisType.id}>
                  {entry.thesisType.name}
                </option>
              ),
            )}
          </SelectionField>

          {studyTypes.length > 0 ? (
            <SelectionField
              disabled={!thesisTypeId}
              id="study-type"
              label="Çalışma Türü"
              onChange={(event) => setStudyTypeId(event.target.value)}
              value={studyTypeId}
            >
              <option value="">Çalışma türü seçin</option>
              {studyTypes.map((studyType) => (
                <option key={studyType.id} value={studyType.id}>
                  {studyType.name}
                </option>
              ))}
            </SelectionField>
          ) : null}
        </section>

        <UploadDropzone errorMessage={errorMessage} onFileSelect={handleFileSelect} />
        {selectedFile ? <FileInfo selectedFile={selectedFile} /> : null}
        <p className="upload-page__analysis-hint" aria-live="polite">
          {disabledReason}
        </p>
        <UploadActions
          disabled={!selectedFile || !academicSelection}
          onAnalyze={handleAnalyzeClick}
        />
      </Card>
    </Container>
  )
}

interface SelectionFieldProps {
  children: ReactNode
  disabled?: boolean
  id: string
  label: string
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
  value: string
}

function SelectionField({
  children,
  disabled = false,
  id,
  label,
  onChange,
  value,
}: SelectionFieldProps) {
  return (
    <label className="upload-page__selection" htmlFor={id}>
      <span>{label}</span>
      <select disabled={disabled} id={id} onChange={onChange} value={value}>
        {children}
      </select>
    </label>
  )
}

function getOrganization(entry: AcademicCatalogEntry) {
  return entry.faculty ?? entry.institute
}

function getUnit(entry: AcademicCatalogEntry) {
  return entry.department ?? entry.program
}

function uniqueEntries(
  entries: readonly AcademicCatalogEntry[],
  getId: (entry: AcademicCatalogEntry) => string,
): AcademicCatalogEntry[] {
  return entries.filter(
    (entry, index) =>
      entries.findIndex((candidate) => getId(candidate) === getId(entry)) === index,
  )
}

function createAcademicSelection(
  entries: readonly AcademicCatalogEntry[],
  thesisTypeId: string,
  studyTypeId: string,
): AcademicSelection | null {
  const entry = entries.find(
    (candidate) => candidate.thesisType.id === thesisTypeId,
  )

  if (!entry) {
    return null
  }

  if (entry.studyTypes?.length && !studyTypeId) {
    return null
  }

  if (
    studyTypeId &&
    !entry.studyTypes?.some((studyType) => studyType.id === studyTypeId)
  ) {
    return null
  }

  const base = {
    universityId: entry.university.id,
    thesisTypeId: entry.thesisType.id,
    ...(studyTypeId ? { studyTypeId } : {}),
  }

  if (entry.faculty && entry.department) {
    return {
      ...base,
      facultyId: entry.faculty.id,
      departmentId: entry.department.id,
    }
  }

  if (entry.faculty && entry.program) {
    return {
      ...base,
      facultyId: entry.faculty.id,
      programId: entry.program.id,
    }
  }

  if (entry.institute && entry.department) {
    return {
      ...base,
      instituteId: entry.institute.id,
      departmentId: entry.department.id,
    }
  }

  return {
    ...base,
    instituteId: entry.institute.id,
    programId: entry.program.id,
  }
}

function getDisabledReason(
  selectedFile: SelectedUploadFile | null,
  selection: AcademicSelection | null,
): string {
  if (!selection && !selectedFile) {
    return 'Analiz için akademik seçimleri tamamlayın ve geçerli bir DOCX yükleyin.'
  }

  if (!selection) {
    return 'Analiz için akademik seçimleri tamamlayın.'
  }

  if (!selectedFile) {
    return 'Analiz için geçerli bir DOCX yükleyin.'
  }

  return 'Akademik seçim ve DOCX hazır. Analizi başlatabilirsiniz.'
}
