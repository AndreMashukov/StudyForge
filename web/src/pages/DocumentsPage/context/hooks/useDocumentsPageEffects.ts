import { useEffect } from 'react';
import { ReadonlyURLSearchParams } from 'react-router-dom';
import { DocumentEnhanced } from '@shared-types';

interface IUseDocumentsPageEffects {
  searchParams: ReadonlyURLSearchParams;
  setSearchParams: (params: Record<string, string>) => void;
  documents: DocumentEnhanced[] | undefined;
  handlers: {
    handleCreateQuizFromDocument: (documentId: string) => Promise<void>;
  };
}

export const useDocumentsPageEffects = ({
  searchParams,
  setSearchParams,
  documents,
  handlers,
}: IUseDocumentsPageEffects) => {
  // Handle URL parameters for auto-quiz generation
  useEffect(() => {
    const highlightDocId = searchParams.get('highlight');
    const action = searchParams.get('action');

    if (highlightDocId && action === 'generate-quiz' && documents && documents.length > 0) {
      const documentExists = documents.find(doc => doc.id === highlightDocId);
      if (documentExists) {
        // Auto-trigger quiz generation for the highlighted document
        console.log('Auto-triggering quiz generation for document:', highlightDocId);
        handlers.handleCreateQuizFromDocument(highlightDocId);

        // Clear the URL parameters after processing
        setSearchParams({});
      }
    }
  }, [documents, searchParams, setSearchParams, handlers]);
};