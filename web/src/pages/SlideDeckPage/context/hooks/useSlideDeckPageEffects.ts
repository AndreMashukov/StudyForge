import { useEffect } from 'react';
import { ISlideDeckPageHandlers } from '../../types/ISlideDeckPageHandlers';
import { ISlideDeckFullscreen } from '../../types/ISlideDeckFullscreen';
import { normalizeSlideParam } from '../../utils/slideParam';

interface IUseSlideDeckPageEffectsParams {
  slidesLength: number;
  handlers: ISlideDeckPageHandlers;
  fullscreen: ISlideDeckFullscreen;
}

/** Keys typed into fields, menus or dialogs (e.g. the agent chat) must not change slides. */
const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return target.closest('[role="dialog"], [role="menu"], [aria-modal="true"]') !== null;
};

export const useSlideDeckPageEffects = ({
  slidesLength,
  handlers,
  fullscreen,
}: IUseSlideDeckPageEffectsParams) => {
  const {
    rawSlideParam,
    handleNormalizeSlideParam,
    handlePrevSlide,
    handleNextSlide,
    handleFirstSlide,
    handleLastSlide,
  } = handlers;
  const { isFullscreen, handleExitFullscreen, handleBrowserFullscreenChange } = fullscreen;

  // Rewrite an invalid or out-of-range ?slide=N once the slide count is known.
  useEffect(() => {
    const canonical = normalizeSlideParam(rawSlideParam, slidesLength);
    if (canonical !== null) {
      handleNormalizeSlideParam(canonical);
    }
  }, [rawSlideParam, slidesLength, handleNormalizeSlideParam]);

  // Keyboard navigation.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (isInteractiveTarget(event.target)) return;

      switch (event.key) {
        case 'ArrowLeft':
        case 'PageUp':
          if (slidesLength === 0) return;
          handlePrevSlide();
          break;
        case 'ArrowRight':
        case 'PageDown':
          if (slidesLength === 0) return;
          handleNextSlide();
          break;
        case 'Home':
          if (slidesLength === 0) return;
          handleFirstSlide();
          break;
        case 'End':
          if (slidesLength === 0) return;
          handleLastSlide();
          break;
        case 'Escape':
          // Browser fullscreen handles Esc itself; this covers the app-only fallback.
          if (isFullscreen && !document.fullscreenElement) {
            handleExitFullscreen();
          }
          return;
        default:
          return;
      }
      event.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    slidesLength,
    isFullscreen,
    handlePrevSlide,
    handleNextSlide,
    handleFirstSlide,
    handleLastSlide,
    handleExitFullscreen,
  ]);

  // Leaving browser fullscreen (Esc, F11) also leaves app fullscreen.
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleBrowserFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleBrowserFullscreenChange);
  }, [handleBrowserFullscreenChange]);

  // Never strand the app in fullscreen after navigating away.
  useEffect(() => () => handleExitFullscreen(), [handleExitFullscreen]);
};
