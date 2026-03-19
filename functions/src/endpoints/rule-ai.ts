import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { JsonSanitizer } from '../services/gemini/json-sanitizer';
import { RulePromptBuilder } from '../services/gemini/prompt-builder/rule-prompt-builder';
import { validateAuth } from '../lib/auth';

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const GEMINI_MODEL = 'gemini-3.1-pro-preview';

// Zod schemas for request payload validation
const generateRuleRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200, 'Topic must be 200 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  applicableTo: z.array(z.enum([
    'scraping',
    'upload',
    'prompt',
    'quiz',
    'followup',
    'flashcard',
    'slide_deck',
  ])).optional(),
  existingContent: z.string().max(15000, 'Existing content must be 15000 characters or less').optional(),
});

interface RuleResponse {
  name: string;
  description: string;
  content: string;
}

/**
 * Parse the JSON response from Gemini AI with sanitization.
 */
function parseRuleResponse(responseText: string): RuleResponse {
  let cleanText = '';
  try {
    cleanText = JsonSanitizer.initialCleanup(responseText);
    cleanText = JsonSanitizer.sanitizeJsonText(cleanText);
    cleanText = JsonSanitizer.applyComprehensiveCleanup(cleanText);
    cleanText = JsonSanitizer.applyStateBased(cleanText);

    const parsed = JSON.parse(cleanText);

    if (!parsed.name || !parsed.description || !parsed.content) {
      throw new Error('Missing required fields: name, description, or content');
    }

    return {
      name: String(parsed.name),
      description: String(parsed.description),
      content: String(parsed.content),
    };
  } catch (error) {
    JsonSanitizer.logParsingError(error, responseText, cleanText);

    try {
      const fallbackResult = JsonSanitizer.tryFallbackParsing(cleanText) as Record<string, unknown>;
      if (fallbackResult.name && fallbackResult.description && fallbackResult.content) {
        return {
          name: String(fallbackResult.name),
          description: String(fallbackResult.description),
          content: String(fallbackResult.content),
        };
      }
    } catch {
      // Fall through
    }

    throw new Error('Failed to parse rule response from Gemini AI');
  }
}

/**
 * Generates or improves a rule using Gemini AI.
 */
export const generateRuleWithAI = onCall(
  { region: 'asia-east1', cors: true, secrets: [geminiApiKey] },
  async (request) => {
    try {
      const userId = validateAuth(request);
      const parseResult = generateRuleRequestSchema.safeParse(request.data);
      if (!parseResult.success) {
        const msg = parseResult.error.issues[0]?.message ?? 'Invalid request payload.';
        throw new HttpsError('invalid-argument', msg);
      }
      const { topic, description, applicableTo, existingContent } = parseResult.data;

      logger.info('[generateRuleWithAI] Function started.', {
        userId,
        hasExistingContent: !!existingContent,
        topic,
      });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new HttpsError('internal', 'Gemini API key not configured.');
      }

      const client = new GoogleGenAI({ apiKey });

      const prompt = existingContent
        ? RulePromptBuilder.buildImprovePrompt(existingContent, topic, description)
        : RulePromptBuilder.buildGeneratePrompt(topic, description, applicableTo);

      logger.info('[generateRuleWithAI] Calling Gemini AI.', {
        mode: existingContent ? 'improve' : 'generate',
      });

      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      const text = response.text;
      if (!text) {
        throw new HttpsError('internal', 'Empty response from Gemini AI.');
      }

      logger.info('[generateRuleWithAI] Gemini response received.', {
        responseLength: text.length,
      });

      const rule = parseRuleResponse(text);

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
