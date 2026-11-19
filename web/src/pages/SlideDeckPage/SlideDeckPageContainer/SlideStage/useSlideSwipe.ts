import { PointerEvent, useCallback, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 50;
/** Horizontal travel must dominate vertical travel by this factor to count as a swipe. */
const SWIPE_DIRECTION_RATIO = 1.5;

interface IUseSlideSwipeParams {
  onPrev: () => void;
  onNext: () => void;
}

/** Touch/pen swipe left → next, right → previous. Mouse drags are ignored. */
export const useSlideSwipe = ({ onPrev, onNext }: IUseSlideSwipeParams) => {
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return;
    startRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || start.pointerId !== event.pointerId) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
        return;
      }
      if (dx < 0) {
        onNext();
      } else {
        onPrev();
      }
    },
    [onPrev, onNext]
  );

  const onPointerCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
};
