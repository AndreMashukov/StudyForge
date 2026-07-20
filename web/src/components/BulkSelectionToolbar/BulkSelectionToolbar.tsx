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
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2',
        className,
      )}
      role="region"
      aria-label="Bulk selection"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {selectedCount} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSelectAllVisible}
          disabled={allVisibleSelected}
        >
          Select all visible
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
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
