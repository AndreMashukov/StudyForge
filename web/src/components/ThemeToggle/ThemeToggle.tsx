import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button/Button';
import { cn } from '../../lib/utils';

export const ThemeToggle = () => {
  const { isDark, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 relative"
      onClick={() => setTheme(isDark ? 'light' : 'linear')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Sun className={cn(
        'absolute h-5 w-5 transition-all duration-300',
        isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
      )} />
      <Moon className={cn(
        'absolute h-5 w-5 transition-all duration-300',
        isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
      )} />
    </Button>
  );
};
