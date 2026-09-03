import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { validateContentForArtifactGeneration } from '@study-forge/backend-llm/llm';
import { getGenerationFailureEnvelope } from '@study-forge/backend-llm/llm/llm-endpoint-error';
import { mapErrorToArtifactEnvelope } from '@study-forge/backend-core/lib/callable-error';
import {
  enforceCallableGenerationLimits,
  refundUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { FirestoreService } from '@study-forge/backend-artifacts/firestore';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  createPendingMatchQuiz,
  failPendingMatchQuiz,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import { buildStartGenerationPayload } from '@study-forge/backend-core/lib/start-generation-response';
import {
  GenerateMatchQuizResponse,
  GetMatchQuizResponse,
  ApiResponse,
  MatchQuiz,
  getDocumentFallbackColor,
} from "@shared-types";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const llmSettingsEncryptionKey = defineSecret("LLM_SETTINGS_ENCRYPTION_KEY");

function optionalTrimmedString(
  value: unknown,
  fieldName: string
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const generateMatchQuiz = onCall(
  {
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request): Promise<ApiResponse<GenerateMatchQuizResponse>> => {
    let usageReservationId: string | undefined;
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
        throw new Error("Maximum 5 documents allowed per match quiz");
      }

      if (requestData.additionalRuleIds != null && !Array.isArray(requestData.additionalRuleIds)) {
        throw new Error("additionalRuleIds must be an array when provided");
      }
      if (requestData.followupRuleIds != null && !Array.isArray(requestData.followupRuleIds)) {
        throw new Error("followupRuleIds must be an array when provided");
      }
      if (
        Array.isArray(requestData.additionalRuleIds) &&
        !requestData.additionalRuleIds.every((id): id is string => typeof id === "string")
      ) {
        throw new Error("Each additionalRuleId must be a string");
      }
      if (
        Array.isArray(requestData.followupRuleIds) &&
        !requestData.followupRuleIds.every((id): id is string => typeof id === "string")
      ) {
        throw new Error("Each followupRuleId must be a string");
      }

      const matchQuizName = optionalTrimmedString(
        requestData.matchQuizName,
        "matchQuizName"
      );
      const additionalPrompt = optionalTrimmedString(
        requestData.additionalPrompt,
        "additionalPrompt"
      );
      const directoryIdFromRequest = optionalTrimmedString(
        requestData.directoryId,
        "directoryId"
      );

      const documentDataList = await DocumentCrudService.loadDocumentsWithContentForGeneration(
        userId,
        documentIds,
      );

      const resolvedDirectoryId =
        directoryIdFromRequest ?? documentDataList[0]?.doc.directoryId;
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

      validateContentForArtifactGeneration(documentContent);

      const usageReservation = await enforceCallableGenerationLimits(userId, 'matchQuiz');
      usageReservationId = usageReservation.id;

      const pendingTitle = matchQuizName
        || (documentIds.length === 1
          ? `Match Quiz from ${documentDataList[0].doc.title}`
          : `Match Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

      const pendingMatchQuizId = await createPendingMatchQuiz({
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
          recordId: pendingMatchQuizId,
          kind: 'matchQuiz',
          payload: {
            documentIds,
            matchQuizName,
            additionalPrompt,
            ruleIds: Array.isArray(requestData.ruleIds) ? requestData.ruleIds : undefined,
            followupRuleIds: Array.isArray(requestData.followupRuleIds) ? requestData.followupRuleIds : undefined,
            additionalRuleIds: Array.isArray(requestData.additionalRuleIds) ? requestData.additionalRuleIds : undefined,
            ruleResolutionMode: requestData.ruleResolutionMode,
          },
          usageReservationId,
        });

        return {
          success: true,
          data: {
            ...buildStartGenerationPayload('matchQuiz', pendingMatchQuizId, resolvedDirectoryId, {
              matchQuizId: pendingMatchQuizId,
            }),
            matchQuiz: { id: pendingMatchQuizId, generationStatus: 'pending' } as MatchQuiz,
          },
        };
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await failPendingMatchQuiz(userId, pendingMatchQuizId, msg).catch(() => {/* best-effort */});
        await refundUsageReservationSafe(userId, usageReservationId);
        throw innerError;
      }
    } catch (error) {
      console.error("Error in generateMatchQuiz:", error);
      if (usageReservationId && request.auth?.uid) {
        await refundUsageReservationSafe(request.auth.uid, usageReservationId);
      }
      return {
        success: false,
        error: getGenerationFailureEnvelope(error),
      };
    }
  }
);

export const getMatchQuiz = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<GetMatchQuizResponse>> => {
    try {
      const data = (request.data ?? {}) as Record<string, unknown>;
      const matchQuizId = typeof data.matchQuizId === "string" ? data.matchQuizId : undefined;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }
      if (!matchQuizId) {
        throw new Error("matchQuizId is required");
      }

      const matchQuiz = await FirestoreService.getMatchQuiz(matchQuizId, userId);
      if (!matchQuiz) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Match quiz not found" },
        };
      }

      return {
        success: true,
        data: { matchQuiz },
      };
    } catch (error) {
      console.error("Error in getMatchQuiz:", error);
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'FETCH_FAILED'),
      };
    }
  }
);

export const getUserMatchQuizzes = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ matchQuizzes: MatchQuiz[] }>> => {
    try {
      const userId = request.auth?.uid;
      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }

      const matchQuizzes = await FirestoreService.getUserMatchQuizzes(userId);
      return {
        success: true,
        data: { matchQuizzes },
      };
    } catch (error) {
      console.error("Error in getUserMatchQuizzes:", error);
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'FETCH_FAILED'),
      };
    }
  }
);

export const deleteMatchQuiz = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const userId = request.auth?.uid;
      const deleteData = (request.data ?? {}) as Record<string, unknown>;
      const matchQuizId = typeof deleteData.matchQuizId === "string" ? deleteData.matchQuizId : undefined;

      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }
      if (!matchQuizId) {
        return {
          success: false,
          error: { code: "MISSING_PARAMETER", message: "matchQuizId is required" },
        };
      }

      await FirestoreService.deleteMatchQuiz(matchQuizId, userId);
      return {
        success: true,
        data: { success: true },
      };
    } catch (error) {
      console.error("Error in deleteMatchQuiz:", error);
      return {
        success: false,
        error: mapErrorToArtifactEnvelope(error, 'DELETE_FAILED'),
      };
    }
  }
);