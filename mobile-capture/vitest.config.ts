import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared-types': path.resolve(
        __dirname,
        '../libs/shared-types/src/index.ts',
      ),
    },
  },
  test: {
    include: ['mobile-capture/src/**/*.spec.ts'],
  },
});
