import { Theme, ThemeId } from '../types/theme';

export const themes: Record<ThemeId, Theme> = {
  light: {
    name: 'Lumen',
    id: 'light',
    colors: {
      background: 'rgb(255 255 255)', // #FFFFFF - Pure white
      foreground: 'rgb(15 23 42)', // #0F172A - Very dark slate for maximum contrast
      card: 'rgb(255 255 255)', // #FFFFFF
      cardForeground: 'rgb(15 23 42)', // #0F172A
      popover: 'rgb(255 255 255)', // #FFFFFF
      popoverForeground: 'rgb(15 23 42)', // #0F172A
      primary: 'rgb(79 70 229)', // #4F46E5
      primaryForeground: 'rgb(255 255 255)', // #FFFFFF
      secondary: 'rgb(248 250 252)', // #F8FAFC - Very light slate
      secondaryForeground: 'rgb(15 23 42)', // #0F172A
      muted: 'rgb(248 250 252)', // #F8FAFC
      mutedForeground: 'rgb(51 65 85)', // #334155 - Dark slate-600 for better contrast
      accent: 'rgb(79 70 229)', // #4F46E5
      accentForeground: 'rgb(255 255 255)', // #FFFFFF
      destructive: 'rgb(220 38 38)', // #DC2626
      destructiveForeground: 'rgb(255 255 255)', // #FFFFFF
      border: 'rgb(226 232 240)', // #E2E8F0 - Slate-200
      input: 'rgb(248 250 252)', // #F8FAFC
      ring: 'rgb(79 70 229)', // #4F46E5
      radius: '0.5rem',
      // Advanced design tokens
      sidebar: 'rgb(251 251 252)', // #FBFBFC - Slightly off-white
      dropdown: 'rgb(255 255 255)', // #FFFFFF - Pure white dropdown
      overlay: 'rgba(15 23 42 / 0.6)', // Dark overlay with better opacity
      glass: 'rgba(255 255 255 / 0.9)', // More opaque glass effect
      glow: 'rgba(79 70 229 / 0.15)', // Primary color glow
    },
  },
  linear: {
    name: 'Bit Depth',
    id: 'linear',
    colors: {
      background: 'rgb(8 8 8)', // #080808 - Even darker than current
      foreground: 'rgb(255 255 255)', // #FFFFFF
      card: 'rgb(12 12 12)', // #0C0C0C - Slightly lighter than background
      cardForeground: 'rgb(255 255 255)', // #FFFFFF
      popover: 'rgb(12 12 12)', // #0C0C0C
      popoverForeground: 'rgb(255 255 255)', // #FFFFFF
      primary: 'rgb(139 92 246)', // #8B5CF6 - Purple like Linear
      primaryForeground: 'rgb(255 255 255)', // #FFFFFF
      secondary: 'rgb(18 18 18)', // #121212
      secondaryForeground: 'rgb(255 255 255)', // #FFFFFF
      muted: 'rgb(20 20 20)', // #141414
      mutedForeground: 'rgb(156 163 175)', // #9CA3AF
      accent: 'rgb(139 92 246)', // #8B5CF6
      accentForeground: 'rgb(255 255 255)', // #FFFFFF
      destructive: 'rgb(239 68 68)', // #EF4444
      destructiveForeground: 'rgb(255 255 255)', // #FFFFFF
      border: 'rgb(31 31 31)', // #1F1F1F
      input: 'rgb(16 16 16)', // #101010
      ring: 'rgb(139 92 246)', // #8B5CF6
      radius: '0.375rem', // Smaller radius like Linear
      // Advanced design tokens
      sidebar: 'rgb(10 10 10)', // #0A0A0A - Slightly lighter than background
      dropdown: 'rgb(15 15 15)', // #0F0F0F - For dropdown menus
      overlay: 'rgba(0 0 0 / 0.9)', // Very dark overlay
      glass: 'rgba(12 12 12 / 0.8)', // Glass effect background
      glow: 'rgba(139 92 246 / 0.2)', // Primary color glow
    },
  },
};

export const defaultTheme: ThemeId = 'linear';