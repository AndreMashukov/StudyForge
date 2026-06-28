import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GeminiService } from "../services/gemini";
import { getGenerationFailureEnvelope } from "../services/llm/llm-endpoint-error";
import { LlmGenerationService, resolveTextGenerationAudit } from "../services/llm";
import { FirestoreService } from "../services/firestore";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import {
  isRuleResolutionMode,
  resolveEffectiveRules,
} from "../services/rule-resolution";
import {
  createPendingSubjectWorld,
  completePendingSubjectWorld,
  failPendingSubjectWorld,
} from "../services/artifact-generation-records";
import { normalizeSubjectWorldSpec } from "../services/subject-world-normalizer";
import { FirestorePaths } from "../lib/firestore-paths";
import { FieldValue } from "firebase-admin/firestore";
import {
  GenerateSubjectWorldResponse,
  GetSubjectWorldResponse,
  ApiResponse,
  SubjectWorld,
  SubjectWorldProgressSnapshot,
  RuleApplicability,
  getDocumentFallbackColor,
  SaveSubjectWorldProgressResponse,
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

export const generateSubjectWorld = onCall(
  {
    cors: true,
    secrets: [geminiApiKey, llmSettingsEncryptionKey],
    maxInstances: 5,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request): Promise<ApiResponse<GenerateSubjectWorldResponse>> => {
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
        throw new Error("Maximum 5 documents allowed per subject world");
      }

      const subjectWorldName = optionalTrimmedString(
        requestData.subjectWorldName,
        "subjectWorldName"
      );
      const additionalPrompt = optionalTrimmedString(
        requestData.additionalPrompt,
        "additionalPrompt"
      );
      const directoryIdFromRequest = optionalTrimmedString(
        requestData.directoryId,
        "directoryId"
      );

      const documentDataList = await Promise.all(
        documentIds.map(async (docId) => {
          const doc = await DocumentCrudService.getDocument(userId, docId);
          const content = await FirestoreService.getDocumentContent(userId, docId);
          return { doc, content };
        })
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

      GeminiService.validateContentForQuiz(documentContent);

      const pendingTitle = subjectWorldName
        || (documentIds.length === 1
          ? `Subject World: ${documentDataList[0].doc.title}`
          : `Subject World: ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`);

      const pendingSubjectWorldId = await createPendingSubjectWorld({
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
        let enhancedPrompt = additionalPrompt || "";
        let followupIdsForSave: string[] = [];

        const additionalRuleIds = Array.isArray(requestData.additionalRuleIds)
          ? (requestData.additionalRuleIds as string[])
          : undefined;
        const ruleIds = Array.isArray(requestData.ruleIds)
          ? (requestData.ruleIds as string[])
          : undefined;
        const followupRuleIds = Array.isArray(requestData.followupRuleIds)
          ? (requestData.followupRuleIds as string[])
          : undefined;
        const hasExplicitRules = Boolean(ruleIds?.length || followupRuleIds?.length);
        const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
          ? requestData.ruleResolutionMode
          : (hasExplicitRules ? 'explicit-only' : 'inherit-plus-explicit');

        const { text: worldRulesText, ruleIds: appliedRuleIdsForSave } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.SUBJECT_WORLD,
          additionalRuleIds: ruleIds?.length ? ruleIds : additionalRuleIds,
          mode,
        });
        if (worldRulesText) {
          enhancedPrompt = `${worldRulesText}\n\n${enhancedPrompt}`;
        }
        const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.FOLLOWUP,
          additionalRuleIds: hasExplicitRules ? (followupRuleIds || []) : additionalRuleIds,
          mode,
        });
        followupIdsForSave = resolvedFollowupIds;

        const rawSpec = await LlmGenerationService.generateSubjectWorld(
          userId,
          documentContent,
          documentIds,
          enhancedPrompt || undefined
        );

        const worldSpec = normalizeSubjectWorldSpec(
          rawSpec,
          documentIds,
          pendingTitle
        );

        const finalTitle = subjectWorldName || worldSpec.title || pendingTitle;

        const { generationModel, generationModelUsage } = await resolveTextGenerationAudit(userId, 'subjectWorld');

        await completePendingSubjectWorld(userId, pendingSubjectWorldId, {
          title: finalTitle,
          worldSpec,
          appliedRuleIds: appliedRuleIdsForSave,
          followupRuleIds: followupIdsForSave,
          generationModel,
          generationModelUsage,
        });

        return {
          success: true,
          data: {
            subjectWorldId: pendingSubjectWorldId,
            subjectWorld: { id: pendingSubjectWorldId } as SubjectWorld,
          },
        };

      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        await failPendingSubjectWorld(userId, pendingSubjectWorldId, msg).catch(() => {/* best-effort */});
        throw innerError;
      }
    } catch (error) {
      console.error("Error in generateSubjectWorld:", error);
      return {
        success: false,
        error: getGenerationFailureEnvelope(error),
      };
    }
  }
);

export const getSubjectWorld = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<GetSubjectWorldResponse>> => {
    try {
      const data = (request.data ?? {}) as Record<string, unknown>;
      const subjectWorldId = typeof data.subjectWorldId === "string" ? data.subjectWorldId : undefined;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }
      if (!subjectWorldId) {
        throw new Error("subjectWorldId is required");
      }

      const subjectWorld = await FirestoreService.getSubjectWorld(subjectWorldId, userId);
      if (!subjectWorld) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Subject world not found" },
        };
      }

      return {
        success: true,
        data: { subjectWorld },
      };
    } catch (error) {
      console.error("Error in getSubjectWorld:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch subject world",
        },
      };
    }
  }
);

export const getUserSubjectWorlds = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ subjectWorlds: SubjectWorld[] }>> => {
    try {
      const userId = request.auth?.uid;
      if (!userId) {
        return {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Authentication required" },
        };
      }

      const subjectWorlds = await FirestoreService.getUserSubjectWorlds(userId);
      return {
        success: true,
        data: { subjectWorlds },
      };
    } catch (error) {
      console.error("Error in getUserSubjectWorlds:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch subject worlds",
        },
      };
    }
  }
);

export const deleteSubjectWorld = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const data = (request.data ?? {}) as Record<string, unknown>;
      const subjectWorldId = typeof data.subjectWorldId === "string" ? data.subjectWorldId : undefined;
      const userId = request.auth?.uid;

      if (!userId) {
        throw new Error("Authentication required");
      }
      if (!subjectWorldId) {
        throw new Error("subjectWorldId is required");
      }

      await FirestoreService.deleteSubjectWorld(subjectWorldId, userId);
      return { success: true, data: { success: true } };
    } catch (error) {
      console.error("Error in deleteSubjectWorld:", error);
      return {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: error instanceof Error ? error.message : "Failed to delete subject world",
        },
      };
    }
  }
);

export const saveSubjectWorldProgress = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<SaveSubjectWorldProgressResponse>> => {
    try {
      const data = (request.data ?? {}) as Record<string, unknown>;
      const userId = request.auth?.uid;
      const subjectWorldId = typeof data.subjectWorldId === "string" ? data.subjectWorldId : undefined;
      const progress = data.progress as SubjectWorldProgressSnapshot | undefined;

      if (!userId) {
        throw new Error("Authentication required");
      }
      if (!subjectWorldId) {
        throw new Error("subjectWorldId is required");
      }
      if (!progress || typeof progress !== "object") {
        throw new Error("progress is required");
      }

      const world = await FirestoreService.getSubjectWorld(subjectWorldId, userId);
      if (!world) {
        throw new Error("Subject world not found");
      }

      await FirestorePaths.subjectWorldProgress(userId, subjectWorldId).doc(userId).set({
        userId,
        subjectWorldId,
        progress,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { success: true, data: { success: true } };
    } catch (error) {
      console.error("Error in saveSubjectWorldProgress:", error);
      return {
        success: false,
        error: {
          code: "SAVE_FAILED",
          message: error instanceof Error ? error.message : "Failed to save progress",
        },
      };
    }
  }
);

export const getSubjectWorldProgress = onCall(
  { cors: true },
  async (request): Promise<ApiResponse<{ progress: SubjectWorldProgressSnapshot | null }>> => {
    try {
      const data = (request.data ?? {}) as Record<string, unknown>;
      const userId = request.auth?.uid;
      const subjectWorldId = typeof data.subjectWorldId === "string" ? data.subjectWorldId : undefined;

      if (!userId) {
        throw new Error("Authentication required");
      }
      if (!subjectWorldId) {
        throw new Error("subjectWorldId is required");
      }

      const snap = await FirestorePaths.subjectWorldProgress(userId, subjectWorldId).doc(userId).get();
      if (!snap.exists) {
        return { success: true, data: { progress: null } };
      }

      const doc = snap.data() as { progress?: SubjectWorldProgressSnapshot };
      return { success: true, data: { progress: doc.progress ?? null } };
    } catch (error) {
      console.error("Error in getSubjectWorldProgress:", error);
      return {
        success: false,
        error: {
          code: "FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch progress",
        },
      };
    }
  }
);
