import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { DocumentService } from './document-storage.js';
import { 
  DocumentEnhanced as Document, 
  DocumentMetadataEnhanced as DocumentMetadata, 
  CreateDocumentRequest, 
  UpdateDocumentRequest,
  DocumentSourceType,
  DocumentStatus,
} from "../../libs/shared-types/src/index";

/**
 * Comprehensive Document CRUD Service
 * Manages documents across both Firestore (metadata) and Storage (content)
 */
export class DocumentCrudService {
  private static db = getFirestore();
  private static readonly COLLECTION_NAME = 'documents';

  /**
   * Create a new document with content storage
   * @param userId - The authenticated user's ID
   * @param request - Document creation request
   * @returns The created document
   */
  static async createDocument(userId: string, request: CreateDocumentRequest): Promise<Document> {
    try {
      logger.info('Creating new document', { 
        userId, 
        title: request.title,
        sourceType: request.sourceType,
        contentLength: request.content.length,
      });

      // Validate content
      DocumentService.validateDocumentContent(request.content);

      // Generate document ID
      const docRef = this.db.collection(this.COLLECTION_NAME).doc();
      const documentId = docRef.id;

      // Count words in content
      const wordCount = this.countWords(request.content);

      // Prepare metadata
      const metadata: DocumentMetadata = {
        title: request.title || 'Untitled Document',
        sourceType: request.sourceType,
        wordCount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Upload content to Storage
      const storageFile = await DocumentService.uploadDocument(
        userId,
        documentId,
        request.content,
        metadata
      );

      // Create document record in Firestore
      const document: Document = {
        id: documentId,
        userId,
        title: metadata.title,
        description: request.description || '',
        sourceType: request.sourceType,
        sourceUrl: request.sourceUrl || null,
        wordCount: metadata.wordCount,
        status: request.status || DocumentStatus.ACTIVE,
        storageUrl: storageFile.downloadUrl,
        storagePath: storageFile.path,
        tags: request.tags || [],
        createdAt: Timestamp.fromDate(metadata.createdAt),
        updatedAt: Timestamp.fromDate(metadata.updatedAt),
      };

      // Save to Firestore
      await docRef.set(document);

      logger.info('Document created successfully', { 
        userId, 
        documentId,
        title: document.title,
      });

      return document;
    } catch (error) {
      logger.error('Failed to create document', {
        userId,
        title: request.title,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a document by ID (metadata only, no content)
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @returns The document metadata
   */
  static async getDocument(userId: string, documentId: string): Promise<Document> {
    try {
      logger.info('Retrieving document', { userId, documentId });

      const docRef = this.db.collection(this.COLLECTION_NAME).doc(documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new Error('Document not found');
      }

      const document = docSnap.data() as Document;
      
      // Ensure document has an ID from the Firestore document ID
      const documentWithId = {
        ...document,
        id: docSnap.id, // Use Firestore document ID
      };

      // Verify ownership
      if (documentWithId.userId !== userId) {
        throw new Error('Unauthorized: Document belongs to different user');
      }

      logger.info('Document retrieved successfully', { 
        userId, 
        documentId: docSnap.id,
        hasId: !!documentWithId.id,
        title: documentWithId.title 
      });
      return documentWithId;
    } catch (error) {
      logger.error('Failed to retrieve document', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to retrieve document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document with content from storage
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @returns Document with content included
   */
  static async getDocumentWithContent(userId: string, documentId: string): Promise<Document & { content: string }> {
    try {
      // Get document metadata
      const document = await this.getDocument(userId, documentId);

      // Get content from storage
      const content = await DocumentService.getDocumentContent(userId, documentId);

      logger.info('Document with content retrieved successfully', { 
        userId, 
        documentId,
        contentLength: content.length,
      });

      return {
        ...document,
        content,
      };
    } catch (error) {
      logger.error('Failed to retrieve document with content', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to retrieve document with content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a document (metadata and/or content)
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @param updates - Updates to apply
   * @returns The updated document
   */
  static async updateDocument(
    userId: string,
    documentId: string,
    updates: UpdateDocumentRequest
  ): Promise<Document> {
    try {
      logger.info('Updating document', { 
        userId, 
        documentId,
        hasContentUpdate: !!updates.content,
        hasMetadataUpdate: !!(updates.title || updates.description || updates.tags),
      });

      // Get current document
      const currentDocument = await this.getDocument(userId, documentId);
      const docRef = this.db.collection(this.COLLECTION_NAME).doc(documentId);

      let storageFile;
      let wordCount = currentDocument.wordCount;

      // Update content in storage if provided
      if (updates.content !== undefined) {
        DocumentService.validateDocumentContent(updates.content);
        wordCount = this.countWords(updates.content);

        const metadata: DocumentMetadata = {
          title: updates.title || currentDocument.title,
          sourceType: currentDocument.sourceType,
          wordCount,
          createdAt: this.toDate(currentDocument.createdAt),
          updatedAt: new Date(),
        };

        storageFile = await DocumentService.uploadDocument(
          userId,
          documentId,
          updates.content,
          metadata
        );
      }

      // Prepare Firestore updates
      const firestoreUpdates: Partial<Document> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.title !== undefined) {
        firestoreUpdates.title = updates.title;
      }

      if (updates.description !== undefined) {
        firestoreUpdates.description = updates.description;
      }

      if (updates.tags !== undefined) {
        firestoreUpdates.tags = updates.tags;
      }

      if (updates.status !== undefined) {
        firestoreUpdates.status = updates.status;
      }

      if (storageFile) {
        firestoreUpdates.storageUrl = storageFile.downloadUrl;
        firestoreUpdates.wordCount = wordCount;
      }

      // Update document in Firestore
      await docRef.update(firestoreUpdates);

      // Get updated document
      const updatedDocument = await this.getDocument(userId, documentId);

      logger.info('Document updated successfully', { userId, documentId });
      return updatedDocument;
    } catch (error) {
      logger.error('Failed to update document', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a document (both metadata and content)
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   */
  static async deleteDocument(userId: string, documentId: string): Promise<void> {
    try {
      logger.info('Deleting document', { userId, documentId });

      // Verify ownership first
      await this.getDocument(userId, documentId);

      // Delete content from storage
      await DocumentService.deleteDocument(userId, documentId);

      // Delete metadata from Firestore
      const docRef = this.db.collection(this.COLLECTION_NAME).doc(documentId);
      await docRef.delete();

      logger.info('Document deleted successfully', { userId, documentId });
    } catch (error) {
      logger.error('Failed to delete document', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List documents for a user with pagination and filtering
   * @param userId - The authenticated user's ID
   * @param options - Query options
   * @returns Array of documents
   */
  static async listDocuments(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      sourceType?: DocumentSourceType;
      status?: DocumentStatus;
      tags?: string[];
      sortBy?: 'createdAt' | 'updatedAt' | 'title';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ documents: Document[]; total: number; hasMore: boolean }> {
    try {
      logger.info('Listing documents for user', { 
        userId, 
        options: {
          limit: options.limit,
          sourceType: options.sourceType,
          status: options.status,
          tagsCount: options.tags?.length,
        },
      });

      let query = this.db
        .collection(this.COLLECTION_NAME)
        .where('userId', '==', userId);

      // Apply filters
      if (options.sourceType) {
        query = query.where('sourceType', '==', options.sourceType);
      }

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      if (options.tags && options.tags.length > 0) {
        query = query.where('tags', 'array-contains-any', options.tags);
      }

      // Apply sorting
      const sortBy = options.sortBy || 'updatedAt';
      const sortOrder = options.sortOrder || 'desc';
      query = query.orderBy(sortBy, sortOrder);

      // Get total count (for pagination)
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Apply pagination
      if (options.offset) {
        query = query.offset(options.offset);
      }

      const limit = Math.min(options.limit || 20, 100); // Max 100 per request
      query = query.limit(limit + 1); // Get one extra to check if there are more

      // Execute query
      const snapshot = await query.get();
      const documents = snapshot.docs.map(doc => {
        const data = doc.data() as Document;
        // Ensure document has an ID from the Firestore document ID
        const documentWithId = {
          ...data,
          id: doc.id, // Use Firestore document ID
        };
        logger.info('Document retrieved from Firestore', { 
          userId, 
          documentId: doc.id,
          hasId: !!documentWithId.id,
          title: documentWithId.title 
        });
        return documentWithId;
      });

      // Check if there are more documents
      const hasMore = documents.length > limit;
      if (hasMore) {
        documents.pop(); // Remove the extra document
      }

      logger.info('Documents listed successfully', { 
        userId, 
        count: documents.length,
        total,
        hasMore,
      });

      return {
        documents,
        total,
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to list documents', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search documents by title or description
   * @param userId - The authenticated user's ID
   * @param searchTerm - The search term
   * @param options - Search options
   * @returns Array of matching documents
   */
  static async searchDocuments(
    userId: string,
    searchTerm: string,
    options: {
      limit?: number;
      sourceType?: DocumentSourceType;
      status?: DocumentStatus;
    } = {}
  ): Promise<Document[]> {
    try {
      logger.info('Searching documents', { 
        userId, 
        searchTerm: searchTerm.substring(0, 50), // Log truncated search term
        options,
      });

      // Note: This is a basic implementation. For better search,
      // consider using Algolia, Elasticsearch, or Firebase's full-text search
      let query = this.db
        .collection(this.COLLECTION_NAME)
        .where('userId', '==', userId);

      // Apply filters
      if (options.sourceType) {
        query = query.where('sourceType', '==', options.sourceType);
      }

      if (options.status) {
        query = query.where('status', '==', options.status);
      }

      const limit = Math.min(options.limit || 20, 50);
      query = query.limit(limit);

      const snapshot = await query.get();
      const allDocuments = snapshot.docs.map(doc => doc.data() as Document);

      // Client-side filtering for search (not ideal for large datasets)
      const searchTermLower = searchTerm.toLowerCase();
      const matchingDocuments = allDocuments.filter(doc =>
        doc.title.toLowerCase().includes(searchTermLower) ||
        (doc.description && doc.description.toLowerCase().includes(searchTermLower)) ||
        (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchTermLower)))
      );

      logger.info('Document search completed', { 
        userId, 
        searchTerm: searchTerm.substring(0, 50),
        totalScanned: allDocuments.length,
        matchesFound: matchingDocuments.length,
      });

      return matchingDocuments;
    } catch (error) {
      logger.error('Failed to search documents', {
        userId,
        searchTerm: searchTerm.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document statistics for a user
   * @param userId - The authenticated user's ID
   * @returns Document statistics
   */
  static async getDocumentStats(userId: string): Promise<{
    total: number;
    bySourceType: Record<DocumentSourceType, number>;
    byStatus: Record<DocumentStatus, number>;
    totalWordCount: number;
    recentActivity: Date | null;
  }> {
    try {
      logger.info('Getting document statistics', { userId });

      const snapshot = await this.db
        .collection(this.COLLECTION_NAME)
        .where('userId', '==', userId)
        .get();

      const documents = snapshot.docs.map(doc => doc.data() as Document);

      const stats = {
        total: documents.length,
        bySourceType: {} as Record<DocumentSourceType, number>,
        byStatus: {} as Record<DocumentStatus, number>,
        totalWordCount: 0,
        recentActivity: null as Date | null,
      };

      // Initialize counters
      (Object.values(DocumentSourceType) as DocumentSourceType[]).forEach(type => {
        stats.bySourceType[type] = 0;
      });

      (Object.values(DocumentStatus) as DocumentStatus[]).forEach(status => {
        stats.byStatus[status] = 0;
      });

      // Calculate statistics
      documents.forEach(doc => {
        stats.bySourceType[doc.sourceType]++;
        stats.byStatus[doc.status]++;
        stats.totalWordCount += doc.wordCount;

        const updatedAt = this.toDate(doc.updatedAt);
        if (!stats.recentActivity || updatedAt > stats.recentActivity) {
          stats.recentActivity = updatedAt;
        }
      });

      logger.info('Document statistics calculated', { userId, stats });
      return stats;
    } catch (error) {
      logger.error('Failed to get document statistics', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to get document statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Count words in text content
   * @param content - The text content
   * @returns Word count
   */
  private static countWords(content: string): number {
    return content
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(word => word.length > 0).length;
  }

  /**
   * Convert Date or Timestamp to Date
   * @param dateValue - Date or Firestore Timestamp
   * @returns Date object
   */
  private static toDate(dateValue: Date | { toDate(): Date }): Date {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    return dateValue.toDate();
  }

  /**
   * Validate document ownership
   * @param userId - The requesting user's ID
   * @param documentId - The document identifier
   * @returns true if user owns document, throws error if not
   */
  private static async validateOwnership(userId: string, documentId: string): Promise<boolean> {
    const document = await this.getDocument(userId, documentId);
    if (document.userId !== userId) {
      throw new Error('Unauthorized: Document belongs to different user');
    }
    return true;
  }
}