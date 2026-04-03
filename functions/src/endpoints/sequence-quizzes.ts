import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { FirestoreService } from "../services/firestore";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import { resolveGenerationRulesForPrompt, resolveRulesForDirectory } from "../services/rule-resolution";
import {
  GenerateSequenceQuizRequest,
  GenerateSequenceQuizResponse,
  GetSequenceQuizResponse,
  ApiResponse,
  SequenceQuiz,
  RuleApplicability,
} from "@shared-types";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const generateSequenceQuiz = onCall(
  {
    cors: true,
    secrets: [geminiApiKey],
    maxInstances: 5,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request): Promise<ApiResponse<GenerateSequenceQuizResponse>> => {
    try {
      const requestData = (request.data ?? {}) as Record<string, unknown>;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }

      const documentIds = requestData.documentIds;
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        throw new Error("documentIds must be a non-empty array");
      }
      if (!documentIds.every((id): id is string => typeof id === "string")) {
        throw new Error("Each documentId must be a string");
      }

      if (documentIds.length > 5) {
        throw new Error("Maximum 5 documents allowed per sequence quiz");
      }

      if (requestData.additionalRuleIds != null && !Array.isArray(requestData.additionalRuleIds)) {
        throw new Error("additionalRuleIds must be an array when provided");
      }

      const typedRequest = requestData as unknown as GenerateSequenceQuizRequest;
      const { sequenceQuizName, additionalPrompt } = typedRequest;

      const documentDataList = await Promise.all(
        documentIds.map(async (docId) => {
          const doc = await DocumentCrudService.getDocument(userId, docId);
          const content = await FirestoreService.getDocumentContent(userId, docId);
          return { doc, content };
        })
      );

      const resolvedDirectoryId =
        typedRequest.directoryId ?? documentDataList[0]?.doc.directoryId;
      if (!resolvedDirectoryId) {
        throw new Error("directoryId is required, or documents must belong to a directory");
      }
      await directoryService.validateDirectoryId(userId, resolvedDirectoryId);

      for (const { doc } of documentDataList) {
        if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
          throw new Error("All selected documents must belong to the same directory");
        }
      }

      const combinedContent = documentDataList.map((d) => d.content).join("\n\n---\n\n");
      const combinedWordCount = combinedContent.split(/\s+/).length;
      const combinedTitle = documentDataList.map((d) => d.doc.title).join(" + ");

      const documentContent = {
        title: combinedTitle,
        content: combinedContent,
        wordCount: combinedWordCount,
      };

      GeminiService.validateContentForQuiz(documentContent);

      let enhancedPrompt = additionalPrompt || "";
      let followupIdsForSave: string[] = [];

      const quizRulesText = await resolveGenerationRulesForPrompt(
        userId,
        resolvedDirectoryId,
        RuleApplicability.SEQUENCE_QUIZ,
        typedRequest.additionalRuleIds
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

      const geminiQuiz = await GeminiService.generateSequenceQuiz(
        documentContent,
        enhancedPrompt || undefined
      );

      if (sequenceQuizName?.trim()) {
        geminiQuiz.title = sequenceQuizName.trim();
      } else if (documentIds.length === 1) {
        geminiQuiz.title = `Sequence Quiz from ${documentDataList[0].doc.title}`;
      } else {
        geminiQuiz.title = `Sequence Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
      }

      const primaryDocumentId = documentIds[0];
      const saved = await FirestoreService.saveSequenceQuizFromDocument(
        primaryDocumentId,
        geminiQuiz,
        userId,
        resolvedDirectoryId,
        followupIdsForSave,
        documentIds.length > 1 ? documentIds : undefined
      );

      return {
        success: true,
        data: {
          sequenceQuizId: saved.id,
          sequenceQuiz: saved,
        },
      };
    } catch (error) {
      console.error("Error in generateSequenceQuiz:", error);
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate sequence quiz",
        },
      };
    }
  }
);

export const getSequenceQuiz = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<GetSequenceQuizResponse>> => {
    try {
      const data = (request.data ?? {}) as Record<string, unknown>;
      const sequenceQuizId = typeof data.sequenceQuizId === "string" ? data.sequenceQuizId : undefined;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }
      if (!sequenceQuizId) {
        throw new Error("sequenceQuizId is required");
      }

      const sequenceQuiz = await FirestoreService.getSequenceQuiz(sequenceQuizId, userId);
      if (!sequenceQuiz) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Sequence quiz not found" },
        };
      }

      return {
        success: true,
        data: { sequenceQuiz },
      };
    } catch (error) {
      console.error("Error in getSequenceQuiz:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch sequence quiz",
        },
      };
    }
  }
);

export const getUserSequenceQuizzes = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ sequenceQuizzes: SequenceQuiz[] }>> => {
    try {
      const userId = request.auth?.uid;
      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }

      const sequenceQuizzes = await FirestoreService.getUserSequenceQuizzes(userId);
      return {
        success: true,
        data: { sequenceQuizzes },
      };
    } catch (error) {
      console.error("Error in getUserSequenceQuizzes:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch sequence quizzes",
        },
      };
    }
  }
);

export const deleteSequenceQuiz = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const userId = request.auth?.uid;
      const deleteData = (request.data ?? {}) as Record<string, unknown>;
      const sequenceQuizId = typeof deleteData.sequenceQuizId === "string" ? deleteData.sequenceQuizId : undefined;

      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }
      if (!sequenceQuizId) {
        return {
          success: false,
          error: { code: "MISSING_PARAMETER", message: "sequenceQuizId is required" },
        };
      }

      await FirestoreService.deleteSequenceQuiz(sequenceQuizId, userId);
      return {
        success: true,
        data: { success: true },
      };
    } catch (error) {
      console.error("Error in deleteSequenceQuiz:", error);
      return {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: error instanceof Error ? error.message : "Failed to delete sequence quiz",
        },
      };
    }
  }
);
