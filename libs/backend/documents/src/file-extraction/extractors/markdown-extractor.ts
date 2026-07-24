import { FileExtractionResult } from '@shared-types';
import { FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  countWords,
  decodeUtf8,
  extractMarkdownTitle,
  filenameToTitle,
  normalizeLineEndings,
} from '../utils';

export class MarkdownExtractor implements FileExtractor {
  readonly name = 'MarkdownExtractor';
  readonly supportedExtensions = ['md'] as const;
  readonly supportedMimeTypes = ['text/markdown', 'text/x-markdown', 'text/plain'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    const markdownContent = normalizeLineEndings(decodeUtf8(input.buffer));
    assertExtractedMarkdown(markdownContent, input.filename);

    return {
      filename: input.filename,
      originalType: input.mimeType || 'text/markdown',
      markdownContent,
      wordCount: countWords(markdownContent),
      title: extractMarkdownTitle(markdownContent) || filenameToTitle(input.filename),
      extension: 'md',
      originalSize: input.buffer.length,
    };
  }
}
