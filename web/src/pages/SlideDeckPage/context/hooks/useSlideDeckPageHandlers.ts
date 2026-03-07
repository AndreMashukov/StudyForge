import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ISlideDeckPageHandlers } from '../../types/ISlideDeckPageHandlers';
import { useFullscreen } from '../../../../hooks/useFullscreen';

export const useSlideDeckPageHandlers = (): ISlideDeckPageHandlers => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { isFullscreen, handleToggleFullscreen } = useFullscreen();

  const handleNavigateBack = useCallback(() => navigate('/slides'), [navigate]);

  const handleSlideChange = useCallback((index: number) => setCurrentSlide(index), []);

  const handlePrevSlide = useCallback(
    () => setCurrentSlide((prev) => Math.max(0, prev - 1)),
    []
  );

  const handleNextSlide = useCallback(
    (maxIndex: number) => setCurrentSlide((prev) => Math.min(maxIndex, prev + 1)),
    []
  );

  const handleClampSlide = useCallback((lastIndex: number) => setCurrentSlide(lastIndex), []);

  return {
    currentSlide,
    isFullscreen,
    handleNavigateBack,
    handleSlideChange,
    handlePrevSlide,
    handleNextSlide,
    handleClampSlide,
    handleToggleFullscreen,
  };
};
