import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { getGenerationFailureEnvelope } from '../services/llm/llm-endpoint-error';
import { mapErrorToArtifactEnvelope } from '../lib/callable-error';
import { enforceCallableGenerationRateLimit } from '../lib/generation-rate-limit';
import { DocumentCrudService } from "../services/document-crud";
import { FirestoreService } from "../services/firestore";
import { directoryService } from "../services/directory";
import {
  createPendingQuiz,
  failPendingQuiz,
} from "../services/artifact-generation-records";
import { enqueueGenerationJob } from "../services/generation-enqueue";
import { buildStartGenerationPayload } from "../lib/start-generation-response";
import { 
  GenerateQuizRequest, 
  GenerateQuizResponse, 
  GetQuizResponse,
  ApiResponse,
  Quiz,
  getDocumentFallbackColor,
} from "@shared-types";

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const llmSettingsEncryptionKey = defineSecret("LLM_SETTINGS_ENCRYPTION_KEY");

/**
 * Generate Quiz from Document
 * Callable function: generateQuiz
 */
export const generateQuiz = onCall(
  {
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request): Promise<ApiResponse<GenerateQuizResponse>> => {
    try {
      const requestData = request.data as GenerateQuizRequest;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }

      const documentIds = requestData.documentIds;
      if (!documentIds || documentIds.length === 0) {
        throw new Error("documentIds is required (at least one document)");
      }

      if (documentIds.length > 5) {
        throw new Error("Maximum 5 documents allowed per quiz");
      }

      await enforceCallableGenerationRateLimit(userId, 'quiz');

      console.log(`Generating quiz from ${documentIds.length} document(s): ${documentIds.join(', ')}`, {
        customQuizName: !!requestData.quizName,
        hasAdditionalPrompt: !!requestData.additionalPrompt,
        quizRuleCount: requestData.quizRuleIds?.length || 0,
        followupRuleCount: requestData.followupRuleIds?.length || 0,
      });
      
      // Fetch all documents and their content in parallel
      const documentDataList = await Promise.all(
        documentIds.map(async (docId) => {
          const doc = await DocumentCrudService.getDocument(userId, docId);
          const content = await FirestoreService.getDocumentContent(userId, docId);
          return { doc, content };
        })
      );

      const resolvedDirectoryId = requestData.directoryId ?? documentDataList[0]?.doc.directoryId;
      if (!resolvedDirectoryId) {
        throw new Error("directoryId is required, or documents must belong to a directory");
      }
      await directoryService.validateDirectoryId(userId, resolvedDirectoryId);

      for (const { doc } of documentDataList) {
        if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
          throw new Error("All selected documents must belong to the same directory");
        }
      }

      // Build combined content for Gemini
      const combinedContent = documentDataList
        .map((d) => d.content)
        .join('\n\n---\n\n');
      const combinedWordCount = combinedContent.split(/\s+/).length;
      const combinedTitle = documentDataList.map((d) => d.doc.title).join(' + ');

      const documentContent = {
        title: combinedTitle,
        content: combinedContent,
        wordCount: combinedWordCount,
      };
      
      GeminiService.validateContentForQuiz(documentContent);

      const pendingTitle = requestData.quizName?.trim()
        || (documentIds.length === 1
          ? `Quiz from ${documentDataList[0].doc.title}`
          : `Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

      const pendingQuizId = await createPendingQuiz({
        directoryId: resolvedDirectoryId,
        userId,
        documentId: documentIds[0],
        documentIds: documentIds.length > 1 ? documentIds : undefined,
        documentTitle: documentDataList[0].doc.title,
        title: pendingTitle,
        documentColor: documentDataList[0].doc.color ?? getDocumentFallbackColor(documentDataList[0].doc.id),
        documentColors: documentDataList.length > 1
          ? documentDataList.map(d => d.doc.color ?? getDocumentFallbackColor(d.doc.id))
          : undefined,
      });

      try {
        await enqueueGenerationJob({
          userId,
          directoryId: resolvedDirectoryId,
          recordId: pendingQuizId,
          kind: 'quiz',
          payload: requestData,
        });

        return {
          success: true,
          data: {
            ...buildStartGenerationPayload('quiz', pendingQuizId, resolvedDirectoryId, {
              quizId: pendingQuizId,
            }),
            quiz: { id: pendingQuizId, generationStatus: 'pending' } as Quiz,
          },
        };
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await failPendingQuiz(userId, pendingQuizId, msg).catch(() => {/* best-effort */});
        throw innerError;
      }

    } catch (error) {
      console.error("Error in generateQuiz:", error);
      
      return {
        success: false,
        error: getGenerationFailureEnvelope(error),
      };
    }
  }
);

/**
 * Get Quiz by ID
 * Callable function: getQuiz
 */
export const getQuiz = onCall(
  {
    cors: true,
  },
  async (request): Promise<ApiResponse<GetQuizResponse>> => {
    try {
      const { quizId } = request.data;
      const userId = request.auth?.uid;
      
      if (!quizId) {
        throw new Error("Quiz ID is required");
      }

      if (!userId) {
        throw new Error("Authentication required");
      }

      console.log(`Fetching quiz: ${quizId}`);

      const quiz = await FirestoreService.getQuiz(quizId, userId);
      
      if (!quiz) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Quiz not found",
          },
        };
      }

      return {
        success: true,
        data: {
          quiz,
        },
      };

    } catch (error) {
      console.error("Error in getQuiz:", error);
      
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'FETCH_FAILED'),
      };
    }
  }
);

/**
 * Get User's Quizzes
 * Requires authentication
 */
export const getUserQuizzes = onCall(
  {
    cors: true,
  },
  async (request): Promise<ApiResponse<{ quizzes: Quiz[] }>> => {
    try {
      const userId = request.auth?.uid;
      
      if (!userId) {
        return {
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        };
      }

      console.log(`Fetching quizzes for user: ${userId}`);

      const quizzes = await FirestoreService.getUserQuizzes(userId);

      return {
        success: true,
        data: {
          quizzes,
        },
      };

    } catch (error) {
      console.error("Error in getUserQuizzes:", error);
      
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'FETCH_FAILED'),
      };
    }
  }
);

/**
 * Get Document Quizzes
 * Get all quizzes for a specific document
 * Requires authentication
 */
export const getDocumentQuizzes = onCall(
  {
    cors: true,
  },
  async (request): Promise<ApiResponse<{ quizzes: Quiz[] }>> => {
    try {
      const userId = request.auth?.uid;
      const { documentId } = request.data;
      
      if (!userId) {
        return {
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        };
      }

      if (!documentId) {
        return {
          success: false,
          error: {
            code: "MISSING_PARAMETER",
            message: "documentId is required",
          },
        };
      }

      console.log(`Fetching quizzes for document: ${documentId}, user: ${userId}`);

      const quizzes = await FirestoreService.getDocumentQuizzes(documentId, userId);

      return {
        success: true,
        data: {
          quizzes,
        },
      };

    } catch (error) {
      console.error("Error in getDocumentQuizzes:", error);
      
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'FETCH_FAILED'),
      };
    }
  }
);

/**
 * Delete Quiz
 * Delete a quiz by ID (requires authentication)
 */
export const deleteQuiz = onCall(
  {
    cors: true,
  },
  async (request): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const userId = request.auth?.uid;
      const { quizId } = request.data;
      
      if (!userId) {
        return {
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        };
      }

      if (!quizId) {
        return {
          success: false,
          error: {
            code: "MISSING_PARAMETER",
            message: "quizId is required",
          },
        };
      }

      console.log(`Deleting quiz: ${quizId} for user: ${userId}`);

      await FirestoreService.deleteQuiz(quizId, userId);

      return {
        success: true,
        data: {
          success: true,
        },
      };

    } catch (error) {
      console.error("Error in deleteQuiz:", error);
      
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'DELETE_FAILED'),
      };
    }
  }
);