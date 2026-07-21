import React from 'react';
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
  className?: string;
}

/**
 * Compact inline actions for a section header row.
 * Returns null when nothing is selected; pair with a min-h-9 header so the list does not jump.
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
  className,
}) => {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-end gap-1.5 sm:gap-2 shrink-0',
        className,
      )}
      role="region"
      aria-label="Bulk selection"
    >
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
        {selectedCount} selected
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSelectAllVisible}
        disabled={allVisibleSelected}
      >
        Select all
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      <Button
        type="button"
        variant={actionVariant}
        size="sm"
        onClick={onAction}
        disabled={actionDisabled}
      >
        {actionLabel}
      </Button>
    </div>
  );
};
