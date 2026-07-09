import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['functions/src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@shared-types': path.resolve(__dirname, 'libs/shared-types/src/index.ts'),
    },
  },
});
