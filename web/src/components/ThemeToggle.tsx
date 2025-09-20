import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/Button/Button';
import { ThemeId, Theme } from '../types/theme';

interface ThemePreviewProps {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}

const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      className={`
        relative group flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-300
        ${isActive ? 'border-primary scale-105' : 'border-border hover:border-muted-foreground'}
        ${isHovered ? 'transform hover:scale-102' : ''}
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: theme.colors.card,
        borderColor: isActive ? theme.colors.primary : theme.colors.border,
      }}
    >
      {/* Theme color preview */}
      <div className="flex gap-1 mb-1">
        <div 
          className="w-4 h-4 rounded-full border"
          style={{ 
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border 
          }}
        />
        <div 
          className="w-4 h-4 rounded-full border"
          style={{ 
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.border 
          }}
        />
        <div 
          className="w-4 h-4 rounded-full border"
          style={{ 
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border 
          }}
        />
      </div>
      
      {/* Theme name */}
      <span 
        className="text-sm font-medium transition-colors"
        style={{ 
          color: isActive ? theme.colors.primary : theme.colors.foreground 
        }}
      >
        {theme.name}
      </span>
      
      {/* Active indicator */}
      {isActive && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
          style={{ 
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.background
          }}
        />
      )}
      
      {/* Hover glow effect */}
      {isHovered && !isActive && (
        <div 
          className="absolute inset-0 rounded-lg opacity-20 transition-opacity"
          style={{ 
            boxShadow: `0 0 20px ${theme.colors.primary}` 
          }}
        />
      )}
    </button>
  );
};

export const ThemeToggle = () => {
  const { currentTheme, setTheme, themes } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleThemeChange = (themeId: ThemeId) => {
    setTheme(themeId);
    // Auto-collapse after selection for better UX
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative">
      {/* Compact view */}
      {!isExpanded && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleExpanded}
          className="flex items-center gap-2 transition-all duration-300"
        >
          <div className="flex gap-1">
            <div 
              className="w-3 h-3 rounded-full border"
              style={{ 
                backgroundColor: currentTheme.colors.background,
                borderColor: currentTheme.colors.border 
              }}
            />
            <div 
              className="w-3 h-3 rounded-full border"
              style={{ 
                backgroundColor: currentTheme.colors.primary,
                borderColor: currentTheme.colors.border 
              }}
            />
          </div>
          <span className="text-sm font-medium">
            {currentTheme.name}
          </span>
          <svg 
            className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      )}

      {/* Expanded preview grid */}
      {isExpanded && (
        <div className="absolute top-0 left-0 z-50 p-4 rounded-lg border shadow-lg transition-all duration-300"
             style={{ 
               backgroundColor: currentTheme.colors.popover,
               borderColor: currentTheme.colors.border 
             }}>
          <div className="flex items-center justify-between mb-4">
            <h3 
              className="text-lg font-semibold"
              style={{ color: currentTheme.colors.foreground }}
            >
              Choose Theme
            </h3>
            <button
              onClick={toggleExpanded}
              className="p-1 rounded transition-colors"
              style={{ 
                color: currentTheme.colors.mutedForeground,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = currentTheme.colors.muted;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            {Object.values(themes).map((theme) => (
              <ThemePreview
                key={theme.id}
                theme={theme}
                isActive={currentTheme.id === theme.id}
                onClick={() => handleThemeChange(theme.id as ThemeId)}
              />
            ))}
          </div>
          
          {/* Description */}
          <p 
            className="text-xs mt-3 text-center opacity-70"
            style={{ color: currentTheme.colors.mutedForeground }}
          >
            Themes are applied instantly and saved automatically
          </p>
        </div>
      )}
      
      {/* Backdrop */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-40 transition-opacity duration-300"
          style={{ backgroundColor: currentTheme.colors.overlay }}
          onClick={toggleExpanded}
        />
      )}
    </div>
  );
};