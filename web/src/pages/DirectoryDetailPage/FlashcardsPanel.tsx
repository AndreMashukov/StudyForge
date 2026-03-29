import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, Trash2 } from 'lucide-react';
import { FlashcardSet } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';

interface FlashcardRowProps {
  flashcard: FlashcardSet;
  directoryId: string;
  onDelete: (flashcard: FlashcardSet) => void;
}

const FlashcardRow: React.FC<FlashcardRowProps> = ({ flashcard, directoryId, onDelete }) => {
  return (
    <div className="group relative">
      <Link
        to={`/flashcards/${flashcard.id}?directoryId=${encodeURIComponent(directoryId)}`}
        className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors pr-10"
      >
        <Layers size={18} className="shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{flashcard.title}</div>
          <div className="text-xs text-muted-foreground">{formatDate(flashcard.createdAt)}</div>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity text-muted-foreground hover:text-destructive z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(flashcard);
        }}
        aria-label={`Delete ${flashcard.title}`}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
};

interface FlashcardsPanelProps {
  flashcardSets: FlashcardSet[];
  directoryId: string;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'flashcard' }) => void;
}

export const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({
  flashcardSets,
  directoryId,
  onDeleteArtifact,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Flashcards ({flashcardSets.length})</h2>
        <Button size="sm" asChild>
          <Link to={`/flashcards/create?directoryId=${directoryId}`}>+ Create flashcards</Link>
        </Button>
      </div>

      {flashcardSets.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No flashcard sets in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {flashcardSets.map((f) => (
            <FlashcardRow
              key={f.id}
              flashcard={f}
              directoryId={directoryId}
              onDelete={(fc) =>
                onDeleteArtifact({ id: fc.id, title: fc.title, type: 'flashcard' })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
