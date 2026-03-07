import type { FlashcardSet } from '@shared-types';

export interface IFlashcardSetPageApiState {
  flashcardSet: FlashcardSet | undefined;
  isLoading: boolean;
  error: unknown;
}

export interface IFlashcardSetPageHandlers {
  currentIndex: number;
  isFlipped: boolean;
  isFullscreen: boolean;
  handleNext: (totalCards: number) => void;
  handlePrev: () => void;
  handleFlip: () => void;
  handleRestart: () => void;
  handleGoBack: () => void;
  handleToggleFullscreen: () => void;
}

export interface IFlashcardSetPageContext {
  api: IFlashcardSetPageApiState;
  handlers: IFlashcardSetPageHandlers;
}
