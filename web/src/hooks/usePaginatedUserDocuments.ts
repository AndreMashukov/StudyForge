import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentEnhanced } from '@shared-types';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserDocumentsFromFirestore } from '../services/documentFirestore';

export interface IGetUserDocumentsArgs {
  limit?: number;
  directoryId?: string;
}

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

function buildQueryKey(
  directoryId: string | undefined,
  limit: number | undefined,
): string {
  return `${directoryId ?? ''}:${limit ?? ''}`;
}

/**
 * Accumulates paginated user documents from Firestore.
 */
export function usePaginatedUserDocuments(
  args: IGetUserDocumentsArgs,
): IUsePaginatedUserDocumentsResult {
  const { user, loading: isAuthLoading } = useAuth();
  const queryArgs = useMemo(
    () => ({
      limit: args.limit,
      ...(args.directoryId ? { directoryId: args.directoryId } : {}),
    }),
    [args.directoryId, args.limit],
  );

  const [documents, setDocuments] = useState<DocumentEnhanced[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<unknown>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const queryKeyRef = useRef(
    buildQueryKey(queryArgs.directoryId, queryArgs.limit),
  );

  useEffect(() => {
    let isActive = true;
    const queryKey = buildQueryKey(queryArgs.directoryId, queryArgs.limit);
    queryKeyRef.current = queryKey;

    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setDocuments([]);
      setNextCursor(undefined);
      setHasMore(false);
      setLoadError(null);
      setError(new Error('Authentication required'));
      setIsLoading(false);
      setIsFetching(false);
      return;
    }

    const loadInitialPage = async () => {
      setIsLoading(true);
      setIsFetching(true);
      setError(undefined);
      setLoadError(null);
      setDocuments([]);
      setNextCursor(undefined);
      setHasMore(false);

      try {
        const page = await fetchUserDocumentsFromFirestore(user.uid, queryArgs);
        if (!isActive || queryKeyRef.current !== queryKey) {
          return;
        }
        setDocuments(page.documents);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (fetchError) {
        if (isActive && queryKeyRef.current === queryKey) {
          setError(fetchError);
        }
      } finally {
        if (isActive && queryKeyRef.current === queryKey) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    };

    void loadInitialPage();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, queryArgs, reloadToken, user]);

  const loadMore = useCallback(async () => {
    if (!user || !hasMore || isLoadingMore || !nextCursor) {
      return;
    }

    const requestKey = buildQueryKey(queryArgs.directoryId, queryArgs.limit);

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const result = await fetchUserDocumentsFromFirestore(user.uid, {
        ...queryArgs,
        cursor: nextCursor,
      });

      if (queryKeyRef.current !== requestKey) {
        return;
      }

      setDocuments((previous) => {
        const existingIds = new Set(previous.map((document) => document.id));
        const nextBatch = result.documents.filter(
          (document) => !existingIds.has(document.id),
        );
        return [...previous, ...nextBatch];
      });
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (loadMoreError) {
      if (queryKeyRef.current !== requestKey) {
        return;
      }
      setLoadError(
        loadMoreError instanceof Error
          ? loadMoreError.message
          : 'Failed to load more documents',
      );
    } finally {
      if (queryKeyRef.current === requestKey) {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoadingMore, nextCursor, queryArgs, user]);

  return {
    documents,
    total: documents.length,
    isLoading,
    isFetching,
    error,
    refetch: () => {
      setReloadToken((previous) => previous + 1);
    },
    hasMore,
    isLoadingMore,
    loadMore,
    loadError,
  };
}
