import React from 'react';
import {
  ArrowLeftRight,
  FileText,
  Folder,
  Layers,
  ListChecks,
  ListOrdered,
  MessageSquare,
  Presentation,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { LibrarySearchItemType } from '@shared-types';
import { cn } from '../../lib/utils';
import { formatDate } from '../../utils/dateUtils';
import type { ILibrarySearchResultRow } from './ILibrarySearch';

const ITEM_KINDS: Record<
  LibrarySearchItemType,
  { label: string; icon: LucideIcon }
> = {
  directory: { label: 'Directory', icon: Folder },
  document: { label: 'Document', icon: FileText },
  quiz: { label: 'Quiz', icon: ListChecks },
  flashcard: { label: 'Flashcard set', icon: Layers },
  slideDeck: { label: 'Slide deck', icon: Presentation },
  diagramQuiz: { label: 'Diagram quiz', icon: Workflow },
  sequenceQuiz: { label: 'Sequence quiz', icon: ListOrdered },
  matchQuiz: { label: 'Match quiz', icon: ArrowLeftRight },
  chat: { label: 'Chat', icon: MessageSquare },
};

const STATUS_LABELS = { pending: 'Generating…', failed: 'Failed' };

export const LibrarySearchResultRow: React.FC<ILibrarySearchResultRow> = ({
  id,
  hit,
  active,
  onSelect,
  onHover,
}) => {
  const kind = ITEM_KINDS[hit.itemType];
  const Icon = kind.icon;
  const status =
    hit.generationStatus === 'pending' || hit.generationStatus === 'failed'
      ? STATUS_LABELS[hit.generationStatus]
      : null;

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md px-3 py-2',
        active && 'bg-foreground/[0.06]',
      )}
    >
      <Icon
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {hit.title}
          </span>
          {status ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {status}
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {[
            kind.label,
            hit.path,
            hit.lastActivityAt !== undefined
              ? formatDate(hit.lastActivityAt)
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {hit.snippet ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {hit.snippet.map((segment, index) =>
              segment.highlighted ? (
                <mark
                  key={index}
                  className="rounded-sm bg-primary/20 font-medium text-foreground"
                >
                  {segment.text}
                </mark>
              ) : (
                <React.Fragment key={index}>{segment.text}</React.Fragment>
              ),
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
};
