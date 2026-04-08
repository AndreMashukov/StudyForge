import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ListOrdered } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';

interface SequenceQuizzesPanelProps {
  sequenceQuizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  isGenerating?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'sequenceQuiz' }) => void;
}

export const SequenceQuizzesPanel: React.FC<SequenceQuizzesPanelProps> = ({
  sequenceQuizzes,
  directoryId,
  mayBeTruncated = false,
  isGenerating = false,
  onDeleteArtifact,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sequence quizzes ({sequenceQuizzes.length})</h2>
        <Button size="sm" asChild>
          <Link to={`/sequence-quiz/create?directoryId=${encodeURIComponent(directoryId)}`}>+ Create sequence quiz</Link>
        </Button>
      </div>
      {isGenerating && <ArtifactRowGenerating label="Generating sequence quiz…" />}
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/50 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-500">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {sequenceQuizzes.length} sequence quizzes — more may exist.</span>
        </div>
      )}
      {sequenceQuizzes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No sequence quizzes in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
