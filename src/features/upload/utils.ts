import type { SelectedUploadFile } from './types'

const bytesInKilobyte = 1024
const bytesInMegabyte = bytesInKilobyte * 1024

export const maxUploadSizeInBytes = 20 * bytesInMegabyte

export function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop()

  return extension ? `.${extension.toLowerCase()}` : ''
}

export function isSupportedUploadFile(file: File) {
  return getFileExtension(file.name) === '.docx'
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
