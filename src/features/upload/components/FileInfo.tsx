import type { SelectedUploadFile } from '../types'
import { MAX_DOCX_FILE_SIZE_BYTES } from '../utils'
import './FileInfo.css'

type FileInfoProps = {
  selectedFile: SelectedUploadFile
}

export function FileInfo({ selectedFile }: FileInfoProps) {
  const isFileTooLarge = selectedFile.file.size > MAX_DOCX_FILE_SIZE_BYTES

  return (
    <section className="file-info" aria-label="Seçilen dosya bilgileri">
      <h2 className="file-info__title">Seçilen Dosya</h2>
      <dl className="file-info__list">
        <div className="file-info__row">
          <dt>Dosya adı</dt>
          <dd>{selectedFile.name}</dd>
        </div>
        <div className="file-info__row">
          <dt>Dosya boyutu</dt>
          <dd>{selectedFile.formattedSize}</dd>
        </div>
        <div className="file-info__row">
          <dt>Dosya uzantısı</dt>
          <dd>{selectedFile.extension}</dd>
        </div>
      </dl>
      {isFileTooLarge ? (
        <p className="file-info__warning">Dosya boyutu 20 MB'tan büyük olamaz.</p>
      ) : null}
    </section>
  )
}
