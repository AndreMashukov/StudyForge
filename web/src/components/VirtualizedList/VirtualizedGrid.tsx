import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import { useAutoLoadMore } from '../../hooks/useAutoLoadMore';
import { useNearestScrollParent } from '../../hooks/useNearestScrollParent';
import { VirtualizedLoadStateRow } from './VirtualizedLoadStateRow';

export interface IVirtualizedGridProps<T> {
  items: T[];
  columns: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateRowSize?: number;
  gap?: number;
  overscan?: number;
  /**
   * `container` — scroll inside this grid.
   * `window` — scroll with the nearest page/layout scroll parent
   * (StudyForge `<Page>` main), not the browser window.
   */
  scrollMode?: 'container' | 'window';
  className?: string;
  containerClassName?: string;
  rowClassName?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMore?: () => void;
  loadError?: string | null;
  onRetryLoad?: () => void;
  leadingContent?: React.ReactNode;
  trailingContent?: React.ReactNode;
}

function getVirtualRowCount(
  itemCount: number,
  columns: number,
  hasMore: boolean,
  isLoadingMore: boolean,
  loadError: string | null | undefined,
): number {
  const dataRows = Math.ceil(itemCount / columns);
  if (hasMore || isLoadingMore || loadError) {
    return dataRows + 1;
  }
  return dataRows;
}

export function VirtualizedGrid<T>({
  items,
  columns,
  renderItem,
  estimateRowSize = 280,
  gap = 16,
  overscan = 4,
  scrollMode = 'window',
  className,
  containerClassName,
  rowClassName,
  hasMore = false,
  isLoadingMore = false,
  loadMore,
  loadError = null,
  onRetryLoad,
  leadingContent,
  trailingContent,
}: IVirtualizedGridProps<T>): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isPageScroll = scrollMode === 'window';

  const { scrollElement, scrollMargin } = useNearestScrollParent(
    gridRef,
    isPageScroll,
    [leadingContent, columns],
  );

  const rowCount = getVirtualRowCount(items.length, columns, hasMore, isLoadingMore, loadError);
  const dataRowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () =>
      isPageScroll ? scrollElement : containerRef.current,
    estimateSize: () => estimateRowSize,
    gap,
    overscan,
    scrollMargin: isPageScroll ? scrollMargin : 0,
    enabled: isPageScroll ? scrollElement != null : true,
  });

  const virtualRows = virtualizer.getVirtualItems();

  useAutoLoadMore({
    virtualItems: virtualRows,
    totalCount: rowCount,
    hasMore,
    isLoadingMore,
    loadMore,
  });

  const rowTemplate = useMemo(
    () => ({ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }),
    [columns],
  );

  const gridBody = (
    <div
      ref={isPageScroll ? gridRef : undefined}
      className="relative w-full"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const isLoadState = virtualRow.index >= dataRowCount;
        const offset = isPageScroll
          ? virtualRow.start - scrollMargin
          : virtualRow.start;

        if (isLoadState) {
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${offset}px)` }}
            >
              <VirtualizedLoadStateRow
                isLoading={isLoadingMore}
                error={loadError}
                onRetry={onRetryLoad ?? loadMore}
              />
            </div>
          );
        }

        const startIndex = virtualRow.index * columns;
        const rowItems = items.slice(startIndex, startIndex + columns);

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className={cn('absolute left-0 top-0 grid w-full', rowClassName)}
            style={{
              transform: `translateY(${offset}px)`,
              gap: `${gap}px`,
              ...rowTemplate,
            }}
          >
            {rowItems.map((item, columnIndex) => (
              <React.Fragment key={startIndex + columnIndex}>
                {renderItem(item, startIndex + columnIndex)}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );

  if (isPageScroll) {
    return (
      <div className={cn('w-full', className)}>
        {leadingContent}
        {gridBody}
        {trailingContent}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {leadingContent}
      <div ref={containerRef} className={cn('overflow-y-auto', containerClassName)}>
        {gridBody}
      </div>
      {trailingContent}
    </div>
  );
}
