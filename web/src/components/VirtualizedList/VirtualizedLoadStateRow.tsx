import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface IVirtualizedLoadStateRowProps {
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const VirtualizedLoadStateRow: React.FC<IVirtualizedLoadStateRowProps> = ({
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading more...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return null;
};
