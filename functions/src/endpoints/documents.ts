import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { validateAuth } from '@study-forge/backend-core/lib/auth';
import {
  enforceCallableGenerationLimits,
  refundUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { DocumentService } from '@study-forge/backend-documents/document-storage';
import { CursorPaginationError } from '@study-forge/backend-core/lib/cursor-pagination';
import { directoryService } from '@study-forge/backend-directories/directory';
import { UrlProcessingOrchestrator } from '@study-forge/backend-documents/url-processing/url-processing-orchestrator';
import { FileExtractionError, FileExtractionService } from '@study-forge/backend-documents/file-extraction';
import { ScreenshotDocumentGenerationService } from '@study-forge/backend-documents/screenshot-document-generation';
import { executeBulkOperation } from '@study-forge/backend-artifacts/bulk-operation';
import { GenerationJobPayloadStorage } from '@study-forge/backend-generation/generation-job-payload-storage';
import { GenerationJobsService } from '@study-forge/backend-generation/generation-jobs';
import { enqueueGenerationJobTask } from '@study-forge/backend-generation/generation-task-queue';
import {
  isRuleResolutionMode,
} from '@study-forge/backend-directories/rule-resolution';
import { 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  DocumentSourceType,
  DocumentStatus,
  GenerateFromPromptRequest,
  GenerateFromScreenshotRequest,
  IFileContent,
  IDocumentAgentJobPayload,
  MoveDocumentRequest,
  UploadDocumentRequest,
  CreateDocumentFromPastedTextRequest,
} from "@shared-types";

// Define the Gemini API key secret for markdown conversion
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const llmSettingsEncryptionKey = defineSecret("LLM_SETTINGS_ENCRYPTION_KEY");
const apifyApiToken = defineSecret("APIFY_API_TOKEN");
const MAX_URL_DOCUMENT_SOURCES = 3;
const MIN_PASTE_TEXT_LENGTH = 10;
const MAX_PASTE_TEXT_LENGTH = 100_000;

type DocumentAgentJobKind = 'documentFromContent' | 'documentFromUpload' | 'documentFromUrl';

async function enqueueDocumentAgentJob(params: {
  userId: string;
  directoryId: string;
  documentId: string;
  kind: DocumentAgentJobKind;
  payload: IDocumentAgentJobPayload;
  usageReservationId?: string;
}): Promise<string> {
  const jobId = GenerationJobsService.newJobId(params.userId);
  const payloadStoragePath = await GenerationJobPayloadStorage.saveJson(
    params.userId,
    jobId,
    params.payload
  );
  await GenerationJobsService.createJob({
    jobId,
    kind: params.kind,
    userId: params.userId,
    directoryId: params.directoryId,
    recordId: params.documentId,
    payloadStoragePath,
    usageReservationId: params.usageReservationId,
  });
  await enqueueGenerationJobTask({ userId: params.userId, jobId });
  return jobId;
}

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
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as CreateDocumentRequest;

      logger.info('Creating document (async HTML ADK)', { 
        userId,
        sourceType: data.sourceType,
        title: data.title?.substring(0, 50),
      });

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
      const usageReservation = await enforceCallableGenerationLimits(userId, 'documentFromPrompt');
      const usageReservationId = usageReservation.id;

      const pendingDocId = await DocumentCrudService.createPendingDocument(userId, {
        directoryId: data.directoryId,
        title: data.title,
        description: data.description || '',
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl,
        tags: data.tags || [],
      });

      try {
        await enqueueDocumentAgentJob({
          userId,
          directoryId: data.directoryId,
          documentId: pendingDocId,
          kind: 'documentFromContent',
          payload: {
            sourceKind: 'content',
            title: data.title,
            description: data.description,
            tags: data.tags,
            sourceText: data.content,
            ruleIds: data.ruleIds,
            ruleResolutionMode: data.ruleResolutionMode,
          },
          usageReservationId,
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
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, pendingDocId, msg).catch(() => {/* best-effort */});
        await refundUsageReservationSafe(userId, usageReservationId);
        throw innerError;
      }

    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to create document', {
        error: error instanceof Error ? error.message : String(error),
        data: request.data,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

/**
 * Create a document from pasted text with faithful HTML conversion (no rules).
 */
export const createDocumentFromPastedText = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as CreateDocumentFromPastedTextRequest;

      if (!data.content || typeof data.content !== 'string') {
        throw new HttpsError('invalid-argument', 'content is required');
      }

      const trimmedContent = data.content.trim();
      if (trimmedContent.length < MIN_PASTE_TEXT_LENGTH) {
        throw new HttpsError(
          'invalid-argument',
          `content must be at least ${MIN_PASTE_TEXT_LENGTH} characters`,
        );
      }

      if (trimmedContent.length > MAX_PASTE_TEXT_LENGTH) {
        throw new HttpsError(
          'invalid-argument',
          `content must be at most ${MAX_PASTE_TEXT_LENGTH} characters`,
        );
      }

      if (!data.directoryId) {
        throw new HttpsError('invalid-argument', 'directoryId is required');
      }

      await directoryService.validateDirectoryId(userId, data.directoryId);

      const usageReservation = await enforceCallableGenerationLimits(
        userId,
        'sourceDocumentEnhancement',
      );
      const usageReservationId = usageReservation.id;

      const pendingTitle = 'Pasted text';
      const pendingDocId = await DocumentCrudService.createPendingDocument(userId, {
        directoryId: data.directoryId,
        title: pendingTitle,
        description: 'Pasted text import',
        sourceType: DocumentSourceType.UPLOAD,
        tags: ['pasted'],
      });

      try {
        await enqueueDocumentAgentJob({
          userId,
          directoryId: data.directoryId,
          documentId: pendingDocId,
          kind: 'documentFromContent',
          payload: {
            sourceKind: 'paste',
            title: pendingTitle,
            description: 'Pasted text import',
            tags: ['pasted'],
            sourceText: trimmedContent,
            ruleResolutionMode: 'explicit-only',
          },
          usageReservationId,
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
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, pendingDocId, msg).catch(() => {/* best-effort */});
        await refundUsageReservationSafe(userId, usageReservationId);
        throw innerError;
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Failed to create document from pasted text', {
        error: error instanceof Error ? error.message : String(error),
        directoryId: request.data?.directoryId,
      });
      throw new HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
  },
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

      const usageReservation = await enforceCallableGenerationLimits(userId, 'sourceDocumentEnhancement');
      const usageReservationId = usageReservation.id;

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
        await enqueueDocumentAgentJob({
          userId,
          directoryId: data.directoryId,
          documentId: uploadPendingDocId,
          kind: 'documentFromUpload',
          payload: {
            sourceKind: 'upload',
            title: uploadPendingTitle,
            description: `Uploaded from: ${data.fileName}`,
            tags: ['uploaded', 'ai-generated'],
            sourceText: extraction.markdownContent,
            sourceFilename: data.fileName,
            ruleResolutionMode: 'explicit-only',
          },
          usageReservationId,
        });

        logger.info('Upload document generation queued', {
          userId,
          documentId: uploadPendingDocId,
          fileName: data.fileName,
          extension: extraction.extension,
          originalSize: extraction.originalSize,
          sourceWordCount: extraction.wordCount,
        });

        return {
          success: true,
          id: uploadPendingDocId,
          documentId: uploadPendingDocId,
          recordType: 'document',
          directoryId: data.directoryId,
          generationStatus: 'pending',
          extraction: {
            filename: extraction.filename,
            extension: extraction.extension,
            originalType: extraction.originalType,
            originalSize: extraction.originalSize,
            wordCount: extraction.wordCount,
            metadata: extraction.metadata,
            warnings: extraction.warnings,
          },
        };
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, uploadPendingDocId, msg).catch(() => {/* best-effort */});
        await refundUsageReservationSafe(userId, usageReservationId);
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

      const { title: customTitle, directoryId } = data;

      logger.info('Creating document from URL(s)', {
        userId,
        urlCount: rawUrls.length,
        directoryId,
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

      const usageReservation = await enforceCallableGenerationLimits(userId, 'sourceDocumentEnhancement');
      const usageReservationId = usageReservation.id;

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

        logger.info('Queueing HTML document generation from URL source context', {
          userId,
          urlCount: summary.sourceUrls.length,
          sourceWordCount: summary.totalWordCount,
          hasYouTubeSource,
          hasWebSource,
        });

        const tags = ['scraped', 'ai-generated'];
        if (hasYouTubeSource) {
          tags.push('youtube');
        }
        if (hasWebSource) {
          tags.push('article');
        }

        const title = customTitle
          || (isSingleUrl && firstSuccess ? firstSuccess.title : null)
          || (isSingleUrl ? rawUrls[0] : `Merged Document (${summary.successfulCount} sources)`);

        const description = isSingleUrl
          ? `Scraped from: ${rawUrls[0]}`
          : `Merged from ${summary.successfulCount} URL${summary.successfulCount !== 1 ? 's' : ''}`;

        await enqueueDocumentAgentJob({
          userId,
          directoryId,
          documentId: urlPendingDocId,
          kind: 'documentFromUrl',
          payload: {
            sourceKind: 'url',
            title: title ?? undefined,
            description,
            tags,
            sourceText: summary.mergedMarkdown,
            sourceUrls: summary.sourceUrls,
            sourceUrl: rawUrls[0],
            ruleResolutionMode: 'explicit-only',
          },
          usageReservationId,
        });

        logger.info('URL document generation queued', {
          userId,
          documentId: urlPendingDocId,
          urlCount: rawUrls.length,
          successful: summary.successfulCount,
          failed: summary.failedCount,
        });

        return {
          success: true,
          id: urlPendingDocId,
          documentId: urlPendingDocId,
          recordType: 'document',
          directoryId,
          generationStatus: 'pending',
          summary: {
            urlCount: rawUrls.length,
            successfulCount: summary.successfulCount,
            failedCount: summary.failedCount,
            sourceWordCount: summary.totalWordCount,
          },
        };

      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, urlPendingDocId, msg).catch(() => {/* best-effort */});
        await refundUsageReservationSafe(userId, usageReservationId);
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
    memory: '512MiB',
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

      const document = await DocumentCrudService.getDocument(userId, documentId);
      const stored = await DocumentService.getDocumentContentWithFormat(userId, documentId, {
        storagePath: document.storagePath || undefined,
        contentFormat: document.contentFormat,
      });

      return { 
        success: true, 
        content: stored.content,
        contentFormat: stored.contentFormat,
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

      const usageReservation = await enforceCallableGenerationLimits(userId, 'documentFromPrompt');
      const usageReservationId = usageReservation.id;

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
          usageReservationId,
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
        await refundUsageReservationSafe(userId, usageReservationId);
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

      const usageReservation = await enforceCallableGenerationLimits(userId, 'documentFromScreenshot');
      const usageReservationId = usageReservation.id;

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
          usageReservationId,
        });

        return result;
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await DocumentCrudService.failPendingDocument(userId, screenshotPendingDocId, msg).catch(() => {/* best-effort */});
        await refundUsageReservationSafe(userId, usageReservationId);
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