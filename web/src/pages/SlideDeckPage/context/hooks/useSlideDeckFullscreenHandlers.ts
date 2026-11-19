import { useCallback } from 'react';
import { useAppFullscreen } from '../../../../contexts/FullscreenContext';
import { ISlideDeckFullscreen } from '../../types/ISlideDeckFullscreen';

/**
 * Fullscreen = app fullscreen (hides app bar + agent launcher) plus best-effort browser
 * fullscreen on <html>. Targeting <html> rather than the slide deck element keeps portals
 * (menus, tooltips, toasts) visible; iPhone Safari has no element fullscreen, so app
 * fullscreen alone is the fallback there.
 */
export const useSlideDeckFullscreenHandlers = (): ISlideDeckFullscreen => {
  const { isAppFullscreen, enterFullscreen, exitFullscreen } = useAppFullscreen();

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => undefined);
    }
    exitFullscreen();
  }, [exitFullscreen]);

  const handleEnterFullscreen = useCallback(() => {
    enterFullscreen();
    const root = document.documentElement;
    if (document.fullscreenEnabled && typeof root.requestFullscreen === 'function') {
      void root.requestFullscreen().catch(() => undefined);
    }
  }, [enterFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    if (isAppFullscreen) {
      handleExitFullscreen();
    } else {
      handleEnterFullscreen();
    }
  }, [isAppFullscreen, handleExitFullscreen, handleEnterFullscreen]);

  const handleBrowserFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      exitFullscreen();
    }
  }, [exitFullscreen]);

  return {
    isFullscreen: isAppFullscreen,
    handleToggleFullscreen,
    handleExitFullscreen,
    handleBrowserFullscreenChange,
  };
};
