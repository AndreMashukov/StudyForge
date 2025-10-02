import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { DocumentCrudService } from '../services/document-crud';
import { WebScraperService } from '../services/scraper';
import { 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  DocumentSourceType,
  DocumentStatus,
} from "../../libs/shared-types/src/index";

// Define the Gemini API key secret for markdown conversion
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Authentication middleware for callable functions
 */
async function validateAuth(context: { auth?: { uid?: string } }): Promise<string> {
  if (!context.auth || !context.auth.uid) {
    throw new Error('Unauthenticated: User must be logged in');
  }
  return context.auth.uid;
}

/**
 * Create a new document from uploaded content or URL
 */
export const createDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const data = request.data as CreateDocumentRequest;

      logger.info('Creating document', { 
        userId,
        sourceType: data.sourceType,
        title: data.title?.substring(0, 50),
      });

      // Validate request
      if (!data.sourceType || !Object.values(DocumentSourceType).includes(data.sourceType)) {
        throw new Error('Invalid or missing sourceType');
      }

      if (!data.title || data.title.trim().length === 0) {
        throw new Error('Document title is required');
      }

      if (!data.content || data.content.trim().length === 0) {
        throw new Error('Document content is required');
      }

      // Create document
      const document = await DocumentCrudService.createDocument(userId, data);

      logger.info('Document created successfully', { 
        userId,
        documentId: document.id,
        title: document.title,
      });

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to create document', { 
        error: error instanceof Error ? error.message : String(error),
        data: request.data,
      });
      throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Create a document from a URL (scrape and convert to markdown)
 */
export const createDocumentFromUrl = onCall(
  { 
    region: 'asia-east1',
    cors: true,
    secrets: [geminiApiKey], // Make the Gemini API key available to this function
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { url, title: customTitle } = request.data as { url: string; title?: string };

      logger.info('Creating document from URL', { userId, url });

      // Validate URL
      if (!url || typeof url !== 'string') {
        throw new Error('URL is required');
      }

      if (!WebScraperService.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      logger.info('Starting content scraping and markdown conversion', { url });

      // Scrape content and convert to markdown
      const scrapedContent = await WebScraperService.extractContentAsMarkdown(url);

      logger.info('Content scraped successfully', { 
        url,
        title: scrapedContent.title,
        contentLength: scrapedContent.content?.length || 0,
        markdownLength: scrapedContent.markdownContent?.length || 0,
        hasMarkdown: !!scrapedContent.markdownContent,
      });

      // Validate that we got markdown content, not just plain text
      if (!scrapedContent.markdownContent || scrapedContent.markdownContent.length === 0) {
        logger.error('Markdown conversion returned empty content', { 
          url,
          rawContentLength: scrapedContent.content?.length || 0,
        });
        throw new Error('Failed to convert content to markdown: empty result');
      }

      // Check if markdown is just plain text (no markdown formatting)
      const hasMarkdownFormatting = /[#*\-_`\[\]]/g.test(scrapedContent.markdownContent);
      if (!hasMarkdownFormatting && scrapedContent.markdownContent.length > 100) {
        logger.warn('Markdown content may be plain text without formatting', {
          url,
          contentPreview: scrapedContent.markdownContent.substring(0, 200),
        });
      }

      // Prepare document request
      const documentRequest: CreateDocumentRequest = {
        title: customTitle || scrapedContent.title,
        description: `Scraped from: ${url}`,
        content: scrapedContent.markdownContent,
        sourceType: DocumentSourceType.URL,
        sourceUrl: url,
        status: DocumentStatus.ACTIVE,
        tags: ['scraped', 'article'],
      };

      // Create document
      const document = await DocumentCrudService.createDocument(userId, documentRequest);

      logger.info('Document created from URL successfully', { 
        userId,
        documentId: document.id,
        url,
        title: document.title,
        wordCount: document.wordCount,
      });

      return { 
        success: true, 
        document,
        scrapedContent: {
          title: scrapedContent.title,
          author: scrapedContent.author,
          publishDate: scrapedContent.publishDate,
          wordCount: scrapedContent.wordCount,
        },
      };

    } catch (error) {
      logger.error('Failed to create document from URL', { 
        error: error instanceof Error ? error.message : String(error),
        url: request.data?.url,
      });
      throw new Error(`Failed to create document from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Get a document by ID
 */
export const getDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      // Additional validation to catch "undefined" string
      if (!documentId || typeof documentId !== 'string' || documentId === 'undefined' || documentId.trim() === '') {
        throw new Error('Document ID is required');
      }

      logger.info('Getting document', { userId, documentId });

      const document = await DocumentCrudService.getDocument(userId, documentId);

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to get document', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new Error(`Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Get a document with its content from storage
 */
export const getDocumentWithContent = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Document ID is required');
      }

      logger.info('Getting document with content', { userId, documentId });

      const document = await DocumentCrudService.getDocumentWithContent(userId, documentId);

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to get document with content', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new Error(`Failed to get document with content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Update a document
 */
export const updateDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId, updates } = request.data as { 
        documentId: string; 
        updates: UpdateDocumentRequest;
      };

      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Document ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates object is required');
      }

      logger.info('Updating document', { 
        userId, 
        documentId,
        hasContentUpdate: !!updates.content,
        hasMetadataUpdate: !!(updates.title || updates.description || updates.tags),
      });

      const document = await DocumentCrudService.updateDocument(userId, documentId, updates);

      return { 
        success: true, 
        document,
      };

    } catch (error) {
      logger.error('Failed to update document', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new Error(`Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Delete a document
 */
export const deleteDocument = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      if (!documentId || typeof documentId !== 'string') {
        throw new Error('Document ID is required');
      }

      logger.info('Deleting document', { userId, documentId });

      await DocumentCrudService.deleteDocument(userId, documentId);

      return { 
        success: true, 
        message: 'Document deleted successfully',
      };

    } catch (error) {
      logger.error('Failed to delete document', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Get user documents (alias for listDocuments for frontend compatibility)
 */
export const getUserDocuments = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const options = request.data || {};

      logger.info('Getting user documents', { 
        userId,
        limit: options.limit,
        sourceType: options.sourceType,
        status: options.status,
      });

      const result = await DocumentCrudService.listDocuments(userId, options);

      return { 
        success: true, 
        ...result,
      };

    } catch (error) {
      logger.error('Failed to get user documents', { 
        error: error instanceof Error ? error.message : String(error),
        options: request.data,
      });
      throw new Error(`Failed to get user documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * List documents for the authenticated user
 */
export const listDocuments = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const options = request.data || {};

      logger.info('Listing documents', { 
        userId,
        limit: options.limit,
        sourceType: options.sourceType,
        status: options.status,
      });

      const result = await DocumentCrudService.listDocuments(userId, options);

      return { 
        success: true, 
        ...result,
      };

    } catch (error) {
      logger.error('Failed to list documents', { 
        error: error instanceof Error ? error.message : String(error),
        options: request.data,
      });
      throw new Error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Search documents
 */
export const searchDocuments = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { searchTerm, ...options } = request.data as { 
        searchTerm: string; 
        limit?: number;
        sourceType?: DocumentSourceType;
        status?: DocumentStatus;
      };

      if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
        throw new Error('Search term is required');
      }

      logger.info('Searching documents', { 
        userId,
        searchTerm: searchTerm.substring(0, 50),
        options,
      });

      const documents = await DocumentCrudService.searchDocuments(userId, searchTerm, options);

      return { 
        success: true, 
        documents,
        searchTerm,
      };

    } catch (error) {
      logger.error('Failed to search documents', { 
        error: error instanceof Error ? error.message : String(error),
        searchTerm: request.data?.searchTerm?.substring(0, 50),
      });
      throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Get document statistics for the user
 */
export const getDocumentStats = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);

      logger.info('Getting document statistics', { userId });

      const stats = await DocumentCrudService.getDocumentStats(userId);

      return { 
        success: true, 
        stats,
      };

    } catch (error) {
      logger.error('Failed to get document statistics', { 
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to get document statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * Get document content for viewing/rendering
 */
export const getDocumentContent = onCall(
  { 
    region: 'asia-east1',
    cors: true,
  },
  async (request) => {
    try {
      const userId = await validateAuth(request);
      const { documentId } = request.data as { documentId: string };

      if (!documentId || documentId.trim().length === 0) {
        throw new Error('Document ID is required');
      }

      logger.info('Getting document content', { 
        userId,
        documentId,
      });

      const documentWithContent = await DocumentCrudService.getDocumentWithContent(userId, documentId);

      return { 
        success: true, 
        content: documentWithContent.content,
      };

    } catch (error) {
      logger.error('Failed to get document content', { 
        error: error instanceof Error ? error.message : String(error),
        documentId: request.data?.documentId,
      });
      throw new Error(`Failed to get document content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);