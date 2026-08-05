import { useState, type ReactNode } from 'react'
import { analyzeDocx } from '../features/analysis/analysisService'
import type { AnalysisReport } from '../features/analysis/types'
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
    if (!selectedFile) {
      setErrorMessage('Dosya secilmeden analiz baslatilamaz.')
      return
    }

    try {
      setErrorMessage('')
      const analysisReport = await analyzeDocx(selectedFile.file)

      setAnalysisReport(analysisReport)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'DOCX paketi okunamadi: Bilinmeyen bir hata olustu.'

      setErrorMessage(message)
      console.error(message)
    }
  }

  if (analysisReport) {
    return <ReportPage analysisReport={analysisReport} />
  }

  return (
    <Container className="upload-page">
      <Card className="upload-page__card">
        <header className="upload-page__header">
          <h1>Tez Analizi</h1>
          <p>Tez bilgilerini seçin ve analiz edilecek DOCX dosyasını yükleyin.</p>
        </header>

        <section className="upload-page__selections" aria-label="Tez bilgileri">
          <SelectionField id="university" label="Üniversite">
            <option value="comu">Çanakkale Onsekiz Mart Üniversitesi</option>
          </SelectionField>
          <SelectionField id="faculty" label="Fakülte">
            <option value="all">Tüm fakülteler</option>
          </SelectionField>
          <SelectionField id="institute" label="Enstitü">
            <option value="all">Tüm enstitüler</option>
          </SelectionField>
          <SelectionField id="thesis-type" label="Tez türü">
            <option value="bachelor">Lisans tezi</option>
          </SelectionField>
        </section>

        <UploadDropzone errorMessage={errorMessage} onFileSelect={handleFileSelect} />
        {selectedFile ? <FileInfo selectedFile={selectedFile} /> : null}
        <UploadActions disabled={!selectedFile} onAnalyze={handleAnalyzeClick} />
      </Card>
    </Container>
  )
}

interface SelectionFieldProps {
  children: ReactNode
  id: string
  label: string
}

function SelectionField({ children, id, label }: SelectionFieldProps) {
  return (
    <label className="upload-page__selection" htmlFor={id}>
      <span>{label}</span>
      <select id={id}>{children}</select>
    </label>
  )
}
