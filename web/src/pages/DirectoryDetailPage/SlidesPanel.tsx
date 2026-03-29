import React from 'react';
import { Link } from 'react-router-dom';
import { Presentation, Trash2 } from 'lucide-react';
import { SlideDeck } from '@shared-types';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../../components/ui/Button';

interface SlideRowProps {
  slide: SlideDeck;
  directoryId: string;
  onDelete: (slide: SlideDeck) => void;
}

const SlideRow: React.FC<SlideRowProps> = ({ slide, directoryId, onDelete }) => {
  return (
    <div className="group relative">
      <Link
        to={`/slides/${slide.id}?directoryId=${encodeURIComponent(directoryId)}`}
        className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors pr-10"
      >
        <Presentation size={18} className="shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{slide.title}</div>
          <div className="text-xs text-muted-foreground">{formatDate(slide.createdAt)}</div>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity text-muted-foreground hover:text-destructive z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(slide);
        }}
        aria-label={`Delete ${slide.title}`}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
};

interface SlidesPanelProps {
  slideDecks: SlideDeck[];
  directoryId: string;
  onDeleteArtifact: (artifact: { id: string; title: string; type: 'slideDeck' }) => void;
}

export const SlidesPanel: React.FC<SlidesPanelProps> = ({
  slideDecks,
  directoryId,
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

      {slideDecks.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No slide decks in this directory yet.
        </div>
      ) : (
        <div className="space-y-2">
          {slideDecks.map((s) => (
            <SlideRow
              key={s.id}
              slide={s}
              directoryId={directoryId}
              onDelete={(sd) =>
                onDeleteArtifact({ id: sd.id, title: sd.title, type: 'slideDeck' })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
