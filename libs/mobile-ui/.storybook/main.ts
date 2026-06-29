import type { StorybookConfig } from '@storybook/react-native-web-vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const libRoot = path.resolve(storybookDir, '..');
const mobileUiEntry = path.resolve(libRoot, 'src/index.ts');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      pluginReactOptions: {
        jsxImportSource: 'nativewind',
        babel: {
          presets: ['nativewind/babel'],
        },
      },
    },
  },
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias as Record<string, string>),
      'react-native': 'react-native-web',
      '@studyforge/mobile-ui': mobileUiEntry,
    };

    viteConfig.css = {
      ...(viteConfig.css ?? {}),
      postcss: {
        plugins: [
          require('tailwindcss')({ config: path.join(libRoot, 'tailwind.config.js') }),
          require('autoprefixer')(),
        ],
      },
    };

    return viteConfig;
  },
};

export default config;
