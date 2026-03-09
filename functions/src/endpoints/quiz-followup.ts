import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '../lib/auth';
import { DocumentCrudService } from '../services/document-crud';
import { GeminiService } from '../services/gemini/gemini';
import { promptBuilder } from '../services/promptBuilder';
import { 
  GenerateFollowupRequest, 
  GenerateFollowupResponse,
  QuizFollowupContext,
} from "@shared-types";

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Generate comprehensive followup explanation for quiz question
 */
export const generateQuizFollowup = onCall(
  { 
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as GenerateFollowupRequest;

      logger.info('Generating quiz followup explanation', { 
        userId,
        documentId: data.documentId,
        questionLength: data.questionText?.length,
        followupRuleCount: data.followupRuleIds?.length || 0,
      });

      // Validate request
      if (!data.documentId || !data.questionText || !data.userSelectedAnswer) {
        throw new Error('Missing required fields: documentId, questionText, userSelectedAnswer');
      }

      // Get original document with content
      const originalDocument = await DocumentCrudService.getDocumentWithContent(userId, data.documentId);

      // Prepare context for Gemini
      const followupContext: QuizFollowupContext = {
        originalDocument: {
          title: originalDocument.title,
          content: originalDocument.content || '',
        },
        question: {
          text: data.questionText,
          options: data.questionOptions || [],
          userAnswer: data.userSelectedAnswer,
          correctAnswer: data.correctAnswer,
        },
        quiz: {
          title: data.quizTitle || `Quiz from ${originalDocument.title}`,
        },
      };

      // Inject followup rules if provided
      if (data.followupRuleIds && data.followupRuleIds.length > 0) {
        logger.info('Injecting followup rules into context', { 
          ruleCount: data.followupRuleIds.length,
        });
        const baseFollowupPrompt = 'Generate a detailed followup explanation for this quiz question.';
        followupContext.customInstructions = await promptBuilder.injectRules(
          baseFollowupPrompt,
          data.followupRuleIds,
          userId
        );
      }

      // Generate followup content with Gemini
      const followupContent = await GeminiService.generateQuizFollowup(followupContext);

      logger.info('Quiz followup explanation generated successfully', {
        originalDocId: data.documentId,
        contentLength: followupContent.length,
      });

      return { 
        success: true, 
        data: {
          content: followupContent,
        } as GenerateFollowupResponse,
      };

    } catch (error) {
      logger.error('Failed to generate quiz followup', { 
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to generate followup explanation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);