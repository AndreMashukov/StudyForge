import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ISlideDeckPageHandlers } from '../../types/ISlideDeckPageHandlers';
import { useFullscreen } from '../../../../hooks/useFullscreen';

export const useSlideDeckPageHandlers = (
  directoryIdFromData?: string | null
): ISlideDeckPageHandlers => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { isFullscreen, handleToggleFullscreen } = useFullscreen();

  const resolvedDirectoryId = useMemo(() => {
    const fromData = directoryIdFromData?.trim();
    const fromQuery = searchParams.get('directoryId')?.trim();
    return fromData || fromQuery || null;
  }, [directoryIdFromData, searchParams]);

  const handleNavigateBack = useCallback(() => {
    if (resolvedDirectoryId) {
      navigate(`/directory/${resolvedDirectoryId}`);
    } else {
      navigate('/');
    }
  }, [navigate, resolvedDirectoryId]);

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
