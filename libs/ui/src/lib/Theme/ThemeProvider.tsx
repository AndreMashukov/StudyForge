'use client';

import * as React from 'react';
import {
  type Theme,
  type ThemeContextType,
  type ThemeId,
  type ThemeProviderProps,
} from './ITheme';
import { defaultTheme as fallbackTheme, themes } from './themes';

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
);

const toCssVariableName = (key: string) =>
  `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

const toCssVariableValue = (value: string) => {
  if (value.startsWith('rgb(') || value.startsWith('rgba(')) {
    return value.replace(/rgba?\(([^)]+)\)/, '$1');
  }

  return value;
};

const getInitialTheme = (storageKey: string, defaultTheme: ThemeId): ThemeId => {
  if (typeof window === 'undefined') {
    return defaultTheme;
  }

  const savedTheme = window.localStorage.getItem(storageKey);
  if (
    savedTheme === 'dark' ||
    savedTheme === 'semidark' ||
    !savedTheme ||
    !(savedTheme in themes)
  ) {
    return defaultTheme;
  }

  return savedTheme as ThemeId;
};

const applyThemeToRoot = (theme: Theme, themeId: ThemeId, isDark: boolean) => {
  const root = document.documentElement;

  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(toCssVariableName(key), toCssVariableValue(value));
  });

  root.classList.remove('dark', 'light', 'linear');
  root.classList.add(themeId);

  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    return;
  }

  root.classList.add('light');
  root.style.colorScheme = 'light';
};

export function ThemeProvider({
  children,
  storageKey = 'theme',
  defaultTheme = fallbackTheme,
}: ThemeProviderProps) {
  const [currentThemeId, setCurrentThemeId] = React.useState<ThemeId>(() =>
    getInitialTheme(storageKey, defaultTheme)
  );

  const currentTheme = themes[currentThemeId];
  const isDark = currentThemeId === 'linear';

  const setTheme = React.useCallback(
    (themeId: ThemeId) => {
      setCurrentThemeId(themeId);

      try {
        window.localStorage.setItem(storageKey, themeId);
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    },
    [storageKey]
  );

  const toggleTheme = React.useCallback(() => {
    setTheme(isDark ? 'light' : 'linear');
  }, [isDark, setTheme]);

  React.useEffect(() => {
    applyThemeToRoot(currentTheme, currentThemeId, isDark);
  }, [currentTheme, currentThemeId, isDark]);

  const value = React.useMemo<ThemeContextType>(
    () => ({
      currentTheme,
      currentThemeId,
      themes,
      setTheme,
      toggleTheme,
      isDark,
    }),
    [currentTheme, currentThemeId, isDark, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

export const useThemeColors = () => {
  const { currentTheme } = useTheme();
  return currentTheme.colors;
};
