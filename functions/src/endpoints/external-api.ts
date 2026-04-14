import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { validateApiKeyFromRequest } from "../lib/api-key-auth";
import { DocumentCrudService } from "../services/document-crud";
import { directoryService } from "../services/directory";
import { GeminiService } from "../services/gemini";
import { FirestoreService } from "../services/firestore";
import { promptBuilder } from "../services/promptBuilder";
import {
  resolveGenerationRulesForPrompt,
  resolveRulesForDirectory,
} from "../services/rule-resolution";
import {
  createRule,
  getRule,
  getRules,
} from "../services/rule-crud";
import { FirestorePaths } from "../lib/firestore-paths";
import {
  CreateDocumentRequest,
  CreateDirectoryRequest,
  CreateRuleRequest,
  DocumentSourceType,
  DocumentStatus,
  GenerateQuizRequest,
  RuleApplicability,
  FlashcardSet,
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
 *   POST /documents           — Create a document
 *   POST /directories         — Create a directory
 *   POST /quizzes/generate    — Generate a quiz from document(s)
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
    let userId: string;
    try {
      userId = await validateApiKeyFromRequest(req);
    } catch (err) {
      res.status(401).json({
        success: false,
        error: err instanceof Error ? err.message : "Unauthorized",
      });
      return;
    }

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
          documentIds.length > 1 ? documentIds : undefined
        );

        res.status(201).json({
          success: true,
          data: { quizId: savedQuiz.id, quiz: savedQuiz },
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
          "POST /directories",
          "POST /rules",
          "POST /quizzes/generate",
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
      console.error(`External API error [${method} ${path}]:`, err);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);
