import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the current screen size is mobile
 * @param breakpoint - The breakpoint in pixels to determine mobile view (default: 768)
 * @returns boolean indicating if the screen is mobile-sized
 */
export const useIsMobile = (breakpoint = 768): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    
    // Check on mount
    checkMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
};
