import type { FlashcardSet } from '@shared-types';

export type FlashcardCardOutcome = 'learned' | 'failed';

export interface IFlashcardSetPageApiState {
  flashcardSet: FlashcardSet | undefined;
  isLoading: boolean;
  error: unknown;
}

export interface IFlashcardSetPageHandlers {
  /** Index within the active study queue. */
  currentIndex: number;
  isFlipped: boolean;
  isFullscreen: boolean;
  /** Card IDs in the active study queue for this turn. */
  activeQueue: string[];
  learnedCount: number;
  failedCount: number;
  isSessionComplete: boolean;
  canStartRetake: boolean;
  /** True when the current card is graded and Next may move forward. */
  canAdvanceNext: boolean;
  handleNext: () => void;
  handlePrev: () => void;
  handleFlip: () => void;
  handleMarkLearned: () => void | Promise<void>;
  handleMarkFailed: () => void;
  handleStartRetake: () => void;
  handleRestart: () => void;
  handleGoBack: () => void;
  handleToggleFullscreen: () => void;
}

export interface IFlashcardSetPageContext {
  api: IFlashcardSetPageApiState;
  handlers: IFlashcardSetPageHandlers;
}
