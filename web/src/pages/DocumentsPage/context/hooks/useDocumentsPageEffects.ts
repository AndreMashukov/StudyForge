import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { DocumentEnhanced } from '@shared-types';
import { setSelectedDirectory } from '../../../../store/slices/directorySlice';

interface IUseDocumentsPageEffects {
  documents: DocumentEnhanced[] | undefined;
  handlers: {
    handleCreateQuizFromDocument: (documentId: string) => void;
  };
}

export const useDocumentsPageEffects = ({
  documents,
  handlers,
}: IUseDocumentsPageEffects) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();

  // Sync URL params with Redux state on page load
  useEffect(() => {
    const directoryId = searchParams.get('directoryId');
    if (directoryId) {
      dispatch(setSelectedDirectory(directoryId));
    } else {
      dispatch(setSelectedDirectory(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount to read initial URL params

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