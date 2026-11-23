export interface IStarterCourseBuild {
  threadId: string;
  subject?: string;
  /** Library path of the course folder, once it exists. */
  coursePath: string | null;
  /** Library path of the instant sample folder. */
  samplePath: string | null;
  onAgentMutated: () => void;
  /** Every course document failed and a free retry is waiting. */
  retryAvailable: boolean;
  isRetrying: boolean;
  error: string | null;
  onRetry: () => void;
}
