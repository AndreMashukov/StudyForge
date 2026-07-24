import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '@study-forge/backend-core/lib/auth';
import { enforceCallableGenerationRateLimit } from '@study-forge/backend-generation/generation-rate-limit';
import {
  AI_REVISION_EXISTING_CONTENT_MAX,
  reviseDocumentWithAIRequestSchema,
} from '@study-forge/backend-core/lib/ai-revision-validation';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

/**
 * Generate a revised markdown preview for an existing document (preview only — client applies via updateDocument).
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
      const userId = validateAuth(request);
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

      await enforceCallableGenerationRateLimit(userId, 'documentRevise');

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

      const revisedContent = await LlmGenerationService.reviseDocument(userId, {
        document: {
          title: originalDocument.title,
          content,
        },
        instruction,
      });

      logger.info('[reviseDocumentWithAI] Revision completed', {
        userId,
        documentId,
        revisedLength: revisedContent.length,
      });

      return {
        success: true,
        data: {
          content: revisedContent,
        },
      };
    } catch (error) {
      logger.error('Error in reviseDocumentWithAI:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        'An unexpected error occurred while revising the document.'
      );
    }
  }
);
