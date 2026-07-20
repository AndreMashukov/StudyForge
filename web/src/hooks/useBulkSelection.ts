import { useCallback, useEffect, useMemo, useState } from 'react';
import { BULK_OPERATION_MAX_ITEMS } from '@shared-types';
import { useToast } from '../components/Toast';

export interface IUseBulkSelectionOptions {
  /** IDs currently rendered in the list. Selection is pruned to this set. */
  visibleIds: string[];
}

export interface IUseBulkSelectionResult {
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAllVisible: () => void;
  clear: () => void;
  /** Keep only the given IDs selected (e.g. failed items after a bulk action). */
  keepOnly: (ids: string[]) => void;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * Visible-list-scoped multi-select. Clears when the visible ID set changes.
 * Selection is capped at BULK_OPERATION_MAX_ITEMS to match bulk callables.
 */
export function useBulkSelection({
  visibleIds,
}: IUseBulkSelectionOptions): IUseBulkSelectionResult {
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visibleKey = useMemo(() => [...visibleIds].sort().join('|'), [visibleIds]);

  const selectableVisibleIds = useMemo(
    () => visibleIds.slice(0, BULK_OPERATION_MAX_ITEMS),
    [visibleIds],
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(visibleIds);
      const next = prev.filter((id) => visible.has(id)).slice(0, BULK_OPERATION_MAX_ITEMS);
      return sameIdSet(prev, next) ? prev : next;
    });
    // Reset when the visible set identity changes (nav/filter/tab).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleKey encodes visibleIds
  }, [visibleKey]);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  const toggle = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        return;
      }
      if (selectedIds.length >= BULK_OPERATION_MAX_ITEMS) {
        showToast(
          `You can select at most ${BULK_OPERATION_MAX_ITEMS} items at a time.`,
          'warning',
        );
        return;
      }
      setSelectedIds((prev) => [...prev, id]);
    },
    [selectedIds, showToast],
  );

  const selectAllVisible = useCallback(() => {
    if (visibleIds.length > BULK_OPERATION_MAX_ITEMS) {
      setSelectedIds([...selectableVisibleIds]);
      showToast(
        `Selected the first ${BULK_OPERATION_MAX_ITEMS} of ${visibleIds.length} visible items. Bulk actions are limited to ${BULK_OPERATION_MAX_ITEMS} items per request.`,
        'warning',
      );
      return;
    }
    setSelectedIds([...visibleIds]);
  }, [visibleIds, selectableVisibleIds, showToast]);

  const clear = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const keepOnly = useCallback((ids: string[]) => {
    setSelectedIds(ids.slice(0, BULK_OPERATION_MAX_ITEMS));
  }, []);

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = selectedIds.length > 0;

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected,
    toggle,
    selectAllVisible,
    clear,
    keepOnly,
    allVisibleSelected,
    someVisibleSelected,
  };
}
