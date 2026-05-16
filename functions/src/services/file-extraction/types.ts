import { FileExtractionResult, SupportedFileExtension } from '@shared-types';

export type FileExtractionErrorCode = 'invalid-argument' | 'internal';

export class FileExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: FileExtractionErrorCode = 'invalid-argument'
  ) {
    super(message);
    this.name = 'FileExtractionError';
  }
}

export interface FileExtractionInput {
  buffer: Buffer;
  filename: string;
  extension: SupportedFileExtension;
  mimeType?: string;
}

export interface FileExtractor {
  readonly name: string;
  readonly supportedExtensions: readonly SupportedFileExtension[];
  readonly supportedMimeTypes: readonly string[];
  extract(input: FileExtractionInput): Promise<FileExtractionResult>;
}
