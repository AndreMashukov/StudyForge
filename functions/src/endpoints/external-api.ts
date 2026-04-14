import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
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
  CreateDocumentRequest,
  CreateDirectoryRequest,
  GenerateQuizRequest,
  RuleApplicability,
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
        const data = req.body as CreateDocumentRequest;

        if (!data.title || !data.content || !data.directoryId || !data.sourceType) {
          res.status(400).json({
            success: false,
            error: "title, content, directoryId, and sourceType are required.",
          });
          return;
        }

        const doc = await DocumentCrudService.createDocument(userId, data);
        res.status(201).json({ success: true, data: doc });
        return;
      }

      // POST /directories
      if (method === "POST" && path === "/directories") {
        const data = req.body as CreateDirectoryRequest;

        if (!data.name) {
          res.status(400).json({
            success: false,
            error: "name is required.",
          });
          return;
        }

        const dir = await directoryService.createDirectory(userId, data);
        res.status(201).json({ success: true, data: dir });
        return;
      }

      // POST /quizzes/generate
      if (method === "POST" && path === "/quizzes/generate") {
        const requestData = req.body as GenerateQuizRequest;

        const documentIds = requestData.documentIds;
        if (!documentIds || documentIds.length === 0) {
          res.status(400).json({
            success: false,
            error: "documentIds is required (at least one document).",
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

      // 404 — route not found
      res.status(404).json({
        success: false,
        error: `Route ${method} ${path} not found.`,
        availableRoutes: [
          "POST /documents",
          "POST /directories",
          "POST /quizzes/generate",
        ],
      });
    } catch (err) {
      console.error(`External API error [${method} ${path}]:`, err);
      res.status(500).json({
        success: false,
        error:
          err instanceof Error ? err.message : "Internal server error",
      });
    }
  }
);
