import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { validateAuth } from '../lib/auth';
import { DocumentCrudService } from '../services/document-crud';
import { GeminiService } from '../services/gemini/gemini';
import { promptBuilder } from '../services/promptBuilder';
import { 
  AskDocumentQuestionRequest, 
  AskDocumentQuestionResponse,
  DocumentQuestionContext,
} from "@shared-types";

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Answer a user's question about a specific document
 */
export const askDocumentQuestion = onCall(
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
      const data = request.data as AskDocumentQuestionRequest;

      logger.info('Answering document question', { 
        userId,
        documentId: data.documentId,
        questionLength: data.question?.length,
        ruleCount: data.ruleIds?.length || 0,
      });

      // Validate request
      if (!data.documentId || !data.question) {
        throw new Error('Missing required fields: documentId, question');
      }

      if (data.question.length > 2000) {
        throw new Error('Question must be 2000 characters or less');
      }

      // Get original document with content
      const originalDocument = await DocumentCrudService.getDocumentWithContent(userId, data.documentId);

      // Prepare context for Gemini
      const questionContext: DocumentQuestionContext = {
        document: {
          title: originalDocument.title,
          content: originalDocument.content || '',
        },
        question: data.question,
      };

      // Inject rules if provided
      if (data.ruleIds && data.ruleIds.length > 0) {
        logger.info('Injecting rules into document question context', { 
          ruleCount: data.ruleIds.length,
        });
        const basePrompt = 'Answer the user question about this document.';
        questionContext.customInstructions = await promptBuilder.injectRules(
          basePrompt,
          data.ruleIds,
          userId
        );
      }

      // Generate answer with Gemini
      const answerContent = await GeminiService.generateDocumentQuestionAnswer(questionContext);

      logger.info('Document question answered successfully', {
        userId,
        documentId: data.documentId,
        answerLength: answerContent.length,
      });

      return { 
        success: true, 
        data: {
          content: answerContent,
        } as AskDocumentQuestionResponse,
      };

    } catch (error) {
      logger.error('Failed to answer document question', { 
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to answer question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
