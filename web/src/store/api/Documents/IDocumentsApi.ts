import { 
  DocumentEnhanced, 
  CreateDocumentRequest,
  CreateDocumentFromUrlsRequest,
  UploadDocumentRequest,
  UpdateDocumentRequest,
  DeleteDocumentRequest
} from '@shared-types';
import { IGetUserDocumentsArgs } from './documentsApi';

interface ListDocumentsResponse {
  documents: DocumentEnhanced[];
  total: number;
  hasMore: boolean;
}

export interface IDocumentsApi {
  // Document CRUD operations
  getUserDocuments: (args?: IGetUserDocumentsArgs) => ListDocumentsResponse;
  getDocument: (documentId: string) => DocumentEnhanced;
  createDocument: (data: CreateDocumentRequest) => DocumentEnhanced;
  createDocumentFromUrl: (data: CreateDocumentFromUrlsRequest) => DocumentEnhanced;
  uploadAndCreateDocument: (data: UploadDocumentRequest) => DocumentEnhanced;
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