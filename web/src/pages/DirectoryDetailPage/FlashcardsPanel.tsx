import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Layers } from 'lucide-react';
import { FlashcardSet } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow } from './ArtifactRow';

interface FlashcardsPanelProps {
  flashcardSets: FlashcardSet[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'flashcard' }) => void;
}

export const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({
  flashcardSets,
  directoryId,
  mayBeTruncated = false,
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
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/50 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-500">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {flashcardSets.length} flashcard sets — more may exist.</span>
        </div>
      )}
      {flashcardSets.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No flashcard sets in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
