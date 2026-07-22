import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const libRoot = path.resolve(storybookDir, '..');
const uiEntry = path.resolve(libRoot, 'src/index.ts');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        // Use Storybook's Vite defaults instead of the library build vite.config.
        viteConfigPath: path.join(storybookDir, 'vite.config.ts'),
      },
    },
  },
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias as Record<string, string>),
      '@study-forge/ui': uiEntry,
    };

    viteConfig.css = {
      ...(viteConfig.css ?? {}),
      postcss: {
        plugins: [
          require('tailwindcss')({
            config: path.join(storybookDir, 'tailwind.config.js'),
          }),
          require('autoprefixer')(),
        ],
      },
    };

    return viteConfig;
  },
};

export default config;
