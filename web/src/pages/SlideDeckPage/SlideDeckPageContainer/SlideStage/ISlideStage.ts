import type { Slide } from '@shared-types';

export interface ISlideStage {
  slide: Slide | undefined;
  slideNumber: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}
