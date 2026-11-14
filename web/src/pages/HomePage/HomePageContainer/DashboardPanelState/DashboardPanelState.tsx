import { AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Spinner } from '../../../../components/ui/Spinner';
import type { IDashboardPanelState } from './IDashboardPanelState';

export const DashboardPanelState = ({
  loading,
  error,
  message,
  onRetry,
}: IDashboardPanelState) => (
  <div
    className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground"
    role={error ? 'alert' : 'status'}
  >
    {loading ? (
      <Spinner size="lg" variant="muted" />
    ) : error ? (
      <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
    ) : null}
    <p>{message}</p>
    {error && onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);
