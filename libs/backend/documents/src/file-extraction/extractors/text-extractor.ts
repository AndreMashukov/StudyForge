import { FileExtractionResult } from '@shared-types';
import { FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  countWords,
  decodeUtf8,
  filenameToTitle,
  normalizeLineEndings,
} from '../utils';

export class TextExtractor implements FileExtractor {
  readonly name = 'TextExtractor';
  readonly supportedExtensions = ['txt'] as const;
  readonly supportedMimeTypes = ['text/plain'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    const textContent = normalizeLineEndings(decodeUtf8(input.buffer));
    const markdownContent = textContent.trimStart().startsWith('#')
      ? textContent
      : `# ${filenameToTitle(input.filename)}\n\n${textContent}`;

    assertExtractedMarkdown(markdownContent, input.filename);

    return {
      filename: input.filename,
      originalType: input.mimeType || 'text/plain',
      markdownContent,
      wordCount: countWords(markdownContent),
      title: filenameToTitle(input.filename),
      extension: 'txt',
      originalSize: input.buffer.length,
    };
  }
}
