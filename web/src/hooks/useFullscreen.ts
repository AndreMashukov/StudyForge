import { useState, useCallback, useEffect } from 'react';

export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err: Error) => {
        console.debug('Fullscreen request failed:', err.message);
      });
    } else {
      document.exitFullscreen().catch((err: Error) => {
        console.debug('Exit fullscreen failed:', err.message);
      });
    }
  }, []);

  return { isFullscreen, handleToggleFullscreen };
};
