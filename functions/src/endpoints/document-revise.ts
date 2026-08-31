import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { resolveDocumentContentFormat } from '@shared-types';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { withUsageReservation } from '@study-forge/backend-generation/generation-limits';
import {
  AI_REVISION_EXISTING_CONTENT_MAX,
  reviseDocumentWithAIRequestSchema,
} from '@study-forge/backend-core/lib/ai-revision-validation';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { extractBodyHtml } from '@study-forge/backend-documents/document-html/html-utils';
import { prepareHtmlDocumentForStorage } from '@study-forge/backend-documents/document-html';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

/**
 * Generate a revised document preview for an existing document (preview only — client applies via updateDocument).
 */
export const reviseDocumentWithAI = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    try {
      const userId = await validateVerifiedAuth(request);
      const parseResult = reviseDocumentWithAIRequestSchema.safeParse(request.data);
      if (!parseResult.success) {
        const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
        throw new HttpsError('invalid-argument', msg);
      }

      const { documentId, instruction } = parseResult.data;

      logger.info('[reviseDocumentWithAI] Starting revision', {
        userId,
        documentId,
        instructionLength: instruction.length,
      });

      const originalDocument = await DocumentCrudService.getDocumentWithContent(
        userId,
        documentId
      );

      if (
        originalDocument.generationStatus === 'pending' ||
        originalDocument.generationStatus === 'failed'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Document is not ready for AI editing.'
        );
      }

      const contentFormat = resolveDocumentContentFormat(originalDocument.contentFormat);
      if (contentFormat === 'markdown') {
        throw new HttpsError(
          'failed-precondition',
          'Legacy markdown documents are read-only and cannot be revised.'
        );
      }

      const content = originalDocument.content?.trim() ?? '';
      if (!content) {
        throw new HttpsError('failed-precondition', 'Document has no content to revise.');
      }

      if (content.length > AI_REVISION_EXISTING_CONTENT_MAX) {
        throw new HttpsError(
          'invalid-argument',
          `Document content must be ${AI_REVISION_EXISTING_CONTENT_MAX.toLocaleString()} characters or less.`
        );
      }

      const bodyHtml = extractBodyHtml(content);
      const revisedFragment = await withUsageReservation(
        userId,
        'documentRevise',
        undefined,
        async () =>
          LlmGenerationService.reviseDocument(userId, {
            document: {
              title: originalDocument.title,
              content: bodyHtml,
            },
            instruction,
            contentFormat: 'html',
          })
      );

      const prepared = await prepareHtmlDocumentForStorage(
        revisedFragment,
        originalDocument.title
      );

      logger.info('[reviseDocumentWithAI] Revision completed', {
        userId,
        documentId,
        revisedLength: prepared.fullHtml.length,
      });

      return {
        success: true,
        data: {
          content: prepared.fullHtml,
        },
      };
    } catch (error) {
      logger.error('Error in reviseDocumentWithAI:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith('Invalid HTML document content:')) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError(
        'internal',
        'An unexpected error occurred while revising the document.'
      );
    }
  }
);
