/**
 * Firebase Functions for Code Insights AI Quiz Generator
 * 
 * Phase 3: Core Backend Functionality
 * - Web scraping for article content
 * - Gemini 2.5 Pro integration for quiz generation
 * - Firestore data operations
 * - API endpoints: generateQuiz and getQuiz
 */

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

// Services
import { GeminiService } from "./services/gemini";
import { FirestoreService } from "./services/firestore";

// Configure global options
setGlobalOptions({
  maxInstances: 10,
  region: "asia-east1",
});

/**
 * Health check endpoint (HTTP for monitoring)
 */
export const healthCheck = onRequest(
  {
    cors: true,
  },
  async (req, res) => {
    try {
      // Check Gemini AI availability
      const geminiInfo = await GeminiService.getModelInfo();
      
      // Get basic stats
      const stats = await FirestoreService.getStats();

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          firestore: "available",
          gemini: geminiInfo.available ? "available" : "unavailable",
        },
        stats,
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Export quiz management functions
export {
  generateQuiz,
  getQuiz,
  getUserQuizzes,
  getRecentQuizzes,
  getDocumentQuizzes,
  deleteQuiz,
} from "./endpoints/quizzes";

// Export quiz followup functions
export {
  generateQuizFollowup,
} from "./endpoints/quiz-followup";

// Export document management functions
export {
  createDocument,
  createDocumentFromUrl,
  generateFromPrompt,
  getDocument,
  getDocumentWithContent,
  updateDocument,
  deleteDocument,
  getUserDocuments,
  listDocuments,
  searchDocuments,
  getDocumentStats,
  getDocumentContent,
} from "./endpoints/documents";
