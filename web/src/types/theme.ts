export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
  // Advanced design tokens
  sidebar: string;
  dropdown: string;
  overlay: string;
  glass: string;
  glow: string;
}

export interface Theme {
  name: string;
  id: string;
  colors: ThemeColors;
}

export type ThemeId = 'dark' | 'light' | 'linear' | 'semidark';

export interface ThemeContextType {
  currentTheme: Theme;
  themes: Record<ThemeId, Theme>;
  setTheme: (themeId: ThemeId) => void;
  isDark: boolean;
}