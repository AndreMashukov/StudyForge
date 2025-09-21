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
import { onRequest, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// Services
import { WebScraperService } from "./services/scraper";
import { GeminiService } from "./services/gemini";
import { FirestoreService } from "./services/firestore";

// Types
import { 
  GenerateQuizRequest, 
  GenerateQuizResponse, 
  GetQuizResponse,
  ApiResponse,
  Quiz
} from "../libs/shared-types/src/index";

// Configure global options
setGlobalOptions({
  maxInstances: 10,
  region: "asia-east1",
});

// Define secrets
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Generate Quiz from URL
 * POST /generateQuiz
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
      // Support both new documentId-based requests and legacy URL requests
      const requestData = request.data as GenerateQuizRequest | { url: string };
      const userId = request.auth?.uid;

      let documentId: string | undefined;
      let url: string | undefined;

      // Check if this is a new documentId-based request
      if ('documentId' in requestData && requestData.documentId) {
        documentId = requestData.documentId;
      } 
      // Check if this is a legacy URL-based request
      else if ('url' in requestData && requestData.url) {
        url = requestData.url;
      } else {
        throw new Error("Either documentId or url is required");
      }

      // Handle documentId-based requests (new approach)
      if (documentId) {
        console.log(`Generating quiz from document: ${documentId}`);
        // TODO: Implement document-based quiz generation
        // For now, throw an error to indicate this isn't implemented yet
        throw new Error("Document-based quiz generation not yet implemented. Please use URL-based generation for now.");
      }

      // Handle URL-based requests (legacy approach)
      if (url) {
        // Validate URL format
        if (!WebScraperService.isValidUrl(url)) {
          throw new Error("Invalid URL format");
        }

        console.log(`Starting legacy quiz generation for URL: ${url}`);

        // Step 1: Check if we already have this URL content
        let urlContent = await FirestoreService.findUrlByString(url, userId);
        
        if (!urlContent) {
          // Step 2: Scrape the URL content
          console.log("Scraping URL content...");
          const scrapedContent = await WebScraperService.extractContent(url);
          
          // Step 3: Save URL content to Firestore
          urlContent = await FirestoreService.saveUrlContent(url, scrapedContent, userId);
        } else {
          console.log("Using cached URL content");
        }

        // Step 4: Check if we already have a quiz for this URL
        const existingQuiz = await FirestoreService.findExistingQuiz(urlContent.id, userId);
        
        if (existingQuiz) {
          console.log("Returning existing quiz");
          return {
            success: true,
            data: {
              quizId: existingQuiz.id,
              quiz: existingQuiz,
            },
          };
        }

        // Step 5: Validate content for quiz generation
        const scrapedContent = {
          title: urlContent.title,
          content: urlContent.content,
          wordCount: urlContent.content.split(/\s+/).length,
        };

        GeminiService.validateContentForQuiz(scrapedContent);

        // Step 6: Generate quiz with Gemini AI
        console.log("Generating quiz with Gemini AI...");
        const geminiQuiz = await GeminiService.generateQuiz(scrapedContent);

        // Step 7: Save quiz to Firestore
        const savedQuiz = await FirestoreService.saveQuiz(urlContent.id, geminiQuiz, userId);

        console.log(`Successfully generated quiz: ${savedQuiz.id}`);

        return {
          success: true,
          data: {
            quizId: savedQuiz.id,
            quiz: savedQuiz,
          },
        };
      }

      // This should never be reached, but just in case
      throw new Error("No valid request parameters provided");

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
      
      if (!quizId) {
        throw new Error("Quiz ID is required");
      }

      console.log(`Fetching quiz: ${quizId}`);

      const quiz = await FirestoreService.getQuiz(quizId);
      
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

// Export document management functions
export {
  createDocument,
  createDocumentFromUrl,
  getDocument,
  getDocumentWithContent,
  updateDocument,
  deleteDocument,
  getUserDocuments,
  listDocuments,
  searchDocuments,
  getDocumentStats,
} from "./endpoints/documents.js";
