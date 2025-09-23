import { DocumentEnhanced } from "@shared-types";

export interface IDocumentsPageHandlers {
  handleCreateDocument: () => void;
  handleViewDocument: (documentId: string) => void;
  handleDeleteDocument: (documentId: string) => void;
  handleCreateQuizFromDocument: (documentId: string) => void;
  handleSearchChange: (query: string) => void;
  isGeneratingQuiz: boolean;
}

export interface IDocumentsPageContext {
  documents: DocumentEnhanced[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  handlers: IDocumentsPageHandlers;
}