import {
  DOCUMENT_UPLOAD_CONSTRAINTS,
  DocumentUploadExtension,
  getDocumentUploadExtension,
} from '../types/documentUpload';

export interface IDocumentUploadValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validateDocumentUploadFile(file: File): IDocumentUploadValidationResult {
  const extension = getDocumentUploadExtension(file.name);
  if (!extension) {
    return {
      isValid: false,
      error: 'Please select a PDF, DOCX, TXT, MD, CSV, PPTX, or EPUB file.',
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      error: 'File is empty.',
    };
  }

  if (file.size > DOCUMENT_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size must be less than ${formatDocumentFileSize(DOCUMENT_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE)}.`,
    };
  }

  return {
    isValid: true,
    error: null,
  };
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read file. Please try again.'));
        return;
      }

      const [, base64Content] = reader.result.split(',');
      if (!base64Content) {
        reject(new Error('Failed to encode file. Please try again.'));
        return;
      }

      resolve(base64Content);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file. Please try again.'));
    };

    reader.readAsDataURL(file);
  });
}

export function formatDocumentFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const unit = 1024;
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(unit));
  return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(1))} ${units[index]}`;
}

export function getDocumentUploadTypeLabel(filename: string): string {
  const extension = getDocumentUploadExtension(filename);
  return extension
    ? DOCUMENT_UPLOAD_CONSTRAINTS.TYPE_LABELS[extension]
    : 'FILE';
}

export function stripDocumentUploadExtension(filename: string): string {
  const extension = getDocumentUploadExtension(filename) as DocumentUploadExtension | null;
  return extension ? filename.slice(0, -extension.length) : filename;
}
