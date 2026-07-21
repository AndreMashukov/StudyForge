import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Brain } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useBulkArtifactPanel } from './hooks/useBulkArtifactPanel';
import { useAppDispatch } from '../../hooks/redux';
import { quizApi } from '../../store/api/Quiz/QuizApi';

interface QuizzesPanelProps {
  quizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'quiz' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const QuizzesPanel: React.FC<QuizzesPanelProps> = ({
  quizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const dispatch = useAppDispatch();
  const prefetchQuiz = useCallback(
    (quizId: string) => {
      dispatch(quizApi.util.prefetch('getQuiz', { quizId }, { force: false }));
    },
    [dispatch],
  );

  const completedCount = quizzes.filter(
    (q) => !q.generationStatus || q.generationStatus === 'completed'
  ).length;
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'quizzes',
    quizzes,
  );
  const bulk = useBulkArtifactPanel({
    artifacts: quizzes,
    artifactType: 'quiz',
    entityLabel: 'quizzes',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 min-h-9">
        <h2 className="text-lg font-semibold truncate min-w-0">Quizzes ({completedCount})</h2>
        <div className="flex items-center justify-end gap-2 shrink-0">
          {bulk.toolbar}
          <Button size="sm" asChild>
            <Link to={`/quiz/create?directoryId=${directoryId}`}>+ Create quiz</Link>
          </Button>
        </div>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {quizzes.length} quizzes — more may exist.</span>
        </div>
      )}
      {quizzes.length === 0 && !showOptimisticRow ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No quizzes in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {quizzes.map((q) => (
            <ArtifactRow
              key={q.id}
              icon={Brain}
              title={q.title}
              createdAt={q.createdAt}
              linkTo={`/quiz/${q.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: q.id, title: q.title, type: 'quiz' })
              }
              deleteAriaLabel={`Delete ${q.title}`}
              appliedRuleNames={q.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              completedAt={q.completedAt}
              generationModel={q.generationModel}
              generationStatus={q.generationStatus}
              generationError={q.generationError}
              documentColor={q.documentColor}
              documentColors={q.documentColors}
              onLinkHover={() => prefetchQuiz(q.id)}
              selected={bulk.isSelected(q.id)}
              onSelectChange={() => bulk.toggle(q.id)}
            />
          ))}
        </div>
      )}
      {bulk.dialogs}
    </div>
  );
};
