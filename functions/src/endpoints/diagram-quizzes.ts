import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { getGenerationFailureEnvelope } from "../services/llm/llm-endpoint-error";
import { FirestoreService } from "../services/firestore";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import {
  isRuleResolutionMode,
} from "../services/rule-resolution";
import {
  createPendingDiagramQuiz,
} from "../services/artifact-generation-records";
import { GenerationJobPayloadStorage } from "../services/generation-job-payload-storage";
import { GenerationJobsService } from "../services/generation-jobs";
import { enqueueGenerationJobTask } from "../services/generation-task-queue";
import type { ArtifactAgentJobPayload } from "../services/artifact-agent";
import {
  GenerateDiagramQuizRequest,
  GenerateDiagramQuizResponse,
  GetDiagramQuizResponse,
  ApiResponse,
  DiagramQuiz,
  getDocumentFallbackColor,
} from "@shared-types";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const llmSettingsEncryptionKey = defineSecret("LLM_SETTINGS_ENCRYPTION_KEY");

export const generateDiagramQuiz = onCall(
  {
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "512MiB",
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

      const pendingTitle = diagramQuizName?.trim()
        || (documentIds.length === 1
          ? `Diagram Quiz from ${documentDataList[0].doc.title}`
          : `Diagram Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

      const pendingDiagramQuizId = await createPendingDiagramQuiz({
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

      const ruleResolutionMode = isRuleResolutionMode(
        (requestData as unknown as { ruleResolutionMode?: unknown }).ruleResolutionMode
      )
        ? (requestData as unknown as { ruleResolutionMode: 'inherit' | 'inherit-plus-explicit' | 'explicit-only' }).ruleResolutionMode
        : undefined;
      const hasLegacyExplicitRules = Boolean(
        requestData.ruleIds?.length || quizRuleIds?.length || followupRuleIds?.length
      );
      const mode = ruleResolutionMode
        ?? (hasLegacyExplicitRules ? 'explicit-only' : 'inherit-plus-explicit');
      const selectedQuizRuleIds = requestData.ruleIds?.length
        ? requestData.ruleIds
        : quizRuleIds?.length
        ? quizRuleIds
        : requestData.additionalRuleIds;
      const selectedFollowupRuleIds = hasLegacyExplicitRules
        ? (followupRuleIds || [])
        : requestData.additionalRuleIds;

      const jobId = GenerationJobsService.newJobId(userId);
      const payload: ArtifactAgentJobPayload = {
        artifactKind: 'diagramQuiz',
        documentIds,
        directoryId: resolvedDirectoryId,
        recordId: pendingDiagramQuizId,
        title: pendingTitle,
        additionalPrompt,
        ruleIds: selectedQuizRuleIds,
        followupRuleIds: selectedFollowupRuleIds,
        ruleResolutionMode: mode,
        artifactPayload: {
          diagramQuizName,
        },
      };

      const payloadStoragePath = await GenerationJobPayloadStorage.saveJson(userId, jobId, payload);
      await GenerationJobsService.createJob({
        jobId,
        kind: 'artifactAgent',
        userId,
        directoryId: resolvedDirectoryId,
        recordId: pendingDiagramQuizId,
        payloadStoragePath,
      });
      await enqueueGenerationJobTask({ userId, jobId });

      logger.info('Diagram quiz generation queued', {
        userId,
        jobId,
        diagramQuizId: pendingDiagramQuizId,
        directoryId: resolvedDirectoryId,
      });

      return {
        success: true,
        data: {
          diagramQuizId: pendingDiagramQuizId,
          diagramQuiz: {
            id: pendingDiagramQuizId,
            generationStatus: 'pending',
          } as DiagramQuiz,
        },
      };
    } catch (error) {
      console.error("Error in generateDiagramQuiz:", error);
      return {
        success: false,
        error: getGenerationFailureEnvelope(error),
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
