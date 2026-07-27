import { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentEnhanced } from '@shared-types';
import {
  IGetUserDocumentsArgs,
  useGetUserDocumentsQuery,
  useLazyGetUserDocumentsQuery,
} from '../store/api/Documents/documentsApi';

interface IUsePaginatedUserDocumentsResult {
  documents: DocumentEnhanced[];
  total: number | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  loadError: string | null;
}

function mergeDocuments(
  firstPage: DocumentEnhanced[],
  extraPages: DocumentEnhanced[],
): DocumentEnhanced[] {
  const seen = new Set(firstPage.map((document) => document.id));
  const merged = [...firstPage];

  for (const document of extraPages) {
    if (!seen.has(document.id)) {
      merged.push(document);
      seen.add(document.id);
    }
  }

  return merged;
}

/**
 * Accumulates paginated user documents using existing getUserDocuments cursors.
 */
export function usePaginatedUserDocuments(
  args: IGetUserDocumentsArgs,
): IUsePaginatedUserDocumentsResult {
  const queryArgs = useMemo(
    () => ({
      limit: args.limit,
      ...(args.directoryId ? { directoryId: args.directoryId } : {}),
    }),
    [args.directoryId, args.limit],
  );

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetUserDocumentsQuery(queryArgs);
  const [fetchMore] = useLazyGetUserDocumentsQuery();

  const [extraDocuments, setExtraDocuments] = useState<DocumentEnhanced[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setExtraDocuments([]);
    setNextCursor(undefined);
    setHasMore(false);
    setLoadError(null);
  }, [queryArgs.directoryId, queryArgs.limit]);

  useEffect(() => {
    if (!data) {
      return;
    }
    setHasMore(data.hasMore);
    setNextCursor(data.nextCursor);
  }, [data]);

  const documents = useMemo(
    () => mergeDocuments(data?.documents ?? [], extraDocuments),
    [data?.documents, extraDocuments],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const result = await fetchMore({
        ...queryArgs,
        cursor: nextCursor,
      }).unwrap();

      setExtraDocuments((previous) => {
        const existingIds = new Set([
          ...(data?.documents ?? []).map((document) => document.id),
          ...previous.map((document) => document.id),
        ]);
        const nextBatch = result.documents.filter((document) => !existingIds.has(document.id));
        return [...previous, ...nextBatch];
      });
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (loadMoreError) {
      setLoadError(
        loadMoreError instanceof Error ? loadMoreError.message : 'Failed to load more documents',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, fetchMore, queryArgs, data?.documents]);

  return {
    documents,
    total: data?.total,
    isLoading,
    isFetching,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
    loadError,
  };
}
