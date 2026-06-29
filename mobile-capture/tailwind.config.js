const obsidianPulseTheme = {
  fontFamily: {
    sans: ['HankenGrotesk_400Regular'],
    'sans-medium': ['HankenGrotesk_500Medium'],
    'sans-semibold': ['HankenGrotesk_600SemiBold'],
    'sans-bold': ['HankenGrotesk_700Bold'],
  },
  borderRadius: {
    lg: 'var(--radius)',
    md: 'calc(var(--radius) + 4px)',
    sm: 'calc(var(--radius) - 4px)',
    xl: '1.5rem',
    '2xl': '1rem',
  },
  spacing: {
    gutter: '12px',
    container: '20px',
  },
  colors: {
    background: 'rgb(var(--background) / <alpha-value>)',
    foreground: 'rgb(var(--foreground) / <alpha-value>)',
    card: 'rgb(var(--card) / <alpha-value>)',
    primary: {
      DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
      foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
    },
    accent: 'rgb(var(--accent) / <alpha-value>)',
    muted: {
      DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
      foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
    },
    destructive: 'rgb(var(--destructive) / <alpha-value>)',
    border: 'rgb(var(--border) / <alpha-value>)',
    input: 'rgb(var(--input) / <alpha-value>)',
    ring: 'rgb(var(--ring) / <alpha-value>)',
    surface: {
      high: 'rgb(var(--surface-container-high) / <alpha-value>)',
    },
    outline: 'rgb(var(--outline) / <alpha-value>)',
    'outline-variant': 'rgb(var(--outline-variant) / <alpha-value>)',
  },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../libs/mobile-ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: obsidianPulseTheme,
  },
  plugins: [],
};
