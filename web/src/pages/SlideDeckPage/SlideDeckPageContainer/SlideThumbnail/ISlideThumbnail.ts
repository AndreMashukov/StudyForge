import type { Slide } from '@shared-types';

export interface ISlideThumbnail {
  slide: Slide;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
}
