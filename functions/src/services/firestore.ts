import * as admin from "firebase-admin";
import { 
  Quiz, 
  UrlContent, 
  QuizQuestion, 
  GeminiQuizResponse, 
  ScrapedContent 
} from "shared-types";
import * as functions from "firebase-functions";

/**
 * Firestore service for managing URLs and Quizzes collections
 */

export class FirestoreService {
  private static db: admin.firestore.Firestore;

  /**
   * Initialize Firestore database
   */
  public static initialize(): void {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.db = admin.firestore();
  }

  /**
   * Get Firestore database instance
   */
  private static getDb(): admin.firestore.Firestore {
    if (!this.db) {
      this.initialize();
    }
    return this.db;
  }

  // ========== URLs Collection Operations ==========

  /**
   * Save scraped URL content to Firestore
   */
  public static async saveUrlContent(
    url: string, 
    scrapedContent: ScrapedContent, 
    userId?: string
  ): Promise<UrlContent> {
    try {
      const db = this.getDb();
      const urlsCollection = db.collection("urls");

      // Check if URL already exists for this user
      let existingDoc = null;
      if (userId) {
        const existingQuery = await urlsCollection
          .where("url", "==", url)
          .where("userId", "==", userId)
          .limit(1)
          .get();
        
        if (!existingQuery.empty) {
          existingDoc = existingQuery.docs[0];
        }
      }

      const urlData: UrlContent = {
        id: existingDoc?.id || urlsCollection.doc().id,
        url,
        title: scrapedContent.title,
        content: scrapedContent.content,
        extractedAt: new Date(),
        userId,
      };

      if (existingDoc) {
        // Update existing document
        await existingDoc.ref.update({
          title: urlData.title,
          content: urlData.content,
          extractedAt: urlData.extractedAt,
        });
        
        functions.logger.info(`Updated existing URL content: ${url}`);
      } else {
        // Create new document
        await urlsCollection.doc(urlData.id).set(urlData);
        functions.logger.info(`Saved new URL content: ${url}`);
      }

      return urlData;
    } catch (error) {
      functions.logger.error("Error saving URL content:", error);
      throw new Error(`Failed to save URL content: ${error}`);
    }
  }

  /**
   * Get URL content by ID
   */
  public static async getUrlContent(urlId: string): Promise<UrlContent | null> {
    try {
      const db = this.getDb();
      const doc = await db.collection("urls").doc(urlId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as UrlContent;
      return {
        ...data,
        id: doc.id,
        extractedAt: data.extractedAt instanceof admin.firestore.Timestamp 
          ? data.extractedAt.toDate() 
          : data.extractedAt,
      };
    } catch (error) {
      functions.logger.error(`Error getting URL content ${urlId}:`, error);
      throw new Error(`Failed to get URL content: ${error}`);
    }
  }

  /**
   * Find URL content by URL string
   */
  public static async findUrlByString(url: string, userId?: string): Promise<UrlContent | null> {
    try {
      const db = this.getDb();
      let query = db.collection("urls").where("url", "==", url);
      
      if (userId) {
        query = query.where("userId", "==", userId);
      }

      const snapshot = await query.limit(1).get();
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as UrlContent;
      
      return {
        ...data,
        id: doc.id,
        extractedAt: data.extractedAt instanceof admin.firestore.Timestamp 
          ? data.extractedAt.toDate() 
          : data.extractedAt,
      };
    } catch (error) {
      functions.logger.error(`Error finding URL ${url}:`, error);
      throw new Error(`Failed to find URL: ${error}`);
    }
  }

  // ========== Quizzes Collection Operations ==========

  /**
   * Save generated quiz to Firestore
   */
  public static async saveQuiz(
    urlId: string,
    geminiQuiz: GeminiQuizResponse,
    userId?: string
  ): Promise<Quiz> {
    try {
      const db = this.getDb();
      const quizzesCollection = db.collection("quizzes");

      // Convert Gemini questions to Quiz questions
      const questions: QuizQuestion[] = geminiQuiz.questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      }));

      const quizData: Quiz = {
        id: quizzesCollection.doc().id,
        urlId,
        title: geminiQuiz.title,
        questions,
        createdAt: new Date(),
        userId,
      };

      await quizzesCollection.doc(quizData.id).set(quizData);
      
      functions.logger.info(`Saved quiz: ${quizData.id} with ${questions.length} questions`);
      
      return quizData;
    } catch (error) {
      functions.logger.error("Error saving quiz:", error);
      throw new Error(`Failed to save quiz: ${error}`);
    }
  }

  /**
   * Get quiz by ID
   */
  public static async getQuiz(quizId: string): Promise<Quiz | null> {
    try {
      const db = this.getDb();
      const doc = await db.collection("quizzes").doc(quizId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as Quiz;
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
      };
    } catch (error) {
      functions.logger.error(`Error getting quiz ${quizId}:`, error);
      throw new Error(`Failed to get quiz: ${error}`);
    }
  }

  /**
   * Get all quizzes for a user
   */
  public static async getUserQuizzes(userId: string, limit = 50): Promise<Quiz[]> {
    try {
      const db = this.getDb();
      const snapshot = await db
        .collection("quizzes")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data() as Quiz;
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof admin.firestore.Timestamp 
            ? data.createdAt.toDate() 
            : data.createdAt,
        };
      });
    } catch (error) {
      functions.logger.error(`Error getting user quizzes for ${userId}:`, error);
      throw new Error(`Failed to get user quizzes: ${error}`);
    }
  }

  /**
   * Get recent quizzes (public/anonymous)
   */
  public static async getRecentQuizzes(limit = 20): Promise<Quiz[]> {
    try {
      const db = this.getDb();
      const snapshot = await db
        .collection("quizzes")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data() as Quiz;
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof admin.firestore.Timestamp 
            ? data.createdAt.toDate() 
            : data.createdAt,
        };
      });
    } catch (error) {
      functions.logger.error("Error getting recent quizzes:", error);
      throw new Error(`Failed to get recent quizzes: ${error}`);
    }
  }

  /**
   * Delete quiz by ID
   */
  public static async deleteQuiz(quizId: string, userId?: string): Promise<void> {
    try {
      const db = this.getDb();
      const quizRef = db.collection("quizzes").doc(quizId);
      
      if (userId) {
        // Verify ownership before deletion
        const doc = await quizRef.get();
        if (!doc.exists) {
          throw new Error("Quiz not found");
        }
        
        const data = doc.data() as Quiz;
        if (data.userId !== userId) {
          throw new Error("Unauthorized to delete this quiz");
        }
      }

      await quizRef.delete();
      functions.logger.info(`Deleted quiz: ${quizId}`);
    } catch (error) {
      functions.logger.error(`Error deleting quiz ${quizId}:`, error);
      throw new Error(`Failed to delete quiz: ${error}`);
    }
  }

  // ========== Utility Methods ==========

  /**
   * Get collection statistics
   */
  public static async getStats(): Promise<{ urlsCount: number; quizzesCount: number }> {
    try {
      const db = this.getDb();
      
      const [urlsSnapshot, quizzesSnapshot] = await Promise.all([
        db.collection("urls").count().get(),
        db.collection("quizzes").count().get(),
      ]);

      return {
        urlsCount: urlsSnapshot.data().count,
        quizzesCount: quizzesSnapshot.data().count,
      };
    } catch (error) {
      functions.logger.error("Error getting stats:", error);
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  /**
   * Check if quiz exists for a specific URL and user
   */
  public static async findExistingQuiz(urlId: string, userId?: string): Promise<Quiz | null> {
    try {
      const db = this.getDb();
      let query = db.collection("quizzes").where("urlId", "==", urlId);
      
      if (userId) {
        query = query.where("userId", "==", userId);
      }

      const snapshot = await query.orderBy("createdAt", "desc").limit(1).get();
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as Quiz;
      
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
      };
    } catch (error) {
      functions.logger.error(`Error finding existing quiz for URL ${urlId}:`, error);
      return null;
    }
  }
}

// Initialize Firestore on module load
FirestoreService.initialize();