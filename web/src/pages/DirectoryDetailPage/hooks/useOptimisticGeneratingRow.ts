import { useSelector } from 'react-redux';
import type { GenerationStatus } from '../../../types/generationStatus';
import {
  ArtifactPanelType,
  selectPendingGenerations,
} from '../../../store/slices/artifactGenerationSlice';

interface GeneratingListItem {
  generationStatus?: GenerationStatus;
}

export function useOptimisticGeneratingRow(
  directoryId: string,
  artifactType: ArtifactPanelType,
  items: GeneratingListItem[],
) {
  const pendingGenerations = useSelector(selectPendingGenerations);
  const pending = pendingGenerations.find(
    (generation) =>
      generation.directoryId === directoryId && generation.artifactType === artifactType,
  );
  const hasPendingInList = items.some((item) => item.generationStatus === 'pending');

  return {
    showOptimisticRow: Boolean(pending) && !hasPendingInList,
    optimisticTitle: pending?.optimisticTitle ?? 'Preparing...',
  };
}
