import { useState } from 'react'
import { analyzeDocxWithRuleEngine } from '../features/analysis/analysisService'
import {
  FileInfo,
  UploadActions,
  UploadDropzone,
  createSelectedUploadFile,
  isSupportedUploadFile,
} from '../features/upload'
import type { SelectedUploadFile } from '../features/upload'
import { Card, Container } from '../shared'
import './UploadPage.css'

export function UploadPage() {
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<SelectedUploadFile | null>(null)

  function handleFileSelect(file: File) {
    if (!isSupportedUploadFile(file)) {
      setSelectedFile(null)
      setErrorMessage('Yalnızca .docx uzantılı dosyalar yüklenebilir.')
      return
    }

    setErrorMessage('')
    setSelectedFile(createSelectedUploadFile(file))
  }

  async function handleAnalyzeClick() {
    if (!selectedFile) {
      setErrorMessage('Dosya secilmeden analiz baslatilamaz.')
      return
    }

    try {
      setErrorMessage('')
      const ruleResults = await analyzeDocxWithRuleEngine(selectedFile.file)

      console.log('Rule engine results')
      console.table(ruleResults)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'DOCX paketi okunamadi: Bilinmeyen bir hata olustu.'

      setErrorMessage(message)
      console.error(message)
    }
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
