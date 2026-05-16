import { logger } from 'firebase-functions/v2';
import { FileExtractionResult } from '@shared-types';
import { FileExtractionRegistry } from './file-extraction-registry';
import { FileExtractionError } from './types';
import {
  assertExtractedMarkdown,
  formatBytes,
  getFileExtension,
  MAX_UPLOAD_FILE_BYTES,
  validateBrowserMimeType,
} from './utils';

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const EXTRACTION_TIMEOUT_MS = 30 * 1000;

export class FileExtractionService {
  static decodeBase64File(content: string, expectedSize?: number): Buffer {
    if (!content || typeof content !== 'string') {
      throw new FileExtractionError('File content is required.');
    }

    const normalized = content.trim();
    if (normalized.length === 0 || normalized.length % 4 === 1 || !BASE64_PATTERN.test(normalized)) {
      throw new FileExtractionError('File content is not valid base64.');
    }

    const buffer = Buffer.from(normalized, 'base64');
    if (buffer.length === 0) {
      throw new FileExtractionError('Uploaded file is empty.');
    }

    if (buffer.length > MAX_UPLOAD_FILE_BYTES) {
      throw new FileExtractionError(
        `File too large: ${formatBytes(buffer.length)}, maximum is ${formatBytes(MAX_UPLOAD_FILE_BYTES)}.`
      );
    }

    if (expectedSize && expectedSize !== buffer.length) {
      logger.warn('Browser-reported file size does not match decoded size', {
        expectedSize,
        decodedSize: buffer.length,
      });
    }

    return buffer;
  }

  static async extractFromFile(
    buffer: Buffer,
    filename: string,
    mimeType?: string
  ): Promise<FileExtractionResult> {
    const extension = getFileExtension(filename);
    validateBrowserMimeType(extension, mimeType);

    if (buffer.length > MAX_UPLOAD_FILE_BYTES) {
      throw new FileExtractionError(
        `File too large: ${formatBytes(buffer.length)}, maximum is ${formatBytes(MAX_UPLOAD_FILE_BYTES)}.`
      );
    }

    const extractor = FileExtractionRegistry.select(extension);
    const startedAt = Date.now();

    logger.info('FileExtractionService: extracting file', {
      filename,
      extension,
      extractor: extractor.name,
      size: buffer.length,
      mimeType: mimeType || '(not provided)',
    });

    const result = await withTimeout(
      extractor.extract({ buffer, filename, extension, mimeType }),
      EXTRACTION_TIMEOUT_MS,
      `Extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s for ${filename}.`
    );

    assertExtractedMarkdown(result.markdownContent, filename);

    logger.info('FileExtractionService: extraction complete', {
      filename,
      extension,
      extractor: extractor.name,
      durationMs: Date.now() - startedAt,
      wordCount: result.wordCount,
      warningCount: result.warnings?.length || 0,
    });

    return result;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new FileExtractionError(timeoutMessage, 'internal')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
