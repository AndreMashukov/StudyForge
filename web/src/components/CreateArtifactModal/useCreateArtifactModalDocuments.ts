import { useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useGetDirectoryContentsWithArtifactSummariesQuery } from '../../store/api/Directory/DirectoryApi';

/**
 * Source picker must use the same directory items list as the Sources tab.
 * A separate documents-collection query can still show deleted docs from the
 * Firestore persistence cache.
 */
export function useCreateArtifactModalDocuments(directoryId: string | null) {
  const { data, isLoading, error, refetch } = useGetDirectoryContentsWithArtifactSummariesQuery(
    directoryId ? { directoryId, artifactLimit: 100 } : skipToken,
  );

  const documents = useMemo(
    () =>
      (data?.documents ?? []).filter(
        (document) => document.generationStatus !== 'pending',
      ),
    [data?.documents],
  );

  return {
    documents,
    isLoading,
    error,
    refetch,
    hasMore: false,
    isLoadingMore: false,
    loadMore: async () => undefined,
    loadError: null as string | null,
  };
}
