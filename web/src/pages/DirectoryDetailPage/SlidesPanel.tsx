import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Presentation } from 'lucide-react';
import { SlideDeck } from '@shared-types';
import { Button } from '../../components/ui/Button';
import { ArtifactRow } from './ArtifactRow';

interface SlidesPanelProps {
  slideDecks: SlideDeck[];
  directoryId: string;
  mayBeTruncated?: boolean;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'slideDeck' }) => void;
}

export const SlidesPanel: React.FC<SlidesPanelProps> = ({
  slideDecks,
  directoryId,
  mayBeTruncated = false,
  onDeleteArtifact,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Slide decks ({slideDecks.length})</h2>
        <Button size="sm" asChild>
          <Link to={`/slides/create?directoryId=${directoryId}`}>+ Create slides</Link>
        </Button>
      </div>
      {mayBeTruncated && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-600/50 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-500">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Showing first {slideDecks.length} slide decks — more may exist.</span>
        </div>
      )}
      {slideDecks.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No slide decks in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {slideDecks.map((s) => (
            <ArtifactRow
              key={s.id}
              icon={Presentation}
              title={s.title}
              createdAt={s.createdAt}
              linkTo={`/slides/${s.id}?directoryId=${encodeURIComponent(directoryId)}`}
              onDelete={() =>
                onDeleteArtifact({ id: s.id, title: s.title, type: 'slideDeck' })
              }
              deleteAriaLabel={`Delete ${s.title}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
