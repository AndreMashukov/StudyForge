import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import {
  type ClearScratchPadAvoidedQuestionsRequest,
  type ClearScratchPadAvoidedQuestionsResponse,
  type IScratchPad,
  resolveDocumentContentFormat,
} from '@shared-types';

export const clearScratchPadAvoidedQuestions = onCall(
  {
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateVerifiedAuth(request);
      const data = request.data as ClearScratchPadAvoidedQuestionsRequest;

      if (!data.documentId || typeof data.sectionIndex !== 'number') {
        throw new HttpsError(
          'invalid-argument',
          'Missing required fields: documentId, sectionIndex',
        );
      }

      const document = await DocumentCrudService.getDocument(userId, data.documentId);

      if (
        document.generationStatus === 'pending' ||
        document.generationStatus === 'failed'
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Document is not ready for scratch pad updates.',
        );
      }

      const contentFormat = resolveDocumentContentFormat(document.contentFormat);
      if (contentFormat === 'markdown') {
        throw new HttpsError(
          'failed-precondition',
          'Scratch pads are only available on HTML documents.',
        );
      }

      const existingPads = document.scratchPads ?? [];
      const existingPad = existingPads.find(
        (pad) => pad.sectionIndex === data.sectionIndex,
      );
      if (!existingPad) {
        throw new HttpsError('not-found', 'No scratch pad found for this section.');
      }

      const memoryCount = existingPad.avoidedQuestions?.length ?? 0;
      if (memoryCount === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Nothing to reset on this scratch pad.',
        );
      }

      const clearedPad: IScratchPad = {
        ...existingPad,
        avoidedQuestions: [],
      };

      const nextPads = existingPads.map((pad) =>
        pad.sectionIndex === data.sectionIndex ? clearedPad : pad,
      );

      await DocumentCrudService.updateDocument(userId, data.documentId, {
        scratchPads: nextPads,
      });

      logger.info('Scratch pad avoided questions cleared', {
        userId,
        documentId: data.documentId,
        sectionIndex: data.sectionIndex,
      });

      return {
        success: true,
        data: {
          scratchPad: clearedPad,
        } satisfies ClearScratchPadAvoidedQuestionsResponse,
      };
    } catch (error) {
      logger.error('Failed to clear scratch pad avoided questions', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throwCallableError(error, 'Failed to clear scratch pad memory');
    }
  },
);
