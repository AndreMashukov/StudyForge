import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IFlashcardSetPageHandlers } from '../../types/IFlashcardSetPageContext';
import { useFullscreen } from '../../../../hooks/useFullscreen';

export const useFlashcardSetPageHandlers = (): IFlashcardSetPageHandlers => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const { isFullscreen, handleToggleFullscreen } = useFullscreen();

  const handleGoBack = () => navigate('/flashcards');

  const handleNext = (totalCards: number) => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.min(prev + 1, totalCards - 1));
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleFlip = () => setIsFlipped((prev) => !prev);

  const handleRestart = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
  };

  return { currentIndex, isFlipped, isFullscreen, handleGoBack, handleNext, handlePrev, handleFlip, handleRestart, handleToggleFullscreen };
};
