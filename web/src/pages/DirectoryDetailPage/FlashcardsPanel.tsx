import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Layers } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useBulkArtifactPanel } from './hooks/useBulkArtifactPanel';
import { useAppDispatch } from '../../hooks/redux';
import { flashcardsApi } from '../../store/api/Flashcards/FlashcardsApi';

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

  const completedCount = flashcardSets.filter(
    (f) => !f.generationStatus || f.generationStatus === 'completed'
  ).length;
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'cards',
    flashcardSets,
  );
  const bulk = useBulkArtifactPanel({
    artifacts: flashcardSets,
    artifactType: 'flashcard',
    entityLabel: 'flashcard sets',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 min-h-9">
        <h2 className="text-lg font-semibold truncate min-w-0">Flashcards ({completedCount})</h2>
        <div className="flex items-center justify-end gap-2 shrink-0">
          {bulk.toolbar}
          <Button size="sm" asChild>
            <Link to={`/flashcards/create?directoryId=${directoryId}`}>+ Create flashcards</Link>
          </Button>
        </div>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {flashcardSets.length} flashcard sets — more may exist.</span>
        </div>
      )}
      {flashcardSets.length === 0 && !showOptimisticRow ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No flashcard sets in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {flashcardSets.map((f) => (
            <ArtifactRow
              key={f.id}
              icon={Layers}
              title={f.title}
              createdAt={f.createdAt}
              linkTo={`/flashcards/${f.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: f.id, title: f.title, type: 'flashcard' })
              }
              deleteAriaLabel={`Delete ${f.title}`}
              appliedRuleNames={f.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              completedAt={f.completedAt}
              generationModel={f.generationModel}
              generationStatus={f.generationStatus}
              generationError={f.generationError}
              documentColor={f.documentColor}
              documentColors={f.documentColors}
              onLinkHover={() => prefetchFlashcardSet(f.id)}
              selected={bulk.isSelected(f.id)}
              onSelectChange={() => bulk.toggle(f.id)}
            />
          ))}
        </div>
      )}
      {bulk.dialogs}
    </div>
  );
};
