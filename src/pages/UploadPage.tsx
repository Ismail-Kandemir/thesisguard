import { useState } from 'react'
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
        <UploadDropzone errorMessage={errorMessage} onFileSelect={handleFileSelect} />
        {selectedFile ? <FileInfo selectedFile={selectedFile} /> : null}
        <UploadActions disabled={!selectedFile} onAnalyze={handleAnalyzeClick} />
      </Card>
    </Container>
  )
}
