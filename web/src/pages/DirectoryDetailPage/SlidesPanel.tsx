import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Presentation, Trash2 } from 'lucide-react';
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
        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring z-10"
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
