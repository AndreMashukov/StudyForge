import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { FirestoreService } from "../services/firestore";
import { promptBuilder } from "../services/promptBuilder";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import { resolveGenerationRulesForPrompt, resolveRulesForDirectory } from "../services/rule-resolution";
import { 
  GenerateQuizRequest, 
  GenerateQuizResponse, 
  GetQuizResponse,
  ApiResponse,
  Quiz,
  RuleApplicability,
} from "@shared-types";

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Generate Quiz from Document
 * Callable function: generateQuiz
 */
export const generateQuiz = onCall(
  {
    cors: true,
    secrets: [geminiApiKey],
    maxInstances: 5,
    timeoutSeconds: 300,
    memory: "1GiB",
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

      const { quizName, additionalPrompt, quizRuleIds, followupRuleIds } = requestData;

      console.log(`Generating quiz from ${documentIds.length} document(s): ${documentIds.join(', ')}`, {
        customQuizName: !!quizName,
        hasAdditionalPrompt: !!additionalPrompt,
        quizRuleCount: quizRuleIds?.length || 0,
        followupRuleCount: followupRuleIds?.length || 0,
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
      
      // Inject rules: legacy explicit IDs, or auto-resolve from directory hierarchy
      let enhancedPrompt = additionalPrompt || '';
      let followupIdsForSave: string[] = [];

      if (quizRuleIds?.length || followupRuleIds?.length) {
        console.log("Injecting rules into quiz generation prompt (legacy explicit rule IDs)...");
        const { quizPrompt } = await promptBuilder.injectQuizRules(
          enhancedPrompt,
          quizRuleIds || [],
          followupRuleIds || [],
          userId
        );
        enhancedPrompt = quizPrompt;
        followupIdsForSave = followupRuleIds || [];
      } else {
        const quizRulesText = await resolveGenerationRulesForPrompt(
          userId,
          resolvedDirectoryId,
          RuleApplicability.QUIZ,
          requestData.additionalRuleIds
        );
        if (quizRulesText) {
          enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
        }
        const { rules: followupRules } = await resolveRulesForDirectory(
          userId,
          resolvedDirectoryId,
          RuleApplicability.FOLLOWUP
        );
        followupIdsForSave = followupRules.map((r) => r.id);
        if (requestData.additionalRuleIds?.length) {
          for (const id of requestData.additionalRuleIds) {
            if (!followupIdsForSave.includes(id)) followupIdsForSave.push(id);
          }
        }
      }
      
      // Generate quiz with Gemini AI
      console.log("Generating quiz with Gemini AI for document(s)...");
      const geminiQuiz = await GeminiService.generateQuiz(documentContent, enhancedPrompt);
      
      // Apply custom quiz name if provided
      if (quizName && quizName.trim()) {
        geminiQuiz.title = quizName.trim();
      } else if (documentIds.length === 1) {
        geminiQuiz.title = `Quiz from ${documentDataList[0].doc.title}`;
      } else {
        geminiQuiz.title = `Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
      }
      
      // Save quiz with document references and followup rules
      const primaryDocumentId = documentIds[0];
      const savedQuiz = await FirestoreService.saveQuizFromDocument(
        primaryDocumentId, 
        geminiQuiz, 
        userId,
        resolvedDirectoryId,
        followupIdsForSave,
        documentIds.length > 1 ? documentIds : undefined
      );
      
      console.log(`Successfully generated quiz from ${documentIds.length} document(s): ${savedQuiz.id}`);
      
      return {
        success: true,
        data: {
          quizId: savedQuiz.id,
          quiz: savedQuiz,
        },
      };

    } catch (error) {
      console.error("Error in generateQuiz:", error);
      
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate quiz",
        },
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
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch quiz",
        },
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
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch user quizzes",
        },
      };
    }
  }
);

/**
 * Get Recent Public Quizzes
 */
export const getRecentQuizzes = onCall(
  {
    cors: true,
  },
  async (request): Promise<ApiResponse<{ quizzes: Quiz[] }>> => {
    try {
      const { limit = 20 } = request.data || {};

      console.log(`Fetching ${limit} recent quizzes`);

      const quizzes = await FirestoreService.getRecentQuizzes(limit);

      return {
        success: true,
        data: {
          quizzes,
        },
      };

    } catch (error) {
      console.error("Error in getRecentQuizzes:", error);
      
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch recent quizzes",
        },
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
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch document quizzes",
        },
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
        error: {
          code: "DELETE_FAILED",
          message: error instanceof Error ? error.message : "Failed to delete quiz",
        },
      };
    }
  }
);