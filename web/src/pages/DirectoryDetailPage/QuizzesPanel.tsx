import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Brain, Trash2 } from 'lucide-react';
import { Quiz } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';

interface QuizRowProps {
  quiz: Quiz;
  directoryId: string;
  onDelete: (quiz: Quiz) => void;
}

const QuizRow: React.FC<QuizRowProps> = ({ quiz, directoryId, onDelete }) => {
  return (
    <div className="group relative">
      <Link
        to={`/quiz/${quiz.id}?directoryId=${encodeURIComponent(directoryId)}`}
        className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors pr-10"
      >
        <Brain size={18} className="shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{quiz.title}</div>
          <div className="text-xs text-muted-foreground">{formatDate(quiz.createdAt)}</div>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-events-none group-hover:pointer-events-auto focus-visible:pointer-events-auto transition-opacity text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(quiz);
        }}
        aria-label={`Delete ${quiz.title}`}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
};

interface QuizzesPanelProps {
  quizzes: Quiz[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'quiz' }) => void;
}

export const QuizzesPanel: React.FC<QuizzesPanelProps> = ({
  quizzes,
  directoryId,
  mayBeTruncated = false,
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
            <QuizRow
              key={q.id}
              quiz={q}
              directoryId={directoryId}
              onDelete={(quiz) =>
                onDeleteArtifact({ id: quiz.id, title: quiz.title, type: 'quiz' })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
