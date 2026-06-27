import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { LlmGenerationService } from '../services/llm';
import { validateAuth } from '../lib/auth';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

const generateRuleRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(15000, 'Topic must be 15,000 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').nullish(),
  applicableTo: z.array(z.enum([
    'scraping',
    'upload',
    'prompt',
    'quiz',
    'followup',
    'flashcard',
    'flashcard_desc',
    'slide_deck',
    'diagram_quiz',
    'sequence_quiz',
  ])).nullish(),
  existingContent: z.string().max(100000, 'Existing content must be 100,000 characters or less').nullish(),
});

/**
 * Generates or improves a rule using the LLM routing layer (OpenRouter or Gemini).
 */
export const generateRuleWithAI = onCall(
  { region: 'asia-east1', cors: true, secrets: [geminiApiKey, llmSettingsEncryptionKey], timeoutSeconds: 300 },
  async (request) => {
    try {
      const userId = validateAuth(request);
      const parseResult = generateRuleRequestSchema.safeParse(request.data);
      if (!parseResult.success) {
        const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
        throw new HttpsError('invalid-argument', msg);
      }
      const { topic } = parseResult.data;
      const description = parseResult.data.description ?? undefined;
      const applicableTo = parseResult.data.applicableTo ?? undefined;
      const existingContent = parseResult.data.existingContent ?? undefined;

      logger.info('[generateRuleWithAI] Function started.', {
        userId,
        hasExistingContent: !!existingContent,
        topicLength: topic.length,
      });

      logger.info('[generateRuleWithAI] Starting LLM rule generation.', {
        mode: existingContent ? 'improve' : 'generate',
      });

      const rule = await LlmGenerationService.generateRule(userId, {
        topic,
        description,
        applicableTo,
        existingContent,
      });

      logger.info('[generateRuleWithAI] Rule parsed successfully.', {
        name: rule.name,
      });

      return {
        success: true,
        result: {
          name: rule.name,
          description: rule.description,
          content: rule.content,
        },
      };
    } catch (error) {
      logger.error('Error in generateRuleWithAI:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'An unexpected error occurred while generating the rule.');
    }
  }
);
