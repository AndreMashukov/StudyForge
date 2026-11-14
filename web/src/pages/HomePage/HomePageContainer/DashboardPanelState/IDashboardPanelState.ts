export interface IDashboardPanelState {
  loading?: boolean;
  error?: boolean;
  message: string;
  onRetry?: () => void;
}
