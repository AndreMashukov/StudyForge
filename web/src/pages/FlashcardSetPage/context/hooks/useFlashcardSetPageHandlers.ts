import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IFlashcardSetPageHandlers } from '../../types/IFlashcardSetPageContext';
import { useFullscreen } from '../../../../hooks/useFullscreen';

export const useFlashcardSetPageHandlers = (
  directoryIdFromData?: string | null
): IFlashcardSetPageHandlers => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const { isFullscreen, handleToggleFullscreen } = useFullscreen();

  const resolvedDirectoryId = useMemo(() => {
    const fromData = directoryIdFromData?.trim();
    const fromQuery = searchParams.get('directoryId')?.trim();
    return fromData || fromQuery || null;
  }, [directoryIdFromData, searchParams]);

  const handleGoBack = useCallback(() => {
    if (resolvedDirectoryId) {
      navigate(`/directory/${resolvedDirectoryId}`);
    } else {
      navigate('/');
    }
  }, [navigate, resolvedDirectoryId]);

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
