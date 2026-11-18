import { useEffect, useRef, useState } from 'react';
import { nextRevealLength } from '../../../services/agentConversation';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveals reply text that arrives in chunks (about one write per 800ms) as a
 * steady stream. Shows the full text at once when not `animate` or when the
 * user prefers reduced motion.
 */
export function useSmoothedText(target: string, animate: boolean): string {
  const [shownLength, setShownLength] = useState(target.length);
  const shownRef = useRef(target.length);

  useEffect(() => {
    if (!animate || prefersReducedMotion()) {
      shownRef.current = target.length;
      setShownLength(target.length);
      return;
    }
    if (shownRef.current > target.length) {
      // Reply reset (retry): start over from the new text.
      shownRef.current = 0;
    }

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = nextRevealLength({
        displayedLength: shownRef.current,
        targetLength: target.length,
        elapsedMs: now - last,
      });
      last = now;
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShownLength(next);
      }
      if (next < target.length) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [animate, target]);

  return target.slice(0, Math.min(shownLength, target.length));
}
