import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { langsmithApiKey } from '../langsmith-secret';
import { logger } from 'firebase-functions/v2';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import { withUsageReservation } from '@study-forge/backend-generation/generation-limits';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { evaluateScratchPadAnswer } from '@study-forge/backend-documents/scratch-pad';
import { extractBodyHtml } from '@study-forge/backend-documents/document-html/html-utils';
import { resolveEffectiveRules } from '@study-forge/backend-directories/rule-resolution';
import {
  type EvaluateScratchPadAnswerRequest,
  type EvaluateScratchPadAnswerResponse,
  RuleApplicability,
  resolveDocumentContentFormat,
  splitLessonH2Sections,
} from '@shared-types';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

export const evaluateScratchPadAnswerCallable = onCall(
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
      const data = request.data as EvaluateScratchPadAnswerRequest;

      if (
        !data.documentId ||
        typeof data.sectionIndex !== 'number' ||
        typeof data.userAnswer !== 'string'
      ) {
        throw new HttpsError(
          'invalid-argument',
          'Missing required fields: documentId, sectionIndex, userAnswer',
        );
      }

      const trimmedAnswer = data.userAnswer.trim();
      if (!trimmedAnswer) {
        throw new HttpsError('invalid-argument', 'Answer cannot be empty.');
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

      const existingPad = document.scratchPads?.find(
        (pad) => pad.sectionIndex === data.sectionIndex,
      );
      if (!existingPad) {
        throw new HttpsError('not-found', 'No scratch pad found for this section.');
      }

      const bodyHtml = extractBodyHtml(document.content?.trim() ?? '');
      const lessonSection = splitLessonH2Sections(bodyHtml).find(
        (section) => section.sectionIndex === data.sectionIndex,
      );
      if (!lessonSection) {
        throw new HttpsError('failed-precondition', 'Lesson section not found.');
      }

      let rulesText = '';
      const ruleIds = data.ruleIds?.length ? data.ruleIds : document.appliedRuleIds;
      if (ruleIds?.length) {
        const { text } = await resolveEffectiveRules({
          userId,
          operation: RuleApplicability.PROMPT,
          additionalRuleIds: ruleIds,
          mode: 'explicit-only',
        });
        rulesText = text;
      }

      const evaluation = await withUsageReservation(
        userId,
        'scratchPadQuestion',
        undefined,
        async () => {
          const result = await evaluateScratchPadAnswer({
            userId,
            heading: lessonSection.heading,
            sectionHtml: lessonSection.html,
            question: existingPad.question,
            referenceAnswer: existingPad.answer,
            userAnswer: trimmedAnswer,
            rulesText: rulesText || undefined,
          });
          if (!result) {
            throw new HttpsError(
              'internal',
              'Could not evaluate your answer. Try again.',
            );
          }
          return result;
        },
      );

      logger.info('Scratch pad answer evaluated', {
        userId,
        documentId: data.documentId,
        sectionIndex: data.sectionIndex,
        score: evaluation.score,
      });

      return {
        success: true,
        data: {
          score: evaluation.score,
          hint: evaluation.hint,
        } satisfies EvaluateScratchPadAnswerResponse,
      };
    } catch (error) {
      logger.error('Failed to evaluate scratch pad answer', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throwCallableError(error, 'Failed to evaluate scratch pad answer');
    }
  },
);
