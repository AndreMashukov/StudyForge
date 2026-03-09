import { useEffect, useCallback } from 'react';
import { useAppFullscreen } from '../contexts/FullscreenContext';

export const useFullscreen = () => {
  const { isAppFullscreen, toggleFullscreen, exitFullscreen } =
    useAppFullscreen();

  // Allow Escape key to exit fullscreen
  useEffect(() => {
    if (!isAppFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFullscreen();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAppFullscreen, exitFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  return { isFullscreen: isAppFullscreen, handleToggleFullscreen };
};
