import type { FlashcardSet } from '@shared-types';

export interface IFlashcardsPageApiState {
  flashcardSets: Partial<FlashcardSet>[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}

export interface IFlashcardsPageHandlers {
  handleViewFlashcardSet: (id: string) => void;
}

export interface IFlashcardsPageContext {
  api: IFlashcardsPageApiState;
  handlers: IFlashcardsPageHandlers;
}
