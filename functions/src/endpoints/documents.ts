import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { validateAuth } from '../lib/auth';
import { enforceCallableGenerationRateLimit } from '../lib/generation-rate-limit';
import { DocumentCrudService } from '../services/document-crud';
import { DocumentService } from '../services/document-storage';
import { CursorPaginationError } from '../lib/cursor-pagination';
import { directoryService } from '../services/directory';
import { UrlProcessingOrchestrator } from '../services/url-processing/url-processing-orchestrator';
import { FileExtractionError, FileExtractionService } from '../services/file-extraction';
import {
  LlmGenerationService,
  resolveTextGenerationAudit,
} from '../services/llm';
import { SourceDocumentGenerationService } from '../services/source-document-generation';
import { ScreenshotDocumentGenerationService } from '../services/screenshot-document-generation';
import { GenerationJobPayloadStorage } from '../services/generation-job-payload-storage';
import { GenerationJobsService } from '../services/generation-jobs';
import { enqueueGenerationJobTask } from '../services/generation-task-queue';
import {
  isRuleResolutionMode,
  resolveEffectiveRules,
} from '../services/rule-resolution';
import { 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  DocumentSourceType,
  DocumentStatus,
  GenerateFromPromptRequest,
  GenerateFromScreenshotRequest,
  IFileContent,
  MoveDocumentRequest,
  RuleApplicability,
  UploadDocumentRequest,
} from "@shared-types";

// Define the Gemini API key secret for markdown conversion
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const llmSettingsEncryptionKey = defineSecret("LLM_SETTINGS_ENCRYPTION_KEY");
const apifyApiToken = defineSecret("APIFY_API_TOKEN");
const MAX_URL_DOCUMENT_SOURCES = 3;

function extractMarkdownTitle(content: string): string | null {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || null;
}

function buildUrlDocumentPrompt(params: {
  customTitle?: string;
  sourceCount: number;
  successfulCount: number;
  failedCount: number;
  hasYouTubeSource: boolean;
  sourceUrls: string[];
}): string {
  const sourceList = params.sourceUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');
  const titleInstruction = params.customTitle
    ? `Use this exact document title as the H1 heading: ${params.customTitle}`
    : 'Choose a clear, specific H1 title from the source material.';

  return [
    'Create a comprehensive educational document from the attached URL source material.',
    titleInstruction,
    '',
    'Source URLs:',
    sourceList,
    '',
    `Successfully extracted sources: ${params.successfulCount} of ${params.sourceCount}.`,
    params.failedCount > 0 ? `Some sources failed extraction: ${params.failedCount}. Mention only successful source material in the main explanation.` : '',
    '',
    'Do not save or reproduce the raw transcript, timestamp list, scrape wrapper, or extraction metadata as the final document.',
    'Synthesize the source material into a polished learning document with explanations, structure, examples, and takeaways.',
    params.hasYouTubeSource
      ? 'For YouTube transcript sources, remove timestamps, filler phrasing, and spoken-video artifacts while preserving the technical substance.'
      : '',
  ].filter(Boolean).join('\n');
}

/**
 * Create a new document from uploaded content or URL
 */
export const createDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as CreateDocumentRequest;

      logger.info('Creating document', { 
        userId,
        sourceType: data.sourceType,
        title: data.title?.substring(0, 50),
      });

      // Validate request
      if (!data.sourceType || !Object.values(DocumentSourceType).includes(data.sourceType)) {
        throw new HttpsError('invalid-argument', 'Invalid or missing sourceType');
      }

      if (!data.title || data.title.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'Document title is required');
      }

      if (!data.content || data.content.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'Document content is required');
      }

      if (!data.directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }
      await directoryService.validateDirectoryId(userId, data.directoryId);

      // Create document
      const document = await DocumentCrudService.createDocument(userId, data);

      logger.info('Document created successfully', { 
        userId,
        documentId: document.id,
        title: document.title,
      });

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to create document', { 
        error: error instanceof Error ? error.message : String(error),
        data: request.data,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Upload a binary file, extract it to Markdown, optionally clean up extraction
 * artifacts, and create a document from the resulting content.
 */
export const uploadAndCreateDocument = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as UploadDocumentRequest & {
        additionalRuleIds?: string[];
        ruleResolutionMode?: unknown;
      };

      logger.info('Uploading and creating document', {
        userId,
        fileName: data.fileName,
        mimeType: data.mimeType || '(not provided)',
        browserSize: data.size || null,
        directoryId: data.directoryId,
        ruleCount: data.ruleIds?.length || 0,
      });

      if (!data.fileName || typeof data.fileName !== 'string') {
        throw new HttpsError('invalid-argument', 'fileName is required');
      }

      if (!data.content || typeof data.content !== 'string') {
        throw new HttpsError('invalid-argument', 'content is required');
      }

      if (data.size !== undefined && (!Number.isFinite(data.size) || data.size <= 0)) {
        throw new HttpsError('invalid-argument', 'size must be a positive number when provided');
      }

      if (!data.directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }
      await directoryService.validateDirectoryId(userId, data.directoryId);

      await enforceCallableGenerationRateLimit(userId, 'sourceDocumentEnhancement');

      const buffer = FileExtractionService.decodeBase64File(data.content, data.size);
      const extraction = await FileExtractionService.extractFromFile(
        buffer,
        data.fileName,
        data.mimeType
      );

      // Create pending document after extraction (fast) but before Gemini (slow)
      const uploadPendingTitle = data.title || data.fileName;
      const uploadPendingDocId = await DocumentCrudService.createPendingDocument(userId, {
        directoryId: data.directoryId,
        title: uploadPendingTitle,
        description: `Uploaded from: ${data.fileName}`,
        sourceType: DocumentSourceType.UPLOAD,
        tags: ['uploaded'],
      });

      try {
        const mode = isRuleResolutionMode(data.ruleResolutionMode)
          ? data.ruleResolutionMode
          : (data.ruleIds?.length ? 'explicit-only' : 'inherit-plus-explicit');
        const { text: rulesText, ruleIds: effectiveRuleIds } = await resolveEffectiveRules({
          userId,
          directoryId: data.directoryId,
          operation: RuleApplicability.UPLOAD,
          additionalRuleIds: data.ruleIds?.length ? data.ruleIds : data.additionalRuleIds,
          mode,
        });

        const prepared = await SourceDocumentGenerationService.prepareUploadDocumentContent({
          userId,
          extraction,
          customTitle: data.title,
          rulesText: rulesText || undefined,
        });

        const enhancementAudit = prepared.wasEnhanced
          ? await resolveTextGenerationAudit(userId, 'sourceDocumentEnhancement')
          : undefined;

        await DocumentCrudService.completePendingDocument(userId, uploadPendingDocId, prepared.content, {
          title: prepared.title,
          description: `Uploaded from: ${data.fileName}`,
          tags: prepared.tags,
          appliedRuleIds: effectiveRuleIds,
          generationModel: enhancementAudit?.generationModel,
          generationModelUsage: enhancementAudit?.generationModelUsage,
        });

        logger.info('Document created from upload successfully', {
          userId,
          documentId: uploadPendingDocId,
          fileName: data.fileName,
          extension: extraction.extension,
          originalSize: extraction.originalSize,
          sourceWordCount: extraction.wordCount,
          warningCount: prepared.warnings.length,
        });

        return {
          success: true,
          document: { id: uploadPendingDocId, title: prepared.title },
          extraction: {
            filename: extraction.filename,
            extension: extraction.extension,
            originalType: extraction.originalType,
            originalSize: extraction.originalSize,
            wordCount: extraction.wordCount,
            metadata: extraction.metadata,
            warnings: prepared.warnings,
          },
        };
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, uploadPendingDocId, msg).catch(() => {/* best-effort */});
        throw innerError;
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof FileExtractionError) {
        throw new HttpsError(error.code, error.message);
      }

      logger.error('Failed to create document from upload', {
        error: error instanceof Error ? error.message : String(error),
        fileName: request.data?.fileName,
        directoryId: request.data?.directoryId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Create a document from one or more URLs.
 * Accepts either a single `url` string (legacy) or a `urls` array.
 * YouTube URLs are processed via transcript extraction; all others are web-scraped.
 */
export const createDocumentFromUrl = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey, apifyApiToken],
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as {
        url?: string;
        urls?: string[];
        title?: string;
        directoryId?: string;
        ruleIds?: string[];
        additionalRuleIds?: string[];
        ruleResolutionMode?: unknown;
      };

      // Normalize: accept legacy `url` or new `urls` array
      const rawUrls: string[] = data.urls?.length
        ? data.urls
        : data.url
        ? [data.url]
        : [];

      const { title: customTitle, directoryId, ruleIds, additionalRuleIds, ruleResolutionMode } = data;

      logger.info('Creating document from URL(s)', {
        userId,
        urlCount: rawUrls.length,
        directoryId,
        ruleCount: ruleIds?.length || 0,
      });

      // Validate URLs
      if (rawUrls.length === 0) {
        throw new HttpsError('invalid-argument', 'At least one URL is required');
      }

      if (rawUrls.length > MAX_URL_DOCUMENT_SOURCES) {
        throw new HttpsError(
          'invalid-argument',
          `Too many URLs: ${rawUrls.length} submitted, maximum is ${MAX_URL_DOCUMENT_SOURCES}`
        );
      }

      for (const url of rawUrls) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new HttpsError('invalid-argument', `Invalid URL protocol: ${url}`);
          }
        } catch {
          throw new HttpsError('invalid-argument', `Invalid URL format: ${url}`);
        }
      }

      if (!directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }
      await directoryService.validateDirectoryId(userId, directoryId);

      await enforceCallableGenerationRateLimit(userId, 'sourceDocumentEnhancement');

      // Create pending document visible in the directory UI immediately
      const pendingTitle = customTitle || (rawUrls.length === 1 ? rawUrls[0] : `Importing from ${rawUrls.length} URLs…`);
      const urlPendingDocId = await DocumentCrudService.createPendingDocument(userId, {
        directoryId,
        title: pendingTitle,
        description: rawUrls.length === 1 ? `Scraped from: ${rawUrls[0]}` : `Merged from ${rawUrls.length} URLs`,
        sourceType: DocumentSourceType.URL,
        sourceUrl: rawUrls[0],
        tags: ['scraped', 'ai-generated'],
      });

      try {
        // Resolve content generation rules once for all URL sources.
        const mode = isRuleResolutionMode(ruleResolutionMode)
          ? ruleResolutionMode
          : (ruleIds?.length ? 'explicit-only' : 'inherit-plus-explicit');
        const { text: rulesText, ruleIds: effectiveRuleIds } = await resolveEffectiveRules({
          userId,
          directoryId,
          operation: RuleApplicability.PROMPT,
          additionalRuleIds: ruleIds?.length ? ruleIds : additionalRuleIds,
          mode,
        });

        // Process all URLs via the orchestrator
        let summary;
        try {
          summary = await UrlProcessingOrchestrator.processUrls(rawUrls, undefined, userId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new HttpsError('internal', `URL processing failed: ${message}`);
        }

        const isSingleUrl = rawUrls.length === 1;
        const firstSuccess = summary.results.find((r) => !r.error);
        const hasYouTubeSource = summary.results.some((r) => r.type === 'youtube' && !r.error);
        const hasWebSource = summary.results.some((r) => r.type === 'web' && !r.error);

        const sourceContextFile: IFileContent = {
          filename: isSingleUrl && firstSuccess
            ? `${firstSuccess.title || 'url-source'}.md`
            : 'url-sources.md',
          content: summary.mergedMarkdown,
          size: Buffer.byteLength(summary.mergedMarkdown, 'utf8'),
          type: 'text/markdown',
        };

        logger.info('Generating final document from URL source context', {
          userId,
          urlCount: summary.sourceUrls.length,
          sourceWordCount: summary.totalWordCount,
          ruleCount: effectiveRuleIds.length,
          hasRules: !!rulesText,
          hasYouTubeSource,
          hasWebSource,
        });

        let generatedContent: string;
        try {
          generatedContent = await LlmGenerationService.generateDocumentFromPrompt(
            userId,
            buildUrlDocumentPrompt({
              customTitle,
              sourceCount: summary.sourceUrls.length,
              successfulCount: summary.successfulCount,
              failedCount: summary.failedCount,
              hasYouTubeSource,
              sourceUrls: summary.sourceUrls,
            }),
            [sourceContextFile],
            rulesText || undefined
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new HttpsError('internal', `URL document generation failed: ${message}`);
        }

        const tags = ['scraped', 'ai-generated'];
        if (hasYouTubeSource) {
          tags.push('youtube');
        }
        if (hasWebSource) {
          tags.push('article');
        }

        const generatedTitle = extractMarkdownTitle(generatedContent);
        const title = customTitle
          || generatedTitle
          || (isSingleUrl && firstSuccess ? firstSuccess.title : null)
          || (isSingleUrl ? rawUrls[0] : `Merged Document (${summary.successfulCount} sources)`);

        const description = isSingleUrl
          ? `Scraped from: ${rawUrls[0]}`
          : `Merged from ${summary.successfulCount} URL${summary.successfulCount !== 1 ? 's' : ''}`;

        const { generationModel, generationModelUsage } = await resolveTextGenerationAudit(userId, 'documentFromPrompt');

        await DocumentCrudService.completePendingDocument(userId, urlPendingDocId, generatedContent, {
          title,
          description,
          tags,
          appliedRuleIds: effectiveRuleIds,
          generationModel,
          generationModelUsage,
        });

        logger.info('Document created from URL(s) successfully', {
          userId,
          documentId: urlPendingDocId,
          urlCount: rawUrls.length,
          successful: summary.successfulCount,
          failed: summary.failedCount,
          wordCount: generatedContent.split(/\s+/).length,
        });

        return {
          success: true,
          document: { id: urlPendingDocId, title },
          summary: {
            urlCount: rawUrls.length,
            successfulCount: summary.successfulCount,
            failedCount: summary.failedCount,
            sourceWordCount: summary.totalWordCount,
            totalWordCount: generatedContent.split(/\s+/).length,
          },
        };

      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, urlPendingDocId, msg).catch(() => {/* best-effort */});
        throw innerError;
      }

    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to create document from URL(s)', {
        error: error instanceof Error ? error.message : String(error),
        urls: request.data?.urls ?? (request.data?.url ? [request.data.url] : []),
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Get a document by ID
 */
export const getDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      // Additional validation to catch "undefined" string
      if (!documentId || typeof documentId !== 'string' || documentId === 'undefined' || documentId.trim() === '') {
        throw new HttpsError('invalid-argument', 'Document ID is required');
      }

      logger.info('Getting document', { userId, documentId });

      const document = await DocumentCrudService.getDocument(userId, documentId);

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to get document', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Get a document with its content from storage
 */
export const getDocumentWithContent = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      if (!documentId || typeof documentId !== 'string') {
        throw new HttpsError('invalid-argument', 'Document ID is required');
      }

      logger.info('Getting document with content', { userId, documentId });

      const document = await DocumentCrudService.getDocumentWithContent(userId, documentId);

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to get document with content', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Update a document
 */
export const updateDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId, updates } = request.data as { 
        documentId: string; 
        updates: UpdateDocumentRequest;
      };

      if (!documentId || typeof documentId !== 'string') {
        throw new HttpsError('invalid-argument', 'Document ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new HttpsError('invalid-argument', 'Updates object is required');
      }

      logger.info('Updating document', { 
        userId, 
        documentId,
        hasContentUpdate: !!updates.content,
        hasMetadataUpdate: !!(updates.title || updates.description || updates.tags),
      });

      const document = await DocumentCrudService.updateDocument(userId, documentId, updates);

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to update document', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Delete a document
 */
export const deleteDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      if (!documentId || typeof documentId !== 'string') {
        throw new HttpsError('invalid-argument', 'Document ID is required');
      }

      logger.info('Deleting document', { userId, documentId });

      await DocumentCrudService.deleteDocument(userId, documentId);

      return { 
        success: true, 
        message: 'Document deleted successfully',
      };

    } catch (error) {
      logger.error('Failed to delete document', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Best-effort bulk delete for documents.
 */
export const bulkDeleteDocuments = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    const userId = await validateAuth(request);
    const { documentIds } = (request.data ?? {}) as { documentIds?: unknown };

    if (!Array.isArray(documentIds) || !documentIds.every((id) => typeof id === 'string')) {
      throw new HttpsError('invalid-argument', 'documentIds must be an array of strings.');
    }

    const { executeBulkOperation } = await import('../services/bulk-operation.js');
    return executeBulkOperation({
      items: documentIds,
      getItemId: (id) => id,
      runItem: (documentId) => DocumentCrudService.deleteDocument(userId, documentId),
    });
  }
);

/**
 * Get user documents (alias for listDocuments for frontend compatibility)
 */
export const getUserDocuments = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const options = request.data || {};

      logger.info('Getting user documents', { 
        userId,
        limit: options.limit,
        sourceType: options.sourceType,
        status: options.status,
      });

      const result = await DocumentCrudService.listDocuments(userId, options);

      return { 
        success: true, 
        ...result,
      };

    } catch (error) {
      if (error instanceof CursorPaginationError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      logger.error('Failed to get user documents', { 
        error: error instanceof Error ? error.message : String(error),
        options: request.data,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * List documents for the authenticated user
 */
export const listDocuments = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const options = request.data || {};

      logger.info('Listing documents', { 
        userId,
        limit: options.limit,
        sourceType: options.sourceType,
        status: options.status,
      });

      const result = await DocumentCrudService.listDocuments(userId, options);

      return { 
        success: true, 
        ...result,
      };

    } catch (error) {
      if (error instanceof CursorPaginationError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      logger.error('Failed to list documents', { 
        error: error instanceof Error ? error.message : String(error),
        options: request.data,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Search documents
 */
export const searchDocuments = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { searchTerm, ...options } = request.data as { 
        searchTerm: string; 
        limit?: number;
        sourceType?: DocumentSourceType;
        status?: DocumentStatus;
      };

      if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'Search term is required');
      }

      logger.info('Searching documents', { 
        userId,
        searchTerm: searchTerm.substring(0, 50),
        options,
      });

      const documents = await DocumentCrudService.searchDocuments(userId, searchTerm, options);

      return { 
        success: true, 
        documents,
        searchTerm,
      };

    } catch (error) {
      logger.error('Failed to search documents', { 
        error: error instanceof Error ? error.message : String(error),
        searchTerm: request.data?.searchTerm?.substring(0, 50),
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Get document statistics for the user
 */
export const getDocumentStats = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);

      logger.info('Getting document statistics', { userId });

      const stats = await DocumentCrudService.getDocumentStats(userId);

      return { 
        success: true, 
        stats,
      };

    } catch (error) {
      logger.error('Failed to get document statistics', { 
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Get document content for viewing/rendering
 */
export const getDocumentContent = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      if (!documentId || documentId.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'Document ID is required');
      }

      logger.info('Getting document content', { 
        userId,
        documentId,
      });

      const content = await DocumentService.getDocumentContent(userId, documentId);

      return { 
        success: true, 
        content,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        throw new HttpsError('not-found', message);
      }
      logger.error('Failed to get document content', { 
        error: message,
        documentId: request.data?.documentId,
      });
      throw new HttpsError('internal', message);
    }
  }
);

/**
 * Generate a document from a text prompt using Gemini AI
 */
export const generateFromPrompt = onCall(
  { 
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    timeoutSeconds: 540, // 9 minutes for document generation
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GenerateFromPromptRequest;

      // Count files by source type
      const uploadFilesCount = data.files?.filter(f => f.source === 'upload' || !f.source).length || 0;
      const libraryFilesCount = data.files?.filter(f => f.source === 'library').length || 0;

      logger.info('Generating document from prompt', { 
        userId,
        promptLength: data.prompt?.length,
        filesCount: data.files?.length || 0,
        uploadFilesCount,
        libraryFilesCount,
        hasMixedSources: uploadFilesCount > 0 && libraryFilesCount > 0,
      });

      // Validate prompt
      if (!data.prompt || typeof data.prompt !== 'string') {
        throw new HttpsError('invalid-argument', 'Prompt is required and must be a string');
      }

      const trimmedPrompt = data.prompt.trim();

      if (trimmedPrompt.length === 0) {
        throw new HttpsError('invalid-argument', 'Prompt cannot be empty');
      }

      if (trimmedPrompt.length < 10) {
        throw new HttpsError('invalid-argument', 'Prompt must be at least 10 characters long');
      }

      // Validate files if provided
      if (data.files) {
        if (!Array.isArray(data.files)) {
          throw new HttpsError('invalid-argument', 'Files must be an array');
        }

        if (data.files.length > 5) {
          throw new HttpsError('invalid-argument', 'Cannot attach more than 5 files');
        }

        // Validate each file and track sources
        const sourceStats = {
          upload: 0,
          library: 0,
          libraryDocumentIds: [] as string[],
        };

        data.files.forEach((file, index) => {
          if (!file.filename || !file.content || typeof file.size !== 'number' || !file.type) {
            throw new HttpsError('invalid-argument', `Invalid file structure at index ${index} for file: ${file.filename || 'unknown'}`);
          }

          if (file.size > 5 * 1024 * 1024) {
            throw new HttpsError('invalid-argument', `File "${file.filename}" exceeds 5MB size limit`);
          }

          if (file.content.trim().length === 0) {
            throw new HttpsError('invalid-argument', `File "${file.filename}" is empty`);
          }

          if (!['text/plain', 'text/markdown'].includes(file.type)) {
            throw new HttpsError('invalid-argument', `File "${file.filename}" has an unsupported type: ${file.type}. Only text/plain and text/markdown are allowed.`);
          }

          // Track source type
          if (file.source === 'library') {
            sourceStats.library++;
            if (file.documentId) {
              sourceStats.libraryDocumentIds.push(file.documentId);
            }
          } else {
            sourceStats.upload++;
          }
        });

        logger.info('Context files validated', {
          filesCount: data.files.length,
          totalSize: data.files.reduce((sum, f) => sum + f.size, 0),
          uploadedFiles: sourceStats.upload,
          libraryDocuments: sourceStats.library,
          libraryDocumentIds: sourceStats.libraryDocumentIds,
          hasMixedSources: sourceStats.upload > 0 && sourceStats.library > 0,
        });
      }

      // Resolve effective rules separately from the user's prompt so the prompt builder
      // can place them in the scoped domain hook rather than mixing them with user data.
      const rawRuleData = data as GenerateFromPromptRequest & {
        additionalRuleIds?: string[];
        ruleResolutionMode?: unknown;
      };
      const mode = isRuleResolutionMode(rawRuleData.ruleResolutionMode)
        ? rawRuleData.ruleResolutionMode
        : (data.ruleIds?.length ? 'explicit-only' : 'inherit-plus-explicit');

      if (!data.directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }
      await directoryService.validateDirectoryId(userId, data.directoryId);

      await enforceCallableGenerationRateLimit(userId, 'documentFromPrompt');

      // Create pending document record visible in the directory UI immediately
      const pendingTitle = trimmedPrompt.length > 50
        ? `${trimmedPrompt.substring(0, 50)}…`
        : trimmedPrompt;
      const pendingDocId = await DocumentCrudService.createPendingDocument(userId, {
        directoryId: data.directoryId,
        title: pendingTitle,
        description: `Generated from prompt: ${trimmedPrompt.substring(0, 100)}${trimmedPrompt.length > 100 ? '...' : ''}`,
        sourceType: DocumentSourceType.GENERATED,
        tags: ['ai-generated', 'prompt-based'],
      });

      let jobId: string | undefined;
      let payloadStoragePath: string | undefined;

      try {
        jobId = GenerationJobsService.newJobId(userId);
        payloadStoragePath = await GenerationJobPayloadStorage.saveJson(userId, jobId, {
          ...data,
          prompt: trimmedPrompt,
          ruleResolutionMode: mode,
          additionalRuleIds: rawRuleData.additionalRuleIds,
        });
        await GenerationJobsService.createJob({
          jobId,
          kind: 'documentFromPrompt',
          userId,
          directoryId: data.directoryId,
          recordId: pendingDocId,
          payloadStoragePath,
        });
        await enqueueGenerationJobTask({ userId, jobId });

        logger.info('Prompt document generation queued', {
          userId,
          jobId,
          documentId: pendingDocId,
          directoryId: data.directoryId,
          promptLength: trimmedPrompt.length,
        });

        return {
          success: true,
          id: pendingDocId,
          documentId: pendingDocId,
          recordType: 'document',
          directoryId: data.directoryId,
          generationStatus: 'pending',
        };

      } catch (innerError) {
        // Mark the pending record as failed so the UI shows the error state
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        if (jobId) {
          await GenerationJobsService.markFailed(userId, jobId, msg).catch(() => {/* best-effort */});
        }
        if (payloadStoragePath) {
          await GenerationJobPayloadStorage.delete(payloadStoragePath).catch(() => {/* best-effort */});
        }
        await DocumentCrudService.failPendingDocument(userId, pendingDocId, msg).catch(() => {/* best-effort */});
        throw innerError;
      }

    } catch (error) {
      logger.error('Failed to generate document from prompt', { 
        error: error instanceof Error ? error.message : String(error),
        prompt: request.data?.prompt?.substring(0, 50),
      });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Generate a document from a screenshot using async generation job queue
 */
export const generateFromScreenshot = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GenerateFromScreenshotRequest;

      if (!data.imageBase64 || typeof data.imageBase64 !== 'string') {
        throw new HttpsError('invalid-argument', 'imageBase64 is required and must be a string');
      }

      if (!data.directoryId || typeof data.directoryId !== 'string') {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }

      logger.info('Queueing document from screenshot', {
        userId,
        directoryId: data.directoryId,
        imageSize: data.imageBase64.length,
        hasPrompt: !!data.prompt,
        ruleCount: data.ruleIds?.length || 0,
      });

      await directoryService.validateDirectoryId(userId, data.directoryId);

      await enforceCallableGenerationRateLimit(userId, 'documentFromScreenshot');

      const screenshotPendingTitle = data.title || (data.prompt
        ? (data.prompt.length > 50 ? `${data.prompt.substring(0, 50)}…` : data.prompt)
        : 'Captured Document');
      const screenshotPendingDocId = await DocumentCrudService.createPendingDocument(userId, {
        directoryId: data.directoryId,
        title: screenshotPendingTitle,
        description: 'Captured from screenshot',
        sourceType: DocumentSourceType.GENERATED,
        tags: ['screenshot', 'captured'],
      });

      try {
        const result = await ScreenshotDocumentGenerationService.enqueue({
          ...data,
          userId,
          pendingDocumentId: screenshotPendingDocId,
        });

        return result;
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, screenshotPendingDocId, msg).catch(() => {/* best-effort */});
        throw innerError;
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error('Failed to queue document from screenshot', {
        error: error instanceof Error ? error.message : String(error),
        directoryId: request.data?.directoryId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Move a document to a different directory
 */
export const moveDocument = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId, targetDirectoryId } = request.data as { documentId: string; targetDirectoryId: string };

      if (!documentId || typeof documentId !== 'string') {
        throw new HttpsError('invalid-argument', 'Document ID is required');
      }
      if (!targetDirectoryId || typeof targetDirectoryId !== 'string') {
        throw new HttpsError('invalid-argument', 'Target directory ID is required');
      }

      logger.info('Moving document', { userId, documentId, targetDirectoryId });

      const moveRequest: MoveDocumentRequest = { targetDirectoryId };
      const document = await DocumentCrudService.moveDocument(userId, documentId, moveRequest);

      return {
        success: true,
        data: { document },
      };
    } catch (error) {
      logger.error('Failed to move document', {
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);