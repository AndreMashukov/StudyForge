export interface IDocumentsPageHandlers {
  handleCreateDocument: () => void;
  handleViewDocument: (documentId: string) => void;
  handleDeleteDocument: (documentId: string) => void;
  handleCreateQuizFromDocument: (documentId: string, directoryId?: string) => void;
  handleGenerateFlashcardsFromDocument: (documentId: string, directoryId?: string) => void;
  handleGenerateSlideDeckFromDocument: (documentId: string, directoryId?: string) => void;
  handleSelectDirectory: (directoryId: string | null, directoryName?: string) => void;
}

export interface IDocumentsPageContext {
  handlers: IDocumentsPageHandlers;
}