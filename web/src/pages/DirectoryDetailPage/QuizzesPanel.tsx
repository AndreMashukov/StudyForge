import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Brain } from 'lucide-react';
import { ArtifactSummary } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow, ArtifactRowGenerating } from './ArtifactRow';

interface QuizzesPanelProps {
  quizzes: ArtifactSummary[];
  directoryId: string;
  mayBeTruncated?: boolean;
  isGenerating?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'quiz' }) => void;
}

export const QuizzesPanel: React.FC<QuizzesPanelProps> = ({
  quizzes,
  directoryId,
  mayBeTruncated = false,
  isGenerating = false,
  onDeleteArtifact,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quizzes ({quizzes.length})</h2>
        <Button size="sm" asChild>
          <Link to={`/quiz/create?directoryId=${directoryId}`}>+ Create quiz</Link>
        </Button>
      </div>
      {isGenerating && <ArtifactRowGenerating label="Generating quiz…" />}
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/50 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-500">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {quizzes.length} quizzes — more may exist.</span>
        </div>
      )}
      {quizzes.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No quizzes in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
