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
    try {
      setCurrentThemeId(themeId);
      localStorage.setItem('theme', themeId);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
      // Continue with theme change even if localStorage fails
      setCurrentThemeId(themeId);
    }
  };

  const isDark = currentThemeId === 'dark' || currentThemeId === 'linear' || currentThemeId === 'semidark';

  // Apply theme to document root for CSS custom properties if needed
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme colors as CSS custom properties for compatibility
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      
      // Convert RGB string to space-separated values for CSS variables
      // e.g., "rgb(255 255 255)" -> "255 255 255"
      // Handle both "rgb(255 255 255)" and "rgba(255 255 255 / 0.5)" formats
      let rgbValues = value;
      if (value.startsWith('rgb(') || value.startsWith('rgba(')) {
        rgbValues = value.replace(/rgba?\(([^)]+)\)/, '$1');
      }
      root.style.setProperty(cssVarName, rgbValues);
    });

    // Remove all theme classes first
    root.classList.remove('dark', 'light', 'semidark', 'linear');
    
    // Add the current theme class for theme-specific styling
    root.classList.add(currentThemeId);
    
    // Update the class for dark mode detection (for compatibility)
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      // Update color-scheme for better browser integration
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [currentTheme, currentThemeId, isDark]);

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