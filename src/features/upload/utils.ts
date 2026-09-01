import type { SelectedUploadFile } from './types'

const bytesInKilobyte = 1024
const bytesInMegabyte = bytesInKilobyte * 1024

export const MAX_DOCX_FILE_SIZE_BYTES = 20 * bytesInMegabyte
export const maxUploadSizeInBytes = MAX_DOCX_FILE_SIZE_BYTES

export type UploadValidationErrorCode =
  | 'NO_FILE'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'

export type UploadFileValidationResult =
  | { valid: true }
  | { code: UploadValidationErrorCode; message: string; valid: false }

export class UploadFileValidationError extends Error {
  constructor(
    readonly code: UploadValidationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'UploadFileValidationError'
  }
}

export function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop()

  return extension ? `.${extension.toLowerCase()}` : ''
}

export function isSupportedUploadFile(file: File) {
  return validateUploadFile(file).valid
}

export function validateUploadFile(file: File | null): UploadFileValidationResult {
  if (!file) {
    return {
      code: 'NO_FILE',
      message: 'Analiz için bir DOCX dosyası seçin.',
      valid: false,
    }
  }

  if (getFileExtension(file.name) !== '.docx') {
    return {
      code: 'INVALID_FILE_TYPE',
      message: 'Yalnızca .docx uzantılı dosyalar yüklenebilir.',
      valid: false,
    }
  }

  if (file.size > MAX_DOCX_FILE_SIZE_BYTES) {
    return {
      code: 'FILE_TOO_LARGE',
      message: "Dosya boyutu 20 MB'tan büyük olamaz.",
      valid: false,
    }
  }

  return { valid: true }
}

export function assertValidUploadFile(file: File | null): asserts file is File {
  const validation = validateUploadFile(file)

  if (!validation.valid) {
    throw new UploadFileValidationError(validation.code, validation.message)
  }
}

export function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes >= bytesInMegabyte) {
    return `${(sizeInBytes / bytesInMegabyte).toFixed(2)} MB`
  }

  return `${(sizeInBytes / bytesInKilobyte).toFixed(2)} KB`
}

export function createSelectedUploadFile(file: File): SelectedUploadFile {
  return {
    extension: getFileExtension(file.name),
    file,
    formattedSize: formatFileSize(file.size),
    name: file.name,
  }
}
