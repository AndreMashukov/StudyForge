import { logger } from 'firebase-functions/v2';
import { FileExtractionResult } from '@shared-types';
import { GeminiService } from './gemini';
import { extractMarkdownTitle, filenameToTitle } from './file-extraction/utils';

const ENHANCEABLE_UPLOAD_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'epub']);
const MAX_ENHANCEMENT_INPUT_CHARS = 200000;

export interface PreparedUploadDocumentContent {
  content: string;
  title: string;
  tags: string[];
  warnings: string[];
}

export interface PrepareUploadDocumentContentParams {
  extraction: FileExtractionResult;
  customTitle?: string;
  rulesText?: string;
}

export class SourceDocumentGenerationService {
  static async prepareUploadDocumentContent(
    params: PrepareUploadDocumentContentParams
  ): Promise<PreparedUploadDocumentContent> {
    const warnings = [...(params.extraction.warnings || [])];
    let content = params.extraction.markdownContent;
    let wasEnhanced = false;

    if (this.shouldEnhance(params.extraction)) {
      if (content.length > MAX_ENHANCEMENT_INPUT_CHARS) {
        warnings.push('Extracted content was too large for AI cleanup; raw extraction was stored.');
      } else {
        try {
          content = await GeminiService.enhanceExtractedDocument(
            content,
            params.extraction.filename,
            params.rulesText
          );
          wasEnhanced = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('SourceDocumentGenerationService: AI cleanup failed, storing raw extraction', {
            filename: params.extraction.filename,
            extension: params.extraction.extension,
            error: message,
          });
          warnings.push('AI cleanup failed; raw extraction was stored.');
        }
      }
    }

    const title = params.customTitle?.trim()
      || extractMarkdownTitle(content)
      || params.extraction.title
      || filenameToTitle(params.extraction.filename);

    const tags = ['uploaded'];
    if (wasEnhanced) {
      tags.push('ai-enhanced');
    }
    if (params.extraction.extension) {
      tags.push(params.extraction.extension);
    }

    return {
      content,
      title,
      tags,
      warnings,
    };
  }

  private static shouldEnhance(extraction: FileExtractionResult): boolean {
    return ENHANCEABLE_UPLOAD_EXTENSIONS.has(extraction.extension);
  }
}
