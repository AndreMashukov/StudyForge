import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import { useAutoLoadMore } from '../../hooks/useAutoLoadMore';
import { useNearestScrollParent } from '../../hooks/useNearestScrollParent';
import { VirtualizedLoadStateRow } from './VirtualizedLoadStateRow';

export interface IVirtualizedTableBodyProps<T> {
  items: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  /**
   * `container` — scroll inside a wrapper around the table.
   * `window` — scroll with the nearest page/layout scroll parent
   * (StudyForge `<Page>` main), not the browser window.
   */
  scrollMode?: 'container' | 'window';
  className?: string;
  containerClassName?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMore?: () => void;
  loadError?: string | null;
  onRetryLoad?: () => void;
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

export function VirtualizedTableBody<T>({
  items,
  renderRow,
  estimateSize = 64,
  overscan = 8,
  scrollMode = 'window',
  className,
  containerClassName,
  hasMore = false,
  isLoadingMore = false,
  loadMore,
  loadError = null,
  onRetryLoad,
}: IVirtualizedTableBodyProps<T>): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const isPageScroll = scrollMode === 'window';

  const { scrollElement, scrollMargin } = useNearestScrollParent(bodyRef, isPageScroll);

  const itemCount = items.length;
  const virtualCount = getVirtualCount(itemCount, hasMore, isLoadingMore, loadError);

  const virtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () =>
      isPageScroll ? scrollElement : containerRef.current,
    estimateSize: () => estimateSize,
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

  const rows = virtualItems.map((virtualItem) => {
    const isLoadState = virtualItem.index >= itemCount;
    const offset = isPageScroll
      ? virtualItem.start - scrollMargin
      : virtualItem.start;

    if (isLoadState) {
      return (
        <tr key={virtualItem.key}>
          <td colSpan={1000} className="p-0">
            <div
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${offset}px)` }}
            >
              <VirtualizedLoadStateRow
                isLoading={isLoadingMore}
                error={loadError}
                onRetry={onRetryLoad ?? loadMore}
              />
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr
        key={virtualItem.key}
        data-index={virtualItem.index}
        ref={virtualizer.measureElement}
        style={{ transform: `translateY(${offset}px)` }}
        className="absolute left-0 top-0 w-full table-fixed"
      >
        {renderRow(items[virtualItem.index], virtualItem.index)}
      </tr>
    );
  });

  const tbody = (
    <tbody
      ref={bodyRef}
      className={cn('relative block w-full', className)}
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {rows}
    </tbody>
  );

  if (scrollMode === 'container') {
    return (
      <div ref={containerRef} className={cn('overflow-y-auto', containerClassName)}>
        <table className="w-full">{tbody}</table>
      </div>
    );
  }

  return tbody;
}
