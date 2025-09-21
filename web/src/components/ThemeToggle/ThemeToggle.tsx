import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button/Button';
import { ThemeId } from '../../types/theme';
import { IThemePreview } from './IThemeToggle';
import { themeToggleStyles, getThemePreviewClasses, getExpandIconClasses } from './ThemeToggle.styles';

const ThemePreview: React.FC<IThemePreview> = ({ theme, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      className={getThemePreviewClasses(isActive, isHovered)}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: theme.colors.card,
        borderColor: isActive ? theme.colors.primary : theme.colors.border,
      }}
    >
      {/* Theme color preview */}
      <div className={themeToggleStyles.themeColors}>
        <div 
          className={themeToggleStyles.themeColorDot}
          style={{ 
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border 
          }}
        />
        <div 
          className={themeToggleStyles.themeColorDot}
          style={{ 
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.border 
          }}
        />
        <div 
          className={themeToggleStyles.themeColorDot}
          style={{ 
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border 
          }}
        />
      </div>
      
      {/* Theme name */}
      <span 
        className={themeToggleStyles.themeName}
        style={{ 
          color: isActive ? theme.colors.primary : theme.colors.foreground 
        }}
      >
        {theme.name}
      </span>
      
      {/* Active indicator */}
      {isActive && (
        <div 
          className={themeToggleStyles.activeIndicator}
          style={{ 
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.background
          }}
        />
      )}
      
      {/* Hover glow effect */}
      {isHovered && !isActive && (
        <div 
          className={themeToggleStyles.hoverGlow}
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
    <div className={themeToggleStyles.container}>
      {/* Compact view */}
      {!isExpanded && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleExpanded}
          className={themeToggleStyles.compactButton}
        >
          <div className={themeToggleStyles.colorPreviewContainer}>
            <div 
              className={themeToggleStyles.colorPreview}
              style={{ 
                backgroundColor: currentTheme.colors.background,
                borderColor: currentTheme.colors.border 
              }}
            />
            <div 
              className={themeToggleStyles.colorPreview}
              style={{ 
                backgroundColor: currentTheme.colors.primary,
                borderColor: currentTheme.colors.border 
              }}
            />
          </div>
          <span className={themeToggleStyles.compactButtonText}>
            {currentTheme.name}
          </span>
          <svg 
            className={getExpandIconClasses(isExpanded)}
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
        <div 
          className={themeToggleStyles.popover}
          style={{ 
            backgroundColor: currentTheme.colors.popover,
            borderColor: currentTheme.colors.border 
          }}
        >
          <div className={themeToggleStyles.popoverHeader}>
            <h3 
              className={themeToggleStyles.popoverTitle}
              style={{ color: currentTheme.colors.foreground }}
            >
              Choose Theme
            </h3>
            <button
              onClick={toggleExpanded}
              className={themeToggleStyles.closeButton}
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
              <svg className={themeToggleStyles.closeIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className={themeToggleStyles.themeGrid}>
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
            className={themeToggleStyles.description}
            style={{ color: currentTheme.colors.mutedForeground }}
          >
            Themes are applied instantly and saved automatically
          </p>
        </div>
      )}
      
      {/* Backdrop */}
      {isExpanded && (
        <div 
          className={themeToggleStyles.backdrop}
          style={{ backgroundColor: currentTheme.colors.overlay }}
          onClick={toggleExpanded}
        />
      )}
    </div>
  );
};