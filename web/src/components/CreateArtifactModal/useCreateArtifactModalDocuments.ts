import { useMemo } from 'react';
import { IGetUserDocumentsArgs } from '../../store/api/Documents/documentsApi';
import { usePaginatedUserDocuments } from '../../hooks/usePaginatedUserDocuments';

const ARTIFACT_SOURCE_DOCUMENTS_LIMIT = 100;

export function useCreateArtifactModalDocuments(directoryId: string | null) {
  const queryArgs: IGetUserDocumentsArgs = useMemo(
    () =>
      directoryId
        ? { directoryId, limit: ARTIFACT_SOURCE_DOCUMENTS_LIMIT }
        : { limit: ARTIFACT_SOURCE_DOCUMENTS_LIMIT },
    [directoryId],
  );

  const paginated = usePaginatedUserDocuments(queryArgs);

  return {
    documents: paginated.documents,
    isLoading: paginated.isLoading,
    error: paginated.error,
    refetch: paginated.refetch,
    hasMore: paginated.hasMore,
    isLoadingMore: paginated.isLoadingMore,
    loadMore: paginated.loadMore,
    loadError: paginated.loadError,
  };
}
