import { useSelector } from 'react-redux';
import { selectIsLoading, selectLoadingMessage } from '../../store/slices/uiSlice';
import { Spinner } from '../ui/Spinner';

export const GlobalLoadingOverlay = () => {
  const isLoading = useSelector(selectIsLoading);
  const loadingMessage = useSelector(selectLoadingMessage);

  if (!isLoading) {
    return null;
  }

  const message = loadingMessage ?? 'Working…';

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Spinner size="lg" variant="muted" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
};
