import React, { useCallback } from 'react';
import { Presentation } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { useAppDispatch } from '../../hooks/redux';
import { slideDecksApi } from '../../store/api/SlideDecks/SlideDecksApi';
import { VirtualizedArtifactPanel } from './VirtualizedArtifactPanel';

interface SlidesPanelProps {
  slideDecks: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'slideDeck' }) => void;
  ruleNamesMap?: Map<string, string>;
  onCreate: () => void;
}

export const SlidesPanel: React.FC<SlidesPanelProps> = ({
  slideDecks,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
  onCreate,
}) => {
  const dispatch = useAppDispatch();
  const prefetchSlideDeck = useCallback(
    (slideDeckId: string) => {
      dispatch(slideDecksApi.util.prefetch('getSlideDeck', { slideDeckId }, { force: false }));
    },
    [dispatch],
  );

  return (
    <VirtualizedArtifactPanel
      artifacts={slideDecks}
      directoryId={directoryId}
      panelType="slides"
      title="Slide decks"
      createLabel="+ Create slides"
      onCreate={onCreate}
      emptyMessage="No slide decks in this directory yet."
      entityLabel="slide decks"
      artifactType="slideDeck"
      icon={Presentation}
      buildLinkTo={(artifactId) =>
        `/slides/${artifactId}?directoryId=${encodeURIComponent(directoryId)}`
      }
      onDeleteArtifact={onDeleteArtifact}
      onPrefetch={prefetchSlideDeck}
      ruleNamesMap={ruleNamesMap}
      mayBeTruncated={mayBeTruncated}
    />
  );
};
