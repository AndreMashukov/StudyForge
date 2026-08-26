import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  ArtifactPanelType,
  selectPendingGenerations,
} from '../../../store/slices/artifactGenerationSlice';

export interface OptimisticGeneratingPlaceholder {
  id: string;
  title: string;
}

export function useOptimisticGeneratingRow(
  directoryId: string,
  artifactType: ArtifactPanelType,
) {
  const pendingGenerations = useSelector(selectPendingGenerations);

  const placeholders = useMemo((): OptimisticGeneratingPlaceholder[] => {
    const matching = pendingGenerations.filter(
      (generation) =>
        generation.directoryId === directoryId && generation.artifactType === artifactType,
    );
    return matching
      .slice()
      .reverse()
      .map((generation) => ({
        id: generation.id,
        title: generation.optimisticTitle ?? 'Preparing...',
      }));
  }, [pendingGenerations, directoryId, artifactType]);

  return { placeholders };
}
