import * as mammoth from 'mammoth';
import { FileExtractionResult } from '@shared-types';
import { FileExtractionError, FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  countWords,
  createTurndownService,
  extractMarkdownTitle,
  filenameToTitle,
  loadZipSafely,
  readRequiredZipText,
} from '../utils';

export class DocxExtractor implements FileExtractor {
  readonly name = 'DocxExtractor';
  readonly supportedExtensions = ['docx'] as const;
  readonly supportedMimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    await this.validateDocxContainer(input.buffer, input.filename);

    try {
      const result = await mammoth.convertToHtml(
        { buffer: input.buffer },
        {
          convertImage: mammoth.images.imgElement(() =>
            Promise.resolve({ src: 'studyforge://image-omitted' })
          ),
        }
      );

      const turndownService = createTurndownService();
      const convertedMarkdown = turndownService.turndown(result.value || '').trim();
      const title = extractMarkdownTitle(convertedMarkdown) || filenameToTitle(input.filename);
      const markdownContent = convertedMarkdown.startsWith('#')
        ? convertedMarkdown
        : `# ${title}\n\n${convertedMarkdown}`;

      assertExtractedMarkdown(markdownContent, input.filename);

      const warnings = result.messages
        ?.map((message) => `${message.type}: ${message.message}`)
        .filter(Boolean);

      return {
        filename: input.filename,
        originalType: input.mimeType || this.supportedMimeTypes[0],
        markdownContent,
        wordCount: countWords(markdownContent),
        title,
        extension: 'docx',
        originalSize: input.buffer.length,
        warnings: warnings?.length ? warnings : undefined,
      };
    } catch (error) {
      if (error instanceof FileExtractionError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new FileExtractionError(`Failed to extract DOCX content: ${message}`);
    }
  }

  private async validateDocxContainer(buffer: Buffer, filename: string): Promise<void> {
    const zip = await loadZipSafely(buffer, filename);
    const contentTypesXml = await readRequiredZipText(zip, '[Content_Types].xml');
    if (!contentTypesXml.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) {
      throw new FileExtractionError('The uploaded file is not a valid DOCX document.');
    }
  }
}
