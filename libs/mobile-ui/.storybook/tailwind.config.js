const path = require('path');
const plugin = require('tailwindcss/plugin');
const nativeConfig = require('../tailwind.config.js');

/** Storybook/web uses Google Fonts — native builds keep Expo font file names. */
module.exports = {
  ...nativeConfig,
  content: [
    path.join(__dirname, '../src/**/*.{ts,tsx}'),
    path.join(__dirname, './**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      ...nativeConfig.theme.extend,
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        'sans-medium': ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        'sans-semibold': ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        'sans-bold': ['Hanken Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    ...(nativeConfig.plugins ?? []),
    plugin(({ addUtilities }) => {
      addUtilities({
        '.font-sans': { fontWeight: '400' },
        '.font-sans-medium': { fontWeight: '500' },
        '.font-sans-semibold': { fontWeight: '600' },
        '.font-sans-bold': { fontWeight: '700' },
      });
    }),
  ],
};
