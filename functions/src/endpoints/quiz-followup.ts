import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { DocumentCrudService } from '../services/document-crud';
import { GeminiService } from '../services/gemini/gemini';
import { promptBuilder } from '../services/promptBuilder';
import { 
  GenerateFollowupRequest, 
  GenerateFollowupResponse,
  QuizFollowupContext,
  CreateDocumentRequest,
  DocumentSourceType,
  DocumentStatus,
} from "@shared-types";

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Authentication middleware for callable functions
 */
async function validateAuth(context: { auth?: { uid?: string } }): Promise<string> {
  if (!context.auth?.uid) {
    throw new Error('Authentication required');
  }
  return context.auth.uid;
}

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

      // Create followup document
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const followupTitle = `${originalDocument.title}-quiz-followup-${timestamp}`;

      const createRequest: CreateDocumentRequest = {
        title: followupTitle,
        description: `Comprehensive followup explanation for quiz question from "${originalDocument.title}"`,
        content: followupContent,
        sourceType: DocumentSourceType.GENERATED,
        status: DocumentStatus.ACTIVE,
        tags: ['quiz-followup', 'explanation', 'generated'],
      };

      const followupDocument = await DocumentCrudService.createDocument(userId, createRequest);

      logger.info('Quiz followup document created successfully', { 
        followupDocId: followupDocument.id,
        originalDocId: data.documentId,
      });

      return { 
        success: true, 
        data: {
          documentId: followupDocument.id,
          title: followupDocument.title,
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