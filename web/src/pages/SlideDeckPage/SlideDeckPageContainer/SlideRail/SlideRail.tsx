import React, { useEffect, useRef } from 'react';
import { cn } from '../../../../lib/utils';
import { SlideThumbnail } from '../SlideThumbnail';
import { ISlideRail } from './ISlideRail';

const SCROLL_PADDING_PX = 8;

/**
 * Scrolls only the rail (not the page) so the active thumbnail is fully visible.
 * Works for both the vertical desktop rail and the horizontal mobile strip.
 */
const scrollChildIntoView = (container: HTMLElement, child: HTMLElement) => {
  const bounds = container.getBoundingClientRect();
  const item = child.getBoundingClientRect();
  let top = 0;
  let left = 0;

  if (item.top < bounds.top) top = item.top - bounds.top - SCROLL_PADDING_PX;
  else if (item.bottom > bounds.bottom) top = item.bottom - bounds.bottom + SCROLL_PADDING_PX;

  if (item.left < bounds.left) left = item.left - bounds.left - SCROLL_PADDING_PX;
  else if (item.right > bounds.right) left = item.right - bounds.right + SCROLL_PADDING_PX;

  if (top === 0 && left === 0) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollBy({ top, left, behavior: reduceMotion ? 'auto' : 'smooth' });
};

export const SlideRail: React.FC<ISlideRail> = ({ slides, currentIndex, onSelect, className }) => {
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const revealActive = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="true"]');
      if (active) scrollChildIntoView(list, active);
    };
    revealActive();

    // Re-reveal when the rail flips between vertical (lg) and horizontal layouts.
    const observer = new ResizeObserver(revealActive);
    observer.observe(list);
    return () => observer.disconnect();
  }, [currentIndex, slides.length]);

  return (
    <nav
      aria-label="Slides"
      className={cn('min-h-0 shrink-0 lg:flex lg:w-52 lg:flex-col', className)}
    >
      <ol
        ref={listRef}
        className={cn(
          'flex gap-1 overflow-x-auto pb-1',
          // lg:pb-16 lets the last thumbnail scroll clear of the floating agent button.
          'lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-16 lg:pr-1',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted'
        )}
      >
        {slides.map((slide, index) => (
          <li key={slide.id || index} className="shrink-0">
            <SlideThumbnail
              slide={slide}
              index={index}
              isActive={index === currentIndex}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
};
