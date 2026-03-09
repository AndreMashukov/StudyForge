import React, { createContext, useContext, useState, useCallback } from 'react';

interface IFullscreenContext {
  isAppFullscreen: boolean;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
}

const FullscreenContext = createContext<IFullscreenContext>({
  isAppFullscreen: false,
  enterFullscreen: () => undefined,
  exitFullscreen: () => undefined,
  toggleFullscreen: () => undefined,
});

export const FullscreenProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => setIsAppFullscreen(true), []);
  const exitFullscreen = useCallback(() => setIsAppFullscreen(false), []);
  const toggleFullscreen = useCallback(
    () => setIsAppFullscreen((prev) => !prev),
    []
  );

  return (
    <FullscreenContext.Provider
      value={{
        isAppFullscreen,
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
      }}
    >
      {children}
    </FullscreenContext.Provider>
  );
};

export const useAppFullscreen = () => useContext(FullscreenContext);
