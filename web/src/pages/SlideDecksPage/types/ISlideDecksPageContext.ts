import { SlideDeck } from '@shared-types';
import { ISlideDecksPageHandlers } from './ISlideDecksPageHandlers';

export interface ISlideDecksPageApiState {
  slideDecks: SlideDeck[];
  isLoading: boolean;
  error: unknown;
}

export interface ISlideDecksPageContext {
  slideDecksApi: ISlideDecksPageApiState;
  handlers: ISlideDecksPageHandlers;
}
