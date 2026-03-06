import { SlideDeck } from '@shared-types';
import { ISlideDeckPageHandlers } from './ISlideDeckPageHandlers';

export interface ISlideDeckPageApiState {
  slideDeck: SlideDeck | undefined;
  isLoading: boolean;
  error: unknown;
}

export interface ISlideDeckPageContext {
  slideDeckApi: ISlideDeckPageApiState;
  handlers: ISlideDeckPageHandlers;
}
