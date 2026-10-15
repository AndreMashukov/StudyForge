import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import {
  evaluateMermaidDiagramSuitability,
} from '@study-forge/backend-llm/llm/jev-decisions-client';

const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 10_000;

/**
 * Uses Jev (OpenRouter Decisions API) to decide whether Mermaid diagrams fit an AI Prompt.
 */
export const evaluatePromptDiagramSuitability = onCall(
  {
    region: 'asia-east1',
    cors: true,
    secrets: [llmSettingsEncryptionKey],
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      const userId = await validateVerifiedAuth(request);
      const rawPrompt = (request.data as { prompt?: unknown })?.prompt;

      if (typeof rawPrompt !== 'string') {
        throw new HttpsError('invalid-argument', 'prompt is required and must be a string');
      }

      const trimmedPrompt = rawPrompt.trim();

      if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
        throw new HttpsError(
          'invalid-argument',
          `prompt must be at least ${MIN_PROMPT_LENGTH} characters`,
        );
      }

      if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
        throw new HttpsError(
          'invalid-argument',
          `prompt must be at most ${MAX_PROMPT_LENGTH} characters`,
        );
      }

      logger.info('Evaluating prompt diagram suitability with Jev', {
        userId,
        promptLength: trimmedPrompt.length,
      });

      const result = await evaluateMermaidDiagramSuitability({
        prompt: trimmedPrompt,
      });

      return {
        success: true,
        suitable: result.suitable,
        probability: result.probability,
      };
    } catch (error) {
      logger.error('Failed to evaluate prompt diagram suitability', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  },
);
