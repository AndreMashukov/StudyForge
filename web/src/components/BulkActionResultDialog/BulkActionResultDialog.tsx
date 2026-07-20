import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { IBulkOperationItemResult } from '@shared-types';

export interface IBulkActionResultDialog {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  succeeded: number;
  failed: number;
  results: IBulkOperationItemResult[];
  /** Optional map of id → display name for failed rows. */
  labelsById?: Record<string, string>;
}

export const BulkActionResultDialog: React.FC<IBulkActionResultDialog> = ({
  open,
  onOpenChange,
  title,
  succeeded,
  failed,
  results,
  labelsById = {},
}) => {
  const failedResults = results.filter((r) => !r.success);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {failed === 0
              ? `Successfully processed ${succeeded} item${succeeded === 1 ? '' : 's'}.`
              : `Processed ${succeeded} of ${succeeded + failed}. ${failed} failed.`}
          </DialogDescription>
        </DialogHeader>

        {failedResults.length > 0 && (
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {failedResults.map((result) => (
              <li key={result.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                <div className="font-medium text-destructive">
                  {labelsById[result.id] ?? result.id}
                </div>
                {result.error && (
                  <div className="text-xs text-muted-foreground mt-0.5">{result.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
