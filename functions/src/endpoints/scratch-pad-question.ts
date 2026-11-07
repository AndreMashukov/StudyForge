import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { langsmithApiKey } from '../langsmith-secret';
import { logger } from 'firebase-functions/v2';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import { withUsageReservation } from '@study-forge/backend-generation/generation-limits';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { regenerateScratchPadForSection } from '@study-forge/backend-documents/scratch-pad';
import { extractBodyHtml } from '@study-forge/backend-documents/document-html/html-utils';
import { resolveEffectiveRules } from '@study-forge/backend-directories/rule-resolution';
import {
  type IScratchPad,
  type RegenerateScratchPadQuestionRequest,
  type RegenerateScratchPadQuestionResponse,
  RuleApplicability,
  resolveDocumentContentFormat,
  splitLessonH2Sections,
} from '@shared-types';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

export const regenerateScratchPadQuestion = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey, langsmithApiKey],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    try {
      const userId = await validateVerifiedAuth(request);
      const data = request.data as RegenerateScratchPadQuestionRequest;

      if (!data.documentId || typeof data.sectionIndex !== 'number') {
        throw new HttpsError(
          'invalid-argument',
          'Missing required fields: documentId, sectionIndex',
        );
      }

      const document = await DocumentCrudService.getDocumentWithContent(
        userId,
        data.documentId,
      );

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
        throw new HttpsError(
          'not-found',
          'No scratch pad found for this section.',
        );
      }

      const content = document.content?.trim() ?? '';
      const bodyHtml = extractBodyHtml(content);
      const lessonSection = splitLessonH2Sections(bodyHtml).find(
        (section) => section.sectionIndex === data.sectionIndex,
      );
      if (!lessonSection) {
        throw new HttpsError('failed-precondition', 'Lesson section not found.');
      }

      let rulesText = '';
      const ruleIds = data.ruleIds?.length
        ? data.ruleIds
        : document.appliedRuleIds;
      if (ruleIds?.length) {
        const { text } = await resolveEffectiveRules({
          userId,
          operation: RuleApplicability.PROMPT,
          additionalRuleIds: ruleIds,
          mode: 'explicit-only',
        });
        rulesText = text;
      }

      const replacement = await withUsageReservation(
        userId,
        'scratchPadQuestion',
        undefined,
        async () => {
          const result = await regenerateScratchPadForSection({
            userId,
            heading: lessonSection.heading,
            sectionHtml: lessonSection.html,
            sectionIndex: data.sectionIndex,
            previousQuestion: data.ignorePrevious
              ? undefined
              : existingPad.question,
            rulesText: rulesText || undefined,
            ignorePrevious: data.ignorePrevious === true,
          });
          if (!result) {
            throw new HttpsError(
              'internal',
              data.ignorePrevious
                ? 'Could not reset the scratch pad. Try again.'
                : 'Could not generate a different question. Try again.',
            );
          }
          return result;
        },
      );

      const nextPads: IScratchPad[] = existingPads.map((pad) =>
        pad.sectionIndex === data.sectionIndex ? replacement : pad,
      );

      await DocumentCrudService.updateDocument(userId, data.documentId, {
        scratchPads: nextPads,
      });

      logger.info('Scratch pad question regenerated', {
        userId,
        documentId: data.documentId,
        sectionIndex: data.sectionIndex,
      });

      return {
        success: true,
        data: {
          scratchPad: replacement,
        } satisfies RegenerateScratchPadQuestionResponse,
      };
    } catch (error) {
      logger.error('Failed to regenerate scratch pad question', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throwCallableError(error, 'Failed to regenerate scratch pad question');
    }
  },
);
