import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeContextType, ThemeId } from '../types/theme';
import { themes, defaultTheme } from '../config/themes';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>(() => {
    // Try to get theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as ThemeId) || defaultTheme;
  });

  const currentTheme = themes[currentThemeId];

  const setTheme = (themeId: ThemeId) => {
    setCurrentThemeId(themeId);
    localStorage.setItem('theme', themeId);
  };

  const isDark = currentThemeId === 'dark' || currentThemeId === 'linear';

  // Apply theme to document root for CSS custom properties if needed
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme colors as CSS custom properties for compatibility
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    // Update the class for dark mode detection
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [currentTheme, isDark]);

  const value: ThemeContextType = {
    currentTheme,
    themes,
    setTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for getting theme-aware colors
export const useThemeColors = () => {
  const { currentTheme } = useTheme();
  return currentTheme.colors;
};