import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Network } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';

interface DiagramQuizzesPanelProps {
  diagramQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  isGenerating?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'diagramQuiz' }) => void;
}

export const DiagramQuizzesPanel: React.FC<DiagramQuizzesPanelProps> = ({
  diagramQuizzes,
  directoryId,
  mayBeTruncated = false,
  isGenerating = false,
  onDeleteArtifact,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Diagram quizzes ({diagramQuizzes.length})</h2>
        <Button size="sm" asChild>
          <Link to={`/diagram-quiz/create?directoryId=${directoryId}`}>+ Create diagram quiz</Link>
        </Button>
      </div>
      {isGenerating && <ArtifactRowGenerating label="Generating diagram quiz…" />}
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/50 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-500">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {diagramQuizzes.length} diagram quizzes — more may exist.</span>
        </div>
      )}
      {diagramQuizzes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No diagram quizzes in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
