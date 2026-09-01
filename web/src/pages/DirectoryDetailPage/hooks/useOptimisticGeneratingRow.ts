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
}

export function selectOptimisticGeneratingPlaceholders(
  pendingGenerations: IPendingGeneration[],
  directoryId: string,
  artifactType: ArtifactPanelType,
  items: IOptimisticGeneratingListItem[],
): IOptimisticGeneratingPlaceholder[] {
  const matching = pendingGenerations.filter(
    (generation) =>
      generation.directoryId === directoryId && generation.artifactType === artifactType,
  );

  const claimedItemIndexes = new Set<number>();

  const unmatched = matching.filter((generation) => {
    const optimisticTitle = generation.optimisticTitle;
    if (!optimisticTitle) {
      return true;
    }

    const itemIndex = items.findIndex(
      (item, index) =>
        !claimedItemIndexes.has(index) &&
        item.generationStatus === 'pending' &&
        item.title === optimisticTitle,
    );

    if (itemIndex === -1) {
      return true;
    }

    claimedItemIndexes.add(itemIndex);
    return false;
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
