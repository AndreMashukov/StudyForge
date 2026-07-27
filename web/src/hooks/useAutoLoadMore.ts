import { useEffect, useRef } from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';

interface IUseAutoLoadMoreOptions {
  virtualItems: VirtualItem[];
  totalCount: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMore?: () => void;
  threshold?: number;
}

/**
 * Triggers incremental loading when the virtual range approaches the end of the list.
 */
export function useAutoLoadMore({
  virtualItems,
  totalCount,
  hasMore = false,
  isLoadingMore = false,
  loadMore,
  threshold = 5,
}: IUseAutoLoadMoreOptions): void {
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!hasMore || isLoadingMore || !loadMoreRef.current || virtualItems.length === 0) {
      return;
    }

    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index >= totalCount - threshold) {
      loadMoreRef.current();
    }
  }, [virtualItems, totalCount, hasMore, isLoadingMore, threshold]);
}
