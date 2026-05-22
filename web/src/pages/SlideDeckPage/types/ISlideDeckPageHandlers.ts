export interface ISlideDeckPageHandlers {
  currentSlide: number;
  handleNavigateBack: () => void;
  handleSlideChange: (index: number) => void;
  handlePrevSlide: () => void;
  handleNextSlide: (maxIndex: number) => void;
  handleClampSlide: (lastIndex: number) => void;
}
