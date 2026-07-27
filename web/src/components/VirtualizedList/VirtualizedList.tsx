import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import { useAutoLoadMore } from '../../hooks/useAutoLoadMore';
import { useNearestScrollParent } from '../../hooks/useNearestScrollParent';
import { VirtualizedLoadStateRow } from './VirtualizedLoadStateRow';

export interface IVirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  gap?: number;
  overscan?: number;
  /**
   * `container` — scroll inside this list.
   * `window` — scroll with the nearest page/layout scroll parent
   * (StudyForge `<Page>` main), not the browser window.
   */
  scrollMode?: 'container' | 'window';
  className?: string;
  containerClassName?: string;
  listClassName?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMore?: () => void;
  loadError?: string | null;
  onRetryLoad?: () => void;
  leadingContent?: React.ReactNode;
  trailingContent?: React.ReactNode;
}

function getVirtualCount(
  itemCount: number,
  hasMore: boolean,
  isLoadingMore: boolean,
  loadError: string | null | undefined,
): number {
  if (hasMore || isLoadingMore || loadError) {
    return itemCount + 1;
  }
  return itemCount;
}

function isLoadStateIndex(index: number, itemCount: number): boolean {
  return index >= itemCount;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 72,
  gap = 8,
  overscan = 8,
  scrollMode = 'container',
  className,
  containerClassName,
  listClassName,
  hasMore = false,
  isLoadingMore = false,
  loadMore,
  loadError = null,
  onRetryLoad,
  leadingContent,
  trailingContent,
}: IVirtualizedListProps<T>): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isPageScroll = scrollMode === 'window';

  const { scrollElement, scrollMargin } = useNearestScrollParent(
    listRef,
    isPageScroll,
    leadingContent,
  );

  const itemCount = items.length;
  const virtualCount = getVirtualCount(itemCount, hasMore, isLoadingMore, loadError);

  const virtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () =>
      isPageScroll ? scrollElement : containerRef.current,
    estimateSize: () => estimateSize,
    gap,
    overscan,
    scrollMargin: isPageScroll ? scrollMargin : 0,
    enabled: isPageScroll ? scrollElement != null : true,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useAutoLoadMore({
    virtualItems,
    totalCount: virtualCount,
    hasMore,
    isLoadingMore,
    loadMore,
  });

  const listBody = (
    <div
      ref={isPageScroll ? listRef : undefined}
      className={cn('relative w-full', listClassName)}
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualItems.map((virtualItem) => {
        const isLoadState = isLoadStateIndex(virtualItem.index, itemCount);
        const offset = isPageScroll
          ? virtualItem.start - scrollMargin
          : virtualItem.start;

        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${offset}px)` }}
          >
            {isLoadState ? (
              <VirtualizedLoadStateRow
                isLoading={isLoadingMore}
                error={loadError}
                onRetry={onRetryLoad ?? loadMore}
              />
            ) : (
              renderItem(items[virtualItem.index], virtualItem.index)
            )}
          </div>
        );
      })}
    </div>
  );

  if (isPageScroll) {
    return (
      <div className={cn('w-full', className)}>
        {leadingContent}
        {listBody}
        {trailingContent}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {leadingContent}
      <div ref={containerRef} className={cn('overflow-y-auto', containerClassName)}>
        {listBody}
      </div>
      {trailingContent}
    </div>
  );
}
