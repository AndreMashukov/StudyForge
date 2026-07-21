import React from 'react';
import { Trash2, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export interface IBulkSelectionToolbar {
  selectedCount: number;
  allVisibleSelected: boolean;
  onSelectAllVisible: () => void;
  onClear: () => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  actionVariant?: 'destructive' | 'default';
  actionIcon?: LucideIcon | null;
  className?: string;
}

/**
 * Full-width selection action bar for section headers.
 * Returns null when nothing is selected; swap it in place of the title row
 * (same min-height) so the list does not jump.
 */
export const BulkSelectionToolbar: React.FC<IBulkSelectionToolbar> = ({
  selectedCount,
  allVisibleSelected,
  onSelectAllVisible,
  onClear,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionVariant = 'destructive',
  actionIcon,
  className,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  const ActionIcon =
    actionIcon === null
      ? null
      : (actionIcon ?? (actionVariant === 'destructive' ? Trash2 : null));

  return (
    <div
      className={cn(
        'flex w-full min-h-10 items-center justify-between gap-3',
        className,
      )}
      role="region"
      aria-label="Bulk selection"
    >
      <div className="flex min-w-0 items-center gap-4 text-sm">
        <span className="whitespace-nowrap text-muted-foreground">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onSelectAllVisible}
          disabled={allVisibleSelected}
          className={cn(
            'whitespace-nowrap font-medium text-foreground transition-colors',
            'hover:text-foreground/80',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onClear}
          className="whitespace-nowrap font-medium text-foreground transition-colors hover:text-foreground/80"
        >
          Clear
        </button>
      </div>
      <Button
        type="button"
        variant={actionVariant}
        size="sm"
        onClick={onAction}
        disabled={actionDisabled}
        className="shrink-0 gap-2 rounded-lg"
      >
        {ActionIcon ? <ActionIcon size={16} aria-hidden="true" /> : null}
        {actionLabel}
      </Button>
    </div>
  );
};
