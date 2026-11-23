export interface ISubjectPicker {
  subject: string;
  suggestions: readonly string[];
  isStarting: boolean;
  isSkipping: boolean;
  error: string | null;
  onSubjectChange: (value: string) => void;
  /** Starts the course with the typed subject, or with a chosen suggestion. */
  onStart: (subject?: string) => void;
  onSkip: () => void;
}
