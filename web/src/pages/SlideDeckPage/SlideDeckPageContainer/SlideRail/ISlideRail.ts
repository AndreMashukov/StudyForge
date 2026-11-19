import type { Slide } from '@shared-types';

export interface ISlideRail {
  slides: Slide[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}
