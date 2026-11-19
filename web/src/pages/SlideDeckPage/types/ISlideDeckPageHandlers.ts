export interface ISlideDeckPageHandlers {
  /** 0-based index derived from `?slide=N`, clamped to the slide deck. */
  currentSlide: number;
  /** Raw `?slide` value, used to normalise invalid URLs. */
  rawSlideParam: string | null;
  handleNavigateBack: () => void;
  handleSlideChange: (index: number) => void;
  handlePrevSlide: () => void;
  handleNextSlide: () => void;
  handleFirstSlide: () => void;
  handleLastSlide: () => void;
  handleNormalizeSlideParam: (value: string) => void;
}
