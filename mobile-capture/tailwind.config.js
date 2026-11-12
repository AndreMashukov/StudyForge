// eslint-disable-next-line @nx/enforce-module-boundaries -- Node config file: the @studyforge/mobile-ui alias only resolves in Metro/TS
const mobileUiConfig = require('../libs/mobile-ui/tailwind.config.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../libs/mobile-ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: mobileUiConfig.theme.extend,
  },
  plugins: [],
};
