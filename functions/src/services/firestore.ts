import * as admin from "firebase-admin";
import { 
  Quiz, 
  QuizQuestion, 
  GeminiQuizResponse
} from "../../libs/shared-types/src/index";
import * as functions from "firebase-functions";

/**
 * Firestore service for managing URLs and Quizzes collections
 */

export class FirestoreService {
  private static db: admin.firestore.Firestore;

  /**
   * Safely check if a value is a Firestore Timestamp
   */
  private static isFirestoreTimestamp(value: unknown): value is { toDate(): Date } {
    try {
      // Check if it's a Firestore Timestamp object
      return value !== null && 
             value !== undefined &&
             typeof value === 'object' && 
             'toDate' in value &&
             typeof (value as any).toDate === 'function' &&
             ((value as any).constructor?.name === 'Timestamp' || 
              (value as any)._delegate?.constructor?.name === 'Timestamp' ||
              (admin.firestore.Timestamp && value instanceof admin.firestore.Timestamp));
    } catch {
      // If instanceof check fails, fall back to duck typing
      return value !== null && 
             value !== undefined &&
             typeof value === 'object' &&
             'toDate' in value &&
             typeof (value as any).toDate === 'function';
    }
  }

  /**
   * Convert Firestore timestamp to Date safely
   */
  private static convertTimestamp(value: unknown): Date {
    if (this.isFirestoreTimestamp(value)) {
      return value.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    // If it's a string or number, try to convert to Date
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    // Fallback to current date if value is not convertible
    return new Date();
  }

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

  // ========== Quizzes Collection Operations ==========

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
        createdAt: this.convertTimestamp(data.createdAt),
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
          createdAt: this.convertTimestamp(data.createdAt),
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
          createdAt: this.convertTimestamp(data.createdAt),
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
  // ========== Document-based Quiz Operations ==========

  /**
   * Find existing quiz for a document
   */
  public static async findExistingQuizByDocument(documentId: string, userId?: string): Promise<Quiz | null> {
    try {
      const db = this.getDb();
      let query = db.collection("quizzes").where("documentId", "==", documentId);
      
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
        createdAt: this.convertTimestamp(data.createdAt),
      };
    } catch (error) {
      functions.logger.error(`Error finding existing quiz for document ${documentId}:`, error);
      return null;
    }
  }

  /**
   * Get all quizzes for a specific document
   */
  public static async getDocumentQuizzes(documentId: string, userId?: string): Promise<Quiz[]> {
    try {
      const db = this.getDb();
      let query = db.collection("quizzes").where("documentId", "==", documentId);
      
      if (userId) {
        query = query.where("userId", "==", userId);
      }

      const snapshot = await query.orderBy("createdAt", "desc").get();
      
      return snapshot.docs.map((doc) => {
        const data = doc.data() as Quiz;
        return {
          ...data,
          id: doc.id,
          createdAt: this.convertTimestamp(data.createdAt),
        };
      });
    } catch (error) {
      functions.logger.error(`Error getting quizzes for document ${documentId}:`, error);
      throw new Error(`Failed to get document quizzes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document metadata from documents collection
   */
  public static async getDocument(userId: string, documentId: string): Promise<{ id: string; title: string; wordCount?: number }> {
    try {
      const db = this.getDb();
      const docRef = db.collection("documents").doc(documentId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error("Document not found");
      }

      const data = doc.data();
      if (!data) {
        throw new Error("Document data is empty");
      }

      // Verify user has access to this document
      if (data.userId !== userId) {
        throw new Error("Access denied: Document belongs to another user");
      }
      
      return {
        id: doc.id,
        title: data.title,
        wordCount: data.wordCount,
      };
    } catch (error) {
      functions.logger.error(`Error getting document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Get document content from storage via DocumentCrudService
   */
  public static async getDocumentContent(userId: string, documentId: string): Promise<string> {
    try {
      // Import DocumentService here to avoid circular dependency
      const { DocumentService } = await import('./document-storage.js');
      return await DocumentService.getDocumentContent(userId, documentId);
    } catch (error) {
      functions.logger.error(`Error getting document content ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Save quiz generated from a document
   */
  public static async saveQuizFromDocument(
    documentId: string,
    geminiQuiz: GeminiQuizResponse,
    userId?: string
  ): Promise<Quiz> {
    try {
      const db = this.getDb();
      const quizzesCollection = db.collection("quizzes");

      // Get document metadata for quiz title
      const document = await this.getDocument(userId!, documentId);
      
      // Count existing quizzes for this document to determine generation attempt
      const existingQuizzesSnapshot = await quizzesCollection
        .where("documentId", "==", documentId)
        .where("userId", "==", userId)
        .get();
      
      const generationAttempt = existingQuizzesSnapshot.size + 1;

      const quiz: Quiz = {
        id: "",
        documentId: documentId,
        title: `${document.title} - Quiz ${generationAttempt}`,
        questions: geminiQuiz.questions.map((q: any): QuizQuestion => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        createdAt: new Date(),
        userId: userId,
        // Add generation metadata
        generationAttempt: generationAttempt,
        documentTitle: document.title,
      };

      const docRef = await quizzesCollection.add(quiz);
      quiz.id = docRef.id;

      functions.logger.info(`Quiz saved from document: ${docRef.id} (document: ${documentId}, attempt: ${generationAttempt})`);
      return quiz;
    } catch (error) {
      functions.logger.error("Error saving quiz from document:", error);
      throw new Error(`Failed to save quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Initialize Firestore on module load
FirestoreService.initialize();