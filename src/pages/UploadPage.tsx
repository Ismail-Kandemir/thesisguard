import { useState, type ChangeEvent, type ReactNode } from 'react'
import { analyzeDocx } from '../features/analysis/analysisService'
import {
  ACADEMIC_CATALOG,
  type AcademicCatalogEntry,
} from '../features/analysis/catalog/AcademicCatalog'
import { DocxPackageError } from '../features/analysis/readers/docxPackageReader'
import type {
  AcademicSelection,
  AnalysisReport,
} from '../features/analysis/types'
import {
  FileInfo,
  UploadActions,
  UploadDropzone,
  UploadFileValidationError,
  createSelectedUploadFile,
  validateUploadFile,
} from '../features/upload'
import type { SelectedUploadFile } from '../features/upload'
import { Card, Container } from '../shared'
import { ReportPage } from './ReportPage'
import './UploadPage.css'

export function UploadPage() {
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<SelectedUploadFile | null>(null)
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
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
  const readinessItems = createReadinessItems({
    academicSelection,
    hasSelectedFile: selectedFile !== null,
    hasStudyTypes: studyTypes.length > 0,
    organizationId,
    studyTypeId,
    thesisTypeId,
    unitId,
    universityId,
  })

  function handleFileSelect(file: File) {
    const validation = validateUploadFile(file)

    setAnalysisReport(null)
    setIsAnalyzing(false)

    if (!validation.valid) {
      setSelectedFile(null)
      setErrorMessage(validation.message)
      return
    }

    setErrorMessage('')
    setSelectedFile(createSelectedUploadFile(file))
  }

  async function handleAnalyzeClick() {
    if (!selectedFile) {
      setErrorMessage(validateUploadFile(null).message)
      return
    }

    const validation = validateUploadFile(selectedFile.file)

    if (!validation.valid) {
      setErrorMessage(validation.message)
      return
    }

    if (!academicSelection) {
      setErrorMessage(getDisabledReason(selectedFile, academicSelection))
      return
    }

    try {
      setErrorMessage('')
      setAnalysisReport(null)
      setIsAnalyzing(true)
      const report = await analyzeDocx(selectedFile.file, academicSelection)
      setAnalysisReport(report)
    } catch (error) {
      setAnalysisReport(null)
      setErrorMessage(createUserFriendlyAnalysisErrorMessage(error))
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleChooseAnotherFile() {
    setAnalysisReport(null)
    setSelectedFile(null)
    setIsAnalyzing(false)
    setErrorMessage('')
  }

  function handleFullReset() {
    handleChooseAnotherFile()
    setUniversityId('')
    setOrganizationId('')
    setUnitId('')
    setThesisTypeId('')
    setStudyTypeId('')
  }

  if (analysisReport) {
    return (
      <ReportPage
        analysisReport={analysisReport}
        onChooseAnotherFile={handleChooseAnotherFile}
        onNewAnalysis={handleFullReset}
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

        <p className="upload-page__scope-note">
          Şu anda yalnız listelenen programlar desteklenmektedir.
        </p>
        <ReadinessChecklist items={readinessItems} />
        <UploadDropzone errorMessage={errorMessage} onFileSelect={handleFileSelect} />
        {selectedFile ? <FileInfo selectedFile={selectedFile} /> : null}
        <p className="upload-page__privacy-note">
          Dosyanız tarayıcınızda analiz edilir.
        </p>
        {errorMessage ? <AnalysisErrorMessage /> : null}
        {isAnalyzing ? (
          <div
            aria-live="polite"
            className="upload-page__analysis-status"
            role="status"
          >
            <span aria-hidden="true" className="upload-page__analysis-spinner" />
            <span>
              Belge inceleniyor. Lütfen bu pencereyi kapatmayın; sonuçlar hazır
              olunca rapor ekranı açılacak.
            </span>
          </div>
        ) : null}
        <UploadActions
          disabled={!selectedFile || !academicSelection}
          disabledReason={disabledReason}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyzeClick}
        />
      </Card>
    </Container>
  )
}

interface ReadinessState {
  academicSelection: AcademicSelection | null
  hasSelectedFile: boolean
  hasStudyTypes: boolean
  organizationId: string
  studyTypeId: string
  thesisTypeId: string
  unitId: string
  universityId: string
}

interface ReadinessItem {
  done: boolean
  label: string
}

function ReadinessChecklist({ items }: { items: readonly ReadinessItem[] }) {
  return (
    <section className="upload-page__readiness" aria-labelledby="upload-readiness-heading">
      <h2 id="upload-readiness-heading">Analiz için gerekenler</h2>
      <ul>
        {items.map((item) => (
          <li
            className={item.done ? 'upload-page__readiness-item--done' : ''}
            key={item.label}
          >
            <span aria-hidden="true">{item.done ? '✓' : '•'}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  )
}

function AnalysisErrorMessage() {
  return (
    <p className="upload-page__error-recovery">
      Dosyayı tekrar seçebilirsiniz. Bozuk veya geçersiz görünüyorsa dosyayı Word ya
      da uyumlu bir kelime işlemcide açıp yeniden .docx olarak kaydedin, sonra tekrar
      yükleyin.
    </p>
  )
}

function createReadinessItems(state: ReadinessState): ReadinessItem[] {
  return [
    { done: Boolean(state.universityId), label: 'Üniversite seçildi' },
    { done: Boolean(state.organizationId), label: 'Fakülte veya enstitü seçildi' },
    { done: Boolean(state.unitId), label: 'Bölüm veya program seçildi' },
    { done: Boolean(state.thesisTypeId), label: 'Tez türü seçildi' },
    {
      done: !state.hasStudyTypes || Boolean(state.studyTypeId),
      label: 'Çalışma türü seçildi',
    },
    { done: state.hasSelectedFile, label: 'DOCX dosyası yüklendi' },
    { done: state.academicSelection !== null && state.hasSelectedFile, label: 'Analize hazır' },
  ]
}

function createUserFriendlyAnalysisErrorMessage(error: unknown): string {
  if (error instanceof UploadFileValidationError) {
    return error.message
  }

  if (error instanceof DocxPackageError) {
    return 'DOCX dosyası güvenli şekilde okunamadı. Dosya bozuk, beklenenden büyük veya geçerli bir DOCX paketi olmayabilir.'
  }

  if (!(error instanceof Error)) {
    return 'Analiz başarısız oldu. Lütfen tekrar deneyin.'
  }

  if (error.message.startsWith('DOCX paketi okunamadi:')) {
    return 'DOCX dosyası okunamadı. Dosya bozuk olabilir veya geçerli bir DOCX paketi olmayabilir.'
  }

  return 'Analiz başarısız oldu. Lütfen geçerli bir DOCX dosyasıyla tekrar deneyin.'
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
