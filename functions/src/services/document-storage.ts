import { getStorage } from 'firebase-admin/storage';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DocumentEnhanced as Document, DocumentMetadataEnhanced as DocumentMetadata, StorageFile, StorageMetadata } from "@shared-types";
import { logger } from 'firebase-functions/v2';

/**
 * Service for managing document storage in Firebase Storage
 * Handles markdown document upload, download, and management operations
 */
export class DocumentService {
  private static storage = getStorage();
  private static db = getFirestore();

  /**
   * Upload markdown content to Firebase Storage
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @param content - The markdown content to store
   * @param metadata - Document metadata
   * @returns Storage file information including download URL
   */
  static async uploadDocument(
    userId: string,
    documentId: string,
    content: string,
    metadata: DocumentMetadata
  ): Promise<StorageFile> {
    try {
      const bucket = this.storage.bucket();
      const filePath = `users/${userId}/documents/${documentId}/content.md`;
      const file = bucket.file(filePath);

      logger.info('Uploading document to Storage', {
        userId,
        documentId,
        filePath,
        contentLength: content.length,
      });

      // Prepare content as Buffer with UTF-8 encoding
      const contentBuffer = Buffer.from(content, 'utf8');

      // Upload the markdown content with metadata
      await file.save(contentBuffer, {
        metadata: {
          contentType: 'text/markdown; charset=utf-8',
          cacheControl: 'public, max-age=3600',
          customMetadata: {
            documentId,
            title: metadata.title || 'Untitled Document',
            sourceType: metadata.sourceType || 'upload',
            wordCount: (metadata.wordCount || 0).toString(),
            createdAt: (metadata.createdAt || new Date()).toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        resumable: false, // Use simple upload for files < 100KB
        validation: 'crc32c',
      });

      // Get file metadata for response
      const [fileMetadata] = await file.getMetadata();

      // Generate signed URL for download (24 hours expiry)
      const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      const storageFile: StorageFile = {
        path: filePath,
        downloadUrl,
        metadata: {
          contentType: fileMetadata.contentType || 'text/markdown',
          size: parseInt(String(fileMetadata.size || '0'), 10),
          timeCreated: fileMetadata.timeCreated || new Date().toISOString(),
          updated: fileMetadata.updated || new Date().toISOString(),
          customMetadata: this.sanitizeMetadata(fileMetadata.metadata || {}),
        },
      };

      logger.info('Document uploaded successfully', {
        userId,
        documentId,
        fileSize: storageFile.metadata.size,
      });

      return storageFile;
    } catch (error) {
      logger.error('Failed to upload document', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve document content from Firebase Storage
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @returns The markdown content as string
   */
  static async getDocumentContent(userId: string, documentId: string): Promise<string> {
    try {
      const bucket = this.storage.bucket();
      const filePath = `users/${userId}/documents/${documentId}/content.md`;
      const file = bucket.file(filePath);

      logger.info('Retrieving document from Storage', {
        userId,
        documentId,
        filePath,
      });

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('Document not found in storage');
      }

      // Download and return content
      const [content] = await file.download();
      const contentString = content.toString('utf8');

      logger.info('Document retrieved successfully', {
        userId,
        documentId,
        contentLength: contentString.length,
      });

      return contentString;
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
   * Delete document from Firebase Storage
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   */
  static async deleteDocument(userId: string, documentId: string): Promise<void> {
    try {
      const bucket = this.storage.bucket();
      const filePath = `users/${userId}/documents/${documentId}/content.md`;
      const file = bucket.file(filePath);

      logger.info('Deleting document from Storage', {
        userId,
        documentId,
        filePath,
      });

      // Check if file exists before attempting deletion
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        logger.info('Document deleted successfully', { userId, documentId });
      } else {
        logger.warn('Document not found in storage during deletion', {
          userId,
          documentId,
        });
      }
    } catch (error) {
      logger.error('Failed to delete document from storage', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a signed download URL for a document
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @param expiresInMinutes - URL expiration time in minutes (default: 60)
   * @returns Signed download URL
   */
  static async getDownloadUrl(
    userId: string,
    documentId: string,
    expiresInMinutes: number = 60
  ): Promise<string> {
    try {
      const bucket = this.storage.bucket();
      const filePath = `users/${userId}/documents/${documentId}/content.md`;
      const file = bucket.file(filePath);

      logger.info('Generating download URL', {
        userId,
        documentId,
        expiresInMinutes,
      });

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('Document not found in storage');
      }

      // Generate signed URL
      const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      logger.info('Download URL generated successfully', { userId, documentId });
      return downloadUrl;
    } catch (error) {
      logger.error('Failed to generate download URL', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get document metadata from Storage (without downloading content)
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @returns Storage metadata
   */
  static async getDocumentMetadata(userId: string, documentId: string): Promise<StorageMetadata> {
    try {
      const bucket = this.storage.bucket();
      const filePath = `users/${userId}/documents/${documentId}/content.md`;
      const file = bucket.file(filePath);

      logger.info('Retrieving document metadata', {
        userId,
        documentId,
        filePath,
      });

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('Document not found in storage');
      }

      // Get metadata
      const [metadata] = await file.getMetadata();

      const storageMetadata: StorageMetadata = {
        contentType: metadata.contentType || 'text/markdown',
        size: parseInt(String(metadata.size || '0'), 10),
        timeCreated: metadata.timeCreated || new Date().toISOString(),
        updated: metadata.updated || new Date().toISOString(),
        customMetadata: this.sanitizeMetadata(metadata.metadata || {}),
      };

      logger.info('Document metadata retrieved successfully', {
        userId,
        documentId,
        size: storageMetadata.size,
      });

      return storageMetadata;
    } catch (error) {
      logger.error('Failed to retrieve document metadata', {
        userId,
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to retrieve document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update document content in Storage
   * @param userId - The authenticated user's ID
   * @param documentId - The document identifier
   * @param newContent - The new markdown content
   * @param updateMetadata - Optional metadata updates
   * @returns Updated storage file information
   */
  static async updateDocument(
    userId: string,
    documentId: string,
    newContent: string,
    updateMetadata?: Partial<DocumentMetadata>
  ): Promise<StorageFile> {
    try {
      // Get current metadata from Firestore to merge with updates
      const docRef = this.db.collection('documents').doc(documentId);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        throw new Error('Document not found in database');
      }

      const currentDoc = docSnap.data() as Document;
      
      // Verify ownership
      if (currentDoc.userId !== userId) {
        throw new Error('Unauthorized: Document belongs to different user');
      }

      // Merge metadata
      const mergedMetadata: DocumentMetadata = {
        title: updateMetadata?.title || currentDoc.title,
        sourceType: currentDoc.sourceType, // Don't change source type on update
        wordCount: updateMetadata?.wordCount || this.countWords(newContent),
        createdAt: this.toDate(currentDoc.createdAt),
        updatedAt: new Date(),
      };

      // Upload updated content
      const storageFile = await this.uploadDocument(userId, documentId, newContent, mergedMetadata);

      logger.info('Document updated successfully', { userId, documentId });
      return storageFile;
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
   * Validate document content before storage
   * @param content - The content to validate
   * @returns true if valid, throws error if invalid
   */
  static validateDocumentContent(content: string): boolean {
    if (!content || content.trim().length === 0) {
      throw new Error('Document content cannot be empty');
    }

    if (content.length > 100 * 1024) {
      throw new Error('Document content exceeds maximum size of 100KB');
    }

    // Additional content validation can be added here
    // For example, check for malicious content, validate markdown syntax, etc.

    return true;
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
   * Sanitize Firebase metadata to ensure all values are strings
   * @param metadata - Raw Firebase metadata
   * @returns Sanitized metadata with string values only
   */
  private static sanitizeMetadata(metadata: { [key: string]: string | number | boolean }): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      sanitized[key] = String(value);
    }
    return sanitized;
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
   * Clean up orphaned files (utility function for maintenance)
   * @param userId - The user ID to clean up files for
   * @param validDocumentIds - Array of valid document IDs from Firestore
   */
  static async cleanupOrphanedFiles(userId: string, validDocumentIds: string[]): Promise<void> {
    try {
      const bucket = this.storage.bucket();
      const userFolder = `users/${userId}/documents/`;
      
      const [files] = await bucket.getFiles({
        prefix: userFolder,
      });

      const orphanedFiles = files.filter(file => {
        const pathParts = file.name.split('/');
        if (pathParts.length < 4) return false; // Invalid path structure
        
        const documentId = pathParts[3]; // users/{userId}/documents/{documentId}/...
        return !validDocumentIds.includes(documentId);
      });

      if (orphanedFiles.length > 0) {
        logger.info(`Found ${orphanedFiles.length} orphaned files for user ${userId}`);
        
        // Delete orphaned files
        await Promise.all(
          orphanedFiles.map(async file => {
            await file.delete();
            logger.info(`Deleted orphaned file: ${file.name}`);
          })
        );
      }
    } catch (error) {
      logger.error('Failed to cleanup orphaned files', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to cleanup orphaned files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}