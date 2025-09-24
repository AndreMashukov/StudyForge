import { DocumentEnhanced } from "@shared-types";

export interface IDocumentsPageHandlers {
  handleCreateDocument: () => void;
  handleViewDocument: (documentId: string) => void;
  handleDeleteDocument: (documentId: string) => void;
  handleCreateQuizFromDocument: (documentId: string) => void;
  handleSearchChange: (query: string) => void;
  isGeneratingQuiz: boolean;
}

export interface IDocumentsApi {
  documents: DocumentEnhanced[] | undefined;
  isLoading: boolean;
  error: unknown;
  total?: number;
}

export interface IDocumentsPageContext {
  documentsApi: IDocumentsApi;
  handlers: IDocumentsPageHandlers;
}