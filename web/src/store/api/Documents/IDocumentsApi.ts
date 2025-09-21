import { 
  DocumentEnhanced, 
  CreateDocumentRequest,
  CreateDocumentFromUrlRequest,
  UpdateDocumentRequest,
  DeleteDocumentRequest
} from '@shared-types';

interface ListDocumentsResponse {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
}

export interface IDocumentsApi {
  // Document CRUD operations
  getUserDocuments: () => ListDocumentsResponse;
  getDocument: (documentId: string) => DocumentEnhanced;
  createDocument: (data: CreateDocumentRequest) => DocumentEnhanced;
  createDocumentFromUrl: (data: CreateDocumentFromUrlRequest) => DocumentEnhanced;
  updateDocument: (data: UpdateDocumentRequest) => DocumentEnhanced;
  deleteDocument: (data: DeleteDocumentRequest) => { success: boolean };
  
  // Search and filter operations
  searchDocuments: (query: string) => ListDocumentsResponse;
}

export interface IDocumentListResponse {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
}