import type { DragEvent } from 'react'
import { useRef, useState } from 'react'
import { Button } from '../../../shared'
import './UploadDropzone.css'

type UploadDropzoneProps = {
  errorMessage?: string
  onFileSelect: (file: File) => void
}

export function UploadDropzone({ errorMessage, onFileSelect }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  function openFileDialog() {
    inputRef.current?.click()
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(true)
  }

  function handleDragLeave() {
    setIsDragActive(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)

    const selectedFile = event.dataTransfer.files.item(0)

    if (selectedFile) {
      onFileSelect(selectedFile)
    }
  }

  return (
    <div
      className={['upload-dropzone', isDragActive ? 'upload-dropzone--active' : '']
        .filter(Boolean)
        .join(' ')}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        accept=".docx"
        className="upload-dropzone__input"
        onChange={(event) => {
          const selectedFile = event.target.files?.item(0)

          if (selectedFile) {
            onFileSelect(selectedFile)
          }

          event.target.value = ''
        }}
        ref={inputRef}
        type="file"
      />
      <div className="upload-dropzone__content">
        <h1 className="upload-dropzone__title">Belgenizi yükleyin</h1>
        <p className="upload-dropzone__description">
          DOCX dosyanızı buraya sürükleyip bırakın veya dosya seçin.
        </p>
        <Button onClick={openFileDialog} variant="secondary">
          Dosya Seç
        </Button>
        <p className="upload-dropzone__hint">Desteklenen format: .docx, en fazla 20 MB.</p>
        {errorMessage ? <p className="upload-dropzone__error">{errorMessage}</p> : null}
      </div>
    </div>
  )
}
