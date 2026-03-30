import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { FirestoreService } from "../services/firestore";
import { promptBuilder } from "../services/promptBuilder";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import { resolveGenerationRulesForPrompt, resolveRulesForDirectory } from "../services/rule-resolution";
import {
  GenerateDiagramQuizRequest,
  GenerateDiagramQuizResponse,
  GetDiagramQuizResponse,
  ApiResponse,
  DiagramQuiz,
  RuleApplicability,
} from "@shared-types";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const generateDiagramQuiz = onCall(
  {
    cors: true,
    secrets: [geminiApiKey],
    maxInstances: 5,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request): Promise<ApiResponse<GenerateDiagramQuizResponse>> => {
    try {
      const requestData = request.data as GenerateDiagramQuizRequest;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }

      const documentIds = requestData.documentIds;
      if (!documentIds || documentIds.length === 0) {
        throw new Error("documentIds is required (at least one document)");
      }

      if (documentIds.length > 5) {
        throw new Error("Maximum 5 documents allowed per diagram quiz");
      }

      const { diagramQuizName, additionalPrompt, quizRuleIds, followupRuleIds } =
        requestData;

      const documentDataList = await Promise.all(
        documentIds.map(async (docId) => {
          const doc = await DocumentCrudService.getDocument(userId, docId);
          const content = await FirestoreService.getDocumentContent(userId, docId);
          return { doc, content };
        })
      );

      const resolvedDirectoryId =
        requestData.directoryId ?? documentDataList[0]?.doc.directoryId;
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

      if (quizRuleIds?.length || followupRuleIds?.length) {
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
          RuleApplicability.DIAGRAM_QUIZ,
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

      const geminiQuiz = await GeminiService.generateDiagramQuiz(
        documentContent,
        enhancedPrompt
      );

      if (diagramQuizName?.trim()) {
        geminiQuiz.title = diagramQuizName.trim();
      } else if (documentIds.length === 1) {
        geminiQuiz.title = `Diagram Quiz from ${documentDataList[0].doc.title}`;
      } else {
        geminiQuiz.title = `Diagram Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
      }

      const primaryDocumentId = documentIds[0];
      const saved = await FirestoreService.saveDiagramQuizFromDocument(
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
          diagramQuizId: saved.id,
          diagramQuiz: saved,
        },
      };
    } catch (error) {
      console.error("Error in generateDiagramQuiz:", error);
      return {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate diagram quiz",
        },
      };
    }
  }
);

export const getDiagramQuiz = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<GetDiagramQuizResponse>> => {
    try {
      const { diagramQuizId } = request.data as { diagramQuizId?: string };
      const userId = request.auth?.uid;

      if (!diagramQuizId) {
        throw new Error("diagramQuizId is required");
      }
      if (!userId) {
        throw new Error("Authentication required");
      }

      const diagramQuiz = await FirestoreService.getDiagramQuiz(diagramQuizId, userId);
      if (!diagramQuiz) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Diagram quiz not found" },
        };
      }

      return {
        success: true,
        data: { diagramQuiz },
      };
    } catch (error) {
      console.error("Error in getDiagramQuiz:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch diagram quiz",
        },
      };
    }
  }
);

export const getUserDiagramQuizzes = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ diagramQuizzes: DiagramQuiz[] }>> => {
    try {
      const userId = request.auth?.uid;
      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }

      const diagramQuizzes = await FirestoreService.getUserDiagramQuizzes(userId);
      return {
        success: true,
        data: { diagramQuizzes },
      };
    } catch (error) {
      console.error("Error in getUserDiagramQuizzes:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message:
            error instanceof Error ? error.message : "Failed to fetch diagram quizzes",
        },
      };
    }
  }
);

export const deleteDiagramQuiz = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const userId = request.auth?.uid;
      const { diagramQuizId } = request.data as { diagramQuizId?: string };

      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }
      if (!diagramQuizId) {
        return {
          success: false,
          error: { code: "MISSING_PARAMETER", message: "diagramQuizId is required" },
        };
      }

      await FirestoreService.deleteDiagramQuiz(diagramQuizId, userId);
      return {
        success: true,
        data: { success: true },
      };
    } catch (error) {
      console.error("Error in deleteDiagramQuiz:", error);
      return {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: error instanceof Error ? error.message : "Failed to delete diagram quiz",
        },
      };
    }
  }
);
