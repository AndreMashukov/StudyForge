import pdf from 'pdf-parse';
import { FileExtractionResult } from '@shared-types';
import { FileExtractionError, FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  countWords,
  filenameToTitle,
  normalizeLineEndings,
} from '../utils';

export class PdfExtractor implements FileExtractor {
  readonly name = 'PdfExtractor';
  readonly supportedExtensions = ['pdf'] as const;
  readonly supportedMimeTypes = ['application/pdf'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    if (!input.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new FileExtractionError('The uploaded file is not a valid PDF.');
    }

    try {
      const parsed = await pdf(input.buffer);
      const extractedText = normalizeLineEndings(parsed.text || '').trim();
      if (!extractedText) {
        throw new FileExtractionError('No extractable text found. This PDF may be scanned or image-based.');
      }

      const title = typeof parsed.info?.Title === 'string' && parsed.info.Title.trim()
        ? parsed.info.Title.trim()
        : filenameToTitle(input.filename);
      const markdownContent = `# ${title}\n\n${extractedText}`;
      assertExtractedMarkdown(markdownContent, input.filename);

      return {
        filename: input.filename,
        originalType: input.mimeType || 'application/pdf',
        markdownContent,
        wordCount: countWords(markdownContent),
        title,
        extension: 'pdf',
        originalSize: input.buffer.length,
        metadata: {
          pageCount: parsed.numpages,
        },
      };
    } catch (error) {
      if (error instanceof FileExtractionError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new FileExtractionError(`Failed to extract PDF content: ${message}`);
    }
  }
}
