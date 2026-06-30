import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Network } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';
import { useOptimisticGeneratingRow } from './hooks/useOptimisticGeneratingRow';
import { useAppDispatch } from '../../hooks/redux';
import { diagramQuizApi } from '../../store/api/DiagramQuiz/DiagramQuizApi';

interface DiagramQuizzesPanelProps {
  diagramQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'diagramQuiz' }) => void;
  ruleNamesMap?: Map<string, string>;
}

export const DiagramQuizzesPanel: React.FC<DiagramQuizzesPanelProps> = ({
  diagramQuizzes,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
  ruleNamesMap,
}) => {
  const dispatch = useAppDispatch();
  const prefetchDiagramQuiz = useCallback(
    (diagramQuizId: string) => {
      dispatch(
        diagramQuizApi.util.prefetch('getDiagramQuiz', { diagramQuizId }, { force: false }),
      );
    },
    [dispatch],
  );

  const completedCount = diagramQuizzes.filter(
    (dq) => !dq.generationStatus || dq.generationStatus === 'completed'
  ).length;
  const { showOptimisticRow, optimisticTitle } = useOptimisticGeneratingRow(
    directoryId,
    'diagramQuizzes',
    diagramQuizzes,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Diagram quizzes ({completedCount})</h2>
        <Button size="sm" asChild>
          <Link to={`/diagram-quiz/create?directoryId=${directoryId}`}>+ Create diagram quiz</Link>
        </Button>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-primary">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {diagramQuizzes.length} diagram quizzes — more may exist.</span>
        </div>
      )}
      {diagramQuizzes.length === 0 && !showOptimisticRow ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No diagram quizzes in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {showOptimisticRow && <ArtifactRowGenerating title={optimisticTitle} />}
          {diagramQuizzes.map((dq) => (
            <ArtifactRow
              key={dq.id}
              icon={Network}
              title={dq.title}
              createdAt={dq.createdAt}
              linkTo={`/diagram-quiz/${dq.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: dq.id, title: dq.title, type: 'diagramQuiz' })
              }
              deleteAriaLabel={`Delete ${dq.title}`}
              appliedRuleNames={dq.appliedRuleIds?.map((id) => ruleNamesMap?.get(id) ?? 'Unknown rule')}
              completedAt={dq.completedAt}
              generationModel={dq.generationModel}
              generationStatus={dq.generationStatus}
              generationError={dq.generationError}
              documentColor={dq.documentColor}
              documentColors={dq.documentColors}
              onLinkHover={() => prefetchDiagramQuiz(dq.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
