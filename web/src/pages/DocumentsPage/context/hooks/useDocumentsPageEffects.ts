import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSelectedDirectory } from '../../../../store/slices/directorySlice';
import { useGetDocumentQuery } from '../../../../store/api/Documents';

interface IUseDocumentsPageEffects {
  handlers: {
    handleCreateQuizFromDocument: (documentId: string) => void;
  };
}

export const useDocumentsPageEffects = ({
  handlers,
}: IUseDocumentsPageEffects) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();

  const highlightDocId = searchParams.get('highlight');
  const action = searchParams.get('action');
  const shouldFetchHighlight = Boolean(highlightDocId && action === 'generate-quiz');

  const { data: highlightedDocument } = useGetDocumentQuery(highlightDocId ?? '', {
    skip: !shouldFetchHighlight || !highlightDocId,
  });

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

  // Handle URL parameters for auto-quiz generation (lazy single-document fetch)
  useEffect(() => {
    if (!shouldFetchHighlight || !highlightDocId || !highlightedDocument) {
      return;
    }

    handlers.handleCreateQuizFromDocument(highlightDocId);
    setSearchParams({});
  }, [
    shouldFetchHighlight,
    highlightDocId,
    highlightedDocument,
    handlers,
    setSearchParams,
  ]);
};
