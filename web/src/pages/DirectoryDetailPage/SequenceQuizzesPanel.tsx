import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ListOrdered } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useBulkArtifactPanel } from './hooks/useBulkArtifactPanel';
import { useAppDispatch } from '../../hooks/redux';
import { sequenceQuizApi } from '../../store/api/SequenceQuiz/SequenceQuizApi';

interface SequenceQuizzesPanelProps {
  sequenceQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'sequenceQuiz' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const SequenceQuizzesPanel: React.FC<SequenceQuizzesPanelProps> = ({
  sequenceQuizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const dispatch = useAppDispatch();
  const prefetchSequenceQuiz = useCallback(
    (sequenceQuizId: string) => {
      dispatch(
        sequenceQuizApi.util.prefetch('getSequenceQuiz', { sequenceQuizId }, { force: false }),
      );
    },
    [dispatch],
  );

  const completedCount = sequenceQuizzes.filter(
    (sq) => !sq.generationStatus || sq.generationStatus === 'completed'
  ).length;
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'sequenceQuizzes',
    sequenceQuizzes,
  );
  const bulk = useBulkArtifactPanel({
    artifacts: sequenceQuizzes,
    artifactType: 'sequenceQuiz',
    entityLabel: 'sequence quizzes',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 min-h-9">
        <h2 className="text-lg font-semibold truncate min-w-0">Sequence quizzes ({completedCount})</h2>
        <div className="flex items-center justify-end gap-2 shrink-0">
          {bulk.toolbar}
          <Button size="sm" asChild>
            <Link to={`/sequence-quiz/create?directoryId=${encodeURIComponent(directoryId)}`}>+ Create sequence quiz</Link>
          </Button>
        </div>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {sequenceQuizzes.length} sequence quizzes — more may exist.</span>
        </div>
      )}
      {sequenceQuizzes.length === 0 && !showOptimisticRow ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No sequence quizzes in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {sequenceQuizzes.map((sq) => (
            <ArtifactRow
              key={sq.id}
              icon={ListOrdered}
              title={sq.title}
              createdAt={sq.createdAt}
              linkTo={`/sequence-quiz/${sq.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: sq.id, title: sq.title, type: 'sequenceQuiz' })
              }
              deleteAriaLabel={`Delete ${sq.title}`}
              appliedRuleNames={sq.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              completedAt={sq.completedAt}
              generationModel={sq.generationModel}
              generationStatus={sq.generationStatus}
              generationError={sq.generationError}
              documentColor={sq.documentColor}
              documentColors={sq.documentColors}
              onLinkHover={() => prefetchSequenceQuiz(sq.id)}
              selected={bulk.isSelected(sq.id)}
              onSelectChange={() => bulk.toggle(sq.id)}
            />
          ))}
        </div>
      )}
      {bulk.dialogs}
    </div>
  );
};
