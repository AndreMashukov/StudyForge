import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Presentation } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useAppDispatch } from '../../hooks/redux';
import { slideDecksApi } from '../../store/api/SlideDecks/SlideDecksApi';

interface SlidesPanelProps {
  slideDecks: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'slideDeck' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const SlidesPanel: React.FC<SlidesPanelProps> = ({
  slideDecks,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const dispatch = useAppDispatch();
  const prefetchSlideDeck = useCallback(
    (slideDeckId: string) => {
      dispatch(slideDecksApi.util.prefetch('getSlideDeck', { slideDeckId }, { force: false }));
    },
    [dispatch],
  );

  const completedCount = slideDecks.filter(
    (s) => !s.generationStatus || s.generationStatus === 'completed'
  ).length;
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'slides',
    slideDecks,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Slide decks ({completedCount})</h2>
        <Button size="sm" asChild>
          <Link to={`/slides/create?directoryId=${directoryId}`}>+ Create slides</Link>
        </Button>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {slideDecks.length} slide decks — more may exist.</span>
        </div>
      )}
      {slideDecks.length === 0 && !showOptimisticRow ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No slide decks in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {slideDecks.map((s) => (
            <ArtifactRow
              key={s.id}
              icon={Presentation}
              title={s.title}
              createdAt={s.createdAt}
              linkTo={`/slides/${s.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: s.id, title: s.title, type: 'slideDeck' })
              }
              deleteAriaLabel={`Delete ${s.title}`}
              appliedRuleNames={s.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              completedAt={s.completedAt}
              generationModel={s.generationModel}
              generationStatus={s.generationStatus}
              generationError={s.generationError}
              documentColor={s.documentColor}
              documentColors={s.documentColors}
              onLinkHover={() => prefetchSlideDeck(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
