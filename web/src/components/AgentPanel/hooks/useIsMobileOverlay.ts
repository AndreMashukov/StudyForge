import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT_PX = 768;

/** Narrow viewport check for the overlay layout (only tracked when `enabled`). */
export function useIsMobileOverlay(enabled: boolean): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [enabled]);

  return isMobile;
}
