const path = require('path');

const crowdsNowTheme = {
  fontFamily: {
    sans: ['Inter_400Regular'],
    'sans-medium': ['Inter_500Medium'],
    'sans-semibold': ['Inter_600SemiBold'],
    'sans-bold': ['Inter_700Bold'],
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
    container: '16px',
  },
  boxShadow: {
    raised: '0 8px 6px rgba(0, 0, 0, 0.06)',
    field: '0 6px 24px rgba(32, 34, 44, 0.1)',
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
    'error-container': 'rgb(var(--error-container) / <alpha-value>)',
    'on-error-container': 'rgb(var(--on-error-container) / <alpha-value>)',
    border: 'rgb(var(--border) / <alpha-value>)',
    input: 'rgb(var(--input) / <alpha-value>)',
    ring: 'rgb(var(--ring) / <alpha-value>)',
    surface: {
      high: 'rgb(var(--surface-container-high) / <alpha-value>)',
      lowest: 'rgb(var(--surface-container-lowest) / <alpha-value>)',
    },
    outline: 'rgb(var(--outline) / <alpha-value>)',
    'outline-variant': 'rgb(var(--outline-variant) / <alpha-value>)',
    'switch-off': 'rgb(var(--switch-off) / <alpha-value>)',
    'tab-bar': 'rgb(var(--tab-bar) / <alpha-value>)',
  },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    path.join(__dirname, 'src/**/*.{ts,tsx}'),
    path.join(__dirname, '.storybook/**/*.{ts,tsx}'),
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: crowdsNowTheme,
  },
  plugins: [],
};
