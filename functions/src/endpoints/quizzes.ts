import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { FirestoreService } from "../services/firestore";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import { FirestorePaths } from "../lib/firestore-paths";
import {
  isRuleResolutionMode,
  resolveEffectiveRules,
} from "../services/rule-resolution";
import {
  createPendingQuiz,
  completePendingQuiz,
  failPendingQuiz,
} from "../services/artifact-generation-records";
import { 
  GenerateQuizRequest, 
  GenerateQuizResponse, 
  GetQuizResponse,
  ApiResponse,
  Quiz,
  RuleApplicability,
  getDocumentFallbackColor,
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
        // Inject rules: legacy explicit IDs, or auto-resolve from directory hierarchy
        let enhancedPrompt = requestData.additionalPrompt || '';
        let followupIdsForSave: string[] = [];
        let appliedRuleIdsForSave: string[] = [];
        const ruleResolutionMode = isRuleResolutionMode(
          (requestData as unknown as { ruleResolutionMode?: unknown }).ruleResolutionMode
        )
          ? (requestData as unknown as { ruleResolutionMode: 'inherit' | 'inherit-plus-explicit' | 'explicit-only' }).ruleResolutionMode
          : undefined;
        const hasLegacyExplicitRules = Boolean(
          requestData.ruleIds?.length || requestData.quizRuleIds?.length || requestData.followupRuleIds?.length
        );
        const mode = ruleResolutionMode
          ?? (hasLegacyExplicitRules ? 'explicit-only' : 'inherit-plus-explicit');
        const selectedQuizRuleIds = requestData.ruleIds?.length
          ? requestData.ruleIds
          : requestData.quizRuleIds?.length
          ? requestData.quizRuleIds
          : requestData.additionalRuleIds;
        const selectedFollowupRuleIds = hasLegacyExplicitRules
          ? (requestData.followupRuleIds || [])
          : requestData.additionalRuleIds;

        const { text: quizRulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.QUIZ,
          additionalRuleIds: selectedQuizRuleIds,
          mode,
        });
        if (quizRulesText) {
          enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
        }
        appliedRuleIdsForSave = resolvedAppliedIds;

        const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.FOLLOWUP,
          additionalRuleIds: selectedFollowupRuleIds,
          mode,
        });
        followupIdsForSave = resolvedFollowupIds;
        
        // Generate quiz with Gemini AI
        console.log("Generating quiz with Gemini AI for document(s)...");
        const geminiQuiz = await GeminiService.generateQuiz(documentContent, enhancedPrompt);
        
        // Apply custom quiz name if provided
        if (requestData.quizName && requestData.quizName.trim()) {
          geminiQuiz.title = requestData.quizName.trim();
        } else if (documentIds.length === 1) {
          geminiQuiz.title = `Quiz from ${documentDataList[0].doc.title}`;
        } else {
          geminiQuiz.title = `Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
        }

        // Count existing quizzes for this document for attempt number
        // (pending record already in collection, so size == attempt number)
        const existingSnap = await FirestorePaths.quizzes(userId)
          .where('documentId', '==', documentIds[0])
          .get();
        const generationAttempt = existingSnap.size;

        await completePendingQuiz(userId, pendingQuizId, {
          title: geminiQuiz.title,
          questions: geminiQuiz.questions.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            ...(q.hint ? { hint: q.hint } : {}),
            ...(q.knowledge ? { knowledge: q.knowledge } : {}),
          })),
          appliedRuleIds: appliedRuleIdsForSave,
          generationAttempt,
        });

        // Also persist followupRuleIds and documentTitle
        await FirestorePaths.quiz(userId, pendingQuizId).update({
          followupRuleIds: followupIdsForSave,
          documentTitle: documentDataList[0].doc.title,
        });
        
        console.log(`Successfully generated quiz from ${documentIds.length} document(s): ${pendingQuizId}`);
        
        return {
          success: true,
          data: {
            quizId: pendingQuizId,
            quiz: { id: pendingQuizId } as Quiz,
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