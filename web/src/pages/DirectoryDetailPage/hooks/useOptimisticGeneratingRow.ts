import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { GenerationStatus } from '../../../types/generationStatus';
import {
  ArtifactPanelType,
  IPendingGeneration,
  selectPendingGenerations,
} from '../../../store/slices/artifactGenerationSlice';

export interface IOptimisticGeneratingPlaceholder {
  id: string;
  title: string;
}

export interface IOptimisticGeneratingListItem {
  title: string;
  generationStatus?: GenerationStatus;
  createdAt?: string | Date | { toDate(): Date };
}

/** Allow server timestamps to land slightly before the client click clock. */
const PENDING_ITEM_CLOCK_SKEW_MS = 250;

export function listItemCreatedAtMs(
  item: IOptimisticGeneratingListItem,
): number | null {
  const value = item.createdAt;
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value.toDate === 'function') {
    const time = value.toDate().getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function claimPendingItemIndex(
  items: IOptimisticGeneratingListItem[],
  claimedItemIndexes: Set<number>,
  predicate: (item: IOptimisticGeneratingListItem) => boolean,
): number {
  return items.findIndex(
    (item, index) =>
      !claimedItemIndexes.has(index) &&
      item.generationStatus === 'pending' &&
      predicate(item),
  );
}

export function selectOptimisticGeneratingPlaceholders(
  pendingGenerations: IPendingGeneration[],
  directoryId: string,
  artifactType: ArtifactPanelType,
  items: IOptimisticGeneratingListItem[],
): IOptimisticGeneratingPlaceholder[] {
  const matching = pendingGenerations.filter(
    (generation) =>
      generation.directoryId === directoryId &&
      generation.artifactType === artifactType,
  );

  const claimedItemIndexes = new Set<number>();

  const unmatched = matching.filter((generation) => {
    const optimisticTitle = generation.optimisticTitle?.trim();

    if (optimisticTitle) {
      const titledIndex = claimPendingItemIndex(
        items,
        claimedItemIndexes,
        (item) => item.title === optimisticTitle,
      );
      if (titledIndex !== -1) {
        claimedItemIndexes.add(titledIndex);
        return false;
      }
    }

    const startedAtMs = generation.startedAtMs;
    const createdAfterIndex = claimPendingItemIndex(
      items,
      claimedItemIndexes,
      (item) => {
        const createdAtMs = listItemCreatedAtMs(item);
        if (createdAtMs === null) {
          return false;
        }
        return createdAtMs >= startedAtMs - PENDING_ITEM_CLOCK_SKEW_MS;
      },
    );

    if (createdAfterIndex !== -1) {
      claimedItemIndexes.add(createdAfterIndex);
      return false;
    }

    return true;
  });

  return unmatched
    .slice()
    .reverse()
    .map((generation) => ({
      id: generation.id,
      title: generation.optimisticTitle ?? 'Preparing...',
    }));
}

export function useOptimisticGeneratingRow(
  directoryId: string,
  artifactType: ArtifactPanelType,
  items: IOptimisticGeneratingListItem[],
) {
  const pendingGenerations = useSelector(selectPendingGenerations);

  const placeholders = useMemo(
    () =>
      selectOptimisticGeneratingPlaceholders(
        pendingGenerations,
        directoryId,
        artifactType,
        items,
      ),
    [pendingGenerations, directoryId, artifactType, items],
  );

  return { placeholders };
}
