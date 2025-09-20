import { Theme, ThemeId } from '../types/theme';

export const themes: Record<ThemeId, Theme> = {
  dark: {
    name: 'Eclipse',
    id: 'dark',
    colors: {
      background: 'rgb(11 11 11)', // #0B0B0B
      foreground: 'rgb(255 255 255)', // #FFFFFF
      card: 'rgb(16 16 16)', // #101010
      cardForeground: 'rgb(255 255 255)', // #FFFFFF
      popover: 'rgb(16 16 16)', // #101010
      popoverForeground: 'rgb(255 255 255)', // #FFFFFF
      primary: 'rgb(79 70 229)', // #4F46E5
      primaryForeground: 'rgb(255 255 255)', // #FFFFFF
      secondary: 'rgb(20 20 20)', // #141414
      secondaryForeground: 'rgb(255 255 255)', // #FFFFFF
      muted: 'rgb(24 24 24)', // #181818
      mutedForeground: 'rgb(163 163 163)', // #A3A3A3
      accent: 'rgb(79 70 229)', // #4F46E5
      accentForeground: 'rgb(255 255 255)', // #FFFFFF
      destructive: 'rgb(220 38 38)', // #DC2626
      destructiveForeground: 'rgb(255 255 255)', // #FFFFFF
      border: 'rgb(39 39 42)', // #27272A
      input: 'rgb(20 20 20)', // #141414
      ring: 'rgb(79 70 229)', // #4F46E5
      radius: '0.5rem',
      // Advanced design tokens
      sidebar: 'rgb(14 14 14)', // #0E0E0E - Slightly lighter than background
      dropdown: 'rgb(18 18 18)', // #121212 - For dropdown menus
      overlay: 'rgba(0 0 0 / 0.8)', // Dark overlay
      glass: 'rgba(16 16 16 / 0.8)', // Glass effect background
      glow: 'rgba(79 70 229 / 0.15)', // Primary color glow
    },
  },
  light: {
    name: 'Lumen',
    id: 'light',
    colors: {
      background: 'rgb(255 255 255)', // #FFFFFF
      foreground: 'rgb(9 9 11)', // #09090B
      card: 'rgb(255 255 255)', // #FFFFFF
      cardForeground: 'rgb(9 9 11)', // #09090B
      popover: 'rgb(255 255 255)', // #FFFFFF
      popoverForeground: 'rgb(9 9 11)', // #09090B
      primary: 'rgb(79 70 229)', // #4F46E5
      primaryForeground: 'rgb(255 255 255)', // #FFFFFF
      secondary: 'rgb(244 244 245)', // #F4F4F5
      secondaryForeground: 'rgb(9 9 11)', // #09090B
      muted: 'rgb(244 244 245)', // #F4F4F5
      mutedForeground: 'rgb(113 113 122)', // #71717A
      accent: 'rgb(79 70 229)', // #4F46E5
      accentForeground: 'rgb(255 255 255)', // #FFFFFF
      destructive: 'rgb(220 38 38)', // #DC2626
      destructiveForeground: 'rgb(255 255 255)', // #FFFFFF
      border: 'rgb(228 228 231)', // #E4E4E7
      input: 'rgb(244 244 245)', // #F4F4F5
      ring: 'rgb(79 70 229)', // #4F46E5
      radius: '0.5rem',
      // Advanced design tokens
      sidebar: 'rgb(248 248 249)', // #F8F8F9 - Slightly darker than background
      dropdown: 'rgb(255 255 255)', // #FFFFFF - White dropdown
      overlay: 'rgba(0 0 0 / 0.5)', // Light overlay
      glass: 'rgba(255 255 255 / 0.8)', // Glass effect background
      glow: 'rgba(79 70 229 / 0.1)', // Primary color glow
    },
  },
  linear: {
    name: 'Code Abyss',
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
  semidark: {
    name: 'Twilight',
    id: 'semidark',
    colors: {
      background: 'rgb(24 24 27)', // #18181B - Zinc-900
      foreground: 'rgb(244 244 245)', // #F4F4F5 - Zinc-100
      card: 'rgb(39 39 42)', // #27272A - Zinc-800
      cardForeground: 'rgb(244 244 245)', // #F4F4F5
      popover: 'rgb(39 39 42)', // #27272A
      popoverForeground: 'rgb(244 244 245)', // #F4F4F5
      primary: 'rgb(99 102 241)', // #6366F1 - Indigo-500
      primaryForeground: 'rgb(255 255 255)', // #FFFFFF
      secondary: 'rgb(63 63 70)', // #3F3F46 - Zinc-700
      secondaryForeground: 'rgb(244 244 245)', // #F4F4F5
      muted: 'rgb(63 63 70)', // #3F3F46 - Zinc-700
      mutedForeground: 'rgb(161 161 170)', // #A1A1AA - Zinc-400
      accent: 'rgb(99 102 241)', // #6366F1 - Indigo-500
      accentForeground: 'rgb(255 255 255)', // #FFFFFF
      destructive: 'rgb(239 68 68)', // #EF4444 - Red-500
      destructiveForeground: 'rgb(255 255 255)', // #FFFFFF
      border: 'rgb(63 63 70)', // #3F3F46 - Zinc-700
      input: 'rgb(39 39 42)', // #27272A - Zinc-800
      ring: 'rgb(99 102 241)', // #6366F1 - Indigo-500
      radius: '0.5rem',
      // Advanced design tokens
      sidebar: 'rgb(32 32 36)', // #202024 - Slightly lighter than background
      dropdown: 'rgb(44 44 47)', // #2C2C2F - For dropdown menus
      overlay: 'rgba(0 0 0 / 0.6)', // Medium overlay
      glass: 'rgba(39 39 42 / 0.8)', // Glass effect background
      glow: 'rgba(99 102 241 / 0.12)', // Primary color glow
    },
  },
};

export const defaultTheme: ThemeId = 'dark';