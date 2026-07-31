import { useState } from 'react'
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

  function handleAnalyzeClick() {
    console.log('Analyze clicked')
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
