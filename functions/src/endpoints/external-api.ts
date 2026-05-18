import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { ExternalAuthResult, validateExternalAuthFromRequest } from "../lib/api-key-auth";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import { GeminiService } from "../services/gemini";
import { FirestoreService } from "../services/firestore";
import { ScreenshotDocumentGenerationService } from "../services/screenshot-document-generation";
import { enforceScreenshotGenerationRateLimit, RateLimitError } from "../services/api-rate-limit";
import {
  isRuleResolutionMode,
  resolveEffectiveRules,
  resolveRulesForDirectory,
} from "../services/rule-resolution";
import {
  createRule,
  getRule,
  getRules,
  updateRule,
} from "../services/rule-crud";
import { FirestorePaths } from "../lib/firestore-paths";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import {
  CreateDocumentRequest,
  CreateDirectoryRequest,
  CreateRuleRequest,
  DocumentSourceType,
  DocumentStatus,
  Flashcard,
  FlashcardSet,
  GenerateFromPromptRequest,
  GenerateFromScreenshotRequest,
  GenerateQuizRequest,
  RuleApplicability,
  Slide,
  SlideDeck,
  DiagramQuiz,
} from "@shared-types";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * External HTTP API authenticated via API keys (X-API-Key or Authorization: Bearer).
 *
 * Base URL (production):
 *   https://asia-east1-{project-id}.cloudfunctions.net/api
 *
 * Base URL (local emulator):
 *   http://127.0.0.1:5001/{project-id}/asia-east1/api
 *
 * Routes:
 *   POST /documents                        — Create a document
 *   POST /documents/generate-from-prompt   — Generate a document from an AI text prompt
 *   POST /documents/generate-from-screenshot — Generate a document from a screenshot
 *   POST /directories                      — Create a directory
 *   POST /quizzes/generate                 — Generate a quiz from document(s)
 */
export const api = onRequest(
  {
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 300,
    memory: "1GiB",
    maxInstances: 5,
    region: "asia-east1",
  },
  async (req, res) => {
    // --- Authentication ---
    let authResult: ExternalAuthResult;
    try {
      authResult = await validateExternalAuthFromRequest(req);
    } catch (err) {
      res.status(401).json({
        success: false,
        error: err instanceof Error ? err.message : "Unauthorized",
      });
      return;
    }

    const userId = authResult.userId;

    const method = req.method;
    const path = req.path; // e.g. "/documents", "/quizzes/generate"

    try {
      // POST /documents
      if (method === "POST" && path === "/documents") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const b = body as Record<string, unknown>;
        if (
          typeof b.title !== "string" ||
          typeof b.content !== "string" ||
          typeof b.directoryId !== "string" ||
          typeof b.sourceType !== "string"
        ) {
          res.status(400).json({
            success: false,
            error: "title, content, directoryId, and sourceType are required string fields.",
          });
          return;
        }
        const data = b as unknown as CreateDocumentRequest;

        const doc = await DocumentCrudService.createDocument(userId, data);
        res.status(201).json({ success: true, data: doc });
        return;
      }

      // POST /directories
      if (method === "POST" && path === "/directories") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const b = body as Record<string, unknown>;
        if (typeof b.name !== "string" || !b.name.trim()) {
          res.status(400).json({ success: false, error: "name is required." });
          return;
        }
        const data = b as unknown as CreateDirectoryRequest;

        const dir = await directoryService.createDirectory(userId, data);
        res.status(201).json({ success: true, data: dir });
        return;
      }

      // POST /quizzes/generate
      if (method === "POST" && path === "/quizzes/generate") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const requestData = body as GenerateQuizRequest;

        const documentIds = requestData.documentIds;
        if (
          !Array.isArray(documentIds) ||
          documentIds.length === 0 ||
          !documentIds.every((id) => typeof id === "string")
        ) {
          res.status(400).json({
            success: false,
            error: "documentIds must be a non-empty array of strings.",
          });
          return;
        }

        if (documentIds.length > 5) {
          res.status(400).json({
            success: false,
            error: "Maximum 5 documents allowed per quiz.",
          });
          return;
        }

        const { quizName, additionalPrompt, quizRuleIds, followupRuleIds } =
          requestData;

        // Fetch all documents and their content in parallel
        const documentDataList = await Promise.all(
          documentIds.map(async (docId) => {
            const doc = await DocumentCrudService.getDocument(userId, docId);
            const content = await FirestoreService.getDocumentContent(
              userId,
              docId
            );
            return { doc, content };
          })
        );

        const resolvedDirectoryId =
          requestData.directoryId ?? documentDataList[0]?.doc.directoryId;
        if (!resolvedDirectoryId) {
          res.status(400).json({
            success: false,
            error:
              "directoryId is required, or documents must belong to a directory.",
          });
          return;
        }

        await directoryService.validateDirectoryId(userId, resolvedDirectoryId);

        for (const { doc } of documentDataList) {
          if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
            res.status(400).json({
              success: false,
              error: "All selected documents must belong to the same directory.",
            });
            return;
          }
        }

        const combinedContent = documentDataList
          .map((d) => d.content)
          .join("\n\n---\n\n");
        const combinedTitle = documentDataList
          .map((d) => d.doc.title)
          .join(" + ");

        const documentContent = {
          title: combinedTitle,
          content: combinedContent,
          wordCount: combinedContent.split(/\s+/).length,
        };

        GeminiService.validateContentForQuiz(documentContent);

        let enhancedPrompt = additionalPrompt || "";
        let followupIdsForSave: string[] = [];
        let appliedRuleIdsForSave: string[] = [];
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

        const geminiQuiz = await GeminiService.generateQuiz(
          documentContent,
          enhancedPrompt
        );

        if (quizName?.trim()) {
          geminiQuiz.title = quizName.trim();
        } else if (documentIds.length === 1) {
          geminiQuiz.title = `Quiz from ${documentDataList[0].doc.title}`;
        } else {
          geminiQuiz.title = `Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
        }

        const savedQuiz = await FirestoreService.saveQuizFromDocument(
          documentIds[0],
          geminiQuiz,
          userId,
          resolvedDirectoryId,
          followupIdsForSave,
          documentIds.length > 1 ? documentIds : undefined,
          appliedRuleIdsForSave
        );

        res.status(201).json({
          success: true,
          data: { quizId: savedQuiz.id, quiz: savedQuiz },
        });
        return;
      }

      // POST /diagram-quizzes/generate
      if (method === "POST" && path === "/diagram-quizzes/generate") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const requestData = body as Record<string, unknown>;

        const documentIds = requestData.documentIds as string[];
        if (
          !Array.isArray(documentIds) ||
          documentIds.length === 0 ||
          !documentIds.every((id) => typeof id === "string")
        ) {
          res.status(400).json({ success: false, error: "documentIds must be a non-empty array of strings." });
          return;
        }
        if (documentIds.length > 5) {
          res.status(400).json({ success: false, error: "Maximum 5 documents allowed." });
          return;
        }

        const diagramQuizName = typeof requestData.diagramQuizName === "string" ? requestData.diagramQuizName.trim() : undefined;
        const additionalPrompt = typeof requestData.additionalPrompt === "string" ? requestData.additionalPrompt.trim() : undefined;
        const ruleIds = Array.isArray(requestData.ruleIds) ? requestData.ruleIds as string[] : undefined;
        const quizRuleIds = Array.isArray(requestData.quizRuleIds) ? requestData.quizRuleIds as string[] : undefined;
        const followupRuleIds = Array.isArray(requestData.followupRuleIds) ? requestData.followupRuleIds as string[] : undefined;
        const additionalRuleIds = Array.isArray(requestData.additionalRuleIds) ? requestData.additionalRuleIds as string[] : undefined;

        const documentDataList = await Promise.all(
          documentIds.map(async (docId) => {
            const doc = await DocumentCrudService.getDocument(userId, docId);
            const content = await FirestoreService.getDocumentContent(userId, docId);
            return { doc, content };
          })
        );

        const resolvedDirectoryId = (requestData.directoryId as string) ?? documentDataList[0]?.doc.directoryId;
        if (!resolvedDirectoryId) {
          res.status(400).json({ success: false, error: "directoryId is required, or documents must belong to a directory." });
          return;
        }
        await directoryService.validateDirectoryId(userId, resolvedDirectoryId);

        for (const { doc } of documentDataList) {
          if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
            res.status(400).json({ success: false, error: "All selected documents must belong to the same directory." });
            return;
          }
        }

        const combinedContent = documentDataList.map((d) => d.content).join("\n\n---\n\n");
        const combinedTitle = documentDataList.map((d) => d.doc.title).join(" + ");
        const documentContent = {
          title: combinedTitle,
          content: combinedContent,
          wordCount: combinedContent.split(/\s+/).length,
        };

        GeminiService.validateContentForQuiz(documentContent);

        let enhancedPrompt = additionalPrompt || "";
        let followupIdsForSave: string[] = [];
        let appliedRuleIdsForSave: string[] = [];
        const ruleResolutionMode = isRuleResolutionMode(requestData.ruleResolutionMode)
          ? requestData.ruleResolutionMode
          : undefined;
        const hasLegacyExplicitRules = Boolean(ruleIds?.length || quizRuleIds?.length || followupRuleIds?.length);
        const mode = ruleResolutionMode
          ?? (hasLegacyExplicitRules ? "explicit-only" : "inherit-plus-explicit");
        const selectedQuizRuleIds = ruleIds?.length
          ? ruleIds
          : quizRuleIds?.length
          ? quizRuleIds
          : additionalRuleIds;
        const selectedFollowupRuleIds = hasLegacyExplicitRules
          ? (followupRuleIds || [])
          : additionalRuleIds;

        const { text: quizRulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.DIAGRAM_QUIZ,
          additionalRuleIds: selectedQuizRuleIds,
          mode,
        });
        if (quizRulesText) enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
        appliedRuleIdsForSave = resolvedAppliedIds;
        const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.FOLLOWUP,
          additionalRuleIds: selectedFollowupRuleIds,
          mode,
        });
        followupIdsForSave = resolvedFollowupIds;

        const geminiQuiz = await GeminiService.generateDiagramQuiz(documentContent, enhancedPrompt);

        if (diagramQuizName) {
          geminiQuiz.title = diagramQuizName;
        } else if (documentIds.length === 1) {
          geminiQuiz.title = `Diagram Quiz from ${documentDataList[0].doc.title}`;
        } else {
          geminiQuiz.title = `Diagram Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
        }

        const saved = await FirestoreService.saveDiagramQuizFromDocument(
          documentIds[0], geminiQuiz, userId, resolvedDirectoryId,
          followupIdsForSave, documentIds.length > 1 ? documentIds : undefined, appliedRuleIdsForSave
        );

        res.status(201).json({ success: true, data: { diagramQuizId: saved.id, diagramQuiz: saved } });
        return;
      }

      // POST /sequence-quizzes/generate
      if (method === "POST" && path === "/sequence-quizzes/generate") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const requestData = body as Record<string, unknown>;

        const documentIds = requestData.documentIds as string[];
        if (
          !Array.isArray(documentIds) ||
          documentIds.length === 0 ||
          !documentIds.every((id) => typeof id === "string")
        ) {
          res.status(400).json({ success: false, error: "documentIds must be a non-empty array of strings." });
          return;
        }
        if (documentIds.length > 5) {
          res.status(400).json({ success: false, error: "Maximum 5 documents allowed." });
          return;
        }

        const sequenceQuizName = typeof requestData.sequenceQuizName === "string" ? requestData.sequenceQuizName.trim() : undefined;
        const additionalPrompt = typeof requestData.additionalPrompt === "string" ? requestData.additionalPrompt.trim() : undefined;
        const ruleIds = Array.isArray(requestData.ruleIds) ? requestData.ruleIds as string[] : undefined;
        const additionalRuleIds = Array.isArray(requestData.additionalRuleIds) ? requestData.additionalRuleIds as string[] : undefined;

        const documentDataList = await Promise.all(
          documentIds.map(async (docId) => {
            const doc = await DocumentCrudService.getDocument(userId, docId);
            const content = await FirestoreService.getDocumentContent(userId, docId);
            return { doc, content };
          })
        );

        const resolvedDirectoryId = (requestData.directoryId as string) ?? documentDataList[0]?.doc.directoryId;
        if (!resolvedDirectoryId) {
          res.status(400).json({ success: false, error: "directoryId is required, or documents must belong to a directory." });
          return;
        }
        await directoryService.validateDirectoryId(userId, resolvedDirectoryId);

        for (const { doc } of documentDataList) {
          if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
            res.status(400).json({ success: false, error: "All selected documents must belong to the same directory." });
            return;
          }
        }

        const combinedContent = documentDataList.map((d) => d.content).join("\n\n---\n\n");
        const combinedTitle = documentDataList.map((d) => d.doc.title).join(" + ");
        const documentContent = {
          title: combinedTitle,
          content: combinedContent,
          wordCount: combinedContent.split(/\s+/).length,
        };

        GeminiService.validateContentForQuiz(documentContent);

        let enhancedPrompt = additionalPrompt || "";
        let followupIdsForSave: string[] = [];
        const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
          ? requestData.ruleResolutionMode
          : (ruleIds?.length ? "explicit-only" : "inherit-plus-explicit");

        const { text: quizRulesText, ruleIds: appliedRuleIdsForSave } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.SEQUENCE_QUIZ,
          additionalRuleIds: ruleIds?.length ? ruleIds : additionalRuleIds,
          mode,
        });
        if (quizRulesText) enhancedPrompt = `${quizRulesText}\n\n${enhancedPrompt}`;
        const { ruleIds: resolvedFollowupIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.FOLLOWUP,
          additionalRuleIds: ruleIds?.length ? [] : additionalRuleIds,
          mode,
        });
        followupIdsForSave = resolvedFollowupIds;

        const geminiQuiz = await GeminiService.generateSequenceQuiz(
          documentContent, enhancedPrompt || undefined
        );

        if (sequenceQuizName) {
          geminiQuiz.title = sequenceQuizName;
        } else if (documentIds.length === 1) {
          geminiQuiz.title = `Sequence Quiz from ${documentDataList[0].doc.title}`;
        } else {
          geminiQuiz.title = `Sequence Quiz from ${documentDataList[0].doc.title} + ${documentIds.length - 1} more`;
        }

        const saved = await FirestoreService.saveSequenceQuizFromDocument(
          documentIds[0], geminiQuiz, userId, resolvedDirectoryId,
          followupIdsForSave, documentIds.length > 1 ? documentIds : undefined, appliedRuleIdsForSave
        );

        res.status(201).json({ success: true, data: { sequenceQuizId: saved.id, sequenceQuiz: saved } });
        return;
      }

      // POST /flashcard-sets/generate
      if (method === "POST" && path === "/flashcard-sets/generate") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const requestData = body as Record<string, unknown>;

        const documentIds = requestData.documentIds as string[];
        if (
          !Array.isArray(documentIds) ||
          documentIds.length === 0 ||
          !documentIds.every((id) => typeof id === "string")
        ) {
          res.status(400).json({ success: false, error: "documentIds must be a non-empty array of strings." });
          return;
        }
        if (documentIds.length > 5) {
          res.status(400).json({ success: false, error: "Maximum 5 documents allowed." });
          return;
        }

        const customTitle = typeof requestData.title === "string" ? requestData.title.trim() : undefined;
        const additionalPrompt = typeof requestData.additionalPrompt === "string" ? requestData.additionalPrompt.trim() : undefined;
        const ruleIds = Array.isArray(requestData.ruleIds) ? requestData.ruleIds as string[] : undefined;
        const additionalRuleIds = Array.isArray(requestData.additionalRuleIds) ? requestData.additionalRuleIds as string[] : undefined;

        const documentDataList = await Promise.all(
          documentIds.map(async (docId) => {
            const doc = await DocumentCrudService.getDocument(userId, docId);
            const content = await FirestoreService.getDocumentContent(userId, docId);
            return { doc, content };
          })
        );

        const combinedContent = documentDataList.map((d) => d.content).join("\n\n---\n\n");

        const resolvedDirectoryId = (requestData.directoryId as string) ?? documentDataList[0]?.doc.directoryId;
        if (!resolvedDirectoryId) {
          res.status(400).json({ success: false, error: "directoryId is required, or documents must belong to a directory." });
          return;
        }
        await directoryService.validateDirectoryId(userId, resolvedDirectoryId);
        for (const { doc } of documentDataList) {
          if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
            res.status(400).json({ success: false, error: "All selected documents must belong to the same directory." });
            return;
          }
        }

        let injectedRules: string | undefined;
        let appliedRuleIdsForSave: string[] = [];
        const explicitRuleIds = ruleIds?.length ? ruleIds : additionalRuleIds;
        const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
          ? requestData.ruleResolutionMode
          : (ruleIds?.length ? "explicit-only" : "inherit-plus-explicit");
        const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.FLASHCARD,
          additionalRuleIds: explicitRuleIds,
          mode,
        });
        appliedRuleIdsForSave = resolvedAppliedIds;
        const base = additionalPrompt || "";
        if (rulesText && base) {
          injectedRules = `${rulesText}\n\n${base}`;
        } else if (rulesText) {
          injectedRules = rulesText;
        } else if (base) {
          injectedRules = base;
        }

        const generatedFlashcards = await GeminiService.generateFlashcards(combinedContent, injectedRules);
        const flashcardsWithIds: Flashcard[] = generatedFlashcards.map((card) => ({
          ...card,
          id: admin.firestore().collection("tmp").doc().id,
        }));

        let title: string;
        if (customTitle) {
          title = customTitle;
        } else if (documentIds.length === 1) {
          title = `Flashcards for "${documentDataList[0].doc.title}"`;
        } else {
          title = `Flashcards for "${documentDataList[0].doc.title}" + ${documentIds.length - 1} more`;
        }

        const primaryDocumentId = documentIds[0];
        const newFlashcardSetData = {
          title,
          flashcards: flashcardsWithIds,
          userId,
          documentId: primaryDocumentId,
          directoryId: resolvedDirectoryId,
          ...(documentIds.length > 1 ? { documentIds } : {}),
          documentTitle: documentDataList[0].doc.title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          appliedRuleIds: appliedRuleIdsForSave,
        };

        const db = admin.firestore();
        const newRef = FirestorePaths.flashcardSets(userId).doc();
        await db.runTransaction(async (transaction) => {
          transaction.set(newRef, newFlashcardSetData);
          transaction.update(FirestorePaths.directory(userId, resolvedDirectoryId), {
            flashcardSetCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        res.status(201).json({ success: true, data: { flashcardSetId: newRef.id } });
        return;
      }

      // POST /slide-decks/generate
      if (method === "POST" && path === "/slide-decks/generate") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const requestData = body as Record<string, unknown>;

        const documentIds = requestData.documentIds as string[];
        if (
          !Array.isArray(documentIds) ||
          documentIds.length === 0 ||
          !documentIds.every((id) => typeof id === "string")
        ) {
          res.status(400).json({ success: false, error: "documentIds must be a non-empty array of strings." });
          return;
        }
        if (documentIds.length > 5) {
          res.status(400).json({ success: false, error: "Maximum 5 documents allowed." });
          return;
        }

        const customTitle = typeof requestData.title === "string" ? requestData.title.trim() : undefined;
        const additionalPrompt = typeof requestData.additionalPrompt === "string" ? requestData.additionalPrompt.trim() : undefined;
        const ruleIds = Array.isArray(requestData.ruleIds) ? requestData.ruleIds as string[] : undefined;
        const additionalRuleIds = Array.isArray(requestData.additionalRuleIds) ? requestData.additionalRuleIds as string[] : undefined;

        const documentDataList = await Promise.all(
          documentIds.map(async (docId) => {
            const doc = await DocumentCrudService.getDocument(userId, docId);
            const content = await FirestoreService.getDocumentContent(userId, docId);
            return { doc, content };
          })
        );

        const combinedContent = documentDataList.map((d) => d.content).join("\n\n---\n\n");

        const resolvedDirectoryId = (requestData.directoryId as string) ?? documentDataList[0]?.doc.directoryId;
        if (!resolvedDirectoryId) {
          res.status(400).json({ success: false, error: "directoryId is required, or documents must belong to a directory." });
          return;
        }
        await directoryService.validateDirectoryId(userId, resolvedDirectoryId);
        for (const { doc } of documentDataList) {
          if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
            res.status(400).json({ success: false, error: "All selected documents must belong to the same directory." });
            return;
          }
        }

        let injectedRules: string | undefined;
        let appliedRuleIdsForSave: string[] = [];
        const explicitRuleIds = ruleIds?.length ? ruleIds : additionalRuleIds;
        const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
          ? requestData.ruleResolutionMode
          : (ruleIds?.length ? "explicit-only" : "inherit-plus-explicit");
        const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.SLIDE_DECK,
          additionalRuleIds: explicitRuleIds,
          mode,
        });
        appliedRuleIdsForSave = resolvedAppliedIds;
        const base = additionalPrompt || "";
        if (rulesText && base) {
          injectedRules = `${rulesText}\n\n${base}`;
        } else if (rulesText) {
          injectedRules = rulesText;
        } else if (base) {
          injectedRules = base;
        }

        const slideOutline = await GeminiService.generateSlideDeckOutline(
          combinedContent, additionalPrompt || undefined, injectedRules
        );

        const CONCURRENCY = 3;
        const slides: Slide[] = slideOutline.map((outline) => ({
          id: admin.firestore().collection("tmp").doc().id,
          title: outline.title,
          content: outline.content,
          speakerNotes: outline.speakerNotes,
        }));

        const uploadedPaths: string[] = [];
        try {
          for (let batch = 0; batch < slides.length; batch += CONCURRENCY) {
            const chunk = slides.slice(batch, batch + CONCURRENCY);
            await Promise.all(chunk.map(async (slide, ci) => {
              const i = batch + ci;
              const brief = await GeminiService.generateSlideImageBrief(slide.title, slide.content, injectedRules);
              let imageBase64: string | null = null;
              if (brief) {
                const { SlideDeckPromptBuilder } = await import("../services/gemini/prompt-builder/slide-deck");
                const imagePrompt = SlideDeckPromptBuilder.buildSlideImageFromBriefPrompt(brief);
                imageBase64 = await GeminiService.generateSlideImageFromPrompt(imagePrompt);
              }
              if (!imageBase64) {
                imageBase64 = await GeminiService.generateSlideImage(slide.title, slide.content, injectedRules);
              }
              if (imageBase64) {
                const storagePath = `users/${userId}/slideDecks/${slide.id}/slide-${i}.png`;
                const downloadToken = randomUUID();
                const file = admin.storage().bucket().file(storagePath);
                await file.save(Buffer.from(imageBase64, "base64"), {
                  metadata: {
                    contentType: "image/png",
                    metadata: { firebaseStorageDownloadTokens: downloadToken },
                  },
                  resumable: false,
                });
                slide.imageStoragePath = storagePath;
                slide.imageDownloadToken = downloadToken;
                uploadedPaths.push(storagePath);
              }
            }));
          }
        } catch (genError) {
          if (uploadedPaths.length > 0) {
            const bucket = admin.storage().bucket();
            await Promise.allSettled(uploadedPaths.map((p) => bucket.file(p).delete().catch(() => { /* ignore cleanup errors */ })));
          }
          throw genError;
        }

        let deckTitle: string;
        if (customTitle) {
          deckTitle = customTitle;
        } else if (documentIds.length === 1) {
          deckTitle = `Slides for "${documentDataList[0].doc.title}"`;
        } else {
          deckTitle = `Slides for "${documentDataList[0].doc.title}" + ${documentIds.length - 1} more`;
        }

        const primaryDocumentId = documentIds[0];
        const newSlideDeckData = {
          title: deckTitle,
          slides,
          userId,
          documentId: primaryDocumentId,
          directoryId: resolvedDirectoryId,
          ...(documentIds.length > 1 ? { documentIds } : {}),
          documentTitle: documentDataList[0].doc.title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          appliedRuleIds: appliedRuleIdsForSave,
        };

        const db = admin.firestore();
        const newDeckRef = FirestorePaths.slideDecks(userId).doc();
        await db.runTransaction(async (transaction) => {
          transaction.set(newDeckRef, newSlideDeckData);
          transaction.update(FirestorePaths.directory(userId, resolvedDirectoryId), {
            slideDeckCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        res.status(201).json({ success: true, data: { slideDeckId: newDeckRef.id } });
        return;
      }

      // POST /slide-decks/generate-with-images
      // Same as /slide-decks/generate, but the caller supplies pre-generated
      // images (base64) instead of having Gemini render them. The images array
      // is positional: images[i] is bound to slides[i]. Image count MUST equal
      // the number of slides Gemini produces from the document(s); otherwise a
      // 400 is returned with both counts so the caller can retry.
      if (method === "POST" && path === "/slide-decks/generate-with-images") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const requestData = body as Record<string, unknown>;

        const documentIds = requestData.documentIds as string[];
        if (
          !Array.isArray(documentIds) ||
          documentIds.length === 0 ||
          !documentIds.every((id) => typeof id === "string")
        ) {
          res.status(400).json({ success: false, error: "documentIds must be a non-empty array of strings." });
          return;
        }
        if (documentIds.length > 5) {
          res.status(400).json({ success: false, error: "Maximum 5 documents allowed." });
          return;
        }

        const rawImages = requestData.images;
        if (!Array.isArray(rawImages) || rawImages.length === 0) {
          res.status(400).json({
            success: false,
            error: "images is required: a non-empty array of { data: string (base64), contentType?: string } in slide order.",
          });
          return;
        }
        const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
        const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB per image (decoded)
        const parsedImages: Array<{ buffer: Buffer; contentType: string; extension: string }> = [];
        for (let i = 0; i < rawImages.length; i++) {
          const item = rawImages[i];
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            res.status(400).json({ success: false, error: `images[${i}] must be an object.` });
            return;
          }
          const itemRecord = item as Record<string, unknown>;
          if (typeof itemRecord.data !== "string" || !itemRecord.data.trim()) {
            res.status(400).json({ success: false, error: `images[${i}].data must be a non-empty base64 string.` });
            return;
          }
          let dataField: string = itemRecord.data;
          let contentType = typeof itemRecord.contentType === "string" ? itemRecord.contentType.toLowerCase() : "image/png";
          // Allow data URLs (e.g. "data:image/png;base64,XXXX") and extract type + payload
          const dataUrlMatch = dataField.match(/^data:([^;,]+);base64,(.+)$/);
          if (dataUrlMatch) {
            contentType = dataUrlMatch[1].toLowerCase();
            dataField = dataUrlMatch[2];
          }          if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
            res.status(400).json({
              success: false,
              error: `images[${i}].contentType "${contentType}" is not allowed. Allowed: ${[...ALLOWED_IMAGE_TYPES].join(", ")}.`,
            });
            return;
          }
          let buffer: Buffer;
          try {
            buffer = Buffer.from(dataField, "base64");
          } catch {
            res.status(400).json({ success: false, error: `images[${i}].data is not valid base64.` });
            return;
          }
          if (buffer.length === 0) {
            res.status(400).json({ success: false, error: `images[${i}].data decoded to 0 bytes.` });
            return;
          }
          if (buffer.length > MAX_IMAGE_BYTES) {
            res.status(400).json({
              success: false,
              error: `images[${i}] is ${buffer.length} bytes, exceeds ${MAX_IMAGE_BYTES} byte limit.`,
            });
            return;
          }
          const extension = contentType.split("/")[1] || "png";
          parsedImages.push({ buffer, contentType, extension });
        }

        const customTitle = typeof requestData.title === "string" ? requestData.title.trim() : undefined;
        const additionalPrompt = typeof requestData.additionalPrompt === "string" ? requestData.additionalPrompt.trim() : undefined;
        const ruleIds = Array.isArray(requestData.ruleIds) ? requestData.ruleIds as string[] : undefined;
        const additionalRuleIds = Array.isArray(requestData.additionalRuleIds) ? requestData.additionalRuleIds as string[] : undefined;

        const documentDataList = await Promise.all(
          documentIds.map(async (docId) => {
            const doc = await DocumentCrudService.getDocument(userId, docId);
            const content = await FirestoreService.getDocumentContent(userId, docId);
            return { doc, content };
          })
        );

        const combinedContent = documentDataList.map((d) => d.content).join("\n\n---\n\n");

        const resolvedDirectoryId = (requestData.directoryId as string) ?? documentDataList[0]?.doc.directoryId;
        if (!resolvedDirectoryId) {
          res.status(400).json({ success: false, error: "directoryId is required, or documents must belong to a directory." });
          return;
        }
        await directoryService.validateDirectoryId(userId, resolvedDirectoryId);
        for (const { doc } of documentDataList) {
          if (!doc.directoryId || doc.directoryId !== resolvedDirectoryId) {
            res.status(400).json({ success: false, error: "All selected documents must belong to the same directory." });
            return;
          }
        }

        let injectedRules: string | undefined;
        let appliedRuleIdsForSave: string[] = [];
        const explicitRuleIds = ruleIds?.length ? ruleIds : additionalRuleIds;
        const mode = isRuleResolutionMode(requestData.ruleResolutionMode)
          ? requestData.ruleResolutionMode
          : (ruleIds?.length ? "explicit-only" : "inherit-plus-explicit");
        const { text: rulesText, ruleIds: resolvedAppliedIds } = await resolveEffectiveRules({
          userId,
          directoryId: resolvedDirectoryId,
          operation: RuleApplicability.SLIDE_DECK,
          additionalRuleIds: explicitRuleIds,
          mode,
        });
        appliedRuleIdsForSave = resolvedAppliedIds;
        const base = additionalPrompt || "";
        if (rulesText && base) {
          injectedRules = `${rulesText}\n\n${base}`;
        } else if (rulesText) {
          injectedRules = rulesText;
        } else if (base) {
          injectedRules = base;
        }

        const slideOutline = await GeminiService.generateSlideDeckOutline(
          combinedContent, additionalPrompt || undefined, injectedRules
        );

        if (slideOutline.length !== parsedImages.length) {
          res.status(400).json({
            success: false,
            error: "Image count does not match generated slide count. Resubmit with the correct number of images.",
            data: {
              expectedImageCount: slideOutline.length,
              providedImageCount: parsedImages.length,
            },
          });
          return;
        }

        const slides: Slide[] = slideOutline.map((outline) => ({
          id: admin.firestore().collection("tmp").doc().id,
          title: outline.title,
          content: outline.content,
          speakerNotes: outline.speakerNotes,
        }));

        const uploadedPaths: string[] = [];
        try {
          await Promise.all(slides.map(async (slide, i) => {
            const img = parsedImages[i];
            const storagePath = `users/${userId}/slideDecks/${slide.id}/slide-${i}.${img.extension}`;
            const downloadToken = randomUUID();
            const file = admin.storage().bucket().file(storagePath);
            await file.save(img.buffer, {
              metadata: {
                contentType: img.contentType,
                metadata: { firebaseStorageDownloadTokens: downloadToken },
              },
              resumable: false,
            });
            slide.imageStoragePath = storagePath;
            slide.imageDownloadToken = downloadToken;
            uploadedPaths.push(storagePath);
          }));
        } catch (uploadError) {
          if (uploadedPaths.length > 0) {
            const bucket = admin.storage().bucket();
            await Promise.allSettled(uploadedPaths.map((p) => bucket.file(p).delete().catch(() => { /* ignore cleanup errors */ })));
          }
          throw uploadError;
        }

        let deckTitle: string;
        if (customTitle) {
          deckTitle = customTitle;
        } else if (documentIds.length === 1) {
          deckTitle = `Slides for "${documentDataList[0].doc.title}"`;
        } else {
          deckTitle = `Slides for "${documentDataList[0].doc.title}" + ${documentIds.length - 1} more`;
        }

        const primaryDocumentId = documentIds[0];
        const newSlideDeckData = {
          title: deckTitle,
          slides,
          userId,
          documentId: primaryDocumentId,
          directoryId: resolvedDirectoryId,
          ...(documentIds.length > 1 ? { documentIds } : {}),
          documentTitle: documentDataList[0].doc.title,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          appliedRuleIds: appliedRuleIdsForSave,
        };

        const db = admin.firestore();
        const newDeckRef = FirestorePaths.slideDecks(userId).doc();
        await db.runTransaction(async (transaction) => {
          transaction.set(newDeckRef, newSlideDeckData);
          transaction.update(FirestorePaths.directory(userId, resolvedDirectoryId), {
            slideDeckCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });

        res.status(201).json({ success: true, data: { slideDeckId: newDeckRef.id } });
        return;
      }

      // POST /documents/generate-from-prompt
      if (method === "POST" && path === "/documents/generate-from-prompt") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const data = body as GenerateFromPromptRequest;

        if (!data.prompt || typeof data.prompt !== "string") {
          res.status(400).json({ success: false, error: "prompt is required and must be a string." });
          return;
        }

        const trimmedPrompt = data.prompt.trim();

        if (trimmedPrompt.length === 0) {
          res.status(400).json({ success: false, error: "prompt cannot be empty." });
          return;
        }

        if (trimmedPrompt.length < 10) {
          res.status(400).json({ success: false, error: "prompt must be at least 10 characters long." });
          return;
        }

        if (typeof data.directoryId !== "string" || !data.directoryId.trim()) {
          res.status(400).json({ success: false, error: "directoryId is required." });
          return;
        }

        if (data.files) {
          if (!Array.isArray(data.files)) {
            res.status(400).json({ success: false, error: "files must be an array." });
            return;
          }
          if (data.files.length > 5) {
            res.status(400).json({ success: false, error: "Cannot attach more than 5 files." });
            return;
          }
          for (let i = 0; i < data.files.length; i++) {
            const file = data.files[i];
            if (!file.filename || !file.content || typeof file.size !== "number" || !file.type) {
              res.status(400).json({ success: false, error: `Invalid file structure at index ${i} for file: ${file.filename || "unknown"}.` });
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              res.status(400).json({ success: false, error: `File "${file.filename}" exceeds 5MB size limit.` });
              return;
            }
            if (file.content.trim().length === 0) {
              res.status(400).json({ success: false, error: `File "${file.filename}" is empty.` });
              return;
            }
            if (!["text/plain", "text/markdown"].includes(file.type)) {
              res.status(400).json({ success: false, error: `File "${file.filename}" has unsupported type: ${file.type}. Only text/plain and text/markdown are allowed.` });
              return;
            }
          }
        }

        await directoryService.validateDirectoryId(userId, data.directoryId);

        let rulesText: string | undefined;
        if (data.ruleIds && data.ruleIds.length > 0) {
          const mode = isRuleResolutionMode(
            (data as unknown as { ruleResolutionMode?: unknown }).ruleResolutionMode
          )
            ? (data as unknown as { ruleResolutionMode: 'inherit' | 'inherit-plus-explicit' | 'explicit-only' }).ruleResolutionMode
            : 'explicit-only';
          const resolvedRules = await resolveEffectiveRules({
            userId,
            directoryId: data.directoryId,
            operation: RuleApplicability.PROMPT,
            additionalRuleIds: data.ruleIds,
            mode,
          });
          rulesText = resolvedRules.text || undefined;
        }

        const generatedContent = await GeminiService.generateDocumentFromPrompt(
          trimmedPrompt,
          data.files,
          rulesText
        );

        let title = "Generated Document";
        const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        } else {
          title = trimmedPrompt.length > 50
            ? `${trimmedPrompt.substring(0, 50)}...`
            : trimmedPrompt;
        }

        const wordCount = generatedContent.split(/\s+/).length;

        const document = await DocumentCrudService.createDocument(userId, {
          title,
          description: `Generated from prompt: ${trimmedPrompt.substring(0, 100)}${trimmedPrompt.length > 100 ? "..." : ""}`,
          content: generatedContent,
          sourceType: DocumentSourceType.GENERATED,
          status: DocumentStatus.ACTIVE,
          tags: ["ai-generated", "prompt-based"],
          directoryId: data.directoryId,
        });

        res.status(201).json({
          success: true,
          data: {
            documentId: document.id,
            title: document.title,
            content: generatedContent,
            wordCount,
            metadata: {
              originalPrompt: trimmedPrompt,
              generatedAt: new Date().toISOString(),
              filesUsed: data.files?.length || 0,
            },
          },
        });
        return;
      }

      // POST /documents/generate-from-screenshot
      if (method === "POST" && path === "/documents/generate-from-screenshot") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const data = body as GenerateFromScreenshotRequest;

        if (!data.imageBase64 || typeof data.imageBase64 !== "string") {
          res.status(400).json({ success: false, error: "imageBase64 is required and must be a string." });
          return;
        }

        if (typeof data.directoryId !== "string" || !data.directoryId.trim()) {
          res.status(400).json({ success: false, error: "directoryId is required." });
          return;
        }

        if (data.prompt !== undefined && typeof data.prompt !== "string") {
          res.status(400).json({ success: false, error: "prompt must be a string when provided." });
          return;
        }

        if (data.title !== undefined && typeof data.title !== "string") {
          res.status(400).json({ success: false, error: "title must be a string when provided." });
          return;
        }

        if (data.ruleIds !== undefined && !Array.isArray(data.ruleIds)) {
          res.status(400).json({ success: false, error: "ruleIds must be an array when provided." });
          return;
        }

        await enforceScreenshotGenerationRateLimit({
          userId,
          limiterKey: authResult.limiterKey,
        });

        const result = await ScreenshotDocumentGenerationService.generate({
          ...data,
          userId,
        });

        res.status(201).json({
          success: true,
          data: result,
        });
        return;
      }

      // ==================== READ ENDPOINTS ====================

      // GET /documents — List documents (with optional filters)
      if (method === "GET" && path === "/documents") {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const offset = parseInt(req.query.offset as string) || 0;
        const directoryId = req.query.directoryId as string | undefined;
        const sourceType = req.query.sourceType as string | undefined;
        const status = req.query.status as string | undefined;
        const sortBy = (req.query.sortBy as string) || "createdAt";
        const sortOrder = (req.query.sortOrder as string) || "desc";

        const result = await DocumentCrudService.listDocuments(userId, {
          limit,
          offset,
          directoryId: directoryId || undefined,
          sourceType: sourceType as DocumentSourceType | undefined,
          status: status as DocumentStatus | undefined,
          sortBy: sortBy as "createdAt" | "updatedAt" | "title",
          sortOrder: sortOrder as "asc" | "desc",
        });

        res.status(200).json({ success: true, data: result });
        return;
      }

      // GET /documents/:id — Get a single document (metadata)
      if (method === "GET" && path.match(/^\/documents\/[^/]+$/)) {
        const documentId = path.split("/")[2];
        const doc = await DocumentCrudService.getDocument(userId, documentId);
        res.status(200).json({ success: true, data: doc });
        return;
      }

      // GET /documents/:id/content — Get document content
      if (method === "GET" && path.match(/^\/documents\/[^/]+\/content$/)) {
        const documentId = path.split("/")[2];
        const content = await FirestoreService.getDocumentContent(userId, documentId);
        res.status(200).json({ success: true, data: { documentId, content } });
        return;
      }

      // GET /directories — List directories (tree or flat)
      if (method === "GET" && path === "/directories") {
        const tree = req.query.tree === "true";
        if (tree) {
          const directoryTree = await directoryService.getDirectoryTree(userId);
          res.status(200).json({ success: true, data: directoryTree });
        } else {
          const parentId = req.query.parentId as string | undefined;
          const contents = await directoryService.getDirectoryContents(
            userId,
            parentId || null
          );
          res.status(200).json({ success: true, data: contents });
        }
        return;
      }

      // GET /directories/:id — Get a single directory
      if (method === "GET" && path.match(/^\/directories\/[^/]+$/)) {
        const directoryId = path.split("/")[2];
        const dir = await directoryService.getDirectory(userId, directoryId);
        if (!dir) {
          res.status(404).json({ success: false, error: "Directory not found." });
          return;
        }
        res.status(200).json({ success: true, data: dir });
        return;
      }

      // GET /directories/:id/contents — Get directory contents (artifacts)
      if (method === "GET" && path.match(/^\/directories\/[^/]+\/contents$/)) {
        const directoryId = path.split("/")[2];
        const contents = await directoryService.getDirectoryContents(userId, directoryId);
        res.status(200).json({ success: true, data: contents });
        return;
      }

      // GET /directories/:id/rules — Get resolved rules for a directory (direct + inherited)
      if (method === "GET" && path.match(/^\/directories\/[^/]+\/rules$/)) {
        const directoryId = path.split("/")[2];
        const dir = await directoryService.getDirectory(userId, directoryId);
        if (!dir) {
          res.status(404).json({ success: false, error: "Directory not found." });
          return;
        }
        const resolved = await resolveRulesForDirectory(userId, directoryId);
        res.status(200).json({ success: true, data: resolved });
        return;
      }

      // POST /rules — Create a rule
      if (method === "POST" && path === "/rules") {
        const body: unknown = req.body;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          res.status(400).json({ success: false, error: "Request body must be a JSON object." });
          return;
        }
        const b = body as Record<string, unknown>;
        if (
          typeof b.name !== "string" || !b.name.trim() ||
          typeof b.content !== "string" || !b.content.trim() ||
          !Array.isArray(b.applicableTo) || b.applicableTo.length === 0 ||
          typeof b.color !== "string"
        ) {
          res.status(400).json({
            success: false,
            error: "name, content, color, and applicableTo (non-empty array) are required.",
          });
          return;
        }
        const data = b as unknown as CreateRuleRequest;
        const rule = await createRule(userId, data);
        res.status(201).json({ success: true, data: rule });
        return;
      }

      // GET /rules — List rules (with optional type filter)
      // Query params: ?applicableTo=quiz,prompt  (comma-separated RuleApplicability values)
      if (method === "GET" && path === "/rules") {
        const applicableToParam = req.query.applicableTo as string | undefined;
        let rules = await getRules(userId);

        if (applicableToParam) {
          const requestedTypes = applicableToParam.split(",").map((t) => t.trim());
          rules = rules.filter((rule) =>
            rule.applicableTo.some((a) => requestedTypes.includes(a))
          );
        }

        res.status(200).json({ success: true, data: rules });
        return;
      }

      // GET /rules/:id — Get a single rule
      if (method === "GET" && path.match(/^\/rules\/[^/]+$/)) {
        const ruleId = path.split("/")[2];
        const rule = await getRule(userId, ruleId);
        if (!rule) {
          res.status(404).json({ success: false, error: "Rule not found." });
          return;
        }
        res.status(200).json({ success: true, data: rule });
        return;
      }

      // PUT /rules/:id — Update a rule
      if (method === "PUT" && path.match(/^\/rules\/[^/]+$/)) {
        const ruleId = path.split("/")[2];
        const body = req.body as Record<string, unknown>;
        const rule = await updateRule(userId, { ruleId, ...body });
        res.status(200).json({ success: true, data: rule });
        return;
      }

      // GET /quizzes — List quizzes
      if (method === "GET" && path === "/quizzes") {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const directoryId = req.query.directoryId as string | undefined;

        let query = FirestorePaths.quizzes(userId)
          .orderBy("createdAt", "desc")
          .limit(limit);
        if (directoryId) {
          query = FirestorePaths.quizzes(userId)
            .where("directoryId", "==", directoryId)
            .orderBy("createdAt", "desc")
            .limit(limit);
        }

        const snapshot = await query.get();
        const quizzes = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        res.status(200).json({ success: true, data: quizzes });
        return;
      }

      // GET /quizzes/:id — Get a single quiz
      if (method === "GET" && path.match(/^\/quizzes\/[^/]+$/)) {
        const quizId = path.split("/")[2];
        const quiz = await FirestoreService.getQuiz(quizId, userId);
        if (!quiz) {
          res.status(404).json({ success: false, error: "Quiz not found." });
          return;
        }
        res.status(200).json({ success: true, data: quiz });
        return;
      }

      // GET /flashcard-sets — List flashcard sets
      if (method === "GET" && path === "/flashcard-sets") {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const directoryId = req.query.directoryId as string | undefined;

        let query = FirestorePaths.flashcardSets(userId)
          .orderBy("createdAt", "desc")
          .limit(limit);
        if (directoryId) {
          query = FirestorePaths.flashcardSets(userId)
            .where("directoryId", "==", directoryId)
            .orderBy("createdAt", "desc")
            .limit(limit);
        }

        const snapshot = await query.get();
        const flashcardSets = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        } as FlashcardSet));

        res.status(200).json({ success: true, data: flashcardSets });
        return;
      }

      // GET /flashcard-sets/:id — Get a single flashcard set
      if (method === "GET" && path.match(/^\/flashcard-sets\/[^/]+$/)) {
        const flashcardSetId = path.split("/")[2];
        const doc = await FirestorePaths.flashcardSet(userId, flashcardSetId).get();
        if (!doc.exists) {
          res.status(404).json({ success: false, error: "Flashcard set not found." });
          return;
        }
        const flashcardSet = { ...doc.data(), id: doc.id } as FlashcardSet;
        res.status(200).json({ success: true, data: flashcardSet });
        return;
      }

      // GET /slide-decks — List slide decks
      if (method === "GET" && path === "/slide-decks") {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const directoryId = req.query.directoryId as string | undefined;

        let query = FirestorePaths.slideDecks(userId)
          .orderBy("createdAt", "desc")
          .limit(limit);
        if (directoryId) {
          query = FirestorePaths.slideDecks(userId)
            .where("directoryId", "==", directoryId)
            .orderBy("createdAt", "desc")
            .limit(limit);
        }

        const snapshot = await query.get();
        const slideDecks = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        } as SlideDeck));

        res.status(200).json({ success: true, data: slideDecks });
        return;
      }

      // GET /slide-decks/:id — Get a single slide deck
      if (method === "GET" && path.match(/^\/slide-decks\/[^/]+$/)) {
        const slideDeckId = path.split("/")[2];
        const doc = await FirestorePaths.slideDeck(userId, slideDeckId).get();
        if (!doc.exists) {
          res.status(404).json({ success: false, error: "Slide deck not found." });
          return;
        }
        const slideDeck = { ...doc.data(), id: doc.id } as SlideDeck;

        // Resolve storage paths to download URLs
        if (slideDeck.slides) {
          const bucket = admin.storage().bucket();
          const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
          for (const slide of slideDeck.slides) {
            if (slide.imageStoragePath) {
              try {
                const encodedPath = encodeURIComponent(slide.imageStoragePath);
                if (emulatorHost) {
                  const token = slide.imageDownloadToken ? `&token=${slide.imageDownloadToken}` : "";
                  slide.imageUrl = `http://${emulatorHost}/v0/b/${bucket.name}/o/${encodedPath}?alt=media${token}`;
                } else if (slide.imageDownloadToken) {
                  slide.imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${slide.imageDownloadToken}`;
                }
              } catch {
                // Skip URL resolution on failure
              }
            }
          }
        }

        res.status(200).json({ success: true, data: slideDeck });
        return;
      }

      // GET /diagram-quizzes — List diagram quizzes
      if (method === "GET" && path === "/diagram-quizzes") {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const directoryId = req.query.directoryId as string | undefined;

        let query = FirestorePaths.diagramQuizzes(userId)
          .orderBy("createdAt", "desc")
          .limit(limit);
        if (directoryId) {
          query = FirestorePaths.diagramQuizzes(userId)
            .where("directoryId", "==", directoryId)
            .orderBy("createdAt", "desc")
            .limit(limit);
        }

        const snapshot = await query.get();
        const diagramQuizzes = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        } as DiagramQuiz));

        res.status(200).json({ success: true, data: diagramQuizzes });
        return;
      }

      // GET /diagram-quizzes/:id — Get a single diagram quiz
      if (method === "GET" && path.match(/^\/diagram-quizzes\/[^/]+$/)) {
        const diagramQuizId = path.split("/")[2];
        const doc = await FirestorePaths.diagramQuiz(userId, diagramQuizId).get();
        if (!doc.exists) {
          res.status(404).json({ success: false, error: "Diagram quiz not found." });
          return;
        }
        const diagramQuiz = { ...doc.data(), id: doc.id } as DiagramQuiz;
        res.status(200).json({ success: true, data: diagramQuiz });
        return;
      }

      // PUT /diagram-quizzes/:id — Update a diagram quiz (title, questions)
      if (method === "PUT" && path.match(/^\/diagram-quizzes\/[^/]+$/)) {
        const diagramQuizId = path.split("/")[2];
        const docRef = FirestorePaths.diagramQuiz(userId, diagramQuizId);
        const existing = await docRef.get();
        if (!existing.exists) {
          res.status(404).json({ success: false, error: "Diagram quiz not found." });
          return;
        }
        const body = req.body as Record<string, unknown>;
        const allowed: Record<string, unknown> = {};
        if (typeof body.title === "string") allowed.title = body.title.trim();
        if (Array.isArray(body.questions)) allowed.questions = body.questions;
        allowed.updatedAt = new Date().toISOString();
        await docRef.update(allowed);
        const updated = await docRef.get();
        res.status(200).json({ success: true, data: { ...updated.data(), id: diagramQuizId } });
        return;
      }

      // GET /sequence-quizzes — List sequence quizzes
      if (method === "GET" && path === "/sequence-quizzes") {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const directoryId = req.query.directoryId as string | undefined;

        let query = FirestorePaths.sequenceQuizzes(userId)
          .orderBy("createdAt", "desc")
          .limit(limit);
        if (directoryId) {
          query = FirestorePaths.sequenceQuizzes(userId)
            .where("directoryId", "==", directoryId)
            .orderBy("createdAt", "desc")
            .limit(limit);
        }

        const snapshot = await query.get();
        const sequenceQuizzes = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        res.status(200).json({ success: true, data: sequenceQuizzes });
        return;
      }

      // GET /sequence-quizzes/:id — Get a single sequence quiz
      if (method === "GET" && path.match(/^\/sequence-quizzes\/[^/]+$/)) {
        const sequenceQuizId = path.split("/")[2];
        const doc = await FirestorePaths.sequenceQuiz(userId, sequenceQuizId).get();
        if (!doc.exists) {
          res.status(404).json({ success: false, error: "Sequence quiz not found." });
          return;
        }
        const sequenceQuiz = { ...doc.data(), id: doc.id };
        res.status(200).json({ success: true, data: sequenceQuiz });
        return;
      }

      // 404 — route not found
      res.status(404).json({
        success: false,
        error: `Route ${method} ${path} not found.`,
        availableRoutes: [
          // Create
          "POST /documents",
          "POST /documents/generate-from-prompt",
          "POST /documents/generate-from-screenshot",
          "POST /directories",
          "POST /rules",
          "POST /quizzes/generate",
          "POST /diagram-quizzes/generate",
          "POST /sequence-quizzes/generate",
          "POST /flashcard-sets/generate",
          "POST /slide-decks/generate",
          "POST /slide-decks/generate-with-images",
          // Read — Documents
          "GET /documents",
          "GET /documents/:id",
          "GET /documents/:id/content",
          // Read — Directories
          "GET /directories",
          "GET /directories/:id",
          "GET /directories/:id/contents",
          "GET /directories/:id/rules",
          // Read — Rules (filterable by ?applicableTo=quiz,prompt,...)",
          "GET /rules",
          "GET /rules/:id",
          "PUT /rules/:id",
          // Read — Quizzes
          "GET /quizzes",
          "GET /quizzes/:id",
          // Read — Flashcard Sets
          "GET /flashcard-sets",
          "GET /flashcard-sets/:id",
          // Read — Slide Decks
          "GET /slide-decks",
          "GET /slide-decks/:id",
          // Read — Diagram Quizzes
          "GET /diagram-quizzes",
          "GET /diagram-quizzes/:id",
          // Read — Sequence Quizzes
          "GET /sequence-quizzes",
          "GET /sequence-quizzes/:id",
        ],
      });
    } catch (err) {
      if (err instanceof RateLimitError) {
        res.set("Retry-After", String(err.retryAfterSeconds));
        res.status(429).json({
          success: false,
          error: err.message,
          retryAfterSeconds: err.retryAfterSeconds,
        });
        return;
      }

      console.error(`External API error [${method} ${path}]:`, err);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);
