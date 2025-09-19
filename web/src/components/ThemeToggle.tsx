import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/Button/Button';
import { ThemeId } from '../types/theme';

export const ThemeToggle = () => {
  const { currentTheme, setTheme, themes } = useTheme();

  const handleThemeChange = (themeId: ThemeId) => {
    setTheme(themeId);
  };

  return (
    <div className="flex gap-2 p-4 border rounded-lg" style={{ 
      backgroundColor: currentTheme.colors.card,
      borderColor: currentTheme.colors.border,
      borderRadius: currentTheme.colors.radius,
    }}>
      <span style={{ color: currentTheme.colors.foreground }} className="text-sm font-medium">
        Theme:
      </span>
      {Object.values(themes).map((theme) => (
        <Button
          key={theme.id}
          variant={currentTheme.id === theme.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleThemeChange(theme.id as ThemeId)}
        >
          {theme.name}
        </Button>
      ))}
    </div>
  );
};