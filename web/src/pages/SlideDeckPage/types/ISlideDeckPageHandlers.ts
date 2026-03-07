export interface ISlideDeckPageHandlers {
  currentSlide: number;
  isFullscreen: boolean;
  handleNavigateBack: () => void;
  handleSlideChange: (index: number) => void;
  handlePrevSlide: () => void;
  handleNextSlide: (maxIndex: number) => void;
  handleClampSlide: (lastIndex: number) => void;
  handleToggleFullscreen: () => void;
}
