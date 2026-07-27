import React, { useCallback } from 'react';
import { Layers } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { flashcardsApi } from '../../store/api/Flashcards/FlashcardsApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

interface FlashcardsPanelProps {
  flashcardSets: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'flashcard' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({
  flashcardSets,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const dispatch = useAppDispatch();
  const prefetchFlashcardSet = useCallback(
    (flashcardSetId: string) => {
      dispatch(
        flashcardsApi.util.prefetch('getFlashcardSet', { flashcardSetId }, { force: false }),
      );
    },
    [dispatch],
  );

  return (
    <VirtualizedArtifactPanel
      artifacts={flashcardSets}
      directoryId={directoryId}
      panelType="cards"
      title="Flashcards"
      createLabel="+ Create flashcards"
      createPath={`/flashcards/create?directoryId=${directoryId}`}
      emptyMessage="No flashcard sets in this directory yet."
      entityLabel="flashcard sets"
      artifactType="flashcard"
      icon={Layers}
      buildLinkTo={(artifactId) =>
        `/flashcards/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchFlashcardSet}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};
