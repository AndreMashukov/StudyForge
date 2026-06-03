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
  success: string;
  successForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
  sidebar: string;
  dropdown: string;
  overlay: string;
  glass: string;
  glow: string;
}

export interface Theme {
  name: string;
  id: ThemeId;
  colors: ThemeColors;
}

export type ThemeId = 'light' | 'linear';

export interface ThemeContextType {
  currentTheme: Theme;
  currentThemeId: ThemeId;
  themes: Record<ThemeId, Theme>;
  setTheme: (themeId: ThemeId) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  storageKey?: string;
  defaultTheme?: ThemeId;
}
