import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Network, Trash2 } from 'lucide-react';
import { DiagramQuiz } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';

interface DiagramQuizRowProps {
  diagramQuiz: DiagramQuiz;
  directoryId: string;
  onDelete: (dq: DiagramQuiz) => void;
}

const DiagramQuizRow: React.FC<DiagramQuizRowProps> = ({
  diagramQuiz,
  directoryId,
  onDelete,
}) => {
  return (
    <div className="group relative">
      <Link
        to={`/diagram-quiz/${diagramQuiz.id}?directoryId=${encodeURIComponent(directoryId)}`}
        className="flex items-center gap-3 rounded-lg border border-border p-3 pr-10 transition-colors hover:bg-muted/50"
      >
        <Network size={18} className="shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{diagramQuiz.title}</div>
          <div className="text-xs text-muted-foreground">{formatDate(diagramQuiz.createdAt)}</div>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="pointer-events-none absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring z-10 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete(diagramQuiz);
        }}
        aria-label={`Delete ${diagramQuiz.title}`}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
};

interface DiagramQuizzesPanelProps {
  diagramQuizzes: DiagramQuiz[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'diagramQuiz' }) => void;
}

export const DiagramQuizzesPanel: React.FC<DiagramQuizzesPanelProps> = ({
  diagramQuizzes,
  directoryId,
  mayBeTruncated = false,
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
            <DiagramQuizRow
              key={dq.id}
              diagramQuiz={dq}
              directoryId={directoryId}
              onDelete={(q) =>
                onDeleteArtifact({ id: q.id, title: q.title, type: 'diagramQuiz' })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
