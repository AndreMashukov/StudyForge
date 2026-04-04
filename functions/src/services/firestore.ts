import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { 
  Quiz, 
  QuizQuestion, 
  GeminiQuizResponse,
  DiagramQuiz,
  DiagramQuizQuestion,
  SequenceQuiz,
  SequenceQuizQuestion,
} from "@shared-types";
import type { GeminiDiagramQuizResponse, GeminiSequenceQuizResponse } from "./gemini/gemini";
import * as functions from "firebase-functions";
import { FirestorePaths } from '../lib/firestore-paths';

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
             typeof (value as { toDate?: unknown }).toDate === 'function' &&
             ((value as { constructor?: { name?: string } }).constructor?.name === 'Timestamp' || 
              (value as { _delegate?: { constructor?: { name?: string } } })._delegate?.constructor?.name === 'Timestamp' ||
              (admin.firestore.Timestamp && value instanceof admin.firestore.Timestamp));
    } catch {
      // If instanceof check fails, fall back to duck typing
      return value !== null && 
             value !== undefined &&
             typeof value === 'object' &&
             'toDate' in value &&
             typeof (value as { toDate?: unknown }).toDate === 'function';
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
  public static async getQuiz(quizId: string, userId: string): Promise<Quiz | null> {
    try {
      const doc = await FirestorePaths.quiz(userId, quizId).get();
      
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
      const snapshot = await FirestorePaths.quizzes(userId)
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
   * Get recent quizzes (public/anonymous) using collection group query
   */
  public static async getRecentQuizzes(limit = 20): Promise<Quiz[]> {
    try {
      const db = this.getDb();
      const snapshot = await db
        .collectionGroup("quizzes")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data() as Quiz;
        // Strip userId from public response to avoid leaking user metadata
        const { userId: _uid, ...publicData } = data;
        return {
          ...publicData,
          id: doc.id,
          createdAt: this.convertTimestamp(data.createdAt),
        } as Quiz;
      });
    } catch (error) {
      functions.logger.error("Error getting recent quizzes:", error);
      throw new Error(`Failed to get recent quizzes: ${error}`);
    }
  }

  /**
   * Delete quiz by ID
   */
  public static async deleteQuiz(quizId: string, userId: string): Promise<void> {
    try {
      const quizRef = FirestorePaths.quiz(userId, quizId);
      const db = this.getDb();
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(quizRef);
        if (!snap.exists) {
          throw new Error("Quiz not found");
        }
        const data = snap.data() as Quiz;
        transaction.delete(quizRef);
        if (data.directoryId) {
          transaction.update(FirestorePaths.directory(userId, data.directoryId), {
            quizCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
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
        db.collectionGroup("quizzes").count().get(),
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
  public static async findExistingQuizByDocument(documentId: string, userId: string): Promise<Quiz | null> {
    try {
      const snapshot = await FirestorePaths.quizzes(userId)
        .where("documentId", "==", documentId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      
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
  public static async getDocumentQuizzes(documentId: string, userId: string): Promise<Quiz[]> {
    try {
      const snapshot = await FirestorePaths.quizzes(userId)
        .where("documentId", "==", documentId)
        .orderBy("createdAt", "desc")
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
      functions.logger.error(`Error getting quizzes for document ${documentId}:`, error);
      throw new Error(`Failed to get document quizzes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document metadata from documents collection
   */
  public static async getDocument(userId: string, documentId: string): Promise<{ id: string; title: string; wordCount?: number }> {
    try {
      const doc = await FirestorePaths.document(userId, documentId).get();
      
      if (!doc.exists) {
        throw new Error("Document not found");
      }

      const data = doc.data();
      if (!data) {
        throw new Error("Document data is empty");
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
    userId: string,
    directoryId: string,
    followupRuleIds?: string[],
    allDocumentIds?: string[]
  ): Promise<Quiz> {
    try {
      const quizzesCollection = FirestorePaths.quizzes(userId);

      // Get document metadata for quiz title
      const document = await this.getDocument(userId, documentId);
      
      // Count existing quizzes for this document to determine generation attempt
      const existingQuizzesSnapshot = await quizzesCollection
        .where("documentId", "==", documentId)
        .get();
      
      const generationAttempt = existingQuizzesSnapshot.size + 1;

      const quiz: Quiz = {
        id: "",
        documentId: documentId,
        ...(allDocumentIds ? { documentIds: allDocumentIds } : {}),
        title: `${document.title} - Quiz ${generationAttempt}`,
        questions: geminiQuiz.questions.map((q: { question: string; options: string[]; correctAnswer: number; explanation?: string }): QuizQuestion => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        createdAt: new Date(),
        userId: userId,
        directoryId,
        // Add generation metadata
        generationAttempt: generationAttempt,
        documentTitle: document.title,
        // Store followup rules for later use
        followupRuleIds: followupRuleIds || [],
      };

      const db = this.getDb();
      const quizRef = quizzesCollection.doc();
      const quizPayload = {
        documentId: quiz.documentId,
        ...(quiz.documentIds ? { documentIds: quiz.documentIds } : {}),
        title: quiz.title,
        questions: quiz.questions,
        createdAt: FieldValue.serverTimestamp(),
        userId: quiz.userId,
        directoryId: quiz.directoryId,
        generationAttempt: quiz.generationAttempt,
        documentTitle: quiz.documentTitle,
        followupRuleIds: quiz.followupRuleIds || [],
      };

      await db.runTransaction(async (transaction) => {
        transaction.set(quizRef, { ...quizPayload, id: quizRef.id });
        transaction.update(FirestorePaths.directory(userId, directoryId), {
          quizCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      quiz.id = quizRef.id;
      quiz.createdAt = new Date();

      functions.logger.info(`Quiz saved from document: ${quizRef.id} (document: ${documentId}, attempt: ${generationAttempt})`);
      return quiz;
    } catch (error) {
      functions.logger.error("Error saving quiz from document:", error);
      throw new Error(`Failed to save quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save diagram quiz from Gemini output
   */
  public static async saveDiagramQuizFromDocument(
    documentId: string,
    geminiQuiz: GeminiDiagramQuizResponse,
    userId: string,
    directoryId: string,
    followupRuleIds?: string[],
    allDocumentIds?: string[]
  ): Promise<DiagramQuiz> {
    try {
      const col = FirestorePaths.diagramQuizzes(userId);
      const document = await this.getDocument(userId, documentId);
      const existing = await col.where("documentId", "==", documentId).get();
      const generationAttempt = existing.size + 1;

      const questions: DiagramQuizQuestion[] = geminiQuiz.questions.map((q) => ({
        question: q.question,
        diagrams: q.diagrams,
        ...(q.diagramLabels?.length ? { diagramLabels: q.diagramLabels } : {}),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      }));

      const diagramQuiz = {
        id: "",
        documentId,
        ...(allDocumentIds ? { documentIds: allDocumentIds } : {}),
        title: `${document.title} - Diagram Quiz ${generationAttempt}`,
        questions,
        userId,
        directoryId,
        documentTitle: document.title,
        generationAttempt,
        followupRuleIds: followupRuleIds || [],
      };

      const db = this.getDb();
      const ref = col.doc();
      const payload = {
        id: ref.id,
        documentId: diagramQuiz.documentId,
        ...(diagramQuiz.documentIds ? { documentIds: diagramQuiz.documentIds } : {}),
        title: diagramQuiz.title,
        questions: diagramQuiz.questions,
        userId: diagramQuiz.userId,
        directoryId: diagramQuiz.directoryId,
        documentTitle: diagramQuiz.documentTitle,
        generationAttempt: diagramQuiz.generationAttempt,
        followupRuleIds: diagramQuiz.followupRuleIds || [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.runTransaction(async (transaction) => {
        transaction.set(ref, payload);
        transaction.update(FirestorePaths.directory(userId, directoryId), {
          diagramQuizCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      diagramQuiz.id = ref.id;
      return diagramQuiz as DiagramQuiz;
    } catch (error) {
      functions.logger.error("Error saving diagram quiz:", error);
      throw new Error(
        `Failed to save diagram quiz: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public static async getDiagramQuiz(
    diagramQuizId: string,
    userId: string
  ): Promise<DiagramQuiz | null> {
    try {
      const snap = await FirestorePaths.diagramQuiz(userId, diagramQuizId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as DiagramQuiz;
    } catch (error) {
      functions.logger.error(`Error getDiagramQuiz ${diagramQuizId}:`, error);
      throw new Error("Failed to fetch diagram quiz");
    }
  }

  public static async getUserDiagramQuizzes(userId: string): Promise<DiagramQuiz[]> {
    try {
      const snapshot = await FirestorePaths.diagramQuizzes(userId)
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DiagramQuiz));
    } catch (error) {
      functions.logger.error(`getUserDiagramQuizzes ${userId}:`, error);
      throw new Error("Failed to list diagram quizzes");
    }
  }

  public static async deleteDiagramQuiz(
    diagramQuizId: string,
    userId: string
  ): Promise<void> {
    try {
      const ref = FirestorePaths.diagramQuiz(userId, diagramQuizId);
      const db = this.getDb();
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new Error("Diagram quiz not found");
        }
        const data = snap.data() as DiagramQuiz;
        transaction.delete(ref);
        if (data.directoryId) {
          transaction.update(
            FirestorePaths.directory(userId, data.directoryId),
            {
              diagramQuizCount: FieldValue.increment(-1),
              updatedAt: FieldValue.serverTimestamp(),
            }
          );
        }
      });
      functions.logger.info(`Deleted diagram quiz: ${diagramQuizId}`);
    } catch (error) {
      functions.logger.error(`deleteDiagramQuiz ${diagramQuizId}:`, error);
      throw new Error(
        `Failed to delete diagram quiz: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public static async saveSequenceQuizFromDocument(
    documentId: string,
    geminiQuiz: GeminiSequenceQuizResponse,
    userId: string,
    directoryId: string,
    followupRuleIds?: string[],
    allDocumentIds?: string[]
  ): Promise<SequenceQuiz> {
    try {
      const col = FirestorePaths.sequenceQuizzes(userId);
      const document = await this.getDocument(userId, documentId);
      const existing = await col.where("documentId", "==", documentId).get();
      const generationAttempt = existing.size + 1;

      const questions: SequenceQuizQuestion[] = geminiQuiz.questions.map((q) => ({
        question: q.question,
        items: q.items,
        explanation: q.explanation,
      }));

      const db = this.getDb();
      const ref = col.doc();
      const payload = {
        id: ref.id,
        documentId,
        ...(allDocumentIds ? { documentIds: allDocumentIds } : {}),
        title: geminiQuiz.title,
        questions,
        userId,
        directoryId,
        documentTitle: document.title,
        generationAttempt,
        followupRuleIds: followupRuleIds || [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.runTransaction(async (transaction) => {
        transaction.set(ref, payload);
        transaction.update(FirestorePaths.directory(userId, directoryId), {
          sequenceQuizCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      const savedSnap = await ref.get();
      if (!savedSnap.exists) {
        throw new Error("Failed to read saved sequence quiz");
      }
      return { id: savedSnap.id, ...savedSnap.data() } as SequenceQuiz;
    } catch (error) {
      functions.logger.error("Error saving sequence quiz:", error);
      throw new Error(
        `Failed to save sequence quiz: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public static async getSequenceQuiz(
    sequenceQuizId: string,
    userId: string
  ): Promise<SequenceQuiz | null> {
    try {
      const snap = await FirestorePaths.sequenceQuiz(userId, sequenceQuizId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as SequenceQuiz;
    } catch (error) {
      functions.logger.error(`Error getSequenceQuiz ${sequenceQuizId}:`, error);
      throw new Error("Failed to fetch sequence quiz");
    }
  }

  public static async getUserSequenceQuizzes(userId: string): Promise<SequenceQuiz[]> {
    try {
      const snapshot = await FirestorePaths.sequenceQuizzes(userId)
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SequenceQuiz));
    } catch (error) {
      functions.logger.error(`getUserSequenceQuizzes ${userId}:`, error);
      throw new Error("Failed to list sequence quizzes");
    }
  }

  public static async deleteSequenceQuiz(
    sequenceQuizId: string,
    userId: string
  ): Promise<void> {
    try {
      const ref = FirestorePaths.sequenceQuiz(userId, sequenceQuizId);
      const db = this.getDb();
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) {
          throw new Error("Sequence quiz not found");
        }
        const data = snap.data() as SequenceQuiz;
        transaction.delete(ref);
        if (data.directoryId) {
          const dirRef = FirestorePaths.directory(userId, data.directoryId);
          transaction.update(dirRef, {
            sequenceQuizCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
      functions.logger.info(`Deleted sequence quiz: ${sequenceQuizId}`);
    } catch (error) {
      functions.logger.error(`deleteSequenceQuiz ${sequenceQuizId}:`, error);
      throw new Error(
        `Failed to delete sequence quiz: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

// Initialize Firestore on module load
FirestoreService.initialize();