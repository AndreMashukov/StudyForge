import { SlideDeck } from '@shared-types';
import { ISlideDeckPageHandlers } from './ISlideDeckPageHandlers';
import { ISlideDeckFullscreen } from './ISlideDeckFullscreen';
import { ISlideDeckDownload } from './ISlideDeckDownload';

export interface ISlideDeckPageApiState {
  slideDeck: SlideDeck | undefined;
  isLoading: boolean;
  error: unknown;
}

export interface ISlideDeckPageContext {
  slideDeckApi: ISlideDeckPageApiState;
  handlers: ISlideDeckPageHandlers;
  fullscreen: ISlideDeckFullscreen;
  download: ISlideDeckDownload;
}
